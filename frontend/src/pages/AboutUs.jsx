import { Link } from "react-router-dom";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export default function AboutUs() {
  useDocumentTitle("About Us");
  
  return (
    <div className="min-h-screen w-full flex flex-col overflow-x-hidden page-bg font-sans text-gray-900 dark:text-gray-100">
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-12 md:py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-white mb-4">
            About Us
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Empowering guidance counselors with a comprehensive record management system
          </p>
        </div>

        {/* Mission Section */}
        <section className="mb-16">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 md:p-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Our Mission</h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
              The Guidance Counsel Record System is designed to streamline and enhance the work of guidance counselors 
              by providing a centralized platform for managing counseling records, client information, and session documentation.
            </p>
            <p className="text-lg text-gray-600 dark:text-gray-300 leading-relaxed">
              Our mission is to empower counselors with tools that help them focus on what matters most: providing 
              quality guidance and support to those who need it. We believe that by simplifying administrative tasks, 
              counselors can dedicate more time to meaningful interactions with their clients.
            </p>
          </div>
        </section>

        {/* Features Section */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 text-center">Key Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
              <div className="text-4xl mb-4">📋</div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Record Management</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Easily create, update, and manage counseling records with a user-friendly interface designed for efficiency.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Analytics & Reports</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Generate comprehensive reports and gain insights through powerful analytics tools tailored for counselors.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
              <div className="text-4xl mb-4">🔔</div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Notifications</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Stay updated with real-time notifications about records, assignments, and important announcements.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
              <div className="text-4xl mb-4">☁️</div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Cloud Integration</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Seamlessly integrate with Google Drive for secure document storage and easy access from anywhere.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
              <div className="text-4xl mb-4">🔒</div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Security & Privacy</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Your data is protected with industry-standard security measures and privacy controls.
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
              <div className="text-4xl mb-4">⚡</div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Efficient Workflow</h3>
              <p className="text-gray-600 dark:text-gray-300">
                Streamline your workflow with intuitive tools that save time and reduce administrative burden.
              </p>
            </div>
          </div>
        </section>

        {/* Values Section */}
        <section className="mb-16">
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl shadow-lg p-8 md:p-12 text-white">
            <h2 className="text-3xl font-bold mb-8">Our Values</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-xl font-bold mb-3">Confidentiality</h3>
                <p className="text-indigo-100">
                  We prioritize the privacy and confidentiality of all client information, ensuring that sensitive data 
                  is handled with the utmost care and security.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-3">Efficiency</h3>
                <p className="text-indigo-100">
                  Our system is designed to minimize time spent on administrative tasks, allowing counselors to focus 
                  on providing quality guidance and support.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-3">Reliability</h3>
                <p className="text-indigo-100">
                  We are committed to providing a stable and reliable platform that counselors can depend on for their 
                  daily operations.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-3">Innovation</h3>
                <p className="text-indigo-100">
                  We continuously work to improve and enhance our platform based on feedback from counselors and 
                  evolving needs of the guidance community.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Call to Action */}
        <section className="text-center">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 md:p-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
              Join counselors who are already using our system to streamline their work and provide better support to their clients.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link
                to="/signup"
                className="px-8 py-3 rounded-full font-semibold transition-all duration-200 transform hover:-translate-y-0.5 shadow-lg hover:shadow-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:shadow-indigo-500/30"
              >
                Sign Up
              </Link>
              <Link
                to="/login"
                className="px-8 py-3 rounded-full font-semibold transition-all duration-200 transform hover:-translate-y-0.5 shadow-lg hover:shadow-xl bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-gray-600 hover:border-indigo-200 dark:hover:border-gray-500"
              >
                Log In
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800 border-t border-slate-200 dark:border-gray-700 py-8 mt-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              © {new Date().getFullYear()} Collab Project. All rights reserved.
            </p>
            <div className="flex gap-6">
              <Link
                to="/"
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                Home
              </Link>
              <Link
                to="/about"
                className="text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                About Us
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}


