import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },

    username: {
      type: String,
      required: true,
      unique: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true
    },

    passwordHash: {
      type: String,
      required: true
    },

    role: {
      type: String,
      enum: ["participant", "admin"],
      default: "participant"
    },

    teamId: {
      type: String,
      default: ""
    },

    teamName: {
      type: String,
      default: ""
    },

    round1Status: {
      type: String,
      enum: ["NOT_STARTED", "COMPLETED"],
      default: "NOT_STARTED"
    },

    round1Score: {
      type: Number,
      default: 0
    },

    qualificationStatus: {
      type: String,
      enum: ["QUALIFIED", "NOT_QUALIFIED", "PENDING"],
      default: "PENDING"
    },

    /*
     * Round 2 participant result.
     */
    round2Status: {
      type: String,
      enum: [
        "NOT_STARTED",
        "IN_PROGRESS",
        "COMPLETED",
        "TIME_EXPIRED"
      ],
      default: "NOT_STARTED"
    },

    round2Score: {
      type: Number,
      default: 0
    },

    gamesPlayed: {
      type: Number,
      default: 0
    },

    gamesCompleted: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model("User", userSchema);
