import { Router } from "express";
import mongoose from "mongoose";

import { auth } from  "../middleware/auth.js";

import User from "../models/User.js";
import DetectiveCase from "../models/DetectiveCase.js";
import DetectiveClue from "../models/DetectiveClue.js";
import DetectiveQuestion from "../models/DetectiveQuestion.js";
import DetectiveHint from "../models/DetectiveHint.js";
import DetectiveAttempt from "../models/DetectiveAttempt.js";
import DetectiveAnswer from "../models/DetectiveAnswer.js";

const router = Router();

/* =========================================================
   HELPERS
========================================================= */

function validId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function getUserId(req) {
  return req.user?._id || req.user?.id;
}

function isAttemptExpired(attempt) {
  return (
    attempt.expiresAt &&
    new Date() >= new Date(attempt.expiresAt)
  );
}

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
    _id: clue._id,
    sequenceNumber: clue.sequenceNumber,
    title: clue.title,
    description: clue.description,
    evidence: clue.evidence,
    evidenceType: clue.evidenceType,
    timestamp: clue.timestamp,
    location: clue.location,
    relatedSuspect: clue.relatedSuspect,
    unlockCondition: clue.unlockCondition
  };
}

async function markAttemptExpired(attempt) {
  if (attempt.status === "TIME_EXPIRED") {
    return attempt;
  }

  attempt.status = "TIME_EXPIRED";
  attempt.completedAt = new Date();

  /*
   * Prototype behaviour:
   * Preserve whatever score the participant has
   * already earned.
   */
  await attempt.save();

  await User.findByIdAndUpdate(
    attempt.participantId,
    {
      round2Status: "TIME_EXPIRED",
      round2Score: Number(attempt.score || 0)
    }
  );

  return attempt;
}

async function getAttemptOrFail(req, res) {
  const { attemptId } = req.params;

  if (!validId(attemptId)) {
    res.status(400).json({
      message: "Invalid attempt id."
    });

    return null;
  }

  const participantId = getUserId(req);

  const attempt =
    await DetectiveAttempt.findById(attemptId);

  if (!attempt) {
    res.status(404).json({
      message: "Attempt not found."
    });

    return null;
  }

  if (
    String(attempt.participantId) !==
    String(participantId)
  ) {
    res.status(403).json({
      message: "You cannot access this attempt."
    });

    return null;
  }

  if (
    attempt.status === "CASE_COMPLETED"
  ) {
    res.status(409).json({
      message: "This case is already completed.",
      status: attempt.status,
      score: attempt.score
    });

    return null;
  }

  if (
    attempt.status === "TIME_EXPIRED"
  ) {
    res.status(409).json({
      message: "Round 2 time has expired.",
      status: "TIME_EXPIRED",
      score: attempt.score
    });

    return null;
  }

  if (isAttemptExpired(attempt)) {
    await markAttemptExpired(attempt);

    res.status(409).json({
      message: "Round 2 time has expired.",
      status: "TIME_EXPIRED",
      score: attempt.score,
      expiresAt: attempt.expiresAt
    });

    return null;
  }

  return attempt;
}

/* =========================================================
   ROUND 2 ACCESS
========================================================= */

router.get("/access", auth, async (req, res) => {
  try {
    const userId = getUserId(req);

    const user =
      await User.findById(userId).lean();

    if (!user) {
      return res.status(401).json({
        message: "User not found."
      });
    }

    const qualified =
      user.round2Qualified === true ||
      String(user.round2Status || "")
        .trim()
        .toUpperCase() === "QUALIFIED" ||
      String(user.qualificationStatus || "")
        .trim()
        .toUpperCase() === "QUALIFIED";

    const activeCase =
      await getActiveCase();

    return res.json({
      round: 2,

      unlocked:
        qualified && !!activeCase,

      qualificationStatus:
        user.qualificationStatus ||
        (
          qualified
            ? "QUALIFIED"
            : "NOT_QUALIFIED"
        ),

      round2Qualified:
        user.round2Qualified === true,

      round2Status:
        user.round2Status || null,

      caseAvailable:
        !!activeCase
    });

  } catch (error) {
    console.error(
      "Round 2 access error:",
      error
    );

    return res.status(500).json({
      message:
        "Failed to check Round 2 access."
    });
  }
});
/* =========================================================
   START ATTEMPT
========================================================= */

