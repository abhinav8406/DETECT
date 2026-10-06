import { Router } from "express";
import mongoose from "mongoose";

import { auth } from "../middleware/auth.js";

import User from "../models/User.js";
import DetectiveCase from "../models/DetectiveCase.js";
import DetectiveClue from "../models/DetectiveClue.js";
import DetectiveQuestion from "../models/DetectiveQuestion.js";
import DetectiveHint from "../models/DetectiveHint.js";
import DetectiveAttempt from "../models/DetectiveAttempt.js";
import DetectiveAnswer from "../models/DetectiveAnswer.js";

const router = Router();

async function getActiveCase() {
  return DetectiveCase.findOne({
    status: "PUBLISHED"
  }).sort({
    createdAt: -1
  });
}

function publicClue(clue) {
  if (!clue) return null;

  return {
    id: clue._id,
    sequenceNumber: clue.sequenceNumber,
    title: clue.title,
    description: clue.description,
    evidence: clue.evidence,
    evidenceType: clue.evidenceType,
    timestamp: clue.timestamp,
    location: clue.location,
    relatedSuspect: clue.relatedSuspect
  };
}

/*
 * Get an active attempt owned by the logged-in participant.
 */
async function getAttemptOrFail(req, res) {
  const attempt = await DetectiveAttempt.findOne({
    _id: req.params.attemptId,
    participantId: req.user._id
  });

  if (!attempt) {
    res.status(404).json({
      message: "Attempt not found"
    });

    return null;
  }

  if (
    ["CASE_COMPLETED", "TIME_EXPIRED"].includes(
      attempt.status
    )
  ) {
    res.status(409).json({
      message: "This attempt is no longer active",
      status: attempt.status
    });

    return null;
  }

  if (
    attempt.expiresAt &&
    new Date() > new Date(attempt.expiresAt)
  ) {
    attempt.status = "TIME_EXPIRED";

    await attempt.save();

    await User.findByIdAndUpdate(
      attempt.participantId,
      {
        round2Status: "TIME_EXPIRED"
      }
    );

    res.status(409).json({
      message: "Time expired",
      status: attempt.status
    });

    return null;
  }

  return attempt;
}

/*
 * ROUND 2 ACCESS
 */
router.get("/access", auth, async (req, res) => {
  const qualified =
    req.user.qualificationStatus === "QUALIFIED";

  const activeCase = await getActiveCase();

  res.json({
    round: 2,
    unlocked: qualified && !!activeCase,
    qualificationStatus:
      req.user.qualificationStatus,
    caseAvailable: !!activeCase
  });
});

/*
 * START ROUND 2
 */
router.post("/attempts", auth, async (req, res) => {
  if (
    req.user.qualificationStatus !==
    "QUALIFIED"
  ) {
    return res.status(403).json({
      message:
        "Round 2 is locked for this participant"
    });
  }

  const activeCase = await getActiveCase();

  if (!activeCase) {
    return res.status(404).json({
      message: "No published detective case"
    });
  }

  let attempt = await DetectiveAttempt.findOne({
    caseId: activeCase._id,
    participantId: req.user._id
  });

  /*
   * Completed attempts cannot be restarted.
   */
  if (attempt?.status === "CASE_COMPLETED") {
    return res.status(409).json({
      message: "Round 2 already completed"
    });
  }

  /*
   * If an old attempt expired, don't reuse it.
   */
  if (
    attempt &&
    attempt.expiresAt &&
    new Date() > new Date(attempt.expiresAt)
  ) {
    attempt.status = "TIME_EXPIRED";
    await attempt.save();

    await User.findByIdAndUpdate(
      req.user._id,
      {
        round2Status: "TIME_EXPIRED"
      }
    );

    attempt = null;
  }

  if (!attempt) {
    const startedAt = new Date();

    const expiresAt = new Date(
      startedAt.getTime() +
        activeCase.timeLimit * 1000
    );

    attempt = await DetectiveAttempt.create({
      caseId: activeCase._id,
      participantId: req.user._id,
      teamId: req.user.teamId,

      startedAt,
      expiresAt,

      currentClue: 1,
      currentQuestion: 1,

      score: 0,
      hintsUsed: 0,

      status: "CLUE_AVAILABLE"
    });

    await User.findByIdAndUpdate(
      req.user._id,
      {
        $inc: {
          gamesPlayed: 1
        },

        round2Status: "IN_PROGRESS"
      }
    );
  }

  res.json({
    attemptId: attempt._id,
    status: attempt.status,
    startedAt: attempt.startedAt,
    expiresAt: attempt.expiresAt,
    score: attempt.score
  });
});

