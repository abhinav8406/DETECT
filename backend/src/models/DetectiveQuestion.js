import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DetectiveCase",
      required: true,
      index: true
    },

    clueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DetectiveClue",
      default: null
    },

    sequenceNumber: {
      type: Number,
      required: true,
      min: 1
    },

    question: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000
    },

    options: {
      type: [String],
      validate: {
        validator: value =>
          Array.isArray(value) &&
          value.length >= 2 &&
          value.every(
            option =>
              typeof option === "string" &&
              option.trim().length > 0
          ),
        message:
          "At least two non-empty options are required"
      }
    },

    correctOption: {
      type: Number,
      required: true,
      min: 0
    },

    points: {
      type: Number,
      required: true,
      min: 0,
      default: 100
    },

    isPublished: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

schema.index({
  caseId: 1,
  sequenceNumber: 1
});

export default mongoose.model(
  "DetectiveQuestion",
  schema
);