router.post(
  "/attempts",
  auth,
  async (req, res) => {
    try {
      const userId = getUserId(req);

      const user =
        await User.findById(userId);

      if (!user) {
        return res.status(401).json({
          message: "User not found."
        });
      }

      const qualified =
  user.round2Qualified === true ||
  String(user.round2Status || "")
    .trim()
    .toUpperCase() === "QUALIFIED" ||
  String(user.qualificationStatus || "")
    .trim()
    .toUpperCase() === "QUALIFIED";
      if (!qualified) {
        return res.status(403).json({
          message:
            "You are not qualified for Round 2."
        });
      }

      const caseItem =
        await getActiveCase();

      if (!caseItem) {
        return res.status(404).json({
          message:
            "No published detective case is available."
        });
      }

      let attempt =
        await DetectiveAttempt.findOne({
          caseId: caseItem._id,
          participantId: userId
        }).sort({
          createdAt: -1
        });

      /*
       * Existing completed attempt cannot be restarted.
       */
      if (
        attempt &&
        attempt.status === "CASE_COMPLETED"
      ) {
        return res.status(409).json({
          message:
            "You have already completed Round 2.",
          attemptId: attempt._id,
          status: attempt.status,
          score: attempt.score
        });
      }

      /*
       * Expired attempt cannot be restarted.
       */
      if (
        attempt &&
        (
          attempt.status === "TIME_EXPIRED" ||
          isAttemptExpired(attempt)
        )
      ) {
        await markAttemptExpired(attempt);

        return res.status(409).json({
          message:
            "Round 2 time has expired.",
          status: "TIME_EXPIRED",
          score: Number(attempt.score || 0),
          expiresAt: attempt.expiresAt
        });
      }

      /*
       * Resume an active attempt.
       */
      if (attempt) {
        return res.json({
          message:
            "Existing Round 2 attempt resumed.",
          attempt
        });
      }

      const now = new Date();

      const expiresAt =
        new Date(
          now.getTime() +
          Number(caseItem.timeLimit) * 1000
        );

      attempt =
        await DetectiveAttempt.create({
          caseId: caseItem._id,
          participantId: userId,
          teamId: user.teamId || "",
          startedAt: now,
          expiresAt,
          currentClue: 1,
          currentQuestion: 1,
          score: 0,
          hintsUsed: 0,
          usedHintIds: [],
          status: "CLUE_AVAILABLE"
        });

      await User.findByIdAndUpdate(
        userId,
        {
          round2Status: "IN_PROGRESS"
        }
      );

      return res.status(201).json({
        message: "Detective case started.",
        attempt
      });
    } catch (error) {
      console.error(
        "Start attempt error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to start detective case."
      });
    }
  }
);

/* =========================================================
   GET ATTEMPT / CURRENT GAME STATE
========================================================= */

