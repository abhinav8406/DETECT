import React, { useEffect, useState } from "react";
import { api } from "../../api.js";

const EMPTY_QUESTION = {
  clueId: "",
  sequenceNumber: 1,
  question: "",
  options: ["", "", "", ""],
  correctOption: 0,
  points: 100,
  isPublished: true
};

export default function QuestionManager({ caseId }) {
  const [questions, setQuestions] = useState([]);
  const [clues, setClues] = useState([]);

  const [form, setForm] =
    useState(EMPTY_QUESTION);

  const [editingId, setEditingId] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  useEffect(() => {
    if (!caseId) {
      setQuestions([]);
      setClues([]);
      resetForm([]);
      return;
    }

    loadData();
  }, [caseId]);

  function resetForm(currentQuestions = questions) {
    setForm({
      ...EMPTY_QUESTION,
      sequenceNumber:
        Math.max(1, currentQuestions.length + 1)
    });

    setEditingId(null);
  }

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [questionResponse, caseResponse] =
        await Promise.all([
          api.get(
            `/admin/cases/${caseId}/questions`
          ),
          api.get(
            `/admin/cases/${caseId}`
          )
        ]);

      setQuestions(
        Array.isArray(questionResponse.data)
          ? questionResponse.data
          : []
      );

      setClues(
        Array.isArray(caseResponse.data?.clues)
          ? caseResponse.data.clues
          : []
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to load questions"
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

  function updateOption(index, value) {
    setForm(previous => {
      const options = [...previous.options];

      options[index] = value;

      return {
        ...previous,
        options
      };
    });
  }

  function addOption() {
    setForm(previous => ({
      ...previous,
      options: [
        ...previous.options,
        ""
      ]
    }));
  }

  function removeOption(index) {
    if (form.options.length <= 2) {
      setError(
        "A question must have at least 2 options."
      );
      return;
    }

    setForm(previous => {
      const options =
        previous.options.filter(
          (_, optionIndex) =>
            optionIndex !== index
        );

      let correctOption =
        previous.correctOption;

      if (index === correctOption) {
        correctOption = 0;
      } else if (index < correctOption) {
        correctOption -= 1;
      }

      return {
        ...previous,
        options,
        correctOption
      };
    });
  }

  function editQuestion(question) {
    setError("");
    setSuccess("");

    setEditingId(question._id);

    setForm({
      clueId: question.clueId || "",
      sequenceNumber:
        question.sequenceNumber ?? 1,
      question: question.question || "",
      options:
        Array.isArray(question.options) &&
        question.options.length >= 2
          ? question.options
          : ["", ""],
      correctOption:
        question.correctOption ?? 0,
      points: question.points ?? 100,
      isPublished:
        question.isPublished !== false
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  async function saveQuestion(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const cleanOptions =
      form.options.map(option =>
        option.trim()
      );

    if (!form.question.trim()) {
      setError("Question text is required.");
      return;
    }

    if (
      cleanOptions.length < 2 ||
      cleanOptions.some(option => !option)
    ) {
      setError(
        "Every answer option must contain text."
      );
      return;
    }

    if (
      form.correctOption < 0 ||
      form.correctOption >= cleanOptions.length
    ) {
      setError(
        "Please select a valid correct answer."
      );
      return;
    }

    if (Number(form.sequenceNumber) < 1) {
      setError(
        "Question order must be at least 1."
      );
      return;
    }

    if (Number(form.points) < 0) {
      setError(
        "Points cannot be negative."
      );
      return;
    }

    try {
      setSaving(true);

      const payload = {
        caseId,
        clueId: form.clueId || null,
        sequenceNumber:
          Number(form.sequenceNumber),
        question:
          form.question.trim(),
        options: cleanOptions,
        correctOption:
          Number(form.correctOption),
        points: Number(form.points),
        isPublished: form.isPublished
      };

      if (editingId) {
        await api.patch(
          `/admin/questions/${editingId}`,
          payload
        );

        setSuccess(
          "Question updated successfully."
        );
      } else {
        await api.post(
          "/admin/questions",
          payload
        );

        setSuccess(
          "Question created successfully."
        );
      }

      await loadData();

      setForm({
        ...EMPTY_QUESTION,
        sequenceNumber:
          questions.length + 2
      });

      setEditingId(null);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to save question"
      );
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(question) {
    try {
      setError("");
      setSuccess("");

      await api.patch(
        `/admin/questions/${question._id}/publish`,
        {
          isPublished:
            !question.isPublished
        }
      );

      setSuccess(
        question.isPublished
          ? "Question unpublished."
          : "Question published."
      );

      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to change question status"
      );
    }
  }

  async function deleteQuestion(question) {
    const confirmed = window.confirm(
      `Delete this question?\n\n"${question.question}"`
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setSuccess("");

      await api.delete(
        `/admin/questions/${question._id}`
      );

      setSuccess(
        "Question deleted successfully."
      );

      if (editingId === question._id) {
        resetForm();
      }

      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to delete question"
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
            Question Management
          </h3>

          <p className="text-secondary mb-0">
            Create questions, answer options,
            correct answers and scoring.
          </p>
        </div>

        <span className="badge text-bg-dark">
          {questions.length} question
          {questions.length === 1
            ? ""
            : "s"}
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

      {/* QUESTION FORM */}

      <div className="card shadow-sm mb-4">
        <div className="card-header fw-semibold">
          {editingId
            ? "Edit Question"
            : "Create New Question"}
        </div>

        <div className="card-body">
          <form onSubmit={saveQuestion}>
            <div className="row g-3">

              {/* ORDER */}

              <div className="col-md-2">
                <label className="form-label">
                  Question Order
                </label>

                <input
                  className="form-control"
                  type="number"
                  min="1"
                  value={
                    form.sequenceNumber
                  }
                  onChange={e =>
                    updateField(
                      "sequenceNumber",
                      e.target.value
                    )
                  }
                  required
                />
              </div>

              {/* CLUE */}

              <div className="col-md-5">
                <label className="form-label">
                  Associated Clue
                </label>

                <select
                  className="form-select"
                  value={form.clueId}
                  onChange={e =>
                    updateField(
                      "clueId",
                      e.target.value
                    )
                  }
                >
                  <option value="">
                    No specific clue
                  </option>

                  {clues
                    .sort(
                      (a, b) =>
                        Number(
                          a.sequenceNumber
                        ) -
                        Number(
                          b.sequenceNumber
                        )
                    )
                    .map(clue => (
                      <option
                        key={clue._id}
                        value={clue._id}
                      >
                        Clue {clue.sequenceNumber} —{" "}
                        {clue.title}
                      </option>
                    ))}
                </select>
              </div>

              {/* POINTS */}

              <div className="col-md-5">
                <label className="form-label">
                  Points
                </label>

                <input
                  className="form-control"
                  type="number"
                  min="0"
                  value={form.points}
                  onChange={e =>
                    updateField(
                      "points",
                      e.target.value
                    )
                  }
                  required
                />
              </div>

              {/* QUESTION */}

              <div className="col-12">
                <label className="form-label">
                  Question
                </label>

                <textarea
                  className="form-control"
                  rows="3"
                  value={form.question}
                  onChange={e =>
                    updateField(
                      "question",
                      e.target.value
                    )
                  }
                  placeholder="e.g. Who entered the laboratory at 8:42 PM?"
                  required
                />
              </div>

              {/* OPTIONS */}

              <div className="col-12">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <label className="form-label mb-0">
                    Answer Options
                  </label>

                  <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    onClick={addOption}
                  >
                    + Add Option
                  </button>
                </div>

                <div className="d-flex flex-column gap-2">
                  {form.options.map(
                    (option, index) => (
                      <div
                        className="input-group"
                        key={index}
                      >
                        <span className="input-group-text">
                          {String.fromCharCode(
                            65 + index
                          )}
                        </span>

                        <input
                          className="form-control"
                          value={option}
                          onChange={e =>
                            updateOption(
                              index,
                              e.target.value
                            )
                          }
                          placeholder={`Option ${String.fromCharCode(
                            65 + index
                          )}`}
                          required
                        />

                        {form.options.length >
                          2 && (
                          <button
                            type="button"
                            className="btn btn-outline-danger"
                            onClick={() =>
                              removeOption(
                                index
                              )
                            }
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* CORRECT ANSWER */}

              <div className="col-md-6">
                <label className="form-label">
                  Correct Answer
                </label>

                <select
                  className="form-select"
                  value={
                    form.correctOption
                  }
                  onChange={e =>
                    updateField(
                      "correctOption",
                      Number(
                        e.target.value
                      )
                    )
                  }
                >
                  {form.options.map(
                    (option, index) => (
                      <option
                        key={index}
                        value={index}
                      >
                        Option{" "}
                        {String.fromCharCode(
                          65 + index
                        )}
                        {option
                          ? ` — ${option}`
                          : ""}
                      </option>
                    )
                  )}
                </select>

                <div className="form-text">
                  Correct answers are stored on the
                  backend and are not shown to participants.
                </div>
              </div>

              {/* PUBLISH */}

              <div className="col-md-6 d-flex align-items-end">
                <div className="form-check mb-2">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="questionPublished"
                    checked={
                      form.isPublished
                    }
                    onChange={e =>
                      updateField(
                        "isPublished",
                        e.target.checked
                      )
                    }
                  />

                  <label
                    className="form-check-label"
                    htmlFor="questionPublished"
                  >
                    Publish question
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
                  ? "Update Question"
                  : "Create Question"}
              </button>

              {editingId && (
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() =>
                    resetForm()
                  }
                  disabled={saving}
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* QUESTION LIST */}

      <div className="card shadow-sm">
        <div className="card-header fw-semibold">
          Question Sequence
        </div>

        <div className="card-body p-0">
          {loading ? (
            <div className="p-4 text-secondary">
              Loading questions...
            </div>
          ) : questions.length === 0 ? (
            <div className="p-4 text-secondary">
              No questions have been created for
              this case yet.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>#</th>
                    <th>Question</th>
                    <th>Clue</th>
                    <th>Options</th>
                    <th>Points</th>
                    <th>Status</th>
                    <th className="text-end">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {[...questions]
                    .sort(
                      (a, b) =>
                        Number(
                          a.sequenceNumber
                        ) -
                        Number(
                          b.sequenceNumber
                        )
                    )
                    .map(question => {
                      const clue =
                        clues.find(
                          item =>
                            item._id ===
                            question.clueId
                        );

                      return (
                        <tr
                          key={
                            question._id
                          }
                        >
                          <td>
                            <strong>
                              {
                                question.sequenceNumber
                              }
                            </strong>
                          </td>

                          <td>
                            <div className="fw-semibold">
                              {
                                question.question
                              }
                            </div>
                          </td>

                          <td>
                            {clue ? (
                              <>
                                Clue{" "}
                                {
                                  clue.sequenceNumber
                                }
                              </>
                            ) : (
                              <span className="text-secondary">
                                —
                              </span>
                            )}
                          </td>

                          <td>
                            {
                              question.options
                                ?.length || 0
                            }
                          </td>

                          <td>
                            <span className="badge text-bg-dark">
                              {question.points}
                            </span>
                          </td>

                          <td>
                            {question.isPublished ? (
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
                                  editQuestion(
                                    question
                                  )
                                }
                              >
                                Edit
                              </button>

                              <button
                                className="btn btn-outline-secondary"
                                onClick={() =>
                                  togglePublish(
                                    question
                                  )
                                }
                              >
                                {question.isPublished
                                  ? "Unpublish"
                                  : "Publish"}
                              </button>

                              <button
                                className="btn btn-outline-danger"
                                onClick={() =>
                                  deleteQuestion(
                                    question
                                  )
                                }
                              >
                                Delete
                              </button>
                            </div>
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
    </div>
  );
}
