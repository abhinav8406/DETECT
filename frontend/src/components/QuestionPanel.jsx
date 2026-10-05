import React, { useState } from "react";

export default function QuestionPanel({ question, onSubmit, disabled }) {
  const [selected, setSelected] = useState(null);
  if (!question) return null;

  return (
    <div className="card detective-card shadow-sm">
      <div className="card-body p-4">
        <div className="small text-secondary">Question {question.sequenceNumber} · {question.points} points</div>
        <h2 className="h5 mt-2">{question.question}</h2>
        <div className="vstack gap-2 mt-3">
          {question.options.map((option, index) => (
            <button
              key={option}
              className={`btn text-start option-btn ${selected === index ? "selected" : ""}`}
              disabled={disabled}
              onClick={() => setSelected(index)}
            >
              <span className="badge text-bg-secondary me-2">{String.fromCharCode(65 + index)}</span>
              {option}
            </button>
          ))}
        </div>
        <button
          className="btn btn-primary mt-3"
          disabled={disabled || selected === null}
          onClick={() => onSubmit(selected)}
        >
          Submit Answer
        </button>
      </div>
    </div>
  );
}