router.get(
  "/attempts/:attemptId",
  auth,
  async (req, res) => {
    try {
      const attempt =
        await getAttemptOrFail(req, res);

      if (!attempt) return;

      const caseItem =
        await DetectiveCase.findById(
          attempt.caseId
        ).lean();

      if (!caseItem) {
        return res.status(404).json({
          message: "Case not found."
        });
      }

      const clue =
        await DetectiveClue.findOne({
          caseId: attempt.caseId,
          sequenceNumber:
            attempt.currentClue,
          isPublished: true
        }).lean();

      const question =
        await DetectiveQuestion.findOne({
          caseId: attempt.caseId,
          sequenceNumber:
            attempt.currentQuestion,
          isPublished: true
        }).lean();

      const hints =
        await DetectiveHint.find({
          caseId: attempt.caseId,
          isEnabled: true
        })
          .sort({
            sequenceNumber: 1
          })
          .lean();

      const availableHints =
        hints.filter(hint => {
          if (
            hint.questionId &&
            question &&
            String(hint.questionId) !==
              String(question._id)
          ) {
            return false;
          }

          if (
            hint.clueId &&
            clue &&
            String(hint.clueId) !==
              String(clue._id)
          ) {
            return false;
          }

          return true;
        });

      return res.json({
        attempt: {
          _id: attempt._id,
          caseId: attempt.caseId,
          startedAt: attempt.startedAt,
          expiresAt: attempt.expiresAt,
          currentClue: attempt.currentClue,
          currentQuestion:
            attempt.currentQuestion,
          score: attempt.score,
          hintsUsed: attempt.hintsUsed,
          usedHintIds:
            attempt.usedHintIds || [],
          status: attempt.status
        },

        case: {
          _id: caseItem._id,
          title: caseItem.title,
          description: caseItem.description,
          difficulty: caseItem.difficulty,
          timeLimit: caseItem.timeLimit,
          maximumScore:
            caseItem.maximumScore,
          suspects: caseItem.suspects,
          finalAnswerFields:
            caseItem.finalAnswerFields
        },

        clue: publicClue(clue),

        question: question
          ? {
              _id: question._id,
              sequenceNumber:
                question.sequenceNumber,
              clueId: question.clueId,
              question:
                question.question,
              options:
                question.options,
              points:
                question.points
            }
          : null,

        hints: availableHints.map(
          hint => ({
            _id: hint._id,
            sequenceNumber:
              hint.sequenceNumber,
            hintText:
              hint.hintText,
            penalty:
              hint.penalty
          })
        )
      });
    } catch (error) {
      console.error(
        "Get attempt error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to load detective attempt."
      });
    }
  }
);

/* =========================================================
   ANSWER QUESTION
========================================================= */

router.post(
  "/attempts/:attemptId/answer",
  auth,
  async (req, res) => {
    try {
      const attempt =
        await getAttemptOrFail(req, res);

      if (!attempt) return;

      const {
        questionId,
        selectedOption
      } = req.body;

      if (!validId(questionId)) {
        return res.status(400).json({
          message:
            "Invalid question id."
        });
      }

      if (
        !Number.isInteger(
          Number(selectedOption)
        )
      ) {
        return res.status(400).json({
          message:
            "A valid option must be selected."
        });
      }

      const question =
        await DetectiveQuestion.findById(
          questionId
        );

      if (!question) {
        return res.status(404).json({
          message:
            "Question not found."
        });
      }

      if (
        String(question.caseId) !==
        String(attempt.caseId)
      ) {
        return res.status(403).json({
          message:
            "Question does not belong to this case."
        });
      }

      if (
        Number(question.sequenceNumber) !==
        Number(attempt.currentQuestion)
      ) {
        return res.status(409).json({
          message:
            "This question is not currently available."
        });
      }

      const alreadyAnswered =
        await DetectiveAnswer.findOne({
          attemptId: attempt._id,
          questionId: question._id
        });

      if (alreadyAnswered) {
        return res.status(409).json({
          message:
            "This question has already been answered."
        });
      }

      const option =
        Number(selectedOption);

      if (
        option < 0 ||
        option >= question.options.length
      ) {
        return res.status(400).json({
          message:
            "Selected option is invalid."
        });
      }

      const isCorrect =
        option ===
        Number(question.correctOption);

      const pointsAwarded =
        isCorrect
          ? Number(question.points || 0)
          : 0;

      await DetectiveAnswer.create({
        attemptId: attempt._id,
        questionId: question._id,
        selectedOption: option,
        isCorrect,
        pointsAwarded,
        submittedAt: new Date()
      });

      attempt.score =
        Number(attempt.score || 0) +
        pointsAwarded;

      /*
       * Question completed.
       */
      attempt.status =
        "QUESTION_COMPLETED";

      /*
       * Find the next question.
       */
      const nextQuestion =
        await DetectiveQuestion.findOne({
          caseId: attempt.caseId,
          sequenceNumber: {
            $gt:
              question.sequenceNumber
          },
          isPublished: true
        })
          .sort({
            sequenceNumber: 1
          })
          .lean();

      if (nextQuestion) {
        attempt.currentQuestion =
          nextQuestion.sequenceNumber;

        /*
         * Move to the clue associated with
         * the next question if configured.
         */
        if (nextQuestion.clueId) {
          const nextClue =
            await DetectiveClue.findById(
              nextQuestion.clueId
            ).lean();

          if (nextClue) {
            attempt.currentClue =
              nextClue.sequenceNumber;
          }
        }

        attempt.status =
          "CLUE_AVAILABLE";
      } else {
        /*
         * No questions remain.
         * Participant can now submit final answer.
         */
        attempt.status =
          "FINAL_ANSWER";
      }

      await attempt.save();

      return res.json({
        message:
          "Answer submitted successfully.",
        isCorrect,
        pointsAwarded,
        score: attempt.score,
        status: attempt.status,
        currentClue:
          attempt.currentClue,
        currentQuestion:
          attempt.currentQuestion
      });
    } catch (error) {
      console.error(
        "Answer question error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to submit answer."
      });
    }
  }
);

