import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { io } from "socket.io-client";

export default function AdminDashboard() {
  const [cases, setCases] = useState([]);
  const [monitoring, setMonitoring] = useState([]);

  async function load() {
    const [c, m] = await Promise.all([
      api.get("/admin/cases"),
      api.get("/admin/monitoring")
    ]);
    setCases(c.data);
    setMonitoring(m.data);
  }

  useEffect(() => {
    load();
    const socket = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:5000");
    socket.emit("admin:join");
    socket.on("attempt:update", load);
    return () => socket.disconnect();
  }, []);

  async function publish(id, status) {
    await api.patch(`/admin/cases/${id}`, { status });
    load();
  }

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between mb-4">
        <div>
          <div className="small text-secondary">ADMIN PANEL</div>
          <h1 className="h3">Detective Case Management</h1>
        </div>
        <a className="btn btn-outline-dark" href={`${import.meta.env.VITE_API_URL || "http://localhost:5000/api"}/admin/export?fields=name,username,email,teamId,teamName,qualificationStatus`} target="_blank">
          Export CSV
        </a>
      </div>

      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <h2 className="h5">Case Management</h2>
          <div className="table-responsive">
            <table className="table align-middle">
              <thead><tr><th>Case</th><th>Difficulty</th><th>Time</th><th>Status</th><th /></tr></thead>
              <tbody>
                {cases.map(c => (
                  <tr key={c._id}>
                    <td>{c.title}</td>
                    <td>{c.difficulty}</td>
                    <td>{c.timeLimit}s</td>
                    <td>{c.status}</td>
                    <td>
                      <button className="btn btn-sm btn-dark" onClick={() => publish(c._id, c.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED")}>
                        {c.status === "PUBLISHED" ? "Unpublish" : "Publish"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="card-body">
          <h2 className="h5">Live Monitoring</h2>
          <div className="table-responsive">
            <table className="table">
              <thead><tr><th>Participant</th><th>Status</th><th>Clue</th><th>Question</th><th>Hints</th><th>Score</th><th>Time</th></tr></thead>
              <tbody>
                {monitoring.map((r, i) => (
                  <tr key={r.participant?.id || i}>
                    <td>{r.participant?.name}<div className="small text-secondary">{r.participant?.email}</div></td>
                    <td>{r.status}</td><td>{r.currentClue}</td><td>{r.currentQuestion}</td>
                    <td>{r.hintsUsed}</td><td>{r.score}</td>
                    <td>{Math.ceil(r.timeRemaining / 1000)}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
