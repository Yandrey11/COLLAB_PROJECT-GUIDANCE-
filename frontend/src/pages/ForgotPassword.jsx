import { useState } from "react";
import axios from "axios";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export default function ForgotPassword() {
  useDocumentTitle("Forgot Password");
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const isAdmin = returnTo === "admin";
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
      const res = await axios.post(`${baseUrl}/api/reset/forgot-password`, { email });
      setMessage(res.data.message || "Reset code sent! Check your email.");
      const resetPath = isAdmin ? "/reset-password?returnTo=admin" : "/reset-password";
      setTimeout(() => navigate(resetPath), 2000);
    } catch (err) {
      console.error("Forgot password error:", err);
      setMessage(err.response?.data?.message || "Failed to send reset code.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap');
        .forgot-page * { box-sizing: border-box; }
        .forgot-page {
          font-family: 'Montserrat', sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          background: linear-gradient(135deg, #e0e7ff, #ede9fe, #ddd6fe);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px 16px;
        }
        .forgot-card {
          width: 100%;
          max-width: 440px;
          background: #fff;
          border-radius: 24px;
          padding: 48px 40px;
          box-shadow: 0 25px 70px rgba(79, 70, 229, 0.15);
          border: 1px solid rgba(226,232,240,0.8);
          color: #111827;
        }
        .forgot-heading h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
          color: #111827;
        }
        .forgot-heading p {
          color: #6b7280;
          margin: 8px 0 0 0;
          font-size: 15px;
        }
        .forgot-form input {
          width: 100%;
          padding: 12px 14px;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
          background: #f9fafb;
          color: #111827;
          font-size: 15px;
          transition: border 0.2s ease, background 0.2s ease;
        }
        .forgot-form input:focus {
          outline: none;
          border-color: #4f46e5;
          background: #fff;
        }
        .forgot-form label {
          font-size: 13px;
          font-weight: 600;
          color: #374151;
          margin-bottom: 6px;
          display: block;
        }
        .forgot-primary {
          width: 100%;
          padding: 14px;
          border: none;
          border-radius: 12px;
          font-weight: 700;
          cursor: pointer;
          background: linear-gradient(120deg, #4f46e5, #7c3aed);
          color: #fff;
          margin-top: 4px;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
          font-family: inherit;
        }
        .forgot-primary:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }
        .forgot-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 15px 30px rgba(99,102,241,0.35);
        }
        .forgot-back {
          background: transparent;
          color: #6b7280;
          border: 1px solid #e5e7eb;
          padding: 8px 16px;
          border-radius: 999px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          margin-bottom: 24px;
        }
        .forgot-back:hover {
          color: #111827;
          border-color: #c7d2fe;
        }
        .forgot-message {
          margin-top: 12px;
          padding: 10px 12px;
          border-radius: 10px;
          font-size: 13px;
        }
        .forgot-message.success {
          background: rgba(34,197,94,0.1);
          color: #16a34a;
        }
        .forgot-message.error {
          background: rgba(239,68,68,0.1);
          color: #dc2626;
        }
        .forgot-link {
          color: #4f46e5;
          text-decoration: none;
          font-weight: 600;
        }
        .forgot-link:hover {
          text-decoration: underline;
        }
        @media (max-width: 520px) {
          .forgot-card {
            padding: 32px 24px;
          }
        }
      `}</style>

      <div className="forgot-page">
        <div className="forgot-card" role="main">
          <button
            type="button"
            className="forgot-back"
            onClick={() => navigate(isAdmin ? "/adminlogin" : "/login")}
          >
            ← Back to Login
          </button>
          <div className="forgot-heading">
            <h1>Forgot Password</h1>
            <p>
              {isAdmin
                ? "Enter your admin email to receive a reset code."
                : "Enter your email to receive a reset code."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="forgot-form" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label htmlFor="forgot-email">Email</label>
              <input
                id="forgot-email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <button
              type="submit"
              className="forgot-primary"
              disabled={loading}
            >
              {loading ? "Sending..." : "Send Reset Code"}
            </button>
          </form>

          {message && (
            <p className={`forgot-message ${message.includes("Failed") ? "error" : "success"}`}>
              {message}
            </p>
          )}

          <p style={{ textAlign: "center", marginTop: "24px", color: "#6b7280", fontSize: "14px" }}>
            Remembered your password?{" "}
            <Link to={isAdmin ? "/adminlogin" : "/login"} className="forgot-link">
              Back to Login
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