/* =========================================================
   HINT
========================================================= */

async function useHint(req, res) {
  try {
    const attempt =
      await getAttemptOrFail(req, res);

    if (!attempt) return;

    const {
      attemptId,
      hintId
    } = req.params;

    if (!validId(hintId)) {
      return res.status(400).json({
        message: "Invalid hint id."
      });
    }

    const hint =
      await DetectiveHint.findById(
        hintId
      );

    if (!hint) {
      return res.status(404).json({
        message: "Hint not found."
      });
    }

    if (
      String(hint.caseId) !==
      String(attempt.caseId)
    ) {
      return res.status(403).json({
        message:
          "Hint does not belong to this case."
      });
    }

    if (!hint.isEnabled) {
      return res.status(400).json({
        message:
          "This hint is disabled."
      });
    }

    const alreadyUsed =
      (attempt.usedHintIds || [])
        .some(
          id =>
            String(id) ===
            String(hint._id)
        );

    if (alreadyUsed) {
      return res.status(409).json({
        message:
          "This hint has already been used."
      });
    }

    const question =
      await DetectiveQuestion.findOne({
        caseId: attempt.caseId,
        sequenceNumber:
          attempt.currentQuestion,
        isPublished: true
      }).lean();

    const clue =
      await DetectiveClue.findOne({
        caseId: attempt.caseId,
        sequenceNumber:
          attempt.currentClue,
        isPublished: true
      }).lean();

    if (
      hint.questionId &&
      (!question ||
        String(hint.questionId) !==
          String(question._id))
    ) {
      return res.status(403).json({
        message:
          "This hint is not available for the current question."
      });
    }

    if (
      hint.clueId &&
      (!clue ||
        String(hint.clueId) !==
          String(clue._id))
    ) {
      return res.status(403).json({
        message:
          "This hint is not available for the current clue."
      });
    }

    const penalty =
      Number(hint.penalty || 0);

    attempt.score =
      Math.max(
        0,
        Number(attempt.score || 0) -
          penalty
      );

    attempt.hintsUsed =
      Number(attempt.hintsUsed || 0) +
      1;

    attempt.usedHintIds =
      attempt.usedHintIds || [];

    attempt.usedHintIds.push(
      hint._id
    );

    attempt.status =
      "HINT_USED";

    await attempt.save();

    return res.json({
      message:
        "Hint used successfully.",
      hint: hint.hintText,
      penalty,
      score: attempt.score,
      hintsUsed:
        attempt.hintsUsed,
      status:
        attempt.status
    });
  } catch (error) {
    console.error(
      "Use hint error:",
      error
    );

    return res.status(500).json({
      message:
        "Failed to use hint."
    });
  }
}

router.post(
  "/attempt/:attemptId/hint/:hintId",
  auth,
  useHint
);

router.post(
  "/attempts/:attemptId/hints/:hintId/use",
  auth,
  useHint
);

/* =========================================================
   FINAL ANSWER
========================================================= */

