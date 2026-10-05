import React from "react";

export default function CaseStory({ caseData, onStart }) {
  return (
    <div className="card detective-card shadow-sm">
      <div className="card-body p-4">
        <span className="badge text-bg-secondary mb-2">{caseData.difficulty}</span>
        <h1 className="h3">{caseData.title}</h1>
        <p className="text-secondary">{caseData.description}</p>
        <h2 className="h6 mt-4">Suspects</h2>
        <div className="row g-2">
          {caseData.suspects.map(s => (
            <div className="col-md-4" key={s.name}>
              <div className="border rounded p-3 h-100">
                <strong>{s.name}</strong>
                <div className="small text-secondary mt-1">{s.description}</div>
              </div>
            </div>
          ))}
        </div>
        <button className="btn btn-dark mt-4" onClick={onStart}>Start Detective Case</button>
      </div>
    </div>
  );
}
