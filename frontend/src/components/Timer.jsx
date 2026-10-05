import React, { useEffect, useState } from "react";

export default function Timer({ expiresAt, onExpired }) {
  const [remaining, setRemaining] = useState(Math.max(0, new Date(expiresAt).getTime() - Date.now()));

  useEffect(() => {
    const id = setInterval(() => {
      const value = Math.max(0, new Date(expiresAt).getTime() - Date.now());
      setRemaining(value);
      if (value === 0) onExpired?.();
    }, 500);
    return () => clearInterval(id);
  }, [expiresAt, onExpired]);

  const total = Math.floor(remaining / 1000);
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");

  return <span className={`badge ${total < 60 ? "text-bg-danger" : "text-bg-dark"}`}>{m}:{s}</span>;
}
