import React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import DetectiveCase from "./pages/DetectiveCase.jsx";

function ProtectedRoute({ children }) {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "null");

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function LoginRoute() {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "null");

  if (token && user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Login />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Login */}
        <Route
          path="/login"
          element={<LoginRoute />}
        />

        {/* Participant Dashboard */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* Detective Case */}
        <Route
          path="/round2/case"
          element={
            <ProtectedRoute>
              <DetectiveCase />
            </ProtectedRoute>
          }
        />

        {/* Default */}
        <Route
          path="/"
          element={<Navigate to="/dashboard" replace />}
        />

        {/* Unknown routes */}
        <Route
          path="*"
          element={<Navigate to="/dashboard" replace />}
        />

      </Routes>
    </BrowserRouter>
  );
}
