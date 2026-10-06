import React, { useState } from "react";
import { api } from "../api.js";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState(
    "qualified@example.com"
  );

  const [password, setPassword] = useState(
    "password123"
  );

  const [showPassword, setShowPassword] =
    useState(false);

  const [error, setError] = useState("");

  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();

    setError("");

    try {
      const { data } = await api.post(
        "/auth/login",
        {
          email,
          password
        }
      );

      localStorage.setItem(
        "token",
        data.token
      );

      localStorage.setItem(
        "user",
        JSON.stringify(data.user)
      );

      navigate(
        data.user.role === "admin"
          ? "/admin"
          : "/dashboard"
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Login failed"
      );
    }
  }

  return (
    <div className="min-vh-100 d-flex align-items-center bg-body-tertiary px-3">
      <form
        className="card shadow-sm mx-auto p-4 login-card w-100"
        style={{ maxWidth: "420px" }}
        onSubmit={submit}
      >
        <h1 className="h3 mb-1">
          Fest Detective
        </h1>

        <p className="text-secondary mb-4">
          Round 2 access
        </p>

        {error && (
          <div className="alert alert-danger">
            {error}
          </div>
        )}

        {/* EMAIL */}
        <div className="mb-3">
          <label className="form-label">
            Email
          </label>

          <input
            className="form-control"
            type="email"
            value={email}
            onChange={e =>
              setEmail(e.target.value)
            }
            placeholder="Enter your email"
            autoComplete="email"
            required
          />
        </div>

        {/* PASSWORD */}
        <div className="mb-3">
          <label className="form-label">
            Password
          </label>

          <div className="input-group">
            <input
              className="form-control"
              type={
                showPassword
                  ? "text"
                  : "password"
              }
              value={password}
              onChange={e =>
                setPassword(e.target.value)
              }
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />

            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() =>
                setShowPassword(
                  previous => !previous
                )
              }
              aria-label={
                showPassword
                  ? "Hide password"
                  : "Show password"
              }
              title={
                showPassword
                  ? "Hide password"
                  : "Show password"
              }
            >
              {showPassword ? "🙈" : "👁️"}
            </button>
          </div>
        </div>

        <button
          className="btn btn-dark w-100"
          type="submit"
        >
          Login
        </button>
      </form>
    </div>
  );
}
