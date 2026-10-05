import mongoose from "mongoose";

const schema = new mongoose.Schema({
  caseId: { type: mongoose.Schema.Types.ObjectId, ref: "DetectiveCase" },
  participantId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  teamId: String,
  startedAt: Date,
  completedAt: Date,
  expiresAt: Date,
  currentClue: Number,
  currentQuestion: Number,
  score: { type: Number, default: 0 },
  hintsUsed: { type: Number, default: 0 },
  usedHintIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "DetectiveHint" }],
  status: {
    type: String,
    enum: ["NOT_STARTED", "CASE_STARTED", "CLUE_AVAILABLE", "QUESTION_IN_PROGRESS", "HINT_USED", "QUESTION_COMPLETED", "FINAL_ANSWER", "CASE_COMPLETED", "TIME_EXPIRED"],
    default: "NOT_STARTED"
  },
  finalAnswer: mongoose.Schema.Types.Mixed
}, { timestamps: true });

export default mongoose.model("DetectiveAttempt", schema);
