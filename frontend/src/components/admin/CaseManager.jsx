import React, {
  useEffect,
  useMemo,
  useState
} from "react";

import { api } from "../../api.js";

const EMPTY = {
  title: "",
  description: "",
  difficulty: "Medium",
  timeLimit: 900,
  maximumScore: 350,

  suspects: [],

  finalAnswerFields: [
    "culprit",
    "time",
    "method",
    "motive",
    "evidence"
  ],

  finalSolution: {
    culprit: "",
    time: "",
    method: "",
    motive: "",
    evidenceClues: [],
    explanation: ""
  },

  scoring: {
    culprit: 100,
    time: 50,
    method: 50,
    motive: 50,
    evidence: 100,
    hintPenalty: 20,
    wrongFinal: -50
  }
};

const FINAL_FIELDS = [
  ["culprit", "Culprit"],
  ["time", "Time"],
  ["method", "Method"],
  ["motive", "Motive"],
  ["evidence", "Supporting Evidence"],
  ["explanation", "Final Explanation"]
];

function normalizeCase(item) {
  return {
    ...EMPTY,
    ...item,

    suspects:
      item.suspects || [],

    finalAnswerFields:
      item.finalAnswerFields?.length
        ? item.finalAnswerFields
        : EMPTY.finalAnswerFields,

    finalSolution: {
      ...EMPTY.finalSolution,
      ...(item.finalSolution || {}),

      evidenceClues:
        item.finalSolution
          ?.evidenceClues || []
    },

    scoring: {
      ...EMPTY.scoring,
      ...(item.scoring || {})
    }
  };
}

