import { Link } from "react-router-dom";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { motion } from "framer-motion";

export default function Landing() {
  useDocumentTitle("Home");
  return (
    <div className="min-h-screen w-full flex flex-col overflow-x-hidden page-bg font-sans text-gray-900">
      <main className="flex-1 flex flex-col justify-center items-center text-center px-4 md:px-6 lg:px-8 py-12 md:py-16 lg:py-20 max-w-6xl mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto"
        >
          <h2 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-extrabold text-gray-900 mb-6 md:mb-8 leading-tight tracking-tight">
            Guidance Counsel
            <br />
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              Record System
            </span>
          </h2>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-base md:text-lg lg:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed mb-12 md:mb-16 font-medium"
          >
            You have brains in your head. You have feet in your shoes. You can steer yourself any direction you choose.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-wrap gap-3 md:gap-4 justify-center items-center"
          >
            <Link
              to="/about"
              className="group relative px-8 md:px-10 py-3.5 md:py-4 rounded-xl font-semibold text-base md:text-lg transition-all duration-300 transform hover:-translate-y-1 hover:shadow-2xl flex items-center justify-center bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 text-white hover:from-indigo-700 hover:to-violet-700 shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50"
            >
              <span className="relative z-10">About Us</span>
              <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-indigo-700 to-violet-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
            </Link>
            
            <Link
              to="/login"
              className="px-8 md:px-10 py-3.5 md:py-4 rounded-xl font-semibold text-base md:text-lg transition-all duration-300 transform hover:-translate-y-1 hover:shadow-xl flex items-center justify-center bg-white text-indigo-600 border-2 border-indigo-200 hover:border-indigo-300 hover:bg-indigo-50 shadow-md"
            >
              Log In
            </Link>
            
            <Link
              to="/adminlogin"
              className="px-8 md:px-10 py-3.5 md:py-4 rounded-xl font-semibold text-base md:text-lg transition-all duration-300 transform hover:-translate-y-1 hover:shadow-xl flex items-center justify-center bg-white text-indigo-600 border-2 border-indigo-200 hover:border-indigo-300 hover:bg-indigo-50 shadow-md"
            >
              Admin Login
            </Link>
          </motion.div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="text-center py-6 md:py-8 border-t border-indigo-100/50 bg-white/50">
        <p className="text-sm md:text-base text-gray-500">
          © {new Date().getFullYear()} Collab Project. All rights reserved.
        </p>
      </footer>
    </div>
  );
}