import React, { useState } from "react";
import { api } from "../api.js";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("qualified@example.com");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    try {
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      navigate(data.user.role === "admin" ? "/admin" : "/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    }
  }

  return (
    <div className="min-vh-100 d-flex align-items-center bg-body-tertiary">
      <form className="card shadow-sm mx-auto p-4 login-card" onSubmit={submit}>
        <h1 className="h3 mb-1">Fest Detective</h1>
        <p className="text-secondary">Round 2 access</p>
        {error && <div className="alert alert-danger">{error}</div>}
        <input className="form-control mb-2" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" />
        <input className="form-control mb-3" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" />
        <button className="btn btn-dark w-100">Login</button>
      </form>
    </div>
  );
}
