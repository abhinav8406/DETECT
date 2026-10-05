import mongoose from "mongoose";

const schema = new mongoose.Schema({
  caseId: { type: mongoose.Schema.Types.ObjectId, ref: "DetectiveCase", index: true },
  clueId: { type: mongoose.Schema.Types.ObjectId, ref: "DetectiveClue" },
  sequenceNumber: Number,
  question: String,
  options: [String],
  correctOption: Number,
  points: Number,
  isPublished: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model("DetectiveQuestion", schema);
