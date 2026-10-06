import React, { useEffect, useState } from "react";
import { api } from "../../api.js";

const emptyQuestion = {
  clueId: "",
  sequenceNumber: 1,
  question: "",
  options: ["", ""],
  correctOption: 0,
  points: 10,
  isPublished: true
};

export default function QuestionManager({ caseId }) {
  const [questions, setQuestions] = useState([]);
  const [clues, setClues] = useState([]);

  const [form, setForm] = useState(emptyQuestion);
  const [editingId, setEditingId] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadData() {
    if (!caseId) {
      setQuestions([]);
      setClues([]);
      return;
    }

    try {
      const { data } = await api.get(`/admin/cases/${caseId}`);

      const sortedClues = [...(data.clues || [])].sort(
        (a, b) =>
          Number(a.sequenceNumber || 0) -
          Number(b.sequenceNumber || 0)
      );

      const sortedQuestions = [...(data.questions || [])].sort(
        (a, b) =>
          Number(a.sequenceNumber || 0) -
          Number(b.sequenceNumber || 0)
      );

      setClues(sortedClues);
      setQuestions(sortedQuestions);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Failed to load questions."
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
      ...emptyQuestion,
      clueId: "",
      sequenceNumber: questions.length + 1
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

  function updateOption(index, value) {
    setForm(prev => ({
      ...prev,
      options: prev.options.map((option, i) =>
        i === index ? value : option
      )
    }));
  }

  function addOption() {
    setForm(prev => ({
      ...prev,
      options: [...prev.options, ""]
    }));
  }

  function removeOption(index) {
    if (form.options.length <= 2) {
      return;
    }

    setForm(prev => {
      const options = prev.options.filter(
        (_, i) => i !== index
      );

      let correctOption = prev.correctOption;

      if (index === correctOption) {
        correctOption = 0;
      } else if (index < correctOption) {
        correctOption -= 1;
      }

      return {
        ...prev,
        options,
        correctOption
      };
    });
  }

  function editQuestion(question) {
    setEditingId(question._id);

    setForm({
      clueId: question.clueId?._id || question.clueId || "",
      sequenceNumber: question.sequenceNumber ?? 1,
      question: question.question || "",
      options:
        question.options?.length >= 2
          ? question.options
          : ["", ""],
      correctOption: Number(
        question.correctOption ?? 0
      ),
      points: Number(question.points ?? 0),
      isPublished: question.isPublished !== false
    });

    setError("");
    setMessage("");
  }

  async function saveQuestion(e) {
    e.preventDefault();

    if (!caseId) {
      setError("Select a case first.");
      return;
    }

    if (!form.clueId) {
      setError("Select the clue associated with this question.");
      return;
    }

    const cleanedOptions = form.options
      .map(option => option.trim())
      .filter(Boolean);

    if (cleanedOptions.length < 2) {
      setError("A question needs at least two options.");
      return;
    }

    if (
      form.correctOption < 0 ||
      form.correctOption >= cleanedOptions.length
    ) {
      setError("Select a valid correct answer.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        caseId,
        clueId: form.clueId,
        sequenceNumber: Number(form.sequenceNumber),
        question: form.question.trim(),
        options: cleanedOptions,
        correctOption: Number(form.correctOption),
        points: Number(form.points),
        isPublished: Boolean(form.isPublished)
      };

      if (editingId) {
        await api.patch(
          `/admin/questions/${editingId}`,
          payload
        );

        setMessage("Question updated successfully.");
      } else {
        await api.post("/admin/questions", payload);

        setMessage("Question created successfully.");
      }

      await loadData();

      setEditingId(null);

      setForm({
        ...emptyQuestion,
        clueId: form.clueId,
        sequenceNumber: questions.length + 2
      });
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Failed to save question."
      );
    } finally {
      setLoading(false);
    }
  }

  async function togglePublished(question) {
    try {
      setError("");
      setMessage("");

      await api.patch(
        `/admin/questions/${question._id}/publish`,
        {
          isPublished: !question.isPublished
        }
      );

      setMessage(
        question.isPublished
          ? "Question unpublished."
          : "Question published."
      );

      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to change question publication status."
      );
    }
  }

  async function deleteQuestion(id) {
    const confirmed = window.confirm(
      "Delete this question?"
    );

    if (!confirmed) return;

    try {
      setError("");
      setMessage("");

      await api.delete(`/admin/questions/${id}`);

      if (editingId === id) {
        setEditingId(null);
      }

      setMessage("Question deleted.");

      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Unable to delete question."
      );
    }
  }

  function clueName(clueId) {
    const clue = clues.find(
      clue =>
        String(clue._id) === String(clueId)
    );

    if (!clue) {
      return "Unknown clue";
    }

    return `Clue ${clue.sequenceNumber}: ${clue.title}`;
  }

  if (!caseId) {
    return (
      <div className="card shadow-sm">
        <div className="card-body text-center py-5">
          <h3 className="h6">
            Question Management
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
      {/* QUESTION LIST */}
      <div className="col-12 col-xl-5">
        <div className="card shadow-sm h-100">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h3 className="h6 mb-1">
                  Questions
                </h3>

                <div className="small text-secondary">
                  {questions.length} question
                  {questions.length === 1 ? "" : "s"}
                </div>
              </div>

              <button
                className="btn btn-sm btn-dark"
                onClick={() => {
                  setEditingId(null);

                  setForm({
                    ...emptyQuestion,
                    clueId: clues[0]?._id || "",
                    sequenceNumber:
                      questions.length + 1
                  });

                  setError("");
                  setMessage("");
                }}
              >
                + Add Question
              </button>
            </div>

            {questions.length === 0 ? (
              <div className="text-secondary">
                No questions created yet.
              </div>
            ) : (
              <div className="list-group">
                {questions.map(question => (
                  <div
                    className="list-group-item"
                    key={question._id}
                  >
                    <div className="d-flex gap-3">
                      <div>
                        <span className="badge text-bg-dark">
                          #{question.sequenceNumber}
                        </span>
                      </div>

                      <div className="flex-grow-1">
                        <div className="fw-semibold">
                          {question.question}
                        </div>

                        <div className="small text-secondary mt-1">
                          {clueName(
                            question.clueId?._id ||
                            question.clueId
                          )}
                        </div>

                        <div className="small text-secondary">
                          {question.options?.length || 0}{" "}
                          options ·{" "}
                          {question.points} points
                        </div>

                        <div className="mt-2">
                          <span
                            className={`badge ${
                              question.isPublished
                                ? "text-bg-success"
                                : "text-bg-secondary"
                            }`}
                          >
                            {question.isPublished
                              ? "Published"
                              : "Hidden"}
                          </span>
                        </div>

                        <div className="d-flex flex-wrap gap-1 mt-2">
                          <button
                            className="btn btn-sm btn-outline-dark"
                            onClick={() =>
                              editQuestion(question)
                            }
                          >
                            Edit
                          </button>

                          <button
                            className="btn btn-sm btn-outline-warning"
                            onClick={() =>
                              togglePublished(question)
                            }
                          >
                            {question.isPublished
                              ? "Unpublish"
                              : "Publish"}
                          </button>

                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() =>
                              deleteQuestion(
                                question._id
                              )
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

      {/* QUESTION EDITOR */}
      <div className="col-12 col-xl-7">
        <div className="card shadow-sm">
          <div className="card-body">
            <h3 className="h6 mb-3">
              {editingId
                ? "Edit Question"
                : "Create Question"}
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

            {clues.length === 0 && (
              <div className="alert alert-warning">
                Create at least one clue before creating
                questions.
              </div>
            )}

            <form onSubmit={saveQuestion}>
              {/* BASIC INFO */}
              <div className="row g-3">
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

                <div className="col-md-8">
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
                    required
                  >
                    <option value="">
                      Select clue
                    </option>

                    {clues.map(clue => (
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
                    placeholder="What does this evidence prove?"
                    required
                  />
                </div>
              </div>

              <hr className="my-4" />

              {/* OPTIONS */}
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h4 className="h6 mb-0">
                  Options
                </h4>

                <button
                  type="button"
                  className="btn btn-sm btn-outline-dark"
                  onClick={addOption}
                >
                  + Add Option
                </button>
              </div>

              <div className="small text-secondary mb-3">
                Select the radio button beside the correct
                answer.
              </div>

              <div className="d-flex flex-column gap-2">
                {form.options.map((option, index) => (
                  <div
                    className="input-group"
                    key={index}
                  >
                    <div className="input-group-text">
                      <input
                        className="form-check-input mt-0"
                        type="radio"
                        name="correctOption"
                        checked={
                          Number(form.correctOption) ===
                          index
                        }
                        onChange={() =>
                          updateField(
                            "correctOption",
                            index
                          )
                        }
                        aria-label={`Mark option ${
                          index + 1
                        } as correct`}
                      />
                    </div>

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
                      placeholder={`Option ${
                        index + 1
                      }`}
                      required
                    />

                    {form.options.length > 2 && (
                      <button
                        type="button"
                        className="btn btn-outline-danger"
                        onClick={() =>
                          removeOption(index)
                        }
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <hr className="my-4" />

              {/* SCORE */}
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label">
                    Points
                  </label>

                  <input
                    type="number"
                    min="0"
                    className="form-control"
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

                <div className="col-md-6 d-flex align-items-end">
                  <div className="form-check mb-2">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="questionPublished"
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
                      htmlFor="questionPublished"
                    >
                      Publish this question
                    </label>
                  </div>
                </div>
              </div>

              <div className="d-flex gap-2 mt-4">
                <button
                  type="submit"
                  className="btn btn-dark"
                  disabled={
                    loading || clues.length === 0
                  }
                >
                  {loading
                    ? "Saving..."
                    : editingId
                      ? "Update Question"
                      : "Create Question"}
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
