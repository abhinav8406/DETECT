import React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate
} from "react-router-dom";

import Login from "./pages/Login.jsx";
import Round2Gate from "./pages/Round2Gate.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import DetectiveCase from "./pages/DetectiveCase.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";

function getUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

function Protected({ children, admin = false }) {
  const user = getUser();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const role = String(user.role || "").trim().toLowerCase();

  // Admin-only route
  if (admin) {
    if (role !== "admin") {
      return <Navigate to="/dashboard" replace />;
    }

    return children;
  }

  // Participant routes
  if (role === "admin") {
    return <Navigate to="/admin" replace />;
  }

  return children;
}

function HomeRedirect() {
  const user = getUser();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const role = String(user.role || "").trim().toLowerCase();

  if (role === "admin") {
    return <Navigate to="/admin" replace />;
  }

  return <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Login */}
        <Route
          path="/login"
          element={<Login />}
        />

        {/* Root */}
        <Route
          path="/"
          element={<HomeRedirect />}
        />

        {/* Participant Dashboard */}
        <Route
          path="/dashboard"
          element={
            <Protected>
              <Dashboard />
            </Protected>
          }
        />

        {/* Round 2 Gate */}
        <Route
          path="/round2"
          element={
            <Protected>
              <Round2Gate />
            </Protected>
          }
        />

        {/* Detective Case */}
        <Route
          path="/round2/case"
          element={
            <Protected>
              <DetectiveCase />
            </Protected>
          }
        />

        {/* Admin Panel */}
        <Route
          path="/admin"
          element={
            <Protected admin>
              <AdminDashboard />
            </Protected>
          }
        />

        {/* Anything unknown */}
        <Route
          path="*"
          element={<HomeRedirect />}
        />

      </Routes>
    </BrowserRouter>
  );
}
