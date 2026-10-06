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


/*
|--------------------------------------------------------------------------
| QUESTION MANAGEMENT
|--------------------------------------------------------------------------
*/

// GET QUESTIONS FOR A CASE
router.get("/cases/:caseId/questions", async (req, res) => {
  try {
    const { caseId } = req.params;

    if (!validId(caseId)) {
      return res.status(400).json({
        message: "Invalid case ID"
      });
    }

    const detectiveCase = await DetectiveCase.findById(caseId);

    if (!detectiveCase) {
      return res.status(404).json({
        message: "Case not found"
      });
    }

    const questions = await DetectiveQuestion.find({ caseId })
      .sort({
        sequenceNumber: 1,
        createdAt: 1
      })
      .lean();

    res.json(questions);
  } catch (error) {
    console.error("GET questions error:", error);

    res.status(500).json({
      message: "Failed to load questions"
    });
  }
});


// CREATE QUESTION
router.post("/questions", async (req, res) => {
  try {
    const {
      caseId,
      clueId,
      sequenceNumber,
      question,
      options,
      correctOption,
      points,
      isPublished
    } = req.body;

    if (!validId(caseId)) {
      return res.status(400).json({
        message: "Invalid case ID"
      });
    }

    const detectiveCase = await DetectiveCase.findById(caseId);

    if (!detectiveCase) {
      return res.status(404).json({
        message: "Case not found"
      });
    }

    if (clueId && !validId(clueId)) {
      return res.status(400).json({
        message: "Invalid clue ID"
      });
    }

    const cleanQuestion =
      typeof question === "string"
        ? question.trim()
        : "";

    if (!cleanQuestion) {
      return res.status(400).json({
        message: "Question is required"
      });
    }

    const cleanOptions = Array.isArray(options)
      ? options
          .map(option =>
            typeof option === "string"
              ? option.trim()
              : ""
          )
          .filter(Boolean)
      : [];

    if (cleanOptions.length < 2) {
      return res.status(400).json({
        message: "At least 2 answer options are required"
      });
    }

    const order = Number(sequenceNumber);

    if (!Number.isInteger(order) || order < 1) {
      return res.status(400).json({
        message: "Question order must be at least 1"
      });
    }

    const correct = Number(correctOption);

    if (
      !Number.isInteger(correct) ||
      correct < 0 ||
      correct >= cleanOptions.length
    ) {
      return res.status(400).json({
        message: "Invalid correct answer"
      });
    }

    const score = Number(points);

    if (!Number.isFinite(score) || score < 0) {
      return res.status(400).json({
        message: "Points must be 0 or greater"
      });
    }

    const duplicate = await DetectiveQuestion.findOne({
      caseId,
      sequenceNumber: order
    });

    if (duplicate) {
      return res.status(409).json({
        message: `Question ${order} already exists for this case`
      });
    }

    if (clueId) {
      const clue = await DetectiveClue.findOne({
        _id: clueId,
        caseId
      });

      if (!clue) {
        return res.status(400).json({
          message: "Selected clue does not belong to this case"
        });
      }
    }

    const created = await DetectiveQuestion.create({
      caseId,
      clueId: clueId || null,
      sequenceNumber: order,
      question: cleanQuestion,
      options: cleanOptions,
      correctOption: correct,
      points: score,
      isPublished: isPublished !== false
    });

    res.status(201).json(created);
  } catch (error) {
    console.error("CREATE question error:", error);

    res.status(500).json({
      message: "Failed to create question"
    });
  }
});


