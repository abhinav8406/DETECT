import mongoose from "mongoose";

const schema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  difficulty: { type: String, enum: ["Easy", "Medium", "Hard", "Expert"], default: "Medium" },
  timeLimit: { type: Number, required: true },
  maximumScore: { type: Number, required: true },
  status: { type: String, enum: ["DRAFT", "PUBLISHED"], default: "DRAFT" },
  suspects: [{
    name: String,
    description: String
  }],
  finalSolution: {
    culprit: String,
    time: String,
    method: String,
    motive: String,
    evidenceClues: [String]
  },
  scoring: {
    culprit: { type: Number, default: 100 },
    time: { type: Number, default: 50 },
    method: { type: Number, default: 50 },
    motive: { type: Number, default: 50 },
    evidence: { type: Number, default: 100 },
    wrongFinal: { type: Number, default: -50 }
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

export default mongoose.model("DetectiveCase", schema);
