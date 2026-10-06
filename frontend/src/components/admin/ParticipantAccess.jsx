import React, { useEffect, useState } from "react";
import { api } from "../../api.js";

export default function ParticipantAccess() {
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadParticipants() {
    try {
      const { data } = await api.get(
        "/admin/participants"
      );

      setParticipants(data);
      setError("");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to load participants."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadParticipants();
  }, []);

  async function changeQualification(
    participant,
    action
  ) {
    const isUnlock = action === "unlock";

    const confirmed = window.confirm(
      isUnlock
        ? `Unlock Round 2 for ${
            participant.name ||
            participant.username ||
            participant.email
          }?`
        : `Lock Round 2 for ${
            participant.name ||
            participant.username ||
            participant.email
          }?`
    );

    if (!confirmed) return;

    try {
      setError("");
      setMessage("");

      await api.post(
        `/admin/${action}/${participant._id}`
      );

      setMessage(
        isUnlock
          ? "Participant qualified for Round 2."
          : "Participant locked from Round 2."
      );

      await loadParticipants();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to change qualification."
      );
    }
  }

  if (loading) {
    return (
      <div className="card shadow-sm">
        <div className="card-body text-center py-5 text-secondary">
          Loading participants...
        </div>
      </div>
    );
  }

  return (
    <div className="card shadow-sm">
      <div className="card-body">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
          <div>
            <h2 className="h5 mb-1">
              Participant Round 2 Access
            </h2>

            <div className="small text-secondary">
              Manually qualify or lock participants.
            </div>
          </div>

          <button
            className="btn btn-sm btn-outline-dark"
            onClick={loadParticipants}
          >
            Refresh
          </button>
        </div>

        {error && (
          <div className="alert alert-danger">
            {error}
          </div>
        )}

        {message && (
          <div className="alert alert-success">
            {message}
          </div>
        )}

        {participants.length === 0 ? (
          <div className="text-secondary text-center py-4">
            No participants found.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover align-middle">
              <thead>
                <tr>
                  <th>Participant</th>
                  <th>Email</th>
                  <th>Team</th>
                  <th>Round 1</th>
                  <th>Qualification</th>
                  <th>Round 2</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {participants.map(participant => (
                  <tr key={participant._id}>
                    <td>
                      <div className="fw-semibold">
                        {participant.name ||
                          participant.username ||
                          "Unnamed"}
                      </div>

                      {participant.username && (
                        <div className="small text-secondary">
                          @{participant.username}
                        </div>
                      )}
                    </td>

                    <td>
                      {participant.email}
                    </td>

                    <td>
                      {participant.teamName ||
                        participant.teamId ||
                        "—"}
                    </td>

                    <td>
                      <div>
                        {participant.round1Status ||
                          "—"}
                      </div>

                      <div className="small text-secondary">
                        Score:{" "}
                        {participant.round1Score ?? 0}
                      </div>
                    </td>

                    <td>
                      <span
                        className={`badge ${
                          participant.qualificationStatus ===
                          "QUALIFIED"
                            ? "text-bg-success"
                            : "text-bg-danger"
                        }`}
                      >
                        {participant.qualificationStatus ||
                          "NOT_QUALIFIED"}
                      </span>
                    </td>

                    <td>
                      <div>
                        {participant.round2Status ||
                          "NOT_STARTED"}
                      </div>

                      <div className="small text-secondary">
                        Score:{" "}
                        {participant.round2Score ?? 0}
                      </div>
                    </td>

                    <td>
                      <div className="d-flex flex-wrap gap-1">
                        {participant.qualificationStatus ===
                        "QUALIFIED" ? (
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() =>
                              changeQualification(
                                participant,
                                "lock"
                              )
                            }
                          >
                            Lock
                          </button>
                        ) : (
                          <button
                            className="btn btn-sm btn-outline-success"
                            onClick={() =>
                              changeQualification(
                                participant,
                                "unlock"
                              )
                            }
                          >
                            Unlock
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