router.post(
  "/attempts/:attemptId/final",
  auth,
  async (req, res) => {
    try {
      const attempt =
        await getAttemptOrFail(req, res);

      if (!attempt) return;

      if (
        attempt.status !==
        "FINAL_ANSWER"
      ) {
        return res.status(409).json({
          message:
            "Final answer is not available yet.",
          status:
            attempt.status
        });
      }

      const caseItem =
        await DetectiveCase.findById(
          attempt.caseId
        ).lean();

      if (!caseItem) {
        return res.status(404).json({
          message: "Case not found."
        });
      }

      const finalAnswer =
        req.body || {};

      const requiredFields =
        caseItem.finalAnswerFields ||
        [];

      for (const field of requiredFields) {
        if (
          field === "evidence"
        ) {
          if (
            !Array.isArray(
              finalAnswer.evidence
            ) ||
            finalAnswer.evidence.length ===
              0
          ) {
            return res.status(400).json({
              message:
                "Evidence is required."
            });
          }

          continue;
        }

        if (
          field === "explanation"
        ) {
          if (
            !String(
              finalAnswer.explanation ||
                ""
            ).trim()
          ) {
            return res.status(400).json({
              message:
                "Explanation is required."
            });
          }

          continue;
        }

        if (
          !String(
            finalAnswer[field] || ""
          ).trim()
        ) {
          return res.status(400).json({
            message:
              `${field} is required.`
          });
        }
      }

      const solution =
        caseItem.finalSolution || {};

      const scoring =
        caseItem.scoring || {};

      let finalScore =
        Number(attempt.score || 0);

      let correctCount = 0;

      /*
       * Culprit
       */
      if (
        finalAnswer.culprit &&
        solution.culprit &&
        String(
          finalAnswer.culprit
        ).trim().toLowerCase() ===
          String(
            solution.culprit
          ).trim().toLowerCase()
      ) {
        finalScore +=
          Number(scoring.culprit || 0);

        correctCount++;
      } else if (
        finalAnswer.culprit
      ) {
        finalScore +=
          Number(
            scoring.wrongFinal || 0
          );
      }

      /*
       * Time
       */
      if (
        finalAnswer.time &&
        solution.time &&
        String(
          finalAnswer.time
        ).trim().toLowerCase() ===
          String(
            solution.time
          ).trim().toLowerCase()
      ) {
        finalScore +=
          Number(scoring.time || 0);

        correctCount++;
      }

      /*
       * Method
       */
      if (
        finalAnswer.method &&
        solution.method &&
        String(
          finalAnswer.method
        ).trim().toLowerCase() ===
          String(
            solution.method
          ).trim().toLowerCase()
      ) {
        finalScore +=
          Number(scoring.method || 0);

        correctCount++;
      }

      /*
       * Motive
       */
      if (
        finalAnswer.motive &&
        solution.motive &&
        String(
          finalAnswer.motive
        ).trim().toLowerCase() ===
          String(
            solution.motive
          ).trim().toLowerCase()
      ) {
        finalScore +=
          Number(scoring.motive || 0);

        correctCount++;
      }

      /*
       * Evidence
       */
      if (
        Array.isArray(
          finalAnswer.evidence
        ) &&
        Array.isArray(
          solution.evidenceClues
        )
      ) {
        const submitted =
          finalAnswer.evidence.map(
            String
          );

        const expected =
          solution.evidenceClues.map(
            String
          );

        const allPresent =
          expected.every(
            item =>
              submitted.includes(item)
          );

        if (allPresent) {
          finalScore +=
            Number(
              scoring.evidence || 0
            );

          correctCount++;
        }
      }

      /*
       * Explanation
       *
       * Prototype:
       * store it but do not score it separately.
       */

      attempt.score =
        Math.max(
          0,
          finalScore
        );

      attempt.finalAnswer =
        finalAnswer;

      attempt.status =
        "CASE_COMPLETED";

      attempt.completedAt =
        new Date();

      await attempt.save();

      await User.findByIdAndUpdate(
        attempt.participantId,
        {
          round2Status:
            "COMPLETED",
          round2Score:
            attempt.score,
          $inc: {
            gamesCompleted: 1
          }
        }
      );

      return res.json({
        message:
          "Detective case completed.",
        status:
          attempt.status,
        score:
          attempt.score,
        maximumScore:
          caseItem.maximumScore,
        correctFinalFields:
          correctCount,
        completedAt:
          attempt.completedAt
      });
    } catch (error) {
      console.error(
        "Final answer error:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to submit final answer."
      });
    }
  }
);

export default router;
