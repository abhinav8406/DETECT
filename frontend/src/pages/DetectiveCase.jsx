import React, { useCallback, useEffect, useState } from "react";
import { useSearchParams, Navigate } from "react-router-dom";
import { api } from "../api.js";
import Timer from "../components/Timer.jsx";
import CaseStory from "../components/CaseStory.jsx";
import CluePanel from "../components/CluePanel.jsx";
import QuestionPanel from "../components/QuestionPanel.jsx";

export default function DetectiveCase() {
  const [params] = useSearchParams();
  const attemptId = params.get("attempt");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [started, setStarted] = useState(false);
  const [hint, setHint] = useState(null);
  const [final, setFinal] = useState({ culprit: "", time: "", method: "", motive: "", evidenceClues: [] });

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/detective/attempts/${attemptId}`);
      setData(data);
    } catch (e) {
      setError(e.response?.data?.message || "Could not load case");
    }
  }, [attemptId]);

  useEffect(() => { if (attemptId) load(); }, [attemptId, load]);

  if (!attemptId) return <Navigate to="/round2" replace />;
  if (error) return <div className="container py-5"><div className="alert alert-danger">{error}</div></div>;
  if (!data) return <div className="container py-5">Loading case…</div>;

  async function answer(selectedOption) {
    try {
      await api.post(`/detective/attempts/${attemptId}/answer`, {
        questionId: data.question.id,
        selectedOption
      });
      setHint(null);
      await load();
    } catch (e) {
      setError(e.response?.data?.message || "Submission rejected");
    }
  }

  async function useHint() {
    const available = data.hints?.find(h => !data.usedHintIds?.includes(h.id));
    if (!available) { setHint("No unused hint is available for this question."); return; }
    try {
      const r = await api.post(`/detective/attempts/${attemptId}/hints/${available.id}/use`);
      setHint(`${r.data.hintText} (-${r.data.penalty} points)`);
      await load();
    } catch (e) {
      setError(e.response?.data?.message || "Hint request rejected");
    }
  }

  async function submitFinal(e) {
    e.preventDefault();
    try {
      await api.post(`/detective/attempts/${attemptId}/final`, final);
      await load();
    } catch (e) {
      setError(e.response?.data?.message || "Final submission rejected");
    }
  }

  if (data.attempt.status === "CASE_COMPLETED" || data.attempt.status === "TIME_EXPIRED") {
    return (
      <div className="container py-5">
        <div className="card shadow-sm p-5 text-center">
          <h1 className="h2">{data.attempt.status === "CASE_COMPLETED" ? "Case Completed" : "Time Expired"}</h1>
          <p className="display-6 my-3">{data.attempt.score} points</p>
          <p className="text-secondary">The backend has recorded the final state of this attempt.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <div className="small text-secondary">ROUND 2 · DETECTIVE CASE</div>
          <h1 className="h3 mb-0">{data.case.title}</h1>
        </div>
        <div className="text-end">
          <div className="small text-secondary">Score: {data.attempt.score}</div>
          <Timer expiresAt={data.attempt.expiresAt} onExpired={load} />
        </div>
      </div>

      {!started && <CaseStory caseData={data.case} onStart={() => setStarted(true)} />}

      {started && (
        <>
          <div className="progress-strip mb-3">
            <span>CASE</span><i className="active">1</i><span>CLUE</span><i className={data.attempt.currentClue >= 2 ? "active" : ""}>2</i><i className={data.attempt.currentClue >= 3 ? "active" : ""}>3</i><i className={data.attempt.currentClue >= 4 ? "active" : ""}>4</i><span>FINAL</span>
          </div>
          <CluePanel clue={data.clue} />
          <div className="mt-3">
            <QuestionPanel question={data.question} onSubmit={answer} />
          </div>

          {data.question && (
            <div className="mt-3">
              <button className="btn btn-outline-warning" onClick={useHint}>Request Hint</button>
              {hint && <div className="alert alert-warning mt-2">{hint}</div>}
            </div>
          )}

          {data.attempt.status === "FINAL_ANSWER" && (
            <form className="card shadow-sm p-4 mt-4" onSubmit={submitFinal}>
              <h2 className="h5">Final Answer</h2>
              {["culprit", "time", "method", "motive"].map(field => (
                <input
                  key={field}
                  className="form-control mb-2"
                  placeholder={field.toUpperCase()}
                  value={final[field]}
                  onChange={e => setFinal(v => ({ ...v, [field]: e.target.value }))}
                  required
                />
              ))}
              <button className="btn btn-danger">Submit Final Solution</button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
