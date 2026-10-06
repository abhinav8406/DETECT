import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DetectiveCase",
      required: true,
      index: true
    },

    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DetectiveQuestion",
      default: null
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

    hintText: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000
    },

    penalty: {
      type: Number,
      required: true,
      min: 0,
      default: 10
    },

    isEnabled: {
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

export default mongoose.model("DetectiveHint", schema);