/*
 * GET CURRENT ATTEMPT STATE
 */
router.get(
  "/attempts/:attemptId",
  auth,
  async (req, res) => {
    const attempt =
      await DetectiveAttempt.findOne({
        _id: req.params.attemptId,
        participantId: req.user._id
      }).populate("caseId");

    if (!attempt) {
      return res.status(404).json({
        message: "Attempt not found"
      });
    }

    /*
     * Timer validation happens on backend.
     */
    if (
      !["CASE_COMPLETED", "TIME_EXPIRED"].includes(
        attempt.status
      ) &&
      attempt.expiresAt &&
      new Date() > new Date(attempt.expiresAt)
    ) {
      attempt.status = "TIME_EXPIRED";

      await attempt.save();

      await User.findByIdAndUpdate(
        attempt.participantId,
        {
          round2Status: "TIME_EXPIRED"
        }
      );
    }

    const clue = await DetectiveClue.findOne({
      caseId: attempt.caseId._id,
      sequenceNumber: attempt.currentClue,
      isPublished: true
    });

    const question =
      await DetectiveQuestion.findOne({
        caseId: attempt.caseId._id,
        sequenceNumber: attempt.currentQuestion,
        isPublished: true
      });

    const hints = question
      ? await DetectiveHint.find({
          caseId: attempt.caseId._id,
          questionId: question._id,
          isEnabled: true
        }).sort({
          sequenceNumber: 1
        })
      : [];

    res.json({
      attempt: {
        id: attempt._id,
        status: attempt.status,
        startedAt: attempt.startedAt,
        expiresAt: attempt.expiresAt,

        currentClue: attempt.currentClue,
        currentQuestion:
          attempt.currentQuestion,

        score: attempt.score,
        hintsUsed: attempt.hintsUsed,

        finalAnswer:
          attempt.finalAnswer || null
      },

      case: {
        title: attempt.caseId.title,
        description:
          attempt.caseId.description,

        difficulty:
          attempt.caseId.difficulty,

        suspects:
          attempt.caseId.suspects,

        /*
         * These are safe to expose because
         * they describe what the participant
         * must submit, NOT the solution.
         */
        finalAnswerFields:
          attempt.caseId.finalAnswerFields
      },

      clue: publicClue(clue),

      question: question
        ? {
            id: question._id,
            sequenceNumber:
              question.sequenceNumber,

            question: question.question,

            options: question.options,

            points: question.points
          }
        : null,

      hints: hints.map(h => ({
        id: h._id,
        sequenceNumber:
          h.sequenceNumber,
        penalty: h.penalty
      })),

      usedHintIds:
        attempt.usedHintIds.map(id =>
          id.toString()
        )
    });
  }
);

/*
 * QUESTION ANSWER
 */