export default function CaseManager({
  onSelectCase
}) {
  const [cases, setCases] =
    useState([]);

  const [form, setForm] =
    useState(EMPTY);

  const [editingId, setEditingId] =
    useState(null);

  const [preview, setPreview] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const isEditing =
    Boolean(editingId);

  async function load() {
    try {
      setLoading(true);
      setError("");

      const { data } =
        await api.get(
          "/admin/cases"
        );

      setCases(data);
    } catch (err) {
      setError(
        err.response?.data
          ?.message ||
          "Failed to load cases"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function updateField(
    field,
    value
  ) {
    setForm(previous => ({
      ...previous,
      [field]: value
    }));
  }

  function updateNested(
    group,
    field,
    value
  ) {
    setForm(previous => ({
      ...previous,

      [group]: {
        ...previous[group],
        [field]: value
      }
    }));
  }

  function resetForm() {
    setEditingId(null);
    setForm({
      ...EMPTY,
      suspects: [],
      finalAnswerFields: [
        "culprit",
        "time",
        "method",
        "motive",
        "evidence"
      ],
      finalSolution: {
        ...EMPTY.finalSolution
      },
      scoring: {
        ...EMPTY.scoring
      }
    });

    setError("");
    setMessage("");
  }

  function editCase(item) {
    setEditingId(item._id);

    setForm(
      normalizeCase(item)
    );

    setMessage("");
    setError("");

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  function toggleFinalField(
    field
  ) {
    setForm(previous => {
      const exists =
        previous.finalAnswerFields.includes(
          field
        );

      return {
        ...previous,

        finalAnswerFields:
          exists
            ? previous.finalAnswerFields.filter(
                value =>
                  value !== field
              )
            : [
                ...previous.finalAnswerFields,
                field
              ]
      };
    });
  }

  function addSuspect() {
    setForm(previous => ({
      ...previous,

      suspects: [
        ...previous.suspects,

        {
          name: "",
          description: ""
        }
      ]
    }));
  }

  function updateSuspect(
    index,
    field,
    value
  ) {
    setForm(previous => ({
      ...previous,

      suspects:
        previous.suspects.map(
          (suspect, i) =>
            i === index
              ? {
                  ...suspect,
                  [field]: value
                }
              : suspect
        )
    }));
  }

  function removeSuspect(
    index
  ) {
    setForm(previous => ({
      ...previous,

      suspects:
        previous.suspects.filter(
          (_, i) =>
            i !== index
        )
    }));
  }

  async function saveCase(event) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!form.title.trim()) {
      setError(
        "Case title is required."
      );
      return;
    }

    if (
      !form.description.trim()
    ) {
      setError(
        "Case description is required."
      );
      return;
    }

    if (
      Number(form.timeLimit) <= 0
    ) {
      setError(
        "Time limit must be greater than 0 seconds."
      );
      return;
    }

    if (
      Number(form.maximumScore) < 0
    ) {
      setError(
        "Maximum score cannot be negative."
      );
      return;
    }

    if (
      form.finalAnswerFields.length ===
      0
    ) {
      setError(
        "Select at least one final answer field."
      );
      return;
    }

    const invalidSuspect =
      form.suspects.some(
        suspect =>
          !suspect.name.trim()
      );

    if (invalidSuspect) {
      setError(
        "Every suspect must have a name."
      );
      return;
    }

    try {
      setSaving(true);

      const payload = {
        ...form,

        timeLimit:
          Number(form.timeLimit),

        maximumScore:
          Number(form.maximumScore),

        suspects:
          form.suspects.map(
            suspect => ({
              name:
                suspect.name.trim(),

              description:
                suspect.description
                  ?.trim() || ""
            })
          ),

        finalSolution: {
          ...form.finalSolution,

          evidenceClues:
            form.finalSolution
              .evidenceClues || []
        },

        scoring: {
          culprit:
            Number(
              form.scoring.culprit
            ),

          time:
            Number(
              form.scoring.time
            ),

          method:
            Number(
              form.scoring.method
            ),

          motive:
            Number(
              form.scoring.motive
            ),

          evidence:
            Number(
              form.scoring.evidence
            ),

          hintPenalty:
            Number(
              form.scoring.hintPenalty
            ),

          wrongFinal:
            Number(
              form.scoring.wrongFinal
            )
        }
      };

      const response =
        isEditing
          ? await api.patch(
              `/admin/cases/${editingId}`,
              payload
            )
          : await api.post(
              "/admin/cases",
              payload
            );

      setMessage(
        isEditing
          ? "Case updated."
          : "Case created."
      );

      setEditingId(
        response.data._id
      );

      setForm(
        normalizeCase(
          response.data
        )
      );

      await load();
    } catch (err) {
      setError(
        err.response?.data
          ?.message ||
          "Failed to save case"
      );
    } finally {
      setSaving(false);
    }
  }

  async function changePublishState(
    item
  ) {
    setError("");
    setMessage("");

    try {
      if (
        item.status ===
        "PUBLISHED"
      ) {
        await api.post(
          `/admin/cases/${item._id}/unpublish`
        );

        setMessage(
          "Case unpublished."
        );
      } else {
        await api.post(
          `/admin/cases/${item._id}/publish`
        );

        setMessage(
          "Case published."
        );
      }

      await load();
    } catch (err) {
      setError(
        err.response?.data
          ?.message ||
          "Unable to change publish state"
      );
    }
  }

  async function deleteCase(
    item
  ) {
    if (
      !window.confirm(
        `Delete "${item.title}"? This cannot be undone.`
      )
    ) {
      return;
    }

    try {
      await api.delete(
        `/admin/cases/${item._id}`
      );

      if (
        editingId === item._id
      ) {
        resetForm();
      }

      setMessage(
        "Case deleted."
      );

      await load();
    } catch (err) {
      setError(
        err.response?.data
          ?.message ||
          "Failed to delete case"
      );
    }
  }

  const selectedFieldLabels =
    useMemo(
      () =>
        FINAL_FIELDS.filter(
          ([value]) =>
            form.finalAnswerFields.includes(
              value
            )
        ).map(
          ([, label]) =>
            label
        ),
      [form.finalAnswerFields]
    );

  return (
    <div>

      {/* =================================================
          CREATE / EDIT
      ================================================= */}

      <div className="card shadow-sm mb-4">

        <div className="card-header bg-dark text-white">
          <strong>
            {isEditing
              ? "Edit Detective Case"
              : "Create Detective Case"}
          </strong>
        </div>

        <form
          onSubmit={saveCase}
        >
          <div className="card-body">

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

            <div className="row g-3">

              <div className="col-lg-8">
                <label className="form-label">
                  Case Title
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
                  required
                />
              </div>

              <div className="col-lg-4">
                <label className="form-label">
                  Difficulty
                </label>

                <select
                  className="form-select"
                  value={
                    form.difficulty
                  }
                  onChange={e =>
                    updateField(
                      "difficulty",
                      e.target.value
                    )
                  }
                >
                  <option>
                    Easy
                  </option>

                  <option>
                    Medium
                  </option>

                  <option>
                    Hard
                  </option>

                  <option>
                    Expert
                  </option>
                </select>
              </div>

              <div className="col-12">
                <label className="form-label">
                  Case Description
                </label>

                <textarea
                  className="form-control"
                  rows="5"
                  value={
                    form.description
                  }
                  onChange={e =>
                    updateField(
                      "description",
                      e.target.value
                    )
                  }
                  required
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">
                  Time Limit (seconds)
                </label>

                <input
                  className="form-control"
                  type="number"
                  min="1"
                  value={
                    form.timeLimit
                  }
                  onChange={e =>
                    updateField(
                      "timeLimit",
                      e.target.value
                    )
                  }
                  required
                />

                <div className="form-text">
                  {Math.floor(
                    Number(
                      form.timeLimit ||
                        0
                    ) / 60
                  )}{" "}
                  minutes
                </div>
              </div>

              <div className="col-md-6">
                <label className="form-label">
                  Maximum Score
                </label>

                <input
                  className="form-control"
                  type="number"
                  min="0"
                  value={
                    form.maximumScore
                  }
                  onChange={e =>
                    updateField(
                      "maximumScore",
                      e.target.value
                    )
                  }
                  required
                />
              </div>

            </div>

            <hr className="my-4" />

            {/* SUSPECTS */}

            <div className="d-flex justify-content-between align-items-center mb-3">

              <div>
                <h2 className="h5 mb-1">
                  Suspects
                </h2>

                <div className="small text-secondary">
                  Suspect classification is
                  administrator-only.
                </div>
              </div>

              <button
                type="button"
                className="btn btn-outline-dark btn-sm"
                onClick={
                  addSuspect
                }
              >
                + Add Suspect
              </button>

            </div>

            {form.suspects.length ===
              0 && (
              <div className="alert alert-secondary">
                No suspects added yet.
              </div>
            )}

            {form.suspects.map(
              (
                suspect,
                index
              ) => (
                <div
                  className="border rounded p-3 mb-3"
                  key={
                    suspect._id ||
                    index
                  }
                >

                  <div className="d-flex justify-content-between align-items-center mb-2">

                    <strong>
                      Suspect{" "}
                      {index + 1}
                    </strong>

                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={() =>
                        removeSuspect(
                          index
                        )
                      }
                    >
                      Remove
                    </button>

                  </div>

                  <div className="row g-2">

                    <div className="col-md-5">

                      <label className="form-label">
                        Name
                      </label>

                      <input
                        className="form-control"
                        value={
                          suspect.name
                        }
                        onChange={e =>
                          updateSuspect(
                            index,
                            "name",
                            e.target.value
                          )
                        }
                      />

                    </div>

                    <div className="col-md-7">

                      <label className="form-label">
                        Description
                      </label>

                      <textarea
                        className="form-control"
                        rows="2"
                        value={
                          suspect.description
                        }
                        onChange={e =>
                          updateSuspect(
                            index,
                            "description",
                            e.target.value
                          )
                        }
                      />

                    </div>

                  </div>
                </div>
              )
            )}

            <hr className="my-4" />

            {/* FINAL ANSWER */}

            <h2 className="h5">
              Final Answer Configuration
            </h2>

            <p className="small text-secondary">
              Select the fields participants
              must eventually solve.
            </p>

            <div className="row g-2 mb-3">

              {FINAL_FIELDS.map(
                ([value, label]) => (
                  <div
                    className="col-md-4"
                    key={value}
                  >
                    <label className="border rounded p-2 d-flex gap-2 align-items-center">

                      <input
                        type="checkbox"
                        checked={form.finalAnswerFields.includes(
                          value
                        )}
                        onChange={() =>
                          toggleFinalField(
                            value
                          )
                        }
                      />

                      {label}

                    </label>
                  </div>
                )
              )}

            </div>

            <div className="row g-3">

              <div className="col-md-6">
                <label className="form-label">
                  Correct Culprit
                </label>

                <input
                  className="form-control"
                  value={
                    form.finalSolution
                      .culprit
                  }
                  onChange={e =>
                    updateNested(
                      "finalSolution",
                      "culprit",
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">
                  Correct Time
                </label>

                <input
                  className="form-control"
                  value={
                    form.finalSolution
                      .time
                  }
                  onChange={e =>
                    updateNested(
                      "finalSolution",
                      "time",
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">
                  Correct Method
                </label>

                <input
                  className="form-control"
                  value={
                    form.finalSolution
                      .method
                  }
                  onChange={e =>
                    updateNested(
                      "finalSolution",
                      "method",
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="col-md-6">
                <label className="form-label">
                  Correct Motive
                </label>

                <input
                  className="form-control"
                  value={
                    form.finalSolution
                      .motive
                  }
                  onChange={e =>
                    updateNested(
                      "finalSolution",
                      "motive",
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="col-12">
                <label className="form-label">
                  Final Explanation
                </label>

                <textarea
                  className="form-control"
                  rows="3"
                  value={
                    form.finalSolution
                      .explanation
                  }
                  onChange={e =>
                    updateNested(
                      "finalSolution",
                      "explanation",
                      e.target.value
                    )
                  }
                />
              </div>

            </div>

            <hr className="my-4" />

            {/* SCORING */}

            <h2 className="h5">
              Scoring Rules
            </h2>

            <div className="row g-3">

              {[
                [
                  "culprit",
                  "Correct Culprit"
                ],
                [
                  "time",
                  "Correct Time"
                ],
                [
                  "method",
                  "Correct Method"
                ],
                [
                  "motive",
                  "Correct Motive"
                ],
                [
                  "evidence",
                  "Correct Evidence"
                ],
                [
                  "hintPenalty",
                  "Hint Penalty"
                ],
                [
                  "wrongFinal",
                  "Wrong Final Accusation"
                ]
              ].map(
                ([field, label]) => (
                  <div
                    className="col-md-4"
                    key={field}
                  >

                    <label className="form-label">
                      {label}
                    </label>

                    <input
                      className="form-control"
                      type="number"
                      value={
                        form.scoring[
                          field
                        ]
                      }
                      onChange={e =>
                        updateNested(
                          "scoring",
                          field,
                          e.target.value
                        )
                      }
                    />

                  </div>
                )
              )}

            </div>

            <div className="alert alert-light border mt-4 mb-0">

              <strong>
                Required final fields:
              </strong>{" "}

              {selectedFieldLabels.length
                ? selectedFieldLabels.join(
                    ", "
                  )
                : "None selected"}

            </div>

          </div>

          <div className="card-footer d-flex flex-wrap gap-2">

            <button
              className="btn btn-dark"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : isEditing
                ? "Update Case"
                : "Create Case"}
            </button>

            {isEditing && (
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={
                  resetForm
                }
              >
                New Case
              </button>
            )}

          </div>

        </form>

      </div>


      {/* =================================================
          EXISTING CASES
      ================================================= */}

      <div className="card shadow-sm">

        <div className="card-header">
          <strong>
            Existing Cases
          </strong>
        </div>

        <div className="card-body p-0">

          {loading ? (
            <div className="p-4 text-secondary">
              Loading cases...
            </div>
          ) : cases.length === 0 ? (
            <div className="p-4 text-secondary">
              No cases created yet.
            </div>
          ) : (
            <div className="table-responsive">

              <table className="table table-hover align-middle mb-0">

                <thead>
                  <tr>
                    <th>
                      Case
                    </th>

                    <th>
                      Difficulty
                    </th>

                    <th>
                      Time
                    </th>

                    <th>
                      Score
                    </th>

                    <th>
                      Status
                    </th>

                    <th className="text-end">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>

                  {cases.map(
                    item => (
                      <tr
                        key={
                          item._id
                        }
                      >

                        <td>

                          <strong>
                            {item.title}
                          </strong>

                          <div className="small text-secondary">
                            {item.suspects
                              ?.length ||
                              0}{" "}
                            suspects
                          </div>

                        </td>

                        <td>
                          {
                            item.difficulty
                          }
                        </td>

                        <td>
                          {
                            item.timeLimit
                          }s
                        </td>

                        <td>
                          {
                            item.maximumScore
                          }
                        </td>

                        <td>

                          <span
                            className={`badge ${
                              item.status ===
                              "PUBLISHED"
                                ? "text-bg-success"
                                : "text-bg-secondary"
                            }`}
                          >
                            {
                              item.status
                            }
                          </span>

                        </td>

                        <td>

                          <div className="d-flex justify-content-end flex-wrap gap-1">

                            <button
                              className="btn btn-sm btn-outline-dark"
                              onClick={() =>
                                onSelectCase?.(
                                  item
                                )
                              }
                            >
                              Manage Content
                            </button>

                            <button
                              className="btn btn-sm btn-outline-primary"
                              onClick={() =>
                                editCase(
                                  item
                                )
                              }
                            >
                              Edit
                            </button>

                            <button
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() =>
                                setPreview(
                                  item
                                )
                              }
                            >
                              Preview
                            </button>

                            <button
                              className="btn btn-sm btn-outline-success"
                              onClick={() =>
                                changePublishState(
                                  item
                                )
                              }
                            >
                              {item.status ===
                              "PUBLISHED"
                                ? "Unpublish"
                                : "Publish"}
                            </button>

                            <button
                              className="btn btn-sm btn-outline-danger"
                              onClick={() =>
                                deleteCase(
                                  item
                                )
                              }
                            >
                              Delete
                            </button>

                          </div>

                        </td>

                      </tr>
                    )
                  )}

                </tbody>

              </table>

            </div>
          )}

        </div>

      </div>


      {/* =================================================
          PREVIEW
      ================================================= */}

      {preview && (
        <div
          className="modal d-block"
          tabIndex="-1"
          role="dialog"
          style={{
            background:
              "rgba(0,0,0,.55)"
          }}
        >

          <div className="modal-dialog modal-lg modal-dialog-scrollable">

            <div className="modal-content">

              <div className="modal-header">

                <div>

                  <h2 className="h5 mb-1">
                    {preview.title}
                  </h2>

                  <span className="badge text-bg-dark">
                    {
                      preview.difficulty
                    }
                  </span>

                </div>

                <button
                  className="btn-close"
                  onClick={() =>
                    setPreview(null)
                  }
                />

              </div>

              <div className="modal-body">

                <p>
                  {
                    preview.description
                  }
                </p>

                <h3 className="h6 mt-4">
                  Suspects
                </h3>

                {preview.suspects
                  ?.length ? (
                  preview.suspects.map(
                    (
                      suspect,
                      index
                    ) => (
                      <div
                        className="border rounded p-2 mb-2"
                        key={
                          suspect._id ||
                          index
                        }
                      >

                        <strong>
                          {
                            suspect.name
                          }
                        </strong>

                        <div className="small text-secondary">
                          {
                            suspect.description
                          }
                        </div>

                      </div>
                    )
                  )
                ) : (
                  <div className="text-secondary">
                    No suspects.
                  </div>
                )}

                <h3 className="h6 mt-4">
                  Configuration
                </h3>

                <ul>

                  <li>
                    Time:{" "}
                    {
                      preview.timeLimit
                    }{" "}
                    seconds
                  </li>

                  <li>
                    Maximum score:{" "}
                    {
                      preview.maximumScore
                    }
                  </li>

                  <li>
                    Final fields:{" "}
                    {
                      preview
                        .finalAnswerFields
                        ?.join(
                          ", "
                        ) ||
                      "None"
                    }
                  </li>

                </ul>

              </div>

              <div className="modal-footer">

                <button
                  className="btn btn-dark"
                  onClick={() =>
                    setPreview(null)
                  }
                >
                  Close
                </button>

              </div>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}
