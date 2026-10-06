import { Router } from "express";
import mongoose from "mongoose";
import { Parser } from "json2csv";

import { auth, adminOnly } from "../middleware/auth.js";

import DetectiveCase from "../models/DetectiveCase.js";
import DetectiveClue from "../models/DetectiveClue.js";
import DetectiveQuestion from "../models/DetectiveQuestion.js";
import DetectiveHint from "../models/DetectiveHint.js";
import DetectiveAttempt from "../models/DetectiveAttempt.js";
import User from "../models/User.js";

const router = Router();

router.use(auth, adminOnly);

const DIFFICULTIES = [
  "Easy",
  "Medium",
  "Hard",
  "Expert"
];

const FINAL_FIELDS = [
  "culprit",
  "time",
  "method",
  "motive",
  "evidence",
  "explanation"
];

function validId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

function cleanString(value, fallback = "") {
  return typeof value === "string"
    ? value.trim()
    : fallback;
}

function numberValue(value, fallback = 0) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

function normalizeCasePayload(body) {
  const finalAnswerFields = Array.isArray(body.finalAnswerFields)
    ? [
        ...new Set(
          body.finalAnswerFields.filter(value =>
            FINAL_FIELDS.includes(value)
          )
        )
      ]
    : undefined;

  const suspects = Array.isArray(body.suspects)
    ? body.suspects
        .map(suspect => ({
          name: cleanString(suspect.name),
          description: cleanString(suspect.description)
        }))
        .filter(suspect => suspect.name)
    : undefined;

  const scoring = body.scoring || {};

  return {
    ...(body.title !== undefined && {
      title: cleanString(body.title)
    }),

    ...(body.description !== undefined && {
      description: cleanString(body.description)
    }),

    ...(body.difficulty !== undefined && {
      difficulty: body.difficulty
    }),

    ...(body.timeLimit !== undefined && {
      timeLimit: numberValue(body.timeLimit)
    }),

    ...(body.maximumScore !== undefined && {
      maximumScore: numberValue(body.maximumScore)
    }),

    ...(suspects !== undefined && {
      suspects
    }),

    ...(finalAnswerFields !== undefined && {
      finalAnswerFields
    }),

    ...(body.finalSolution !== undefined && {
      finalSolution: {
        culprit: cleanString(
          body.finalSolution?.culprit
        ),

        time: cleanString(
          body.finalSolution?.time
        ),

        method: cleanString(
          body.finalSolution?.method
        ),

        motive: cleanString(
          body.finalSolution?.motive
        ),

        evidenceClues: Array.isArray(
          body.finalSolution?.evidenceClues
        )
          ? body.finalSolution.evidenceClues.map(String)
          : [],

        explanation: cleanString(
          body.finalSolution?.explanation
        )
      }
    }),

    ...(body.scoring !== undefined && {
      scoring: {
        culprit: numberValue(
          scoring.culprit,
          100
        ),

        time: numberValue(
          scoring.time,
          50
        ),

        method: numberValue(
          scoring.method,
          50
        ),

        motive: numberValue(
          scoring.motive,
          50
        ),

        evidence: numberValue(
          scoring.evidence,
          100
        ),

        hintPenalty: numberValue(
          scoring.hintPenalty,
          20
        ),

        wrongFinal: Math.min(
          0,
          numberValue(
            scoring.wrongFinal,
            -50
          )
        )
      }
    })
  };
}

function validateCasePayload(
  payload,
  partial = false
) {
  if (
    !partial ||
    payload.title !== undefined
  ) {
    if (
      !payload.title ||
      payload.title.length < 2
    ) {
      return "Case title is required.";
    }
  }

  if (
    !partial ||
    payload.description !== undefined
  ) {
    if (!payload.description) {
      return "Case description is required.";
    }
  }

  if (
    payload.difficulty !== undefined &&
    !DIFFICULTIES.includes(
      payload.difficulty
    )
  ) {
    return "Invalid difficulty.";
  }

  if (
    payload.timeLimit !== undefined &&
    (
      !Number.isFinite(
        payload.timeLimit
      ) ||
      payload.timeLimit <= 0
    )
  ) {
    return "Time limit must be greater than 0.";
  }

  if (
    payload.maximumScore !== undefined &&
    (
      !Number.isFinite(
        payload.maximumScore
      ) ||
      payload.maximumScore < 0
    )
  ) {
    return "Maximum score cannot be negative.";
  }

  if (
    payload.finalAnswerFields !== undefined &&
    payload.finalAnswerFields.length === 0
  ) {
    return "Select at least one final answer field.";
  }

  return null;
}


