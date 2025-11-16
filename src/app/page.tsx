"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Sun, Moon } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(true);

  // Auto Redirect if logged in
  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    const user = localStorage.getItem("user");

    if (token && user) {
      const userData = JSON.parse(user);
      switch (userData.role) {
        case "admin":
          router.push("/admin/dashboard");
          break;
        case "organization":
          router.push("/organization/dashboard");
          break;
        case "voter":
          router.push("/voter/dashboard");
          break;
      }
    }
  }, [router]);

  return (
    <div
      className={`min-h-screen transition-colors duration-500 ${
        darkMode
          ? "bg-gradient-to-br from-black via-neutral-900 to-emerald-950 text-white"
          : "bg-gray-100 text-gray-800"
      }`}
    >
      {/* === THEME TOGGLE === */}
      <motion.button
        whileTap={{ rotate: 180, scale: 0.9 }}
        onClick={() => setDarkMode(!darkMode)}
        className={`fixed top-3 right-5 p-3 rounded-full shadow-md border backdrop-blur-md z-30 ${
          darkMode
            ? "bg-neutral-900/80 border-emerald-700 text-emerald-300"
            : "bg-white/80 border-gray-300 text-emerald-700"
        }`}
      >
        {darkMode ? <Sun size={18} /> : <Moon size={18} />}
      </motion.button>

      {/* === HEADER === */}
      {/* === HEADER === */}
      <header
        className={`sticky top-0 z-20 backdrop-blur-md transition-all border-b ${
          darkMode
            ? "bg-neutral-950/30 border-emerald-800/40"
            : "bg-white/70 border-gray-300/40"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-emerald-600 rounded-lg flex items-center justify-center shadow-md">
              <svg
                className="h-4 w-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path d="M9 12l2 2 4-4" />
              </svg>
            </div>

            <h1 className="text-lg font-extrabold tracking-wide text-emerald-400">
              BlockVote
            </h1>
          </div>

          {/* Desktop buttons only */}
          <div className="hidden sm:flex items-center gap-4">
            <button
              onClick={() => router.push("/auth/login")}
              className="text-emerald-300 hover:text-emerald-400 font-medium"
            >
              Sign In
            </button>

            <button
              onClick={() => router.push("/auth/register")}
              className="bg-emerald-500 hover:bg-emerald-600 text-black px-4 py-2 rounded-md font-semibold shadow-md"
            >
              Get Started
            </button>
          </div>
        </div>

        {/* === MOBILE BUTTONS (cleaned, smaller, outside main header row) === */}
        <div className="sm:hidden w-full px-4 pb-3 flex gap-2">
          <button
            onClick={() => router.push("/auth/login")}
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-black 
            px-3 py-2 rounded-md text-sm font-semibold shadow-md"
          >
            Sign In
          </button>

          <button
            onClick={() => router.push("/auth/register")}
            className={`flex-1 px-3 py-2 rounded-md text-sm font-semibold border ${
              darkMode
                ? "border-emerald-500 text-emerald-300 hover:bg-emerald-700/20"
                : "border-emerald-600 text-emerald-700 hover:bg-emerald-100"
            }`}
          >
            Get Started
          </button>
        </div>
      </header>


      {/* === HERO SECTION === */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-14 text-center">
        <motion.h1
          initial={{ opacity: 0, y: -25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-4xl sm:text-6xl font-extrabold leading-tight"
        >
          Secure{" "}
          <span className="text-emerald-400 drop-shadow-[0_0_5px_rgba(16,185,129,0.6)]">
            Blockchain
          </span>{" "}
          Voting
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className={`mt-5 max-w-2xl mx-auto text-base sm:text-lg ${
            darkMode ? "text-gray-300" : "text-gray-700"
          }`}
        >
          A tamper-proof, transparent election system powered by cryptographic
          proof and decentralized blockchain consensus.
        </motion.p>

        {/* === Buttons (Mobile stacked!) === */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center"
        >
          <button
            onClick={() => router.push("/auth/login")}
            className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 text-black px-8 py-3 sm:py-4 rounded-xl text-lg font-semibold shadow-md"
          >
            Access Platform
          </button>

          <button
            onClick={() => router.push("/auth/register")}
            className={`w-full sm:w-auto px-8 py-3 sm:py-4 rounded-xl text-lg font-semibold border ${
              darkMode
                ? "border-emerald-500 text-emerald-300 hover:bg-emerald-700/20"
                : "border-emerald-600 text-emerald-700 hover:bg-emerald-100"
            }`}
          >
            Register Organization
          </button>
        </motion.div>

        {/* === Demo Credentials === */}
        {/* 
        <div
          className={`mt-14 p-6 rounded-xl border shadow-lg max-w-2xl mx-auto ${
            darkMode
              ? "bg-neutral-900 border-emerald-900/50"
              : "bg-yellow-50 border-yellow-200"
          }`}
        >
          <h3
            className={`text-lg font-semibold mb-4 ${
              darkMode ? "text-emerald-300" : "text-yellow-800"
            }`}
          >
            Demo Access
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div
              className={`rounded p-3 ${
                darkMode ? "bg-neutral-800" : "bg-white"
              }`}
            >
              <div className="font-medium text-red-400">System Admin</div>
              <div>admin@blockvote.com</div>
              <div>admin123!</div>
            </div>

            <div
              className={`rounded p-3 ${
                darkMode ? "bg-neutral-800" : "bg-white"
              }`}
            >
              <div className="font-medium text-blue-400">Organization</div>
              <div>org@blockvote.com</div>
              <div>org123!</div>
            </div>

            <div
              className={`rounded p-3 ${
                darkMode ? "bg-neutral-800" : "bg-white"
              }`}
            >
              <div className="font-medium text-green-400">Voter</div>
              <div>voter1@blockvote.com</div>
              <div>voter123!</div>
            </div>
          </div>
        </div>
        */}
        {/* === FEATURES GRID (Smooth responsive) === */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mt-20">
          {[
            {
              title: "Cryptographic Security",
              desc: "Ed25519 signatures and double SHA-256 hashing ensure integrity.",
            },
            {
              title: "Transparent Verification",
              desc: "Merkle tree validation and immutable chain history.",
            },
            {
              title: "Real-time Results",
              desc: "Instant blockchain-confirmed vote counting.",
            },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15 }}
              className={`p-6 rounded-xl shadow-xl border ${
                darkMode
                  ? "bg-neutral-900 border-emerald-900/50"
                  : "bg-white border-gray-300"
              }`}
            >
              <h3 className="text-xl font-bold text-emerald-400">
                {item.title}
              </h3>
              <p
                className={`mt-2 text-sm ${
                  darkMode ? "text-gray-300" : "text-gray-600"
                }`}
              >
                {item.desc}
              </p>
            </motion.div>
          ))}
        </div>

        {/* === STATS === */}
        <div
          className={`mt-20 p-8 rounded-xl shadow-lg border ${
            darkMode
              ? "bg-neutral-900 border-emerald-900/50"
              : "bg-white border-gray-200"
          }`}
        >
          <h3 className="text-2xl font-bold mb-6 text-center text-emerald-400">
            Platform Status
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
            {[
              ["100%", "Test Coverage"],
              ["309", "Tests Passing"],
              ["Phase 4", "Complete"],
              ["Ready", "Production"],
            ].map(([num, label], i) => (
              <div key={i}>
                <div className="text-3xl font-bold text-emerald-400">{num}</div>
                <div className="text-sm opacity-80">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* === FOOTER === */}
      <footer
        className={`mt-12 border-t py-10 ${
          darkMode
            ? "bg-neutral-900/60 border-emerald-800/30"
            : "bg-white border-gray-200"
        }`}
      >
        <div className="text-center max-w-7xl mx-auto px-6 text-sm">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="h-5 w-5 bg-emerald-600 rounded flex items-center justify-center">
              <svg
                className="h-3 w-3 text-white"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path d="M9 12l2 2 4-4" />
              </svg>
            </div>

            <span className="font-semibold text-emerald-400">BlockVote</span>
          </div>

          <p className="opacity-70">
            Secure blockchain-based voting platform with cryptographic integrity.
          </p>

          <div className="flex justify-center gap-3 mt-2 opacity-60">
            <span>© 2025 BlockVote</span>
            <span>•</span>
            <span>Phase 5</span>
            <span>•</span>
            <span>Version 0.2</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
