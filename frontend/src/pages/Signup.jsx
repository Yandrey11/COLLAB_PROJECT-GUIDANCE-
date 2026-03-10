import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { validatePassword } from "../utils/passwordValidation";
import PasswordStrengthMeter from "../components/PasswordStrengthMeter.jsx";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

function Signup() {
  useDocumentTitle("Sign Up");
  const [signupData, setSignupData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [passwordErrors, setPasswordErrors] = useState([]);

  const navigate = useNavigate();

  const handleSignupChange = (e) => {
    const { name, value } = e.target;
    setSignupData({ ...signupData, [name]: value });

    if (name === "password") {
      const result = validatePassword(value, {
        email: signupData.email,
        name: signupData.name,
      });
      setPasswordErrors(result.errors);
    }
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setPasswordErrors([]);

    const validation = validatePassword(signupData.password, {
      email: signupData.email,
      name: signupData.name,
    });
    if (!validation.isValid) {
      setPasswordErrors(validation.errors);
      Swal.fire({
        icon: "error",
        title: "Password requirements not met",
        html: `<ul style="text-align:left;margin:0;padding-left:1.2rem;">${validation.hints.length > 0 ? validation.hints.map((hint) => `<li>${hint}</li>`).join("") : validation.errors.map((err) => `<li>${err}</li>`).join("")}</ul>`,
      });
      return;
    }
    try {
      const res = await axios.post(
        `${import.meta.env.VITE_API_URL || "http://localhost:5000"}/api/auth/signup`,
        signupData,
        { headers: { "Content-Type": "application/json" } }
      );

      Swal.fire({
        icon: "success",
        title: "Signup Successful!",
        text: "Your account has been created successfully!",
        timer: 2000,
        showConfirmButton: false,
      });
      console.log(res.data);

      if (res.data?.token) {
        localStorage.setItem("authToken", res.data.token);
        localStorage.setItem("user", JSON.stringify(res.data.user || {}));
      }

      navigate("/login");
    } catch (error) {
      console.error("Signup failed:", error.response?.data || error.message);
      Swal.fire({
        icon: "error",
        title: "Signup Failed",
        text: error.response?.data?.message || error.message,
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center page-bg font-sans p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8" role="region" aria-labelledby="signup-title">
        <h1 id="signup-title" className="text-2xl font-extrabold text-gray-900 text-center mb-2">Create your account</h1>
        <p className="text-sm text-gray-500 text-center mb-6">Sign up to start collaborating — it's quick and free.</p>

        <form onSubmit={handleSignupSubmit} aria-label="Signup form" className="flex flex-col gap-4">
          <div>
            <label htmlFor="name" className="block text-xs font-semibold text-gray-700 mb-1">Name</label>
            <input
              id="name"
              name="name"
              type="text"
              placeholder="Your full name"
              value={signupData.name}
              onChange={handleSignupChange}
              required
              className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-xs font-semibold text-gray-700 mb-1">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              value={signupData.email}
              onChange={handleSignupChange}
              required
              className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-semibold text-gray-700 mb-1">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="Choose a strong password"
              value={signupData.password}
              onChange={handleSignupChange}
              required
              className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
            <div className="mt-1">
              <PasswordStrengthMeter 
                password={signupData.password}
                email={signupData.email}
                name={signupData.name}
              />
            </div>
            {passwordErrors.length > 0 && (
              <ul className="mt-2 text-xs text-red-600 list-disc list-inside">
                {passwordErrors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            )}
          </div>

          <button type="submit" className="w-full py-3 rounded-lg font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
            Create Account
          </button>

          {/* New button that redirects to login */}
          <button
            type="button"
            className="w-full py-3 rounded-lg font-semibold text-indigo-600 border border-indigo-100 bg-white hover:bg-indigo-50 transition-all mt-2"
            onClick={() => navigate("/login")}
            aria-label="Go to login"
          >
            Already have an account? Log in
          </button>
        </form>

        <div className="text-center mt-6 text-xs text-gray-500">
          <div className="flex gap-3 justify-center mb-4" aria-hidden="true">
            <span className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors cursor-pointer"><i className="fab fa-google"></i></span>
            <span className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors cursor-pointer"><i className="fab fa-github"></i></span>
            <span className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors cursor-pointer"><i className="fab fa-linkedin-in"></i></span>
          </div>
          By creating an account you agree to our terms.
        </div>
      </div>
    </div>
  );
}

export default Signup;