/* =========================================================
   CASE MANAGEMENT
========================================================= */

router.get(
  "/cases",
  async (_, res) => {
    try {
      const cases =
        await DetectiveCase.find()
          .sort({
            createdAt: -1
          })
          .lean();

      res.json(cases);
    } catch (error) {
      console.error(
        "List cases error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to load cases."
      });
    }
  }
);


router.get(
  "/cases/:id",
  async (req, res) => {
    try {
      if (!validId(req.params.id)) {
        return res.status(400).json({
          message:
            "Invalid case id."
        });
      }

      const caseItem =
        await DetectiveCase.findById(
          req.params.id
        ).lean();

      if (!caseItem) {
        return res.status(404).json({
          message:
            "Case not found."
        });
      }

      const [
        clues,
        questions,
        hints
      ] = await Promise.all([
        DetectiveClue.find({
          caseId: caseItem._id
        })
          .sort({
            sequenceNumber: 1
          })
          .lean(),

        DetectiveQuestion.find({
          caseId: caseItem._id
        })
          .sort({
            sequenceNumber: 1
          })
          .lean(),

        DetectiveHint.find({
          caseId: caseItem._id
        })
          .sort({
            sequenceNumber: 1
          })
          .lean()
      ]);

      res.json({
        case: caseItem,
        clues,
        questions,
        hints
      });
    } catch (error) {
      console.error(
        "Get case error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to load case."
      });
    }
  }
);


router.post(
  "/cases",
  async (req, res) => {
    try {
      const payload =
        normalizeCasePayload(
          req.body
        );

      const validationError =
        validateCasePayload(
          payload
        );

      if (validationError) {
        return res.status(400).json({
          message: validationError
        });
      }

      const created =
        await DetectiveCase.create({
          title: payload.title,

          description:
            payload.description,

          difficulty:
            payload.difficulty ||
            "Medium",

          timeLimit:
            payload.timeLimit,

          maximumScore:
            payload.maximumScore,

          suspects:
            payload.suspects || [],

          finalAnswerFields:
            payload.finalAnswerFields ||
            [
              "culprit",
              "time",
              "method",
              "motive",
              "evidence"
            ],

          finalSolution:
            payload.finalSolution || {},

          scoring:
            payload.scoring || {},

          status: "DRAFT",

          createdBy:
            req.user._id
        });

      res.status(201).json(
        created
      );
    } catch (error) {
      console.error(
        "Create case error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to create case."
      });
    }
  }
);


router.patch(
  "/cases/:id",
  async (req, res) => {
    try {
      if (!validId(req.params.id)) {
        return res.status(400).json({
          message:
            "Invalid case id."
        });
      }

      const payload =
        normalizeCasePayload(
          req.body
        );

      const validationError =
        validateCasePayload(
          payload,
          true
        );

      if (validationError) {
        return res.status(400).json({
          message: validationError
        });
      }

      const updated =
        await DetectiveCase.findByIdAndUpdate(
          req.params.id,
          payload,
          {
            new: true,
            runValidators: true
          }
        );

      if (!updated) {
        return res.status(404).json({
          message:
            "Case not found."
        });
      }

      res.json(updated);
    } catch (error) {
      console.error(
        "Update case error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to update case."
      });
    }
  }
);


router.post(
  "/cases/:id/publish",
  async (req, res) => {
    try {
      if (!validId(req.params.id)) {
        return res.status(400).json({
          message:
            "Invalid case id."
        });
      }

      const caseItem =
        await DetectiveCase.findById(
          req.params.id
        );

      if (!caseItem) {
        return res.status(404).json({
          message:
            "Case not found."
        });
      }

      if (
        !caseItem.title ||
        !caseItem.description
      ) {
        return res.status(400).json({
          message:
            "Case title and description are required before publishing."
        });
      }

      if (
        !caseItem.finalAnswerFields?.length
      ) {
        return res.status(400).json({
          message:
            "At least one final answer field is required."
        });
      }

      caseItem.status =
        "PUBLISHED";

      await caseItem.save();

      res.json(caseItem);
    } catch (error) {
      console.error(
        "Publish case error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to publish case."
      });
    }
  }
);


router.post(
  "/cases/:id/unpublish",
  async (req, res) => {
    try {
      if (!validId(req.params.id)) {
        return res.status(400).json({
          message:
            "Invalid case id."
        });
      }

      const updated =
        await DetectiveCase.findByIdAndUpdate(
          req.params.id,
          {
            status: "DRAFT"
          },
          {
            new: true,
            runValidators: true
          }
        );

      if (!updated) {
        return res.status(404).json({
          message:
            "Case not found."
        });
      }

      res.json(updated);
    } catch (error) {
      console.error(
        "Unpublish case error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to unpublish case."
      });
    }
  }
);


