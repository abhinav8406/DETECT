import React, { useEffect, useState } from "react";
import { api } from "../../api.js";

function formatTime(ms) {
  if (!ms || ms <= 0) return "00:00";

  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(
    seconds
  ).padStart(2, "0")}`;
}

function statusLabel(status) {
  const labels = {
    NOT_STARTED: "Not Started",
    CASE_STARTED: "Case Started",
    CLUE_AVAILABLE: "Clue Available",
    QUESTION_IN_PROGRESS: "Question In Progress",
    HINT_USED: "Hint Used",
    QUESTION_COMPLETED: "Question Completed",
    FINAL_ANSWER: "Final Answer",
    CASE_COMPLETED: "Completed",
    TIME_EXPIRED: "Time Expired"
  };

  return labels[status] || status || "Unknown";
}

function statusClass(status) {
  if (status === "CASE_COMPLETED") {
    return "text-bg-success";
  }

  if (status === "TIME_EXPIRED") {
    return "text-bg-danger";
  }

  if (status === "NOT_STARTED") {
    return "text-bg-secondary";
  }

  return "text-bg-primary";
}

export default function MonitoringTable() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadMonitoring() {
    try {
      const { data } = await api.get("/admin/monitoring");
      setRows(data);
      setError("");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to load monitoring data."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMonitoring();

    const interval = setInterval(() => {
      loadMonitoring();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="card shadow-sm">
      <div className="card-body">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <div>
            <h2 className="h5 mb-1">
              Live Monitoring
            </h2>

            <div className="small text-secondary">
              Participant activity refreshes every 5 seconds.
            </div>
          </div>

          <button
            className="btn btn-sm btn-outline-dark"
            onClick={loadMonitoring}
            disabled={loading}
          >
            Refresh
          </button>
        </div>

        {error && (
          <div className="alert alert-danger">
            {error}
          </div>
        )}

        {loading && rows.length === 0 ? (
          <div className="text-center py-5 text-secondary">
            Loading monitoring data...
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-5 text-secondary">
            No detective attempts yet.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead>
                <tr>
                  <th>Participant</th>
                  <th>Team</th>
                  <th>Qualification</th>
                  <th>Case</th>
                  <th>Clue</th>
                  <th>Question</th>
                  <th>Hints</th>
                  <th>Score</th>
                  <th>Time</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row, index) => {
                  const participant = row.participant || {};

                  return (
                    <tr
                      key={
                        row.attemptId ||
                        row._id ||
                        `${participant._id}-${index}`
                      }
                    >
                      <td>
                        <div className="fw-semibold">
                          {participant.name ||
                            participant.username ||
                            "Unknown"}
                        </div>

                        <div className="small text-secondary">
                          {participant.email || "—"}
                        </div>
                      </td>

                      <td>
                        {participant.teamName ||
                          participant.teamId ||
                          "—"}
                      </td>

                      <td>
                        <span
                          className={`badge ${
                            participant.qualificationStatus ===
                            "QUALIFIED"
                              ? "text-bg-success"
                              : "text-bg-secondary"
                          }`}
                        >
                          {participant.qualificationStatus ||
                            "UNKNOWN"}
                        </span>
                      </td>

                      <td>
                        {row.case?.title ||
                          row.caseId?.title ||
                          "—"}
                      </td>

                      <td>
                        {row.currentClue ?? "—"}
                      </td>

                      <td>
                        {row.currentQuestion ?? "—"}
                      </td>

                      <td>
                        {row.hintsUsed ?? 0}
                      </td>

                      <td>
                        <strong>
                          {row.score ?? 0}
                        </strong>
                      </td>

                      <td>
                        <span
                          className={
                            row.timeRemaining <= 60000
                              ? "text-danger fw-semibold"
                              : ""
                          }
                        >
                          {formatTime(
                            row.timeRemaining
                          )}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`badge ${statusClass(
                            row.status
                          )}`}
                        >
                          {statusLabel(row.status)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
