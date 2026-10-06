import React, { useEffect, useState } from "react";
import { api } from "../../api.js";

const emptyHint = {
  questionId: "",
  sequenceNumber: 1,
  hintText: "",
  penalty: 20,
  isEnabled: true
};

export default function HintManager({ caseId }) {
  const [hints, setHints] = useState([]);
  const [questions, setQuestions] = useState([]);

  const [form, setForm] = useState(emptyHint);
  const [editingId, setEditingId] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadData() {
    if (!caseId) {
      setHints([]);
      setQuestions([]);
      return;
    }

    try {
      const { data } = await api.get(`/admin/cases/${caseId}`);

      const sortedQuestions = [...(data.questions || [])].sort(
        (a, b) =>
          Number(a.sequenceNumber || 0) -
          Number(b.sequenceNumber || 0)
      );

      const sortedHints = [...(data.hints || [])].sort(
        (a, b) =>
          Number(a.sequenceNumber || 0) -
          Number(b.sequenceNumber || 0)
      );

      setQuestions(sortedQuestions);
      setHints(sortedHints);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Failed to load hints."
      );
    }
  }

  useEffect(() => {
    loadData();
    resetForm();
  }, [caseId]);

  function resetForm() {
    setEditingId(null);

    setForm({
      ...emptyHint,
      questionId: "",
      sequenceNumber: hints.length + 1
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

  function editHint(hint) {
    setEditingId(hint._id);

    setForm({
      questionId:
        hint.questionId?._id ||
        hint.questionId ||
        "",
      sequenceNumber: hint.sequenceNumber ?? 1,
      hintText: hint.hintText || "",
      penalty: Number(hint.penalty ?? 0),
      isEnabled: hint.isEnabled !== false
    });

    setError("");
    setMessage("");
  }

  async function saveHint(e) {
    e.preventDefault();

    if (!caseId) {
      setError("Select a case first.");
      return;
    }

    if (!form.questionId) {
      setError("Select the question associated with this hint.");
      return;
    }

    if (!form.hintText.trim()) {
      setError("Hint text is required.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        caseId,
        questionId: form.questionId,
        sequenceNumber: Number(form.sequenceNumber),
        hintText: form.hintText.trim(),
        penalty: Number(form.penalty),
        isEnabled: Boolean(form.isEnabled)
      };

      if (editingId) {
        await api.patch(
          `/admin/hints/${editingId}`,
          payload
        );

        setMessage("Hint updated successfully.");
      } else {
        await api.post("/admin/hints", payload);

        setMessage("Hint created successfully.");
      }

      await loadData();

      setEditingId(null);

      setForm({
        ...emptyHint,
        questionId: form.questionId,
        sequenceNumber: hints.length + 2
      });
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Failed to save hint."
      );
    } finally {
      setLoading(false);
    }
  }

  async function toggleEnabled(hint) {
    try {
      setError("");
      setMessage("");

      await api.patch(
        `/admin/hints/${hint._id}/enable`,
        {
          isEnabled: !hint.isEnabled
        }
      );

      setMessage(
        hint.isEnabled
          ? "Hint disabled."
          : "Hint enabled."
      );

      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to change hint status."
      );
    }
  }

  async function deleteHint(id) {
    const confirmed = window.confirm(
      "Delete this hint?"
    );

    if (!confirmed) return;

    try {
      setError("");
      setMessage("");

      await api.delete(`/admin/hints/${id}`);

      if (editingId === id) {
        setEditingId(null);
      }

      setMessage("Hint deleted.");

      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to delete hint."
      );
    }
  }

  function questionName(questionId) {
    const question = questions.find(
      item =>
        String(item._id) === String(questionId)
    );

    if (!question) {
      return "Unknown question";
    }

    return `Q${question.sequenceNumber}: ${question.question}`;
  }

  if (!caseId) {
    return (
      <div className="card shadow-sm">
        <div className="card-body text-center py-5">
          <h3 className="h6">
            Hint Management
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
      {/* HINT LIST */}
      <div className="col-12 col-xl-5">
        <div className="card shadow-sm h-100">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h3 className="h6 mb-1">
                  Hints
                </h3>

                <div className="small text-secondary">
                  {hints.length} hint
                  {hints.length === 1 ? "" : "s"}
                </div>
              </div>

              <button
                className="btn btn-sm btn-dark"
                disabled={questions.length === 0}
                onClick={() => {
                  setEditingId(null);

                  setForm({
                    ...emptyHint,
                    questionId:
                      questions[0]?._id || "",
                    sequenceNumber:
                      hints.length + 1
                  });

                  setError("");
                  setMessage("");
                }}
              >
                + Add Hint
              </button>
            </div>

            {questions.length === 0 && (
              <div className="alert alert-warning small">
                Create questions before adding hints.
              </div>
            )}

            {hints.length === 0 ? (
              <div className="text-secondary">
                No hints created yet.
              </div>
            ) : (
              <div className="list-group">
                {hints.map(hint => (
                  <div
                    className="list-group-item"
                    key={hint._id}
                  >
                    <div className="d-flex gap-3">
                      <div>
                        <span className="badge text-bg-dark">
                          #{hint.sequenceNumber}
                        </span>
                      </div>

                      <div className="flex-grow-1">
                        <div className="fw-semibold">
                          {hint.hintText}
                        </div>

                        <div className="small text-secondary mt-1">
                          {questionName(
                            hint.questionId?._id ||
                            hint.questionId
                          )}
                        </div>

                        <div className="small text-secondary">
                          Penalty: {hint.penalty}
                        </div>

                        <div className="mt-2">
                          <span
                            className={`badge ${
                              hint.isEnabled
                                ? "text-bg-success"
                                : "text-bg-secondary"
                            }`}
                          >
                            {hint.isEnabled
                              ? "Enabled"
                              : "Disabled"}
                          </span>
                        </div>

                        <div className="d-flex flex-wrap gap-1 mt-2">
                          <button
                            className="btn btn-sm btn-outline-dark"
                            onClick={() =>
                              editHint(hint)
                            }
                          >
                            Edit
                          </button>

                          <button
                            className="btn btn-sm btn-outline-warning"
                            onClick={() =>
                              toggleEnabled(hint)
                            }
                          >
                            {hint.isEnabled
                              ? "Disable"
                              : "Enable"}
                          </button>

                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() =>
                              deleteHint(hint._id)
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

      {/* HINT EDITOR */}
      <div className="col-12 col-xl-7">
        <div className="card shadow-sm">
          <div className="card-body">
            <h3 className="h6 mb-3">
              {editingId
                ? "Edit Hint"
                : "Create Hint"}
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

            {questions.length === 0 ? (
              <div className="text-secondary">
                Create at least one question before
                configuring hints.
              </div>
            ) : (
              <form onSubmit={saveHint}>
                <div className="row g-3">
                  {/* SEQUENCE */}
                  <div className="col-md-4">
                    <label className="form-label">
                      Hint Order
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

                  {/* QUESTION */}
                  <div className="col-md-8">
                    <label className="form-label">
                      Associated Question
                    </label>

                    <select
                      className="form-select"
                      value={form.questionId}
                      onChange={e =>
                        updateField(
                          "questionId",
                          e.target.value
                        )
                      }
                      required
                    >
                      <option value="">
                        Select question
                      </option>

                      {questions.map(question => (
                        <option
                          key={question._id}
                          value={question._id}
                        >
                          Q{question.sequenceNumber} —{" "}
                          {question.question}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* HINT TEXT */}
                  <div className="col-12">
                    <label className="form-label">
                      Hint Text
                    </label>

                    <textarea
                      className="form-control"
                      rows="5"
                      value={form.hintText}
                      onChange={e =>
                        updateField(
                          "hintText",
                          e.target.value
                        )
                      }
                      placeholder="Give the participant a useful hint without revealing the answer..."
                      required
                    />
                  </div>

                  {/* PENALTY */}
                  <div className="col-md-6">
                    <label className="form-label">
                      Score Penalty
                    </label>

                    <input
                      type="number"
                      min="0"
                      className="form-control"
                      value={form.penalty}
                      onChange={e =>
                        updateField(
                          "penalty",
                          e.target.value
                        )
                      }
                      required
                    />

                    <div className="form-text">
                      Points deducted when this hint is used.
                    </div>
                  </div>

                  {/* ENABLE */}
                  <div className="col-md-6 d-flex align-items-end">
                    <div className="form-check mb-2">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="hintEnabled"
                        checked={form.isEnabled}
                        onChange={e =>
                          updateField(
                            "isEnabled",
                            e.target.checked
                          )
                        }
                      />

                      <label
                        className="form-check-label"
                        htmlFor="hintEnabled"
                      >
                        Enable this hint
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
                        ? "Update Hint"
                        : "Create Hint"}
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