// UPDATE QUESTION
router.patch("/questions/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!validId(id)) {
      return res.status(400).json({
        message: "Invalid question ID"
      });
    }

    const existing =
      await DetectiveQuestion.findById(id);

    if (!existing) {
      return res.status(404).json({
        message: "Question not found"
      });
    }

    const cleanQuestion =
      typeof req.body.question === "string"
        ? req.body.question.trim()
        : existing.question;

    const cleanOptions = Array.isArray(req.body.options)
      ? req.body.options
          .map(option =>
            typeof option === "string"
              ? option.trim()
              : ""
          )
          .filter(Boolean)
      : existing.options;

    if (!cleanQuestion) {
      return res.status(400).json({
        message: "Question is required"
      });
    }

    if (cleanOptions.length < 2) {
      return res.status(400).json({
        message: "At least 2 answer options are required"
      });
    }

    const order =
      req.body.sequenceNumber !== undefined
        ? Number(req.body.sequenceNumber)
        : existing.sequenceNumber;

    if (!Number.isInteger(order) || order < 1) {
      return res.status(400).json({
        message: "Question order must be at least 1"
      });
    }

    const correct =
      req.body.correctOption !== undefined
        ? Number(req.body.correctOption)
        : existing.correctOption;

    if (
      !Number.isInteger(correct) ||
      correct < 0 ||
      correct >= cleanOptions.length
    ) {
      return res.status(400).json({
        message: "Invalid correct answer"
      });
    }

    const score =
      req.body.points !== undefined
        ? Number(req.body.points)
        : existing.points;

    if (!Number.isFinite(score) || score < 0) {
      return res.status(400).json({
        message: "Points must be 0 or greater"
      });
    }

    const duplicate =
      await DetectiveQuestion.findOne({
        caseId: existing.caseId,
        sequenceNumber: order,
        _id: { $ne: id }
      });

    if (duplicate) {
      return res.status(409).json({
        message: `Question ${order} already exists`
      });
    }

    let clueId = existing.clueId;

    if (req.body.clueId !== undefined) {
      if (req.body.clueId === "" || req.body.clueId === null) {
        clueId = null;
      } else {
        if (!validId(req.body.clueId)) {
          return res.status(400).json({
            message: "Invalid clue ID"
          });
        }

        const clue = await DetectiveClue.findOne({
          _id: req.body.clueId,
          caseId: existing.caseId
        });

        if (!clue) {
          return res.status(400).json({
            message: "Selected clue does not belong to this case"
          });
        }

        clueId = req.body.clueId;
      }
    }

    existing.clueId = clueId;
    existing.sequenceNumber = order;
    existing.question = cleanQuestion;
    existing.options = cleanOptions;
    existing.correctOption = correct;
    existing.points = score;

    if (req.body.isPublished !== undefined) {
      existing.isPublished = Boolean(
        req.body.isPublished
      );
    }

    await existing.save();

    res.json(existing);
  } catch (error) {
    console.error("UPDATE question error:", error);

    res.status(500).json({
      message: "Failed to update question"
    });
  }
});


// PUBLISH / UNPUBLISH QUESTION
router.patch("/questions/:id/publish", async (req, res) => {
  try {
    const { id } = req.params;

    if (!validId(id)) {
      return res.status(400).json({
        message: "Invalid question ID"
      });
    }

    const question =
      await DetectiveQuestion.findById(id);

    if (!question) {
      return res.status(404).json({
        message: "Question not found"
      });
    }

    question.isPublished =
      Boolean(req.body.isPublished);

    await question.save();

    res.json(question);
  } catch (error) {
    console.error(
      "PUBLISH question error:",
      error
    );

    res.status(500).json({
      message: "Failed to update question status"
    });
  }
});


// DELETE QUESTION
router.delete("/questions/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!validId(id)) {
      return res.status(400).json({
        message: "Invalid question ID"
      });
    }

    const question =
      await DetectiveQuestion.findById(id);

    if (!question) {
      return res.status(404).json({
        message: "Question not found"
      });
    }

    await DetectiveQuestion.findByIdAndDelete(id);

    // Also remove questions from their associated hints.
    await DetectiveHint.deleteMany({
      questionId: id
    });

    res.json({
      message: "Question deleted successfully"
    });
  } catch (error) {
    console.error(
      "DELETE question error:",
      error
    );

    res.status(500).json({
      message: "Failed to delete question"
    });
  }
});

/* =========================================================
   HINT CRUD
========================================================= */

router.get("/cases/:caseId/hints", async (req, res) => {
  try {
    const { caseId } = req.params;

    if (!validId(caseId)) {
      return res.status(400).json({
        message: "Invalid case id."
      });
    }

    const caseExists = await DetectiveCase.exists({
      _id: caseId
    });

    if (!caseExists) {
      return res.status(404).json({
        message: "Case not found."
      });
    }

    const hints = await DetectiveHint.find({
      caseId
    })
      .populate("questionId", "sequenceNumber question")
      .populate("clueId", "sequenceNumber title")
      .sort({
        sequenceNumber: 1
      })
      .lean();

    res.json(hints);
  } catch (error) {
    console.error("Get hints error:", error);

    res.status(500).json({
      message: "Failed to load hints."
    });
  }
});


