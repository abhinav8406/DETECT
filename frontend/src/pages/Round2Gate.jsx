import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { useNavigate } from "react-router-dom";

export default function Round2Gate() {
  const [state, setState] = useState(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    loadAccess();
  }, []);

  async function loadAccess() {
    try {
      const { data } = await api.get("/detective/access");
      setState(data);
    } catch (err) {
      setState({
        unlocked: false
      });

      setError(
        err.response?.data?.message ||
        "Failed to check Round 2 access."
      );
    }
  }

  async function start() {
    if (starting) return;

    setStarting(true);
    setError("");

    try {
      const { data } =
        await api.post("/detective/attempts");

      const attemptId =
        data.attempt?._id;

      if (!attemptId) {
        throw new Error(
          "Backend did not return an attempt ID."
        );
      }

      navigate(
        `/round2/case?attempt=${attemptId}`
      );

    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.message ||
        "Failed to start Round 2."
      );

      setStarting(false);
    }
  }

  if (!state) {
    return (
      <div className="container py-5">
        Checking qualification…
      </div>
    );
  }

  return (
    <div className="container py-5">
      <div className="card shadow-sm p-4">

        <div className="d-flex justify-content-between">

          <div>
            <div className="small text-secondary">
              ROUND 2
            </div>

            <h1 className="h2">
              Mystery / Detective Case
            </h1>
          </div>

          <span
            className={`badge align-self-start ${
              state.unlocked
                ? "text-bg-success"
                : "text-bg-secondary"
            }`}
          >
            {state.unlocked
              ? "UNLOCKED"
              : "LOCKED"}
          </span>

        </div>

        {error && (
          <div className="alert alert-danger mt-4">
            {error}
          </div>
        )}

        {!state.unlocked ? (

          <div className="alert alert-secondary mt-4 mb-0">
            Round 2 is locked because the backend
            has not marked this participant as
            qualified.
          </div>

        ) : (

          <div className="mt-4">

            <p>
              Investigate the case, analyse the
              evidence, answer questions, use hints
              if necessary, and submit the final
              solution.
            </p>

            <button
              className="btn btn-dark"
              onClick={start}
              disabled={starting}
            >
              {starting
                ? "Starting Case..."
                : "Enter Case"}
            </button>

          </div>

        )}

      </div>
    </div>
  );
}
