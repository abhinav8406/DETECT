import { Router } from "express";
import mongoose from "mongoose";

import { auth, adminOnly } from "../middleware/auth.js";
import DetectiveCase from "../models/DetectiveCase.js";
import DetectiveClue from "../models/DetectiveClue.js";

const router = Router();

router.use(auth, adminOnly);

const EVIDENCE_TYPES = [
  "TEXT",
  "IMAGE",
  "DOCUMENT",
  "CCTV",
  "DIGITAL"
];

const CLASSIFICATIONS = [
  "SUPPORTING",
  "NEUTRAL",
  "MISLEADING",
  "CRITICAL"
];

function validId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function buildCluePayload(body) {
  return {
    caseId: body.caseId,
    sequenceNumber: numberValue(body.sequenceNumber, 1),
    title: clean(body.title),
    description: clean(body.description),
    evidence: clean(body.evidence),
    evidenceType: EVIDENCE_TYPES.includes(body.evidenceType)
      ? body.evidenceType
      : "TEXT",
    timestamp: clean(body.timestamp),
    location: clean(body.location),
    relatedSuspect: clean(body.relatedSuspect),
    unlockCondition: clean(body.unlockCondition),
    classification: CLASSIFICATIONS.includes(body.classification)
      ? body.classification
      : "NEUTRAL",
    isPublished: body.isPublished !== false
  };
}

async function validateCase(caseId) {
  if (!validId(caseId)) {
    return null;
  }

  return DetectiveCase.findById(caseId);
}

/*
|--------------------------------------------------------------------------
| GET ALL CLUES FOR A CASE
|--------------------------------------------------------------------------
*/

router.get("/case/:caseId", async (req, res) => {
  try {
    const { caseId } = req.params;

    const detectiveCase = await validateCase(caseId);

    if (!detectiveCase) {
      return res.status(404).json({
        message: "Case not found"
      });
    }

    const clues = await DetectiveClue.find({ caseId })
      .sort({ sequenceNumber: 1, createdAt: 1 })
      .lean();

    res.json(clues);
  } catch (error) {
    console.error("GET clues error:", error);

    res.status(500).json({
      message: "Failed to load clues"
    });
  }
});

/*
|--------------------------------------------------------------------------
| CREATE CLUE
|--------------------------------------------------------------------------
*/

router.post("/", async (req, res) => {
  try {
    const payload = buildCluePayload(req.body);

    if (!validId(payload.caseId)) {
      return res.status(400).json({
        message: "Invalid case ID"
      });
    }

    const detectiveCase = await DetectiveCase.findById(payload.caseId);

    if (!detectiveCase) {
      return res.status(404).json({
        message: "Case not found"
      });
    }

    if (!payload.title) {
      return res.status(400).json({
        message: "Clue title is required"
      });
    }

    if (!payload.description) {
      return res.status(400).json({
        message: "Clue description is required"
      });
    }

    if (payload.sequenceNumber < 1) {
      return res.status(400).json({
        message: "Clue order must be at least 1"
      });
    }

    const existing = await DetectiveClue.findOne({
      caseId: payload.caseId,
      sequenceNumber: payload.sequenceNumber
    });

    if (existing) {
      return res.status(409).json({
        message: `Clue ${payload.sequenceNumber} already exists for this case`
      });
    }

    const clue = await DetectiveClue.create(payload);

    res.status(201).json(clue);
  } catch (error) {
    console.error("CREATE clue error:", error);

    res.status(500).json({
      message: "Failed to create clue"
    });
  }
});

/*
|--------------------------------------------------------------------------
| UPDATE CLUE
|--------------------------------------------------------------------------
*/

router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!validId(id)) {
      return res.status(400).json({
        message: "Invalid clue ID"
      });
    }

    const existing = await DetectiveClue.findById(id);

    if (!existing) {
      return res.status(404).json({
        message: "Clue not found"
      });
    }

    const payload = buildCluePayload({
      ...existing.toObject(),
      ...req.body,
      caseId: existing.caseId
    });

    if (!payload.title) {
      return res.status(400).json({
        message: "Clue title is required"
      });
    }

    if (!payload.description) {
      return res.status(400).json({
        message: "Clue description is required"
      });
    }

    if (payload.sequenceNumber < 1) {
      return res.status(400).json({
        message: "Clue order must be at least 1"
      });
    }

    const duplicate = await DetectiveClue.findOne({
      caseId: existing.caseId,
      sequenceNumber: payload.sequenceNumber,
      _id: { $ne: id }
    });

    if (duplicate) {
      return res.status(409).json({
        message: `Clue ${payload.sequenceNumber} already exists`
      });
    }

    existing.sequenceNumber = payload.sequenceNumber;
    existing.title = payload.title;
    existing.description = payload.description;
    existing.evidence = payload.evidence;
    existing.evidenceType = payload.evidenceType;
    existing.timestamp = payload.timestamp;
    existing.location = payload.location;
    existing.relatedSuspect = payload.relatedSuspect;
    existing.unlockCondition = payload.unlockCondition;
    existing.classification = payload.classification;
    existing.isPublished = payload.isPublished;

    await existing.save();

    res.json(existing);
  } catch (error) {
    console.error("UPDATE clue error:", error);

    res.status(500).json({
      message: "Failed to update clue"
    });
  }
});

/*
|--------------------------------------------------------------------------
| PUBLISH / UNPUBLISH
|--------------------------------------------------------------------------
*/

router.patch("/:id/publish", async (req, res) => {
  try {
    const { id } = req.params;

    if (!validId(id)) {
      return res.status(400).json({
        message: "Invalid clue ID"
      });
    }

    const clue = await DetectiveClue.findById(id);

    if (!clue) {
      return res.status(404).json({
        message: "Clue not found"
      });
    }

    clue.isPublished = Boolean(req.body.isPublished);

    await clue.save();

    res.json(clue);
  } catch (error) {
    console.error("PUBLISH clue error:", error);

    res.status(500).json({
      message: "Failed to update clue status"
    });
  }
});

/*
|--------------------------------------------------------------------------
| DELETE CLUE
|--------------------------------------------------------------------------
*/

router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!validId(id)) {
      return res.status(400).json({
        message: "Invalid clue ID"
      });
    }

    const clue = await DetectiveClue.findById(id);

    if (!clue) {
      return res.status(404).json({
        message: "Clue not found"
      });
    }

    await DetectiveClue.findByIdAndDelete(id);

    res.json({
      message: "Clue deleted successfully"
    });
  } catch (error) {
    console.error("DELETE clue error:", error);

    res.status(500).json({
      message: "Failed to delete clue"
    });
  }
});

export default router;
