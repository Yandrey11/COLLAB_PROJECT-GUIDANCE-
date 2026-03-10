import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";

const AdminSignup = () => {
  useDocumentTitle("Admin Sign Up");
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        setSuccess("");

        try {
            const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:5000";
            const res = await axios.post(`${baseUrl}/api/admin/signup`, formData);
            
            // If token is returned, store it and redirect to dashboard
            if (res.data.token) {
                localStorage.setItem("adminToken", res.data.token);
                localStorage.setItem("admin", JSON.stringify(res.data.admin));
                setSuccess(res.data.message || "Admin account created successfully!");
                setTimeout(() => navigate("/admindashboard", { replace: true }), 1500);
            } else {
                // If no token, redirect to login
                setSuccess(res.data.message || "Admin account created successfully!");
                setTimeout(() => navigate("/adminlogin"), 1500);
            }
        } catch (err) {
            setError(err.response?.data?.message || "Signup failed. Try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-screen flex items-center justify-center page-bg px-4 py-8">
            <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-2xl w-full max-w-md transform transition-all duration-500 hover:scale-[1.02] animate-fade-in-up">
                {/* Header with animated gradient */}
                <div className="mb-6 text-center">
                    <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent animate-pulse-slow">
                        Admin Signup
                    </h2>
                    <div className="h-1 w-20 bg-gradient-to-r from-purple-600 to-pink-600 mx-auto mt-2 rounded-full animate-slide-right"></div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Name Input */}
                    <div className="transform transition-all duration-300 hover:translate-x-1">
                        <label className="block text-gray-700 text-sm font-semibold mb-2">
                            Name
                        </label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            required
                            className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-purple-400 focus:border-purple-400 focus:outline-none transition-all duration-300 transform hover:shadow-lg"
                            placeholder="Enter your name"
                        />
                    </div>

                    {/* Email Input */}
                    <div className="transform transition-all duration-300 hover:translate-x-1">
                        <label className="block text-gray-700 text-sm font-semibold mb-2">
                            Email
                        </label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                            className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-purple-400 focus:border-purple-400 focus:outline-none transition-all duration-300 transform hover:shadow-lg"
                            placeholder="admin@example.com"
                        />
                    </div>

                    {/* Password Input */}
                    <div className="transform transition-all duration-300 hover:translate-x-1">
                        <label className="block text-gray-700 text-sm font-semibold mb-2">
                            Password
                        </label>
                        <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            required
                            className="w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-purple-400 focus:border-purple-400 focus:outline-none transition-all duration-300 transform hover:shadow-lg"
                            placeholder="••••••••"
                        />
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="animate-shake">
                            <p className="text-red-500 text-sm text-center bg-red-50 py-2 px-3 rounded-lg border border-red-200">
                                {error}
                            </p>
                        </div>
                    )}

                    {/* Success Message */}
                    {success && (
                        <div className="animate-bounce-in">
                            <p className="text-green-600 text-sm text-center bg-green-50 py-2 px-3 rounded-lg border border-green-200">
                                {success}
                            </p>
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transform transition-all duration-300 hover:scale-[1.02] hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 relative overflow-hidden group"
                    >
                        <span className="relative z-10">
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Creating account...
                                </span>
                            ) : (
                                "Sign Up"
                            )}
                        </span>
                        <div className="absolute inset-0 bg-gradient-to-r from-pink-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    </button>
                </form>

                {/* Login Link */}
                <p className="text-sm text-center text-gray-600 mt-6 animate-fade-in">
                    Already have an account?{" "}
                    <a
                        href="/adminlogin"
                        className="text-purple-600 hover:text-pink-600 font-semibold hover:underline transition-colors duration-300"
                    >
                        Login
                    </a>
                </p>
            </div>
        </div>
    );
};

export default AdminSignup;
