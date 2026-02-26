import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import ReCAPTCHA from "react-google-recaptcha";
import Swal from "sweetalert2";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";

export default function AdminLogin() {
  useDocumentTitle("Admin Login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    if (!captchaToken) {
      setMessage("⚠️ Please verify that you are not a robot.");
      setLoading(false);
      return;
    }

    try {
      console.log("🔐 Attempting admin login for:", email);
      const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
      const res = await axios.post(`${baseUrl}/api/admin/login`, {
        email,
        password,
        captchaToken,
      });

      console.log("✅ Login response received:", res.data);

      // Verify token exists in response
      if (!res.data.token) {
        console.error("❌ No token in response:", res.data);
        setMessage("⚠️ Login failed: No token received from server.");
        setLoading(false);
        return;
      }

      // Store token and admin data
      localStorage.setItem("adminToken", res.data.token);
      localStorage.setItem("admin", JSON.stringify(res.data.admin));

      // Verify token was stored
      const storedToken = localStorage.getItem("adminToken");
      if (!storedToken) {
        console.error("❌ Token not stored in localStorage");
        setMessage("⚠️ Failed to store token. Please try again.");
        setLoading(false);
        return;
      }

      console.log("✅ Token stored successfully, redirecting to dashboard");
      await Swal.fire({
        icon: "success",
        title: "Login Successful!",
        text: "Admin login successful!",
        timer: 2000,
        showConfirmButton: false,
      });
      navigate("/admindashboard", { replace: true });
    } catch (err) {
      console.error("❌ Login error:", err);
      console.error("Error response:", err.response?.data);
      console.error("Error status:", err.response?.status);
      setMessage(err.response?.data?.message || "Login failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
    window.location.href = `${baseUrl}/auth/admin/google`;
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&display=swap');
        * { box-sizing: border-box; }
        html, body, #root {
          height: 100%;
          width: 100%;
          margin: 0;
          font-family: 'Montserrat', sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          background: linear-gradient(135deg, #eef2ff, #c7d2fe);
          overflow-x: hidden;
        }
        .page {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 32px 16px;
        }
        .card {
          width: 100%;
          max-width: 520px;
          background: #fff;
          border-radius: 24px;
          padding: 48px 40px;
          box-shadow: 0 25px 70px rgba(79, 70, 229, 0.15);
          border: 1px solid rgba(226,232,240,0.8);
          color: #111827;
        }
        .formSection {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .heading h1 {
          margin: 0;
          font-size: 30px;
          color: #111827;
        }
        .heading p {
          color: #6b7280;
          margin: 6px 0 0 0;
          font-size: 15px;
        }
        form {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        label {
          font-size: 13px;
          font-weight: 600;
          color: #374151;
          margin-bottom: 6px;
          display: inline-block;
        }
        input {
          width: 100%;
          padding: 12px 14px;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
          background: #f9fafb;
          color: #111827;
          font-size: 15px;
          transition: border 0.2s ease, background 0.2s ease;
        }
        input:focus {
          outline: none;
          border-color: #4f46e5;
          background: #fff;
        }
        .primary {
          width: 100%;
          padding: 14px;
          border: none;
          border-radius: 12px;
          font-weight: 700;
          cursor: pointer;
          background: linear-gradient(120deg,#4f46e5,#7c3aed);
          color: #fff;
          margin-top: 4px;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .primary:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }
        .primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 15px 30px rgba(99,102,241,0.35);
        }
        .divider {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 12px;
          text-transform: uppercase;
          color: #9ca3af;
          letter-spacing: 0.08em;
          margin-top: 14px;
        }
        .divider::before,
        .divider::after {
          content: "";
          flex: 1;
          height: 1px;
          background: #e5e7eb;
        }
        .socialButtons {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 10px;
          margin-top: 16px;
        }
        .socialBtn,
        .googleBtn {
          flex: 1;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 10px 14px;
          background: #fff;
          color: #374151;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          font-weight: 600;
          transition: transform 0.15s ease, border 0.15s ease;
          text-decoration: none;
        }
        .socialBtn:hover,
        .googleBtn:hover {
          transform: translateY(-1px);
          border-color: #c7d2fe;
        }
        .backBtn {
          align-self: flex-start;
          background: transparent;
          color: #6b7280;
          border: 1px solid #e5e7eb;
          padding: 8px 16px;
          border-radius: 999px;
          font-weight: 600;
          cursor: pointer;
        }
        .backBtn:hover {
          color: #111827;
          border-color: #c7d2fe;
        }
        .error {
          margin-top: 14px;
          padding: 10px 12px;
          border-radius: 10px;
          background: rgba(239,68,68,0.1);
          text-align: left;
          font-size: 13px;
        }
        .actions {
          display: flex;
          justify-content: flex-end;
          font-size: 13px;
        }
        .link {
          color: #4f46e5;
          text-decoration: none;
          font-weight: 600;
        }
        .status {
          font-size: 13px;
          color: #4f46e5;
          margin-top: 10px;
        }
        @media (max-width: 520px) {
          .card {
            padding: 32px 24px;
          }
          .socialButtons {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="page">
        <div className="card" role="main">
          <section className="formSection" aria-label="Admin login form">
            <button className="backBtn" onClick={() => navigate("/")}>
              ← Go Back 
            </button>
            <div className="heading">
              <h1>Welcome back</h1>
              <p>Sign in to access records, reports, notifications, and more.</p>
            </div>

            <form onSubmit={handleSubmit}>
              <div>
                <label htmlFor="admin-email">Admin email</label>
                <input
                  id="admin-email"
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div>
                <label htmlFor="admin-password">Password</label>
                <input
                  id="admin-password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>

              <div style={{ display: "flex", justifyContent: "center", margin: "6px 0 4px 0" }}>
                <ReCAPTCHA
                  sitekey="6Lf98vErAAAAAFBhvxrQnb4NCHHLXwYb-QOlKSQ3"
                  onChange={(token) => setCaptchaToken(token)}
                />
              </div>

              <div className="actions">
                <a className="link" href="/forgot-password?returnTo=admin">
                  Forgot password?
                </a>
              </div>

              <button type="submit" className="primary" disabled={loading}>
                {loading ? "Authenticating..." : "Log in to Dashboard"}
              </button>

              <div className="divider">
                <span>or continue with</span>
              </div>

              <div className="socialButtons">
                <button className="googleBtn" onClick={handleGoogleLogin} aria-label="Sign in with Google">
                  <img
                    src="https://developers.google.com/identity/images/g-logo.png"
                    alt="Google"
                    style={{ width: "18px", height: "18px" }}
                  />
                  Google
                </button>
              </div>
            </form>
          </section>

          {message && <p className="error">{message}</p>}
          {!message && loading && <p className="status">Verifying credentials...</p>}
        </div>
      </div>
    </>
  );
}