router.delete(
  "/cases/:id",
  async (req, res) => {
    try {
      if (!validId(req.params.id)) {
        return res.status(400).json({
          message:
            "Invalid case id."
        });
      }

      const attemptExists =
        await DetectiveAttempt.exists({
          caseId:
            req.params.id
        });

      if (attemptExists) {
        return res.status(409).json({
          message:
            "This case has attempts and cannot be deleted."
        });
      }

      const deleted =
        await DetectiveCase.findByIdAndDelete(
          req.params.id
        );

      if (!deleted) {
        return res.status(404).json({
          message:
            "Case not found."
        });
      }

      await Promise.all([
        DetectiveClue.deleteMany({
          caseId: req.params.id
        }),

        DetectiveQuestion.deleteMany({
          caseId: req.params.id
        }),

        DetectiveHint.deleteMany({
          caseId: req.params.id
        })
      ]);

      res.json({
        deleted: true
      });
    } catch (error) {
      console.error(
        "Delete case error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to delete case."
      });
    }
  }
);


/* =========================================================
   CLUE CRUD
========================================================= */

router.post(
  "/clues",
  async (req, res) => {
    try {
      const created =
        await DetectiveClue.create(
          req.body
        );

      res.status(201).json(
        created
      );
    } catch (error) {
      res.status(400).json({
        message:
          error.message
      });
    }
  }
);


router.patch(
  "/clues/:id",
  async (req, res) => {
    try {
      const updated =
        await DetectiveClue.findByIdAndUpdate(
          req.params.id,
          req.body,
          {
            new: true,
            runValidators: true
          }
        );

      if (!updated) {
        return res.status(404).json({
          message:
            "Clue not found."
        });
      }

      res.json(updated);
    } catch (error) {
      res.status(400).json({
        message:
          error.message
      });
    }
  }
);


router.delete(
  "/clues/:id",
  async (req, res) => {
    try {
      const deleted =
        await DetectiveClue.findByIdAndDelete(
          req.params.id
        );

      if (!deleted) {
        return res.status(404).json({
          message:
            "Clue not found."
        });
      }

      res.json({
        deleted: true
      });
    } catch {
      res.status(500).json({
        message:
          "Failed to delete clue."
      });
    }
  }
);


/* =========================================================
   QUESTION CRUD
========================================================= */

router.post(
  "/questions",
  async (req, res) => {
    try {
      const created =
        await DetectiveQuestion.create(
          req.body
        );

      res.status(201).json(
        created
      );
    } catch (error) {
      res.status(400).json({
        message:
          error.message
      });
    }
  }
);


router.patch(
  "/questions/:id",
  async (req, res) => {
    try {
      const updated =
        await DetectiveQuestion.findByIdAndUpdate(
          req.params.id,
          req.body,
          {
            new: true,
            runValidators: true
          }
        );

      if (!updated) {
        return res.status(404).json({
          message:
            "Question not found."
        });
      }

      res.json(updated);
    } catch (error) {
      res.status(400).json({
        message:
          error.message
      });
    }
  }
);


router.delete(
  "/questions/:id",
  async (req, res) => {
    try {
      const deleted =
        await DetectiveQuestion.findByIdAndDelete(
          req.params.id
        );

      if (!deleted) {
        return res.status(404).json({
          message:
            "Question not found."
        });
      }

      res.json({
        deleted: true
      });
    } catch {
      res.status(500).json({
        message:
          "Failed to delete question."
      });
    }
  }
);


/* =========================================================
   HINT CRUD
========================================================= */

router.post(
  "/hints",
  async (req, res) => {
    try {
      const created =
        await DetectiveHint.create(
          req.body
        );

      res.status(201).json(
        created
      );
    } catch (error) {
      res.status(400).json({
        message:
          error.message
      });
    }
  }
);


router.patch(
  "/hints/:id",
  async (req, res) => {
    try {
      const updated =
        await DetectiveHint.findByIdAndUpdate(
          req.params.id,
          req.body,
          {
            new: true,
            runValidators: true
          }
        );

      if (!updated) {
        return res.status(404).json({
          message:
            "Hint not found."
        });
      }

      res.json(updated);
    } catch (error) {
      res.status(400).json({
        message:
          error.message
      });
    }
  }
);


