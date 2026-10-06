import React, { useEffect, useState } from "react";
import { api } from "../../api.js";

const emptyClue = {
  sequenceNumber: 1,
  title: "",
  description: "",
  evidence: "",
  evidenceType: "TEXT",
  timestamp: "",
  location: "",
  relatedSuspect: "",
  unlockCondition: "",
  classification: "NEUTRAL",
  isPublished: true
};

export default function ClueManager({ caseId }) {
  const [clues, setClues] = useState([]);
  const [form, setForm] = useState(emptyClue);
  const [editingId, setEditingId] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadClues() {
    if (!caseId) {
      setClues([]);
      return;
    }

    try {
      const { data } = await api.get(`/admin/cases/${caseId}`);

      const sorted = [...(data.clues || [])].sort(
        (a, b) =>
          Number(a.sequenceNumber || 0) -
          Number(b.sequenceNumber || 0)
      );

      setClues(sorted);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Failed to load clues."
      );
    }
  }

  useEffect(() => {
    loadClues();
    resetForm();
  }, [caseId]);

  function resetForm() {
    setEditingId(null);

    setForm({
      ...emptyClue,
      sequenceNumber: clues.length + 1
    });

    setError("");
    setMessage("");
  }

  function updateField(field, value) {
    setForm(prev => ({
      ...prev,
      [field]: value
    }));
  }

  function editClue(clue) {
    setEditingId(clue._id);

    setForm({
      sequenceNumber: clue.sequenceNumber ?? 1,
      title: clue.title || "",
      description: clue.description || "",
      evidence: clue.evidence || "",
      evidenceType: clue.evidenceType || "TEXT",
      timestamp: clue.timestamp || "",
      location: clue.location || "",
      relatedSuspect: clue.relatedSuspect || "",
      unlockCondition: clue.unlockCondition || "",
      classification: clue.classification || "NEUTRAL",
      isPublished: clue.isPublished !== false
    });

    setError("");
    setMessage("");
  }

  async function saveClue(e) {
    e.preventDefault();

    if (!caseId) {
      setError("Select a case first.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        caseId,
        sequenceNumber: Number(form.sequenceNumber),
        title: form.title.trim(),
        description: form.description.trim(),
        evidence: form.evidence.trim(),
        evidenceType: form.evidenceType,
        timestamp: form.timestamp.trim(),
        location: form.location.trim(),
        relatedSuspect: form.relatedSuspect.trim(),
        unlockCondition: form.unlockCondition.trim(),
        classification: form.classification,
        isPublished: Boolean(form.isPublished)
      };

      if (editingId) {
        await api.patch(
          `/admin/clues/${editingId}`,
          payload
        );

        setMessage("Clue updated successfully.");
      } else {
        await api.post("/admin/clues", payload);

        setMessage("Clue created successfully.");
      }

      await loadClues();

      setEditingId(null);

      setForm({
        ...emptyClue,
        sequenceNumber: clues.length + 2
      });
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Failed to save clue."
      );
    } finally {
      setLoading(false);
    }
  }

  async function togglePublished(clue) {
    try {
      setError("");
      setMessage("");

      await api.patch(
        `/admin/clues/${clue._id}/publish`,
        {
          isPublished: !clue.isPublished
        }
      );

      setMessage(
        clue.isPublished
          ? "Clue unpublished."
          : "Clue published."
      );

      await loadClues();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to change clue publication status."
      );
    }
  }

  async function deleteClue(id) {
    const confirmed = window.confirm(
      "Delete this clue?"
    );

    if (!confirmed) return;

    try {
      setError("");
      setMessage("");

      await api.delete(`/admin/clues/${id}`);

      if (editingId === id) {
        setEditingId(null);
      }

      setMessage("Clue deleted.");

      await loadClues();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to delete clue."
      );
    }
  }

  if (!caseId) {
    return (
      <div className="card shadow-sm">
        <div className="card-body text-center py-5">
          <h3 className="h6">
            Clue Management
          </h3>

          <p className="text-secondary mb-0">
            Select or create a detective case first.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="row g-4">
      {/* CLUE LIST */}
      <div className="col-12 col-xl-5">
        <div className="card shadow-sm h-100">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h3 className="h6 mb-1">
                  Clues
                </h3>

                <div className="small text-secondary">
                  {clues.length} clue
                  {clues.length === 1 ? "" : "s"}
                </div>
              </div>

              <button
                className="btn btn-sm btn-dark"
                onClick={() => {
                  setEditingId(null);

                  setForm({
                    ...emptyClue,
                    sequenceNumber:
                      clues.length + 1
                  });

                  setError("");
                  setMessage("");
                }}
              >
                + Add Clue
              </button>
            </div>

            {clues.length === 0 ? (
              <div className="text-secondary">
                No clues created yet.
              </div>
            ) : (
              <div className="list-group">
                {clues.map((clue, index) => (
                  <div
                    className="list-group-item"
                    key={clue._id}
                  >
                    <div className="d-flex gap-3">
                      <div>
                        <span className="badge text-bg-dark">
                          #{clue.sequenceNumber}
                        </span>
                      </div>

                      <div className="flex-grow-1">
                        <div className="fw-semibold">
                          {clue.title ||
                            `Clue ${index + 1}`}
                        </div>

                        <div className="small text-secondary mt-1">
                          {clue.evidenceType}
                          {" · "}
                          {clue.classification}
                        </div>

                        <div className="mt-2">
                          <span
                            className={`badge ${
                              clue.isPublished
                                ? "text-bg-success"
                                : "text-bg-secondary"
                            }`}
                          >
                            {clue.isPublished
                              ? "Published"
                              : "Hidden"}
                          </span>
                        </div>

                        <div className="d-flex flex-wrap gap-1 mt-2">
                          <button
                            className="btn btn-sm btn-outline-dark"
                            onClick={() =>
                              editClue(clue)
                            }
                          >
                            Edit
                          </button>

                          <button
                            className="btn btn-sm btn-outline-warning"
                            onClick={() =>
                              togglePublished(clue)
                            }
                          >
                            {clue.isPublished
                              ? "Unpublish"
                              : "Publish"}
                          </button>

                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() =>
                              deleteClue(clue._id)
                            }
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CLUE EDITOR */}
      <div className="col-12 col-xl-7">
        <div className="card shadow-sm">
          <div className="card-body">
            <h3 className="h6 mb-3">
              {editingId
                ? "Edit Clue"
                : "Create Clue"}
            </h3>

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

            <form onSubmit={saveClue}>
              <div className="row g-3">
                {/* SEQUENCE */}
                <div className="col-md-4">
                  <label className="form-label">
                    Sequence
                  </label>

                  <input
                    type="number"
                    min="1"
                    className="form-control"
                    value={form.sequenceNumber}
                    onChange={e =>
                      updateField(
                        "sequenceNumber",
                        e.target.value
                      )
                    }
                    required
                  />
                </div>

                {/* TYPE */}
                <div className="col-md-4">
                  <label className="form-label">
                    Evidence Type
                  </label>

                  <select
                    className="form-select"
                    value={form.evidenceType}
                    onChange={e =>
                      updateField(
                        "evidenceType",
                        e.target.value
                      )
                    }
                  >
                    <option value="TEXT">
                      Text
                    </option>

                    <option value="IMAGE">
                      Image
                    </option>

                    <option value="DOCUMENT">
                      Document
                    </option>

                    <option value="CCTV">
                      CCTV
                    </option>

                    <option value="DIGITAL">
                      Digital
                    </option>
                  </select>
                </div>

                {/* CLASSIFICATION */}
                <div className="col-md-4">
                  <label className="form-label">
                    Classification
                  </label>

                  <select
                    className="form-select"
                    value={form.classification}
                    onChange={e =>
                      updateField(
                        "classification",
                        e.target.value
                      )
                    }
                  >
                    <option value="SUPPORTING">
                      Supporting
                    </option>

                    <option value="NEUTRAL">
                      Neutral
                    </option>

                    <option value="MISLEADING">
                      Misleading
                    </option>

                    <option value="CRITICAL">
                      Critical
                    </option>
                  </select>

                  <div className="form-text">
                    Admin-only clue classification.
                  </div>
                </div>

                {/* TITLE */}
                <div className="col-12">
                  <label className="form-label">
                    Clue Title
                  </label>

                  <input
                    className="form-control"
                    value={form.title}
                    onChange={e =>
                      updateField(
                        "title",
                        e.target.value
                      )
                    }
                    placeholder="Broken access card"
                    required
                  />
                </div>

                {/* DESCRIPTION */}
                <div className="col-12">
                  <label className="form-label">
                    Description
                  </label>

                  <textarea
                    className="form-control"
                    rows="4"
                    value={form.description}
                    onChange={e =>
                      updateField(
                        "description",
                        e.target.value
                      )
                    }
                    placeholder="Describe what the participant discovers..."
                    required
                  />
                </div>

                {/* EVIDENCE */}
                <div className="col-12">
                  <label className="form-label">
                    Evidence
                  </label>

                  <textarea
                    className="form-control"
                    rows="3"
                    value={form.evidence}
                    onChange={e =>
                      updateField(
                        "evidence",
                        e.target.value
                      )
                    }
                    placeholder="Evidence associated with this clue..."
                  />
                </div>

                {/* TIMESTAMP */}
                <div className="col-md-6">
                  <label className="form-label">
                    Timestamp
                  </label>

                  <input
                    className="form-control"
                    value={form.timestamp}
                    onChange={e =>
                      updateField(
                        "timestamp",
                        e.target.value
                      )
                    }
                    placeholder="21:45"
                  />
                </div>

                {/* LOCATION */}
                <div className="col-md-6">
                  <label className="form-label">
                    Location
                  </label>

                  <input
                    className="form-control"
                    value={form.location}
                    onChange={e =>
                      updateField(
                        "location",
                        e.target.value
                      )
                    }
                    placeholder="Research Lab"
                  />
                </div>

                {/* SUSPECT */}
                <div className="col-md-6">
                  <label className="form-label">
                    Related Suspect
                  </label>

                  <input
                    className="form-control"
                    value={form.relatedSuspect}
                    onChange={e =>
                      updateField(
                        "relatedSuspect",
                        e.target.value
                      )
                    }
                    placeholder="Suspect name"
                  />
                </div>

                {/* UNLOCK */}
                <div className="col-md-6">
                  <label className="form-label">
                    Unlock Condition
                  </label>

                  <input
                    className="form-control"
                    value={form.unlockCondition}
                    onChange={e =>
                      updateField(
                        "unlockCondition",
                        e.target.value
                      )
                    }
                    placeholder="Previous question completed"
                  />
                </div>

                {/* PUBLISH */}
                <div className="col-12">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="cluePublished"
                      checked={form.isPublished}
                      onChange={e =>
                        updateField(
                          "isPublished",
                          e.target.checked
                        )
                      }
                    />

                    <label
                      className="form-check-label"
                      htmlFor="cluePublished"
                    >
                      Publish this clue
                    </label>
                  </div>
                </div>
              </div>

              <div className="d-flex gap-2 mt-4">
                <button
                  type="submit"
                  className="btn btn-dark"
                  disabled={loading}
                >
                  {loading
                    ? "Saving..."
                    : editingId
                      ? "Update Clue"
                      : "Create Clue"}
                </button>

                {editingId && (
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={resetForm}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
