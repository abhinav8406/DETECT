import React, {
  useState
} from "react";

import {
  useNavigate
} from "react-router-dom";

import CaseManager
  from "../components/admin/CaseManager.jsx";

import ClueManager
  from "../components/admin/ClueManager.jsx";

import QuestionManager
  from "../components/admin/QuestionManager.jsx";

import HintManager
  from "../components/admin/HintManager.jsx";

import MonitoringTable
  from "../components/admin/MonitoringTable.jsx";

import ParticipantAccess
  from "../components/admin/ParticipantAccess.jsx";

const tabs = [
  {
    id: "cases",
    label: "Cases"
  },
  {
    id: "clues",
    label: "Clues"
  },
  {
    id: "questions",
    label: "Questions"
  },
  {
    id: "hints",
    label: "Hints"
  },
  {
    id: "monitoring",
    label: "Live Monitoring"
  },
  {
    id: "participants",
    label: "Participants"
  }
];

export default function AdminDashboard() {

  const navigate =
    useNavigate();

  const [
    activeTab,
    setActiveTab
  ] = useState("cases");

  const [
    selectedCase,
    setSelectedCase
  ] = useState(null);


  function logout() {

    localStorage.removeItem(
      "token"
    );

    localStorage.removeItem(
      "user"
    );

    navigate(
      "/login",
      {
        replace: true
      }
    );
  }


  function handleCaseSelect(
    caseItem
  ) {

    setSelectedCase(
      caseItem
    );

    setActiveTab(
      "clues"
    );
  }


  return (
    <div className="min-vh-100 bg-body-tertiary">

      <nav className="navbar bg-dark navbar-dark">

        <div className="container-fluid px-3 px-lg-4">

          <div>

            <span className="navbar-brand fw-semibold">
              Fest Detective
            </span>

            <span className="badge text-bg-danger ms-2">
              ADMIN
            </span>

          </div>

          <button
            className="btn btn-outline-light btn-sm"
            onClick={
              logout
            }
          >
            Logout
          </button>

        </div>

      </nav>


      <main className="container-fluid px-3 px-lg-4 py-4">

        <div className="mb-4">

          <h1 className="h3 mb-1">
            Detective Case Management
          </h1>

          <p className="text-secondary mb-0">
            Configure Round 2 cases,
            clues, questions, hints
            and participant access.
          </p>

        </div>


        {selectedCase && (
          <div className="alert alert-dark d-flex flex-wrap justify-content-between align-items-center gap-2">

            <div>
              <strong>
                Active Case:
              </strong>{" "}
              {
                selectedCase.title
              }
            </div>

            <button
              className="btn btn-sm btn-outline-light"
              onClick={() =>
                setSelectedCase(
                  null
                )
              }
            >
              Clear Case
            </button>

          </div>
        )}


        <div className="card shadow-sm mb-4">

          <div className="card-body p-2">

            <div className="nav nav-pills flex-wrap gap-1">

              {tabs.map(
                tab => (
                  <button
                    key={
                      tab.id
                    }
                    type="button"
                    className={`nav-link ${
                      activeTab ===
                      tab.id
                        ? "active"
                        : ""
                    }`}
                    onClick={() =>
                      setActiveTab(
                        tab.id
                      )
                    }
                  >
                    {
                      tab.label
                    }
                  </button>
                )
              )}

            </div>

          </div>

        </div>


        {activeTab ===
          "cases" && (
          <CaseManager
            onSelectCase={
              handleCaseSelect
            }
          />
        )}


        {activeTab ===
          "clues" && (
          <ClueManager
            caseId={
              selectedCase?._id
            }
          />
        )}


        {activeTab ===
          "questions" && (
          <QuestionManager
            caseId={
              selectedCase?._id
            }
          />
        )}


        {activeTab ===
          "hints" && (
          <HintManager
            caseId={
              selectedCase?._id
            }
          />
        )}


        {activeTab ===
          "monitoring" && (
          <MonitoringTable />
        )}


        {activeTab ===
          "participants" && (
          <ParticipantAccess />
        )}

      </main>

    </div>
  );
}
