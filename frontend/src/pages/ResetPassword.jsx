import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { validatePassword } from "../utils/passwordValidation";
import PasswordStrengthMeter from "../components/PasswordStrengthMeter.jsx";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export default function ResetPassword() {
  useDocumentTitle("Reset Password");
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const returnTo = searchParams.get("returnTo");
  const isAdmin = returnTo === "admin";
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [useToken, setUseToken] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState([]);

  useEffect(() => {
    const tokenParam = searchParams.get("token");
    const emailParam = searchParams.get("email");

    if (tokenParam && emailParam) {
      setToken(tokenParam);
      setEmail(emailParam);
      setUseToken(true);
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    if (!newPassword) {
      setMessage("New password is required");
      setLoading(false);
      return;
    }

    const validation = validatePassword(newPassword, { email });
    if (!validation.isValid) {
      setPasswordErrors(validation.errors);
      setMessage("Password does not meet the security requirements.");
      setLoading(false);
      return;
    }

    try {
      const payload = useToken
        ? { email, token, newPassword }
        : { email, code, newPassword };

      const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
      const res = await axios.post(`${baseUrl}/api/reset/reset-password`, payload);

      setMessage(res.data.message || "Password reset successful!");
      const loginPath = isAdmin ? "/adminlogin" : "/login";
      setTimeout(() => navigate(loginPath), 2000);
    } catch (err) {
      console.error("Reset password error:", err);
      setMessage(err.response?.data?.message || "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap');
        .reset-page * { box-sizing: border-box; }
        .reset-page {
          font-family: 'Montserrat', sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          background: linear-gradient(135deg, #eef2ff, #c7d2fe);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 32px 16px;
        }
        .reset-card {
          width: 100%;
          max-width: 440px;
          background: #fff;
          border-radius: 24px;
          padding: 48px 40px;
          box-shadow: 0 25px 70px rgba(79, 70, 229, 0.15);
          border: 1px solid rgba(226,232,240,0.8);
          color: #111827;
        }
        .reset-heading h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 700;
          color: #111827;
        }
        .reset-heading p {
          color: #6b7280;
          margin: 8px 0 0 0;
          font-size: 15px;
        }
        .reset-form input {
          width: 100%;
          padding: 12px 14px;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
          background: #f9fafb;
          color: #111827;
          font-size: 15px;
          transition: border 0.2s ease, background 0.2s ease;
        }
        .reset-form input:focus {
          outline: none;
          border-color: #4f46e5;
          background: #fff;
        }
        .reset-form label {
          font-size: 13px;
          font-weight: 600;
          color: #374151;
          margin-bottom: 6px;
          display: block;
        }
        .reset-primary {
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
        .reset-primary:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }
        .reset-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 15px 30px rgba(99,102,241,0.35);
        }
        .reset-back {
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
        .reset-back:hover {
          color: #111827;
          border-color: #c7d2fe;
        }
        .reset-email-box {
          padding: 12px 14px;
          background: #f9fafb;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
          font-size: 14px;
          color: #6b7280;
        }
        .reset-email-box strong {
          color: #111827;
        }
        .reset-message {
          margin-top: 12px;
          padding: 10px 12px;
          border-radius: 10px;
          font-size: 13px;
        }
        .reset-message.success {
          background: rgba(34,197,94,0.1);
          color: #16a34a;
        }
        .reset-message.error {
          background: rgba(239,68,68,0.1);
          color: #dc2626;
        }
        .reset-errors {
          font-size: 12px;
          color: #dc2626;
          list-style: disc;
          padding-left: 20px;
          margin: 4px 0 0 0;
        }
        .reset-link {
          color: #4f46e5;
          text-decoration: none;
          font-weight: 600;
        }
        .reset-link:hover {
          text-decoration: underline;
        }
        @media (max-width: 520px) {
          .reset-card {
            padding: 32px 24px;
          }
        }
      `}</style>

      <div className="reset-page">
        <div className="reset-card" role="main">
          <button
            type="button"
            className="reset-back"
            onClick={() => navigate(isAdmin ? "/adminlogin" : "/login")}
          >
            ← Back to Login
          </button>
          <div className="reset-heading">
            <h1>Reset Password</h1>
            <p>
              {isAdmin
                ? "Enter your reset code and new password."
                : "Enter your reset code and new password."}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="reset-form" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {!useToken && (
              <>
                <div>
                  <label htmlFor="reset-email">Email</label>
                  <input
                    id="reset-email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="reset-code">Reset Code</label>
                  <input
                    id="reset-code"
                    type="text"
                    placeholder="Enter 6-digit reset code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                  />
                </div>
              </>
            )}

            {useToken && (
              <div className="reset-email-box">
                Resetting password for: <strong>{email}</strong>
              </div>
            )}

            <div>
              <label htmlFor="reset-password">New Password</label>
              <input
                id="reset-password"
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => {
                  const value = e.target.value;
                  setNewPassword(value);
                  const result = validatePassword(value, { email });
                  setPasswordErrors(result.errors);
                }}
                required
              />
              <div style={{ marginTop: 6 }}>
                <PasswordStrengthMeter password={newPassword} email={email} />
              </div>
              {passwordErrors.length > 0 && (
                <ul className="reset-errors">
                  {passwordErrors.map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
              )}
            </div>

            <button
              type="submit"
              className="reset-primary"
              disabled={loading}
            >
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </form>

          {message && (
            <p className={`reset-message ${message.includes("Failed") ? "error" : "success"}`}>
              {message}
            </p>
          )}

          <p style={{ textAlign: "center", marginTop: "24px", color: "#6b7280", fontSize: "14px" }}>
            Remembered your password?{" "}
            <Link to={isAdmin ? "/adminlogin" : "/login"} className="reset-link">
              Back to {isAdmin ? "Admin " : ""}Login
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