router.delete(
  "/hints/:id",
  async (req, res) => {
    try {
      const deleted =
        await DetectiveHint.findByIdAndDelete(
          req.params.id
        );

      if (!deleted) {
        return res.status(404).json({
          message:
            "Hint not found."
        });
      }

      res.json({
        deleted: true
      });
    } catch {
      res.status(500).json({
        message:
          "Failed to delete hint."
      });
    }
  }
);


/* =========================================================
   MONITORING
========================================================= */

router.get(
  "/monitoring",
  async (_, res) => {
    try {
      const rows =
        await DetectiveAttempt.find()
          .populate(
            "participantId",
            "name username email teamId teamName qualificationStatus"
          )
          .populate(
            "caseId",
            "title"
          )
          .sort({
            updatedAt: -1
          });

      res.json(
        rows.map(attempt => ({
          participant:
            attempt.participantId,

          case:
            attempt.caseId,

          status:
            attempt.status,

          currentClue:
            attempt.currentClue,

          currentQuestion:
            attempt.currentQuestion,

          hintsUsed:
            attempt.hintsUsed,

          score:
            attempt.score,

          timeRemaining:
            Math.max(
              0,
              new Date(
                attempt.expiresAt
              ).getTime() -
                Date.now()
            )
        }))
      );
    } catch (error) {
      console.error(
        "Monitoring error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to load monitoring data."
      });
    }
  }
);


/* =========================================================
   PARTICIPANTS
========================================================= */

router.get(
  "/participants",
  async (_, res) => {
    try {
      const participants =
        await User.find({
          role: "participant"
        })
          .select(
            "name username email teamId teamName round1Status round1Score qualificationStatus round2Status round2Score gamesPlayed gamesCompleted"
          )
          .sort({
            createdAt: -1
          })
          .lean();

      res.json(
        participants
      );
    } catch (error) {
      console.error(
        "Participant list error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to load participants."
      });
    }
  }
);


router.post(
  "/unlock/:userId",
  async (req, res) => {
    try {
      if (
        !validId(
          req.params.userId
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid user id."
        });
      }

      const user =
        await User.findByIdAndUpdate(
          req.params.userId,
          {
            qualificationStatus:
              "QUALIFIED"
          },
          {
            new: true
          }
        );

      if (!user) {
        return res.status(404).json({
          message:
            "Participant not found."
        });
      }

      res.json({
        id: user._id,
        qualificationStatus:
          user.qualificationStatus
      });
    } catch {
      res.status(500).json({
        message:
          "Failed to unlock participant."
      });
    }
  }
);


router.post(
  "/lock/:userId",
  async (req, res) => {
    try {
      if (
        !validId(
          req.params.userId
        )
      ) {
        return res.status(400).json({
          message:
            "Invalid user id."
        });
      }

      const user =
        await User.findByIdAndUpdate(
          req.params.userId,
          {
            qualificationStatus:
              "NOT_QUALIFIED"
          },
          {
            new: true
          }
        );

      if (!user) {
        return res.status(404).json({
          message:
            "Participant not found."
        });
      }

      res.json({
        id: user._id,
        qualificationStatus:
          user.qualificationStatus
      });
    } catch {
      res.status(500).json({
        message:
          "Failed to lock participant."
      });
    }
  }
);


/* =========================================================
   CSV EXPORT
========================================================= */

router.get(
  "/export",
  async (req, res) => {
    try {
      const allowed = [
        "name",
        "username",
        "email",
        "teamId",
        "teamName",
        "round1Status",
        "round1Score",
        "round2Status",
        "round2Score",
        "qualificationStatus",
        "gamesPlayed",
        "gamesCompleted",
        "createdAt"
      ];

      const fields =
        String(
          req.query.fields || ""
        )
          .split(",")
          .filter(field =>
            allowed.includes(field)
          );

      if (!fields.length) {
        return res.status(400).json({
          message:
            "Select at least one export field."
        });
      }

      const users =
        await User.find({
          role: "participant"
        }).lean();

      const rows =
        users.map(user =>
          Object.fromEntries(
            fields.map(field => [
              field,
              user[field]
            ])
          )
        );

      const csv =
        new Parser({
          fields
        }).parse(rows);

      res.header(
        "Content-Type",
        "text/csv"
      );

      res.attachment(
        "participants.csv"
      );

      res.send(csv);
    } catch (error) {
      console.error(
        "CSV export error:",
        error
      );

      res.status(500).json({
        message:
          "Failed to export participants."
      });
    }
  }
);

export default router;
