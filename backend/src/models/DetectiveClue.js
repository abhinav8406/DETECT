import mongoose from "mongoose";

const schema = new mongoose.Schema({
  caseId: { type: mongoose.Schema.Types.ObjectId, ref: "DetectiveCase", index: true },
  sequenceNumber: Number,
  title: String,
  description: String,
  evidence: String,
  evidenceType: { type: String, enum: ["TEXT", "IMAGE", "DOCUMENT", "CCTV", "DIGITAL"], default: "TEXT" },
  timestamp: String,
  location: String,
  relatedSuspect: String,
  unlockCondition: String,
  classification: { type: String, enum: ["SUPPORTING", "NEUTRAL", "MISLEADING", "CRITICAL"], default: "NEUTRAL" },
  isPublished: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model("DetectiveClue", schema);
