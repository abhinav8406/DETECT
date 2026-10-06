import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";

export default function Dashboard() {
  const navigate = useNavigate();

  const [access, setAccess] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  const user = JSON.parse(localStorage.getItem("user") || "null");

  useEffect(() => {
    loadAccess();
  }, []);

  async function loadAccess() {
    try {
      setLoading(true);
      setError("");

      const response = await api.get("/detective/access");

      setAccess(response.data);
    } catch (err) {
      console.error("Round 2 access error:", err);

      setError(
        err.response?.data?.message ||
          "Unable to load Round 2 status."
      );
    } finally {
      setLoading(false);
    }
  }

  async function enterRound2() {
    if (!access?.unlocked || starting) {
      return;
    }

    try {
      setStarting(true);
      setError("");

      const response = await api.post("/detective/attempts");

      const attemptId =
  response.data?.attempt?._id ??
  response.data?.attemptId;

      if (!attemptId) {
        throw new Error("Backend did not return an attempt ID.");
      }

      navigate(`/round2/case?attempt=${attemptId}`);
    } catch (err) {
      console.error("Unable to start Round 2:", err);

      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to enter Round 2."
      );
    } finally {
      setStarting(false);
    }
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    navigate("/login", {
      replace: true,
    });
  }

  if (loading) {
    return (
      <div className="min-vh-100 d-flex align-items-center justify-content-center">
        <div className="text-center">
          <div
            className="spinner-border"
            role="status"
            aria-label="Loading"
          />

          <p className="mt-3 text-secondary">
            Loading dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-vh-100 bg-body-tertiary">
      {/* Navbar */}
      <nav className="navbar bg-dark navbar-dark">
        <div className="container">
          <span className="navbar-brand fw-bold">
            FEST DETECTIVE
          </span>

          <div className="d-flex align-items-center gap-3">
            <span className="text-light small">
              {user?.name || "Participant"}
            </span>

            <button
              type="button"
              className="btn btn-outline-light btn-sm"
              onClick={logout}
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main */}
      <main className="container py-5">
        {/* Header */}
        <div className="mb-5">
          <div className="text-uppercase small text-secondary fw-semibold">
            Participant Dashboard
          </div>

          <h1 className="display-6 fw-bold mt-1">
            Welcome, {user?.name || "Participant"}
          </h1>

          <p className="text-secondary">
            Complete the rounds and solve the mystery to
            progress through the fest.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="alert alert-danger">
            {error}
          </div>
        )}

        <div className="row g-4">
          {/* Round 1 */}
          <div className="col-md-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-body p-4">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <div className="small text-uppercase text-secondary">
                      Round 1
                    </div>

                    <h2 className="h4 fw-bold mt-1">
                      Qualification
                    </h2>
                  </div>

                  <span className="badge text-bg-success">
                    COMPLETED
                  </span>
                </div>

                <hr />

                <p className="text-secondary">
                  Your Round 1 qualification process has
                  been completed.
                </p>

                <div className="p-3 rounded bg-success-subtle">
                  <div className="small text-secondary">
                    Qualification Status
                  </div>

                  <div className="fw-bold text-success">
                    {access?.qualificationStatus === "QUALIFIED"
                      ? "QUALIFIED"
                      : access?.qualificationStatus || "UNKNOWN"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Round 2 */}
          <div className="col-md-6">
            <div
              className={`card border-0 shadow-sm h-100 ${
                access?.unlocked
                  ? "border-start border-4 border-success"
                  : ""
              }`}
            >
              <div className="card-body p-4">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <div className="small text-uppercase text-secondary">
                      Round 2
                    </div>

                    <h2 className="h4 fw-bold mt-1">
                      Mystery / Detective Case
                    </h2>
                  </div>

                  {access?.unlocked ? (
                    <span className="badge text-bg-success">
                      🔓 UNLOCKED
                    </span>
                  ) : (
                    <span className="badge text-bg-secondary">
                      🔒 LOCKED
                    </span>
                  )}
                </div>

                <hr />

                <p className="text-secondary">
                  Investigate a fictional case by analysing
                  clues, evidence, questions and suspect
                  information.
                </p>

                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <div className="bg-body-tertiary rounded p-3">
                      <div className="small text-secondary">
                        CASE TYPE
                      </div>

                      <div className="fw-semibold">
                        Detective
                      </div>
                    </div>
                  </div>

                  <div className="col-6">
                    <div className="bg-body-tertiary rounded p-3">
                      <div className="small text-secondary">
                        ACCESS
                      </div>

                      <div className="fw-semibold">
                        {access?.unlocked
                          ? "Available"
                          : "Locked"}
                      </div>
                    </div>
                  </div>
                </div>

                {access?.unlocked ? (
                  <button
                    type="button"
                    className="btn btn-dark btn-lg w-100"
                    onClick={enterRound2}
                    disabled={starting}
                  >
                    {starting ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm me-2"
                          role="status"
                          aria-hidden="true"
                        />

                        Entering Case...
                      </>
                    ) : (
                      <>Enter Mystery Case →</>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-secondary w-100"
                    disabled
                  >
                    🔒 Round 2 Locked
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* How it works */}
        <div className="card border-0 shadow-sm mt-4">
          <div className="card-body p-4">
            <h2 className="h5 fw-bold">
              How Round 2 Works
            </h2>

            <div className="row g-3 mt-1">
              <div className="col-md-3">
                <div className="p-3 bg-body-tertiary rounded h-100">
                  <strong>01. Case</strong>

                  <p className="small text-secondary mb-0 mt-1">
                    Read the case story and suspect
                    information.
                  </p>
                </div>
              </div>

              <div className="col-md-3">
                <div className="p-3 bg-body-tertiary rounded h-100">
                  <strong>02. Clues</strong>

                  <p className="small text-secondary mb-0 mt-1">
                    Analyse the evidence presented by the
                    case.
                  </p>
                </div>
              </div>

              <div className="col-md-3">
                <div className="p-3 bg-body-tertiary rounded h-100">
                  <strong>03. Questions</strong>

                  <p className="small text-secondary mb-0 mt-1">
                    Answer questions using multiple pieces
                    of evidence.
                  </p>
                </div>
              </div>

              <div className="col-md-3">
                <div className="p-3 bg-body-tertiary rounded h-100">
                  <strong>04. Solution</strong>

                  <p className="small text-secondary mb-0 mt-1">
                    Submit the final detective solution.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
