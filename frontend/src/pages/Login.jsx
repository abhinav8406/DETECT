import React, { useState } from "react";
import { api } from "../api.js";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [mode, setMode] = useState("login");

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");

  const [email, setEmail] = useState("qualified@example.com");
  const [password, setPassword] = useState("password123");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  function switchMode(nextMode) {
    setMode(nextMode);
    setError("");
    setSuccess("");

    if (nextMode === "register") {
      setEmail("");
      setPassword("");
    } else {
      setEmail("qualified@example.com");
      setPassword("password123");
      setName("");
      setUsername("");
      setConfirmPassword("");
    }
  }

  async function submitLogin(e) {
    e.preventDefault();

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const { data } = await api.post("/auth/login", {
        email,
        password
      });

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      navigate(
        data.user.role === "admin"
          ? "/admin"
          : "/dashboard"
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Login failed."
      );
    } finally {
      setLoading(false);
    }
  }

  async function submitRegister(e) {
    e.preventDefault();

    setError("");
    setSuccess("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      const { data } = await api.post("/auth/register", {
        name,
        username,
        email,
        password
      });

      localStorage.setItem("token", data.token);
      localStorage.setItem(
        "user",
        JSON.stringify(data.user)
      );

      navigate("/dashboard");
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Registration failed."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-vh-100 d-flex align-items-center bg-body-tertiary py-5">
      <div className="card shadow-sm mx-auto p-4 login-card">
        <h1 className="h3 mb-1">Fest Detective</h1>

        <p className="text-secondary mb-4">
          {mode === "login"
            ? "Round 2 access"
            : "Create your participant account"}
        </p>

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

        {mode === "login" ? (
          <form onSubmit={submitLogin}>
            <input
              className="form-control mb-2"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email"
              type="email"
              required
            />

            <input
              className="form-control mb-3"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              required
            />

            <button
              className="btn btn-dark w-100"
              disabled={loading}
            >
              {loading ? "Logging in..." : "Login"}
            </button>

            <div className="text-center mt-3">
              <span className="text-secondary">
                Don't have an account?{" "}
              </span>

              <button
                type="button"
                className="btn btn-link p-0"
                onClick={() => switchMode("register")}
              >
                Register
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={submitRegister}>
            <input
              className="form-control mb-2"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Full Name"
              required
            />

            <input
              className="form-control mb-2"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Username"
              required
            />

            <input
              className="form-control mb-2"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email"
              type="email"
              required
            />

            <input
              className="form-control mb-2"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              minLength={6}
              required
            />

            <input
              className="form-control mb-3"
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Confirm Password"
              minLength={6}
              required
            />

            <button
              className="btn btn-dark w-100"
              disabled={loading}
            >
              {loading
                ? "Creating account..."
                : "Create Account"}
            </button>

            <div className="text-center mt-3">
              <span className="text-secondary">
                Already have an account?{" "}
              </span>

              <button
                type="button"
                className="btn btn-link p-0"
                onClick={() => switchMode("login")}
              >
                Login
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