router.post(
  "/attempts/:attemptId/answer",
  auth,
  async (req, res) => {
    const attempt =
      await getAttemptOrFail(req, res);

    if (!attempt) return;

    const {
      questionId,
      selectedOption
    } = req.body;

    if (
      !mongoose.isValidObjectId(questionId) ||
      !Number.isInteger(selectedOption)
    ) {
      return res.status(400).json({
        message: "Invalid answer payload"
      });
    }

    const question =
      await DetectiveQuestion.findOne({
        _id: questionId,
        caseId: attempt.caseId,
        sequenceNumber:
          attempt.currentQuestion,
        isPublished: true
      });

    if (!question) {
      return res.status(403).json({
        message:
          "Question is not the current question"
      });
    }

    const existing =
      await DetectiveAnswer.findOne({
        attemptId: attempt._id,
        questionId
      });

    if (existing) {
      return res.status(409).json({
        message: "Question already answered"
      });
    }

    const isCorrect =
      selectedOption === question.correctOption;

    const pointsAwarded =
      isCorrect ? question.points : 0;

    await DetectiveAnswer.create({
      attemptId: attempt._id,
      questionId,
      selectedOption,
      isCorrect,
      pointsAwarded,
      submittedAt: new Date()
    });

    attempt.score += pointsAwarded;

    const nextQuestion =
      await DetectiveQuestion.findOne({
        caseId: attempt.caseId,
        sequenceNumber:
          attempt.currentQuestion + 1,
        isPublished: true
      });

    if (nextQuestion) {
      attempt.currentQuestion += 1;

      if (nextQuestion.clueId) {
        const nextClue =
          await DetectiveClue.findById(
            nextQuestion.clueId
          );

        if (nextClue) {
          attempt.currentClue =
            nextClue.sequenceNumber;
        }
      }

      attempt.status = "CLUE_AVAILABLE";
    } else {
      attempt.status = "FINAL_ANSWER";
    }

    await attempt.save();

    req.app
      .get("io")
      .to("admins")
      .emit("attempt:update", {
        attemptId: attempt._id,
        participantId: req.user._id,
        score: attempt.score,
        status: attempt.status,
        currentClue:
          attempt.currentClue,
        currentQuestion:
          attempt.currentQuestion
      });

    res.json({
      correct: isCorrect,
      pointsAwarded,
      score: attempt.score,
      nextStatus: attempt.status
    });
  }
);

/*
 * USE HINT
 */
router.post(
  "/attempts/:attemptId/hints/:hintId/use",
  auth,
  async (req, res) => {
    const attempt =
      await getAttemptOrFail(req, res);

    if (!attempt) return;

    const hint =
      await DetectiveHint.findOne({
        _id: req.params.hintId,
        caseId: attempt.caseId,
        isEnabled: true
      });

    if (!hint) {
      return res.status(404).json({
        message: "Hint unavailable"
      });
    }

    if (
      attempt.usedHintIds.some(
        id =>
          id.toString() ===
          hint._id.toString()
      )
    ) {
      return res.status(409).json({
        message: "Hint already used"
      });
    }

    attempt.usedHintIds.push(
      hint._id
    );

    attempt.hintsUsed += 1;

    attempt.score -= hint.penalty;

    attempt.status = "HINT_USED";

    await attempt.save();

    req.app
      .get("io")
      .to("admins")
      .emit("attempt:update", {
        attemptId: attempt._id,
        participantId: req.user._id,
        score: attempt.score,
        status: attempt.status,
        hintsUsed:
          attempt.hintsUsed
      });

    res.json({
      hintText: hint.hintText,
      penalty: hint.penalty,
      score: attempt.score,
      hintsUsed: attempt.hintsUsed
    });
  }
);

/*
 * FINAL ANSWER
 */
