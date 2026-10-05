import React from "react";

export default function CluePanel({ clue }) {
  if (!clue) return null;
  return (
    <div className="card border-0 bg-dark text-light shadow-sm">
      <div className="card-body p-4">
        <div className="small text-uppercase opacity-75">Clue {clue.sequenceNumber}</div>
        <h2 className="h4 mt-1">{clue.title}</h2>
        <p>{clue.description}</p>
        <div className="evidence-box mt-3">{clue.evidence}</div>
        {clue.timestamp && <div className="small mt-3">Timestamp: {clue.timestamp}</div>}
        {clue.location && <div className="small">Location: {clue.location}</div>}
      </div>
    </div>
  );
}
