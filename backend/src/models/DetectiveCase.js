import mongoose from "mongoose";

const suspectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      required: true
    },
    description: {
      type: String,
      trim: true,
      default: ""
    }
  },
  { _id: true }
);

const finalSolutionSchema = new mongoose.Schema(
  {
    culprit: {
      type: String,
      trim: true,
      default: ""
    },
    time: {
      type: String,
      trim: true,
      default: ""
    },
    method: {
      type: String,
      trim: true,
      default: ""
    },
    motive: {
      type: String,
      trim: true,
      default: ""
    },
    evidenceClues: [
      {
        type: String,
        trim: true
      }
    ],
    explanation: {
      type: String,
      trim: true,
      default: ""
    }
  },
  { _id: false }
);

const scoringSchema = new mongoose.Schema(
  {
    culprit: {
      type: Number,
      default: 100,
      min: 0
    },
    time: {
      type: Number,
      default: 50,
      min: 0
    },
    method: {
      type: Number,
      default: 50,
      min: 0
    },
    motive: {
      type: Number,
      default: 50,
      min: 0
    },
    evidence: {
      type: Number,
      default: 100,
      min: 0
    },
    hintPenalty: {
      type: Number,
      default: 20,
      min: 0
    },
    wrongFinal: {
      type: Number,
      default: -50,
      max: 0
    }
  },
  { _id: false }
);

const schema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 200
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 10000
    },

    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard", "Expert"],
      default: "Medium"
    },

    timeLimit: {
      type: Number,
      required: true,
      min: 1
    },

    maximumScore: {
      type: Number,
      required: true,
      min: 0
    },

    status: {
      type: String,
      enum: ["DRAFT", "PUBLISHED"],
      default: "DRAFT"
    },

    suspects: {
      type: [suspectSchema],
      default: []
    },

    finalAnswerFields: {
      type: [String],
      enum: [
        "culprit",
        "time",
        "method",
        "motive",
        "evidence",
        "explanation"
      ],
      default: [
        "culprit",
        "time",
        "method",
        "motive",
        "evidence"
      ]
    },

    finalSolution: {
      type: finalSolutionSchema,
      default: () => ({})
    },

    scoring: {
      type: scoringSchema,
      default: () => ({})
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model("DetectiveCase", schema);