router.post(
  "/attempts/:attemptId/final",
  auth,
  async (req, res) => {
    const attempt =
      await getAttemptOrFail(req, res);

    if (!attempt) return;

    if (
      attempt.status !== "FINAL_ANSWER"
    ) {
      return res.status(409).json({
        message:
          "Final answer is not available yet"
      });
    }

    const activeCase =
      await DetectiveCase.findById(
        attempt.caseId
      );

    if (!activeCase) {
      return res.status(404).json({
        message: "Case not found"
      });
    }

    const answer = req.body || {};

    /*
     * Backend determines which fields are required.
     */
    const requiredFields =
      activeCase.finalAnswerFields || [];

    const missingFields = [];

    for (const field of requiredFields) {
      if (field === "evidence") {
        if (
          !Array.isArray(
            answer.evidenceClues
          ) ||
          answer.evidenceClues.length === 0
        ) {
          missingFields.push(field);
        }

        continue;
      }

      if (
        typeof answer[field] !== "string" ||
        !answer[field].trim()
      ) {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      return res.status(400).json({
        message:
          "Complete all required final-answer fields.",
        missingFields
      });
    }

    const solution =
      activeCase.finalSolution || {};

    const scoring =
      activeCase.scoring || {};

    const submittedEvidence =
      Array.isArray(answer.evidenceClues)
        ? answer.evidenceClues
        : [];

    /*
     * Calculate each component independently.
     */
    const culpritCorrect =
      !requiredFields.includes("culprit") ||
      answer.culprit === solution.culprit;

    const timeCorrect =
      !requiredFields.includes("time") ||
      answer.time === solution.time;

    const methodCorrect =
      !requiredFields.includes("method") ||
      answer.method === solution.method;

    const motiveCorrect =
      !requiredFields.includes("motive") ||
      answer.motive === solution.motive;

    let evidenceCorrect = true;

    if (
      requiredFields.includes("evidence")
    ) {
      const expectedEvidence =
        solution.evidenceClues || [];

      /*
       * Every configured critical evidence
       * item must be selected.
       */
      evidenceCorrect =
        expectedEvidence.length > 0 &&
        expectedEvidence.every(
          clueId =>
            submittedEvidence.includes(
              clueId
            )
        );
    }

    const explanationCorrect =
      !requiredFields.includes(
        "explanation"
      ) ||
      (
        typeof answer.explanation ===
          "string" &&
        answer.explanation.trim().length > 0
      );

    let finalPoints = 0;

    if (
      requiredFields.includes("culprit") &&
      culpritCorrect
    ) {
      finalPoints +=
        scoring.culprit || 0;
    }

    if (
      requiredFields.includes("time") &&
      timeCorrect
    ) {
      finalPoints +=
        scoring.time || 0;
    }

    if (
      requiredFields.includes("method") &&
      methodCorrect
    ) {
      finalPoints +=
        scoring.method || 0;
    }

    if (
      requiredFields.includes("motive") &&
      motiveCorrect
    ) {
      finalPoints +=
        scoring.motive || 0;
    }

    if (
      requiredFields.includes("evidence") &&
      evidenceCorrect
    ) {
      finalPoints +=
        scoring.evidence || 0;
    }

    /*
     * Explanation currently acts as a required
     * field but has no automatic score because
     * the specification doesn't define an
     * explanation scoring value.
     */
    const allRequiredCorrect =
      culpritCorrect &&
      timeCorrect &&
      methodCorrect &&
      motiveCorrect &&
      evidenceCorrect &&
      explanationCorrect;

    /*
     * Wrong final accusation penalty.
     *
     * Only apply it when the configured
     * solution itself was not completely solved.
     */
    if (!allRequiredCorrect) {
      finalPoints +=
        scoring.wrongFinal || 0;
    }

    attempt.score += finalPoints;

    attempt.finalAnswer = {
      culprit:
        answer.culprit || "",

      time:
        answer.time || "",

      method:
        answer.method || "",

      motive:
        answer.motive || "",

      evidenceClues:
        submittedEvidence,

      explanation:
        answer.explanation || "",

      result: {
        culpritCorrect,
        timeCorrect,
        methodCorrect,
        motiveCorrect,
        evidenceCorrect,
        explanationCorrect,
        allCorrect: allRequiredCorrect
      },

      finalPoints
    };

    attempt.status =
      "CASE_COMPLETED";

    attempt.completedAt =
      new Date();

    await attempt.save();

    /*
     * Persist Round 2 score on the participant.
     */
    await User.findByIdAndUpdate(
      attempt.participantId,
      {
        round2Status: "COMPLETED",
        round2Score: attempt.score,

        $inc: {
          gamesCompleted: 1
        }
      }
    );

    /*
     * Notify admin dashboard.
     */
    req.app
      .get("io")
      .to("admins")
      .emit("attempt:update", {
        attemptId: attempt._id,
        participantId:
          req.user._id,

        score: attempt.score,

        status:
          attempt.status,

        completedAt:
          attempt.completedAt
      });

    res.json({
      status: attempt.status,

      score: attempt.score,

      finalPoints,

      result:
        attempt.finalAnswer.result,

      completedAt:
        attempt.completedAt
    });
  }
);

export default router;