router.post("/hints", async (req, res) => {
  try {
    const {
      caseId,
      questionId,
      clueId,
      sequenceNumber,
      hintText,
      penalty,
      isEnabled
    } = req.body;

    if (!validId(caseId)) {
      return res.status(400).json({
        message: "Valid case is required."
      });
    }

    const caseExists = await DetectiveCase.exists({
      _id: caseId
    });

    if (!caseExists) {
      return res.status(404).json({
        message: "Case not found."
      });
    }

    if (!Number.isInteger(Number(sequenceNumber)) || Number(sequenceNumber) < 1) {
      return res.status(400).json({
        message: "Sequence number must be at least 1."
      });
    }

    if (!cleanString(hintText)) {
      return res.status(400).json({
        message: "Hint text is required."
      });
    }

    const numericPenalty = Number(penalty);

    if (!Number.isFinite(numericPenalty) || numericPenalty < 0) {
      return res.status(400).json({
        message: "Hint penalty must be a non-negative number."
      });
    }

    if (!questionId && !clueId) {
      return res.status(400).json({
        message: "Hint must be associated with a clue or question."
      });
    }

    if (questionId && !validId(questionId)) {
      return res.status(400).json({
        message: "Invalid question id."
      });
    }

    if (clueId && !validId(clueId)) {
      return res.status(400).json({
        message: "Invalid clue id."
      });
    }

    if (questionId) {
      const question = await DetectiveQuestion.findOne({
        _id: questionId,
        caseId
      });

      if (!question) {
        return res.status(400).json({
          message: "Question does not belong to this case."
        });
      }
    }

    if (clueId) {
      const clue = await DetectiveClue.findOne({
        _id: clueId,
        caseId
      });

      if (!clue) {
        return res.status(400).json({
          message: "Clue does not belong to this case."
        });
      }
    }

    const duplicate = await DetectiveHint.findOne({
      caseId,
      sequenceNumber: Number(sequenceNumber)
    });

    if (duplicate) {
      return res.status(409).json({
        message: "A hint with this sequence number already exists."
      });
    }

    const created = await DetectiveHint.create({
      caseId,
      questionId: questionId || null,
      clueId: clueId || null,
      sequenceNumber: Number(sequenceNumber),
      hintText: cleanString(hintText),
      penalty: numericPenalty,
      isEnabled: isEnabled !== false
    });

    res.status(201).json(created);
  } catch (error) {
    console.error("Create hint error:", error);

    res.status(400).json({
      message: error.message
    });
  }
});


