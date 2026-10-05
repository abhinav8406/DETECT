import mongoose from "mongoose";

const schema = new mongoose.Schema({
  caseId: { type: mongoose.Schema.Types.ObjectId, ref: "DetectiveCase", index: true },
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: "DetectiveQuestion" },
  sequenceNumber: Number,
  hintText: String,
  penalty: Number,
  isEnabled: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model("DetectiveHint", schema);
