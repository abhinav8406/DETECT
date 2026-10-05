import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { useNavigate } from "react-router-dom";

export default function Round2Gate() {
  const [state, setState] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/detective/access").then(r => setState(r.data)).catch(() => setState({ unlocked: false }));
  }, []);

  async function start() {
    const { data } = await api.post("/detective/attempts");
    navigate(`/round2/case?attempt=${data.attemptId}`);
  }

  if (!state) return <div className="container py-5">Checking qualification…</div>;

  return (
    <div className="container py-5">
      <div className="card shadow-sm p-4">
        <div className="d-flex justify-content-between">
          <div>
            <div className="small text-secondary">ROUND 2</div>
            <h1 className="h2">Mystery / Detective Case</h1>
          </div>
          <span className={`badge align-self-start ${state.unlocked ? "text-bg-success" : "text-bg-secondary"}`}>
            {state.unlocked ? "UNLOCKED" : "LOCKED"}
          </span>
        </div>

        {!state.unlocked ? (
          <div className="alert alert-secondary mt-4 mb-0">
            Round 2 is locked because the backend has not marked this participant as qualified.
          </div>
        ) : (
          <div className="mt-4">
            <p>Investigate the case, analyse the evidence, answer questions, use hints if necessary, and submit the final solution.</p>
            <button className="btn btn-dark" onClick={start}>Enter Case</button>
          </div>
        )}
      </div>
    </div>
  );
}