router.patch("/hints/:id", async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid hint id."
      });
    }

    const existing = await DetectiveHint.findById(
      req.params.id
    );

    if (!existing) {
      return res.status(404).json({
        message: "Hint not found."
      });
    }

    const {
      caseId,
      questionId,
      clueId,
      sequenceNumber,
      hintText,
      penalty,
      isEnabled
    } = req.body;

    const targetCaseId = caseId || existing.caseId;

    if (!validId(targetCaseId)) {
      return res.status(400).json({
        message: "Invalid case id."
      });
    }

    const caseExists = await DetectiveCase.exists({
      _id: targetCaseId
    });

    if (!caseExists) {
      return res.status(404).json({
        message: "Case not found."
      });
    }

    const targetSequence =
      sequenceNumber !== undefined
        ? Number(sequenceNumber)
        : existing.sequenceNumber;

    if (
      !Number.isInteger(targetSequence) ||
      targetSequence < 1
    ) {
      return res.status(400).json({
        message: "Sequence number must be at least 1."
      });
    }

    const targetHintText =
      hintText !== undefined
        ? cleanString(hintText)
        : existing.hintText;

    if (!targetHintText) {
      return res.status(400).json({
        message: "Hint text is required."
      });
    }

    const targetPenalty =
      penalty !== undefined
        ? Number(penalty)
        : existing.penalty;

    if (
      !Number.isFinite(targetPenalty) ||
      targetPenalty < 0
    ) {
      return res.status(400).json({
        message: "Hint penalty must be a non-negative number."
      });
    }

    const targetQuestionId =
      questionId !== undefined
        ? questionId || null
        : existing.questionId;

    const targetClueId =
      clueId !== undefined
        ? clueId || null
        : existing.clueId;

    if (!targetQuestionId && !targetClueId) {
      return res.status(400).json({
        message: "Hint must be associated with a clue or question."
      });
    }

    if (targetQuestionId) {
      if (!validId(targetQuestionId)) {
        return res.status(400).json({
          message: "Invalid question id."
        });
      }

      const question = await DetectiveQuestion.findOne({
        _id: targetQuestionId,
        caseId: targetCaseId
      });

      if (!question) {
        return res.status(400).json({
          message: "Question does not belong to this case."
        });
      }
    }

    if (targetClueId) {
      if (!validId(targetClueId)) {
        return res.status(400).json({
          message: "Invalid clue id."
        });
      }

      const clue = await DetectiveClue.findOne({
        _id: targetClueId,
        caseId: targetCaseId
      });

      if (!clue) {
        return res.status(400).json({
          message: "Clue does not belong to this case."
        });
      }
    }

    const duplicate = await DetectiveHint.findOne({
      caseId: targetCaseId,
      sequenceNumber: targetSequence,
      _id: { $ne: existing._id }
    });

    if (duplicate) {
      return res.status(409).json({
        message: "A hint with this sequence number already exists."
      });
    }

    existing.caseId = targetCaseId;
    existing.questionId = targetQuestionId;
    existing.clueId = targetClueId;
    existing.sequenceNumber = targetSequence;
    existing.hintText = targetHintText;
    existing.penalty = targetPenalty;

    if (isEnabled !== undefined) {
      existing.isEnabled = Boolean(isEnabled);
    }

    await existing.save();

    res.json(existing);
  } catch (error) {
    console.error("Update hint error:", error);

    res.status(400).json({
      message: error.message
    });
  }
});


router.delete("/hints/:id", async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid hint id."
      });
    }

    const deleted = await DetectiveHint.findByIdAndDelete(
      req.params.id
    );

    if (!deleted) {
      return res.status(404).json({
        message: "Hint not found."
      });
    }

    res.json({
      deleted: true
    });
  } catch (error) {
    console.error("Delete hint error:", error);

    res.status(500).json({
      message: "Failed to delete hint."
    });
  }
});

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
   RESET ROUND 2 ATTEMPT
========================================================= */

router.post("/reset-attempt/:userId", async (req, res) => {
  try {
    if (!validId(req.params.userId)) {
      return res.status(400).json({
        message: "Invalid user id."
      });
    }

    const user = await User.findById(
      req.params.userId
    );

    if (!user) {
      return res.status(404).json({
        message: "Participant not found."
      });
    }

    const deleted =
      await DetectiveAttempt.deleteMany({
        participantId: user._id
      });

    await User.findByIdAndUpdate(
      user._id,
      {
        round2Status: "QUALIFIED",
        round2Score: 0
      }
    );

    return res.json({
      success: true,
      message:
        "Round 2 attempt has been reset.",
      deletedAttempts: deleted.deletedCount
    });

  } catch (error) {
    console.error(
      "Reset Round 2 attempt error:",
      error
    );

    return res.status(500).json({
      message:
        "Failed to reset Round 2 attempt."
    });
  }
});

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

router.post("/reset-attempt/:userId", async (req, res) => {
  try {
    if (!validId(req.params.userId)) {
      return res.status(400).json({
        message: "Invalid participant ID."
      });
    }

    const user = await User.findById(req.params.userId);

    if (!user) {
      return res.status(404).json({
        message: "Participant not found."
      });
    }

    const activeCase = await DetectiveCase.findOne({
      status: "PUBLISHED"
    }).sort({ createdAt: -1 });

    if (!activeCase) {
      return res.status(404).json({
        message: "No published Round 2 case found."
      });
    }

    const deleted = await DetectiveAttempt.deleteOne({
      participantId: user._id,
      caseId: activeCase._id
    });

    await User.findByIdAndUpdate(user._id, {
      round2Status: "QUALIFIED",
      round2Score: 0
    });

    return res.json({
      success: true,
      message: "Round 2 attempt has been reset.",
      deletedAttempt: deleted.deletedCount > 0
    });
  } catch (error) {
    console.error("Reset attempt error:", error);

    return res.status(500).json({
      message: "Failed to reset Round 2 attempt."
    });
  }
});

export default router;
