import React, { useEffect, useState } from "react";
import { api } from "../../api.js";

const EMPTY_HINT = {
  sequenceNumber: 1,
  hintText: "",
  penalty: 10,
  clueId: "",
  questionId: "",
  isEnabled: true
};

export default function HintManager({ caseId }) {
  const [hints, setHints] = useState([]);
  const [clues, setClues] = useState([]);
  const [questions, setQuestions] = useState([]);

  const [form, setForm] = useState(EMPTY_HINT);

  const [editingId, setEditingId] = useState(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadData() {
    if (!caseId) {
      setHints([]);
      setClues([]);
      setQuestions([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [hintsResponse, caseResponse] = await Promise.all([
        api.get(`/admin/cases/${caseId}/hints`),
        api.get(`/admin/cases/${caseId}`)
      ]);

      setHints(hintsResponse.data || []);

      setClues(caseResponse.data?.clues || []);
      setQuestions(caseResponse.data?.questions || []);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to load hint management data."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    resetForm();
  }, [caseId]);

  function resetForm() {
    setForm({
      ...EMPTY_HINT,
      sequenceNumber:
        hints.length > 0
          ? Math.max(
              ...hints.map(
                hint => Number(hint.sequenceNumber) || 0
              )
            ) + 1
          : 1
    });

    setEditingId(null);
  }

  function handleChange(event) {
    const { name, value, type, checked } = event.target;

    setForm(previous => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value
    }));
  }

  function validateForm() {
    if (!caseId) {
      return "Select a case first.";
    }

    if (
      !Number.isInteger(Number(form.sequenceNumber)) ||
      Number(form.sequenceNumber) < 1
    ) {
      return "Sequence number must be at least 1.";
    }

    if (!form.hintText.trim()) {
      return "Hint text is required.";
    }

    if (
      !Number.isFinite(Number(form.penalty)) ||
      Number(form.penalty) < 0
    ) {
      return "Penalty must be a non-negative number.";
    }

    if (!form.clueId && !form.questionId) {
      return "Select a clue or question for this hint.";
    }

    if (
      hints.some(
        hint =>
          Number(hint.sequenceNumber) ===
            Number(form.sequenceNumber) &&
          hint._id !== editingId
      )
    ) {
      return "This hint sequence number already exists.";
    }

    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);

    try {
      const payload = {
        caseId,
        sequenceNumber: Number(form.sequenceNumber),
        hintText: form.hintText.trim(),
        penalty: Number(form.penalty),
        clueId: form.clueId || null,
        questionId: form.questionId || null,
        isEnabled: Boolean(form.isEnabled)
      };

      if (editingId) {
        await api.patch(
          `/admin/hints/${editingId}`,
          payload
        );

        setSuccess("Hint updated successfully.");
      } else {
        await api.post("/admin/hints", payload);

        setSuccess("Hint created successfully.");
      }

      await loadData();

      setForm({
        ...EMPTY_HINT,
        sequenceNumber:
          hints.length + 1
      });

      setEditingId(null);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to save hint."
      );
    } finally {
      setSaving(false);
    }
  }

  function startEdit(hint) {
    setEditingId(hint._id);

    setForm({
      sequenceNumber: hint.sequenceNumber,
      hintText: hint.hintText || "",
      penalty: hint.penalty ?? 10,
      clueId:
        typeof hint.clueId === "object"
          ? hint.clueId?._id || ""
          : hint.clueId || "",
      questionId:
        typeof hint.questionId === "object"
          ? hint.questionId?._id || ""
          : hint.questionId || "",
      isEnabled: hint.isEnabled !== false
    });

    setError("");
    setSuccess("");

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  function cancelEdit() {
    resetForm();
    setError("");
    setSuccess("");
  }

  async function deleteHint(id) {
    const confirmed = window.confirm(
      "Delete this hint? This action cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      await api.delete(`/admin/hints/${id}`);

      setSuccess("Hint deleted successfully.");

      if (editingId === id) {
        resetForm();
      }

      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to delete hint."
      );
    }
  }

  async function toggleHint(hint) {
    setError("");
    setSuccess("");

    try {
      await api.patch(`/admin/hints/${hint._id}`, {
        isEnabled: !hint.isEnabled
      });

      setSuccess(
        hint.isEnabled
          ? "Hint disabled."
          : "Hint enabled."
      );

      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to change hint status."
      );
    }
  }

  function getClueTitle(clueId) {
    const id =
      typeof clueId === "object"
        ? clueId?._id
        : clueId;

    const clue = clues.find(
      item => item._id === id
    );

    return clue
      ? `Clue ${clue.sequenceNumber}: ${clue.title}`
      : "—";
  }

  function getQuestionTitle(questionId) {
    const id =
      typeof questionId === "object"
        ? questionId?._id
        : questionId;

    const question = questions.find(
      item => item._id === id
    );

    return question
      ? `Q${question.sequenceNumber}: ${question.question}`
      : "—";
  }

  if (!caseId) {
    return (
      <div className="card shadow-sm">
        <div className="card-body text-center py-5">
          <h5>No case selected</h5>
          <p className="text-secondary mb-0">
            Select a case from the Cases tab before
            managing hints.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3">
        <div>
          <h2 className="h4 mb-1">
            Hint Management
          </h2>

          <p className="text-secondary mb-0">
            Create, order, configure and enable or
            disable hints for this detective case.
          </p>
        </div>

        <span className="badge text-bg-primary">
          {hints.length} hint
          {hints.length === 1 ? "" : "s"}
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

      <div className="card shadow-sm mb-4">
        <div className="card-header">
          <strong>
            {editingId
              ? "Edit Hint"
              : "Create Hint"}
          </strong>
        </div>

        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="row g-3">

              <div className="col-md-3">
                <label className="form-label">
                  Hint Order
                </label>

                <input
                  type="number"
                  min="1"
                  className="form-control"
                  name="sequenceNumber"
                  value={form.sequenceNumber}
                  onChange={handleChange}
                />
              </div>

              <div className="col-md-3">
                <label className="form-label">
                  Penalty
                </label>

                <div className="input-group">
                  <span className="input-group-text">
                    -
                  </span>

                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    name="penalty"
                    value={form.penalty}
                    onChange={handleChange}
                  />

                  <span className="input-group-text">
                    points
                  </span>
                </div>
              </div>

              <div className="col-md-3">
                <label className="form-label">
                  Associated Clue
                </label>

                <select
                  className="form-select"
                  name="clueId"
                  value={form.clueId}
                  onChange={event => {
                    setForm(previous => ({
                      ...previous,
                      clueId: event.target.value
                    }));
                  }}
                >
                  <option value="">
                    No clue
                  </option>

                  {clues.map(clue => (
                    <option
                      key={clue._id}
                      value={clue._id}
                    >
                      Clue {clue.sequenceNumber}:{" "}
                      {clue.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-md-3">
                <label className="form-label">
                  Associated Question
                </label>

                <select
                  className="form-select"
                  name="questionId"
                  value={form.questionId}
                  onChange={event => {
                    setForm(previous => ({
                      ...previous,
                      questionId:
                        event.target.value
                    }));
                  }}
                >
                  <option value="">
                    No question
                  </option>

                  {questions.map(question => (
                    <option
                      key={question._id}
                      value={question._id}
                    >
                      Q{question.sequenceNumber}:{" "}
                      {question.question}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-12">
                <label className="form-label">
                  Hint Text
                </label>

                <textarea
                  className="form-control"
                  rows="3"
                  name="hintText"
                  value={form.hintText}
                  onChange={handleChange}
                  placeholder="Example: Check the CCTV timestamp."
                  maxLength={2000}
                />
              </div>

              <div className="col-12">
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="hintEnabled"
                    name="isEnabled"
                    checked={form.isEnabled}
                    onChange={handleChange}
                  />

                  <label
                    className="form-check-label"
                    htmlFor="hintEnabled"
                  >
                    Hint enabled
                  </label>
                </div>
              </div>

            </div>

            <div className="d-flex gap-2 mt-4">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : editingId
                  ? "Update Hint"
                  : "Create Hint"}
              </button>

              {editingId && (
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={cancelEdit}
                  disabled={saving}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="card-header">
          <strong>Configured Hints</strong>
        </div>

        <div className="card-body p-0">
          {loading ? (
            <div className="text-center py-5">
              Loading hints...
            </div>
          ) : hints.length === 0 ? (
            <div className="text-center text-secondary py-5">
              No hints configured for this case.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Order</th>
                    <th>Hint</th>
                    <th>Associated With</th>
                    <th>Penalty</th>
                    <th>Status</th>
                    <th className="text-end">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {[...hints]
                    .sort(
                      (a, b) =>
                        Number(a.sequenceNumber) -
                        Number(b.sequenceNumber)
                    )
                    .map(hint => (
                      <tr key={hint._id}>
                        <td>
                          <span className="badge text-bg-secondary">
                            #{hint.sequenceNumber}
                          </span>
                        </td>

                        <td style={{ minWidth: "280px" }}>
                          {hint.hintText}
                        </td>

                        <td>
                          {hint.clueId && (
                            <div>
                              <span className="badge text-bg-info me-1">
                                Clue
                              </span>

                              {getClueTitle(
                                hint.clueId
                              )}
                            </div>
                          )}

                          {hint.questionId && (
                            <div className="mt-1">
                              <span className="badge text-bg-warning me-1">
                                Question
                              </span>

                              {getQuestionTitle(
                                hint.questionId
                              )}
                            </div>
                          )}
                        </td>

                        <td>
                          <strong>
                            -{hint.penalty}
                          </strong>
                        </td>

                        <td>
                          {hint.isEnabled ? (
                            <span className="badge text-bg-success">
                              Enabled
                            </span>
                          ) : (
                            <span className="badge text-bg-secondary">
                              Disabled
                            </span>
                          )}
                        </td>

                        <td>
                          <div className="d-flex justify-content-end gap-2">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary"
                              onClick={() =>
                                startEdit(hint)
                              }
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              className={`btn btn-sm ${
                                hint.isEnabled
                                  ? "btn-outline-warning"
                                  : "btn-outline-success"
                              }`}
                              onClick={() =>
                                toggleHint(hint)
                              }
                            >
                              {hint.isEnabled
                                ? "Disable"
                                : "Enable"}
                            </button>

                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() =>
                                deleteHint(hint._id)
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
