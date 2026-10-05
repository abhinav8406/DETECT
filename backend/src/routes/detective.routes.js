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
  }).sort({ createdAt: -1 });
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
    new Date() >= new Date(attempt.expiresAt)
  ) {
    attempt.status = "TIME_EXPIRED";
    await attempt.save();

    res.status(409).json({
      message: "Time expired",
      status: attempt.status
    });

    return null;
  }

  return attempt;
}


/*
|--------------------------------------------------------------------------
| ROUND 2 ACCESS
|--------------------------------------------------------------------------
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
|--------------------------------------------------------------------------
| START / RESUME ATTEMPT
|--------------------------------------------------------------------------
*/

router.post("/attempts", auth, async (req, res) => {
  if (
    req.user.qualificationStatus !== "QUALIFIED"
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
  }).sort({ createdAt: -1 });


  /*
   * A completed attempt cannot be restarted.
   */
  if (attempt?.status === "CASE_COMPLETED") {
    return res.status(409).json({
      message: "Round 2 already completed"
    });
  }


  /*
   * If the stored attempt has expired,
   * mark it expired and create a fresh
   * development attempt.
   */
  if (
    attempt &&
    attempt.expiresAt &&
    new Date() >= new Date(attempt.expiresAt)
  ) {
    attempt.status = "TIME_EXPIRED";
    await attempt.save();

    attempt = null;
  }


  /*
   * Create a new attempt if there is
   * no active attempt.
   */
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
|--------------------------------------------------------------------------
| GET CURRENT ATTEMPT
|--------------------------------------------------------------------------
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
     * Backend is the source of truth
     * for timer state.
     */
    if (
      !["CASE_COMPLETED", "TIME_EXPIRED"].includes(
        attempt.status
      ) &&
      attempt.expiresAt &&
      new Date() >= new Date(attempt.expiresAt)
    ) {
      attempt.status = "TIME_EXPIRED";
      await attempt.save();
    }


    const clue =
      await DetectiveClue.findOne({
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
        currentQuestion: attempt.currentQuestion,
        score: attempt.score,
        hintsUsed: attempt.hintsUsed
      },

      case: {
        title: attempt.caseId.title,
        description: attempt.caseId.description,
        difficulty: attempt.caseId.difficulty,
        suspects: attempt.caseId.suspects
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

      hints: hints.map((h) => ({
        id: h._id,
        sequenceNumber: h.sequenceNumber,
        penalty: h.penalty
      })),

      usedHintIds:
        attempt.usedHintIds.map((id) =>
          id.toString()
        )
    });
  }
);


/*
|--------------------------------------------------------------------------
| SUBMIT QUESTION ANSWER
|--------------------------------------------------------------------------
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
          attempt.currentQuestion
      });


    if (!question) {
      return res.status(400).json({
        message:
          "Question is not valid for the current attempt"
      });
    }


    const alreadyAnswered =
      await DetectiveAnswer.findOne({
        attemptId: attempt._id,
        questionId: question._id
      });


    if (alreadyAnswered) {
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
      questionId: question._id,
      selectedOption,
      isCorrect,
      pointsAwarded,
      submittedAt: new Date()
    });


    attempt.score += pointsAwarded;


    /*
     * Move to next clue/question.
     */
    if (attempt.currentQuestion < 4) {
      attempt.currentQuestion += 1;
      attempt.currentClue += 1;
      attempt.status = "CLUE_AVAILABLE";
    } else {
      attempt.status = "FINAL_ANSWER";
    }


    await attempt.save();


    res.json({
      isCorrect,
      pointsAwarded,
      score: attempt.score,
      status: attempt.status,
      currentClue: attempt.currentClue,
      currentQuestion:
        attempt.currentQuestion
    });
  }
);


/*
|--------------------------------------------------------------------------
| USE HINT
|--------------------------------------------------------------------------
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
        message: "Hint not found or disabled"
      });
    }


    if (
      attempt.usedHintIds.some(
        (id) =>
          id.toString() ===
          hint._id.toString()
      )
    ) {
      return res.status(409).json({
        message: "Hint already used"
      });
    }


    attempt.usedHintIds.push(hint._id);

    attempt.hintsUsed += 1;

    attempt.score -= hint.penalty;


    await attempt.save();


    res.json({
      hintText: hint.hintText,
      penalty: hint.penalty,
      score: attempt.score
    });
  }
);


/*
|--------------------------------------------------------------------------
| FINAL ANSWER
|--------------------------------------------------------------------------
*/

router.post(
  "/attempts/:attemptId/final",
  auth,
  async (req, res) => {
    const attempt =
      await getAttemptOrFail(req, res);

    if (!attempt) return;


    if (attempt.status !== "FINAL_ANSWER") {
      return res.status(400).json({
        message:
          "Final answer is not available yet"
      });
    }


    const {
      culprit,
      time,
      method,
      motive,
      evidenceClues
    } = req.body;


    let awarded = 0;


    /*
     * Seeded case solution:
     * Aarav, evening, removed prototype,
     * prevent batch rejection.
     */
    if (culprit === "Aarav") {
      awarded += 100;
    }

    if (time === "Evening") {
      awarded += 50;
    }

    if (method === "Removed prototype") {
      awarded += 50;
    }

    if (motive === "Prevent batch rejection") {
      awarded += 50;
    }

    if (
      Array.isArray(evidenceClues) &&
      evidenceClues.length > 0
    ) {
      awarded += 100;
    }


    attempt.score += awarded;

    attempt.status = "CASE_COMPLETED";

    attempt.completedAt = new Date();


    await attempt.save();


    res.json({
      status: attempt.status,
      awarded,
      score: attempt.score,
      completedAt:
        attempt.completedAt
    });
  }
);


export default router;
