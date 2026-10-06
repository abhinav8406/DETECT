import React, { useEffect, useMemo, useState } from "react";
import { api } from "../../api.js";

const EMPTY_CLUE = {
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

const EVIDENCE_TYPES = [
  ["TEXT", "Text"],
  ["IMAGE", "Image"],
  ["DOCUMENT", "Document"],
  ["CCTV", "CCTV"],
  ["DIGITAL", "Digital Evidence"]
];

const CLASSIFICATIONS = [
  ["SUPPORTING", "Supporting"],
  ["NEUTRAL", "Neutral"],
  ["MISLEADING", "Misleading"],
  ["CRITICAL", "Critical"]
];

export default function ClueManager({ caseId }) {
  const [clues, setClues] = useState([]);
  const [form, setForm] = useState(EMPTY_CLUE);
  const [editingId, setEditingId] = useState(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const sortedClues = useMemo(() => {
    return [...clues].sort(
      (a, b) =>
        Number(a.sequenceNumber || 0) -
        Number(b.sequenceNumber || 0)
    );
  }, [clues]);

  useEffect(() => {
    if (!caseId) {
      setClues([]);
      resetForm();
      return;
    }

    loadClues();
  }, [caseId]);

  function resetForm() {
    setForm({
      ...EMPTY_CLUE,
      sequenceNumber: Math.max(1, clues.length + 1)
    });

    setEditingId(null);
  }

  async function loadClues() {
    try {
      setLoading(true);
      setError("");

      const { data } = await api.get(
        `/admin/clues/case/${caseId}`
      );

      setClues(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to load clues"
      );
    } finally {
      setLoading(false);
    }
  }

  function updateField(field, value) {
    setForm(previous => ({
      ...previous,
      [field]: value
    }));
  }

  function editClue(clue) {
    setSuccess("");
    setError("");

    setEditingId(clue._id);

    setForm({
      sequenceNumber: clue.sequenceNumber ?? 1,
      title: clue.title ?? "",
      description: clue.description ?? "",
      evidence: clue.evidence ?? "",
      evidenceType: clue.evidenceType ?? "TEXT",
      timestamp: clue.timestamp ?? "",
      location: clue.location ?? "",
      relatedSuspect: clue.relatedSuspect ?? "",
      unlockCondition: clue.unlockCondition ?? "",
      classification: clue.classification ?? "NEUTRAL",
      isPublished: clue.isPublished !== false
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  async function saveClue(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!form.title.trim()) {
      setError("Clue title is required.");
      return;
    }

    if (!form.description.trim()) {
      setError("Clue description is required.");
      return;
    }

    if (Number(form.sequenceNumber) < 1) {
      setError("Clue order must be at least 1.");
      return;
    }

    try {
      setSaving(true);

      const payload = {
        ...form,
        caseId,
        sequenceNumber: Number(form.sequenceNumber)
      };

      if (editingId) {
        await api.patch(
          `/admin/clues/${editingId}`,
          payload
        );

        setSuccess("Clue updated successfully.");
      } else {
        await api.post("/admin/clues", payload);

        setSuccess("Clue created successfully.");
      }

      await loadClues();

      setForm({
        ...EMPTY_CLUE,
        sequenceNumber: clues.length + 2
      });

      setEditingId(null);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to save clue"
      );
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(clue) {
    try {
      setError("");
      setSuccess("");

      await api.patch(
        `/admin/clues/${clue._id}/publish`,
        {
          isPublished: !clue.isPublished
        }
      );

      setSuccess(
        clue.isPublished
          ? "Clue unpublished."
          : "Clue published."
      );

      await loadClues();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to change clue status"
      );
    }
  }

  async function deleteClue(clue) {
    const confirmed = window.confirm(
      `Delete "${clue.title}"? This cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setSuccess("");

      await api.delete(
        `/admin/clues/${clue._id}`
      );

      setSuccess("Clue deleted successfully.");

      if (editingId === clue._id) {
        resetForm();
      }

      await loadClues();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to delete clue"
      );
    }
  }

  if (!caseId) {
    return (
      <div className="alert alert-warning">
        Select a case from the Cases tab first.
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="mb-1">
            Clue Management
          </h3>

          <p className="text-secondary mb-0">
            Create and manage the evidence sequence
            for this detective case.
          </p>
        </div>

        <span className="badge text-bg-dark">
          {clues.length} clue
          {clues.length === 1 ? "" : "s"}
        </span>
      </div>

      {error && (
        <div className="alert alert-danger">
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          {success}
        </div>
      )}

      {/* FORM */}

      <div className="card shadow-sm mb-4">
        <div className="card-header fw-semibold">
          {editingId
            ? "Edit Clue"
            : "Create New Clue"}
        </div>

        <div className="card-body">
          <form onSubmit={saveClue}>
            <div className="row g-3">

              {/* ORDER */}

              <div className="col-md-2">
                <label className="form-label">
                  Clue Order
                </label>

                <input
                  className="form-control"
                  type="number"
                  min="1"
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

              {/* TITLE */}

              <div className="col-md-10">
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
                  placeholder="e.g. CCTV Entry Log"
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
                  Evidence / Digital Information
                </label>

                <textarea
                  className="form-control"
                  rows="4"
                  value={form.evidence}
                  onChange={e =>
                    updateField(
                      "evidence",
                      e.target.value
                    )
                  }
                  placeholder="Add evidence text, encoded data, digital information, etc."
                />

                <div className="form-text">
                  File/image upload will be added in a later phase.
                </div>
              </div>

              {/* EVIDENCE TYPE */}

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
                  {EVIDENCE_TYPES.map(
                    ([value, label]) => (
                      <option
                        key={value}
                        value={value}
                      >
                        {label}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* TIMESTAMP */}

              <div className="col-md-4">
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
                  placeholder="e.g. 8:42 PM"
                />
              </div>

              {/* LOCATION */}

              <div className="col-md-4">
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
                  placeholder="e.g. Research Lab"
                />
              </div>

              {/* RELATED SUSPECT */}

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
                  placeholder="e.g. Dr. Mehta"
                />
              </div>

              {/* UNLOCK CONDITION */}

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
                  placeholder="e.g. Question 1 completed"
                />
              </div>

              {/* CLASSIFICATION */}

              <div className="col-md-6">
                <label className="form-label">
                  Internal Classification
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
                  {CLASSIFICATIONS.map(
                    ([value, label]) => (
                      <option
                        key={value}
                        value={value}
                      >
                        {label}
                      </option>
                    )
                  )}
                </select>

                <div className="form-text">
                  This is visible only to administrators.
                </div>
              </div>

              {/* PUBLISH */}

              <div className="col-md-6 d-flex align-items-end">
                <div className="form-check mb-2">
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
                    Publish clue
                  </label>
                </div>
              </div>

            </div>

            <div className="d-flex gap-2 mt-4">
              <button
                type="submit"
                className="btn btn-dark"
                disabled={saving}
              >
                {saving
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
                  disabled={saving}
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* CLUE LIST */}

      <div className="card shadow-sm">
        <div className="card-header fw-semibold">
          Clue Sequence
        </div>

        <div className="card-body p-0">
          {loading ? (
            <div className="p-4 text-secondary">
              Loading clues...
            </div>
          ) : sortedClues.length === 0 ? (
            <div className="p-4 text-secondary">
              No clues have been created for this case yet.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>#</th>
                    <th>Clue</th>
                    <th>Evidence</th>
                    <th>Suspect</th>
                    <th>Classification</th>
                    <th>Status</th>
                    <th className="text-end">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {sortedClues.map(clue => (
                    <tr key={clue._id}>
                      <td>
                        <strong>
                          {clue.sequenceNumber}
                        </strong>
                      </td>

                      <td>
                        <div className="fw-semibold">
                          {clue.title}
                        </div>

                        <small className="text-secondary">
                          {clue.evidenceType}
                        </small>
                      </td>

                      <td>
                        {clue.evidence ? (
                          <span>
                            {clue.evidence.length > 70
                              ? `${clue.evidence.slice(
                                  0,
                                  70
                                )}...`
                              : clue.evidence}
                          </span>
                        ) : (
                          <span className="text-secondary">
                            —
                          </span>
                        )}
                      </td>

                      <td>
                        {clue.relatedSuspect || "—"}
                      </td>

                      <td>
                        <span className="badge text-bg-secondary">
                          {clue.classification}
                        </span>
                      </td>

                      <td>
                        {clue.isPublished ? (
                          <span className="badge text-bg-success">
                            Published
                          </span>
                        ) : (
                          <span className="badge text-bg-warning">
                            Unpublished
                          </span>
                        )}
                      </td>

                      <td className="text-end">
                        <div className="btn-group btn-group-sm">
                          <button
                            className="btn btn-outline-primary"
                            onClick={() =>
                              editClue(clue)
                            }
                          >
                            Edit
                          </button>

                          <button
                            className="btn btn-outline-secondary"
                            onClick={() =>
                              togglePublish(clue)
                            }
                          >
                            {clue.isPublished
                              ? "Unpublish"
                              : "Publish"}
                          </button>

                          <button
                            className="btn btn-outline-danger"
                            onClick={() =>
                              deleteClue(clue)
                            }
                          >
                            Delete
                          </button>
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
    </div>
  );
}
