import mongoose from "mongoose";

const schema = new mongoose.Schema({
  attemptId: { type: mongoose.Schema.Types.ObjectId, ref: "DetectiveAttempt", index: true },
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: "DetectiveQuestion" },
  selectedOption: Number,
  isCorrect: Boolean,
  pointsAwarded: Number,
  submittedAt: Date
});

export default mongoose.model("DetectiveAnswer", schema);
