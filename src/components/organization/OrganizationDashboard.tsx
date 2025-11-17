"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation"; // PERBAIKAN: Kembali ke 'next/navigation' sesuai file asli
import { motion } from "framer-motion";
import { Sun, Moon } from "lucide-react";

// ---------- Types ----------
interface User {
  id: number;
  username: string;
  email: string;
  role: "admin" | "organization" | "voter";
  status: "active" | "inactive" | "suspended";
  createdAt: string;
}

interface ElectionSummary {
  id: number;
  title: string;
  description: string;
  status: "DRAFT" | "ACTIVE" | "ENDED";
  startDate: string;
  endDate: string;
  candidateCount: number;
  voterCount: number;
  voteCount: number;
  participationRate: number;
}

interface DetailedStatistic {
  electionId: number;
  electionTitle: string;
  electionStatus: string;
  totalRegisteredVoters: number;
  totalVotesCast: number;
  participationRate: number;
  startDate: string;
  endDate: string;
}

interface OrganizationStats {
  totalElections: number;
  activeElections: number;
  draftElections: number;
  endedElections: number;
  totalVotes: number;
  totalVoters: number;
  averageParticipation: number;
  recentVotes: number;
  recentElections: ElectionSummary[];
  performance: {
    mostActiveElection: { id: number; title: string; voteCount: number } | null;
    averageVotesPerElection: number;
    totalEngagement: number;
  };
  detailedStatistics: DetailedStatistic[];
}

// "Create" telah dihapus dari tipe Tab
type Tab = "Overview" | "Elections" | "Voters" | "Results";

// ---------- Component ----------
export default function OrganizationDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [darkMode, setDarkMode] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<OrganizationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [voters, setVoters] = useState<User[]>([]);
  const [votersLoading, setVotersLoading] = useState(false);
  const [votersError, setVotersError] = useState<string | null>(null);

  // Fungsi fetch voters
  const loadVoters = async (token: string) => {
    setVotersLoading(true);
    setVotersError(null);
    try {
      const res = await fetch("/api/organization/voters", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setVoters(data.data);
      else setVotersError(data.message || "Failed to load voters");
    } catch (err) {
      console.error(err);
      setVotersError("Failed to load voters");
    } finally {
      setVotersLoading(false);
    }
  };

  // ---------- Auth check ----------
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const token = localStorage.getItem("accessToken");
    if (!storedUser || !token) {
      router.push("/auth/login");
      return;
    }
    const userData = JSON.parse(storedUser);
    if (userData.role !== "organization") {
      router.push("/auth/login");
      return;
    }
    setUser(userData);
    loadStats(token);
  }, [router]);
  // ---------- Fetch voters setiap kali tab "Voters" aktif ----------
  useEffect(() => {
    if (activeTab === "Voters") {
      const token = localStorage.getItem("accessToken");
      if (token) loadVoters(token);
    }
  }, [activeTab]);

  // ---------- Load stats ----------
  const loadStats = async (token: string) => {
    setLoading(true);
    setError(null);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await fetch("/api/organization/stats", { headers });
      const data = await res.json();
      if (data.success) setStats(data.data);
      else setError(data.message || "Failed to load stats");
    } catch (err) {
      console.error(err);
      setError("Failed to load stats");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    router.push("/auth/login");
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div
      className={
        darkMode
          ? "min-h-screen flex flex-col bg-gradient-to-br from-black via-neutral-900 to-emerald-950 text-white"
          : "min-h-screen flex flex-col bg-gradient-to-br from-gray-100 via-gray-50 to-white text-gray-900"
      }
    >
      {/* Theme toggle */}
      <div className="fixed top-4 right-4 z-50">
        <motion.button
          whileTap={{ rotate: 180, scale: 0.95 }}
          onClick={() => setDarkMode((s) => !s)}
          className={`p-2 rounded-full border shadow-sm backdrop-blur-md ${
            darkMode
              ? "bg-neutral-900/80 border-emerald-700 text-emerald-300"
              : "bg-white/90 border-gray-300 text-emerald-700"
          }`}
        >
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
        </motion.button>
      </div>

      {/* Header */}
      <header
        className={
          darkMode
            ? "bg-neutral-950/30 border-b border-emerald-800/30 sticky top-0 z-40"
            : "bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm"
        }
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center py-4">
          <div>
            <h1 className="text-xl font-bold text-emerald-600">
              Organization Dashboard
            </h1>
            <p className={darkMode ? "text-gray-300" : "text-gray-700"}>
              BlockVote Election Management
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => router.push("/settings")}
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                darkMode
                  ? "bg-emerald-700/10 border border-emerald-700 text-emerald-300"
                  : "bg-emerald-100 border border-emerald-600 text-emerald-700"
              }`}
            >
              Settings
            </button>
            <button
              onClick={handleLogout}
              className="px-3 py-2 rounded-md text-sm font-medium bg-red-600 hover:bg-red-700 text-white"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav
        className={
          darkMode
            ? "bg-neutral-900/40 border-b border-emerald-800/30"
            : "bg-white shadow-sm border-b border-gray-200"
        }
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-6">
            {/* "Create" telah dihapus dari array .map() */}
            {["Overview", "Elections", "Voters", "Results"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as Tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab
                    ? "border-emerald-600 text-emerald-600"
                    : darkMode
                    ? "border-transparent text-gray-300 hover:text-white hover:border-emerald-300"
                    : "border-transparent text-gray-700 hover:text-gray-900 hover:border-emerald-400"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-grow max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-8">
        {error && <p className="text-red-500">{error}</p>}

        {/* Overview */}
        {activeTab === "Overview" && stats && (
          <div className="space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: "Total Elections", value: stats.totalElections },
                { label: "Active Elections", value: stats.activeElections },
                { label: "Total Voters", value: stats.totalVoters },
                {
                  label: "Participation Rate",
                  value: `${stats.averageParticipation.toFixed(1)}%`,
                },
              ].map((card, i) => (
                <motion.div
                  key={i}
                  whileHover={{
                    scale: 1.03,
                    boxShadow: darkMode
                      ? "0 0 15px rgba(72, 187, 120, 0.5)"
                      : "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                  className={`p-5 rounded-lg border shadow-lg transition-all duration-300 ${
                    darkMode
                      ? "bg-gradient-to-r from-emerald-700/60 via-emerald-800/60 to-emerald-900/60 border-emerald-800 text-white"
                      : "bg-white border-gray-200 text-gray-900"
                  }`}
                >
                  <p className={darkMode ? "text-gray-200" : "text-gray-700"}>
                    {card.label}
                  </p>
                  <p className="text-2xl font-bold mt-2">{card.value}</p>
                </motion.div>
              ))}
            </div>

            {/* Active Elections */}
            <div>
              <h2 className="text-xl font-semibold text-emerald-300 mb-4">
                Active Elections
              </h2>
              {/* PERBAIKAN: Gunakan recentElections karena detailedStatistics mungkin kosong */}
              {stats.recentElections.filter(
                (e) => e.status === "ACTIVE"
              ).length === 0 ? (
                <p className="text-gray-400">No active elections.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {stats.recentElections
                    .filter((e) => e.status === "ACTIVE")
                    .map((e) => (
                      <motion.div
                        key={e.id}
                        whileHover={{
                          scale: 1.02,
                          boxShadow: darkMode
                            ? "0 0 10px rgba(72, 187, 120, 0.4)"
                            : "0 4px 10px rgba(0,0,0,0.08)",
                        }}
                        className={`p-4 rounded-lg border shadow transition-all duration-300 ${
                          darkMode
                            ? "bg-neutral-900/70 border-emerald-800 text-white"
                            : "bg-white border-gray-200 text-gray-900"
                        }`}
                      >
                        <h3 className="text-lg font-semibold text-emerald-600">
                          {e.title}
                        </h3>
                        <p
                          className={
                            darkMode ? "text-gray-300" : "text-gray-700"
                          }
                        >
                          Registered Voters: {e.voterCount}
                        </p>
                        <p
                          className={
                            darkMode ? "text-gray-300" : "text-gray-700"
                          }
                        >
                          Votes Cast: {e.voteCount}
                        </p>
                        <p
                          className={
                            darkMode ? "text-gray-300" : "text-gray-700"
                          }
                        >
                          Participation: {e.participationRate}%
                        </p>
                        <p
                          className={`${
                            darkMode ? "text-gray-400" : "text-gray-500"
                          } text-xs mt-1`}
                        >
                          {formatDate(e.startDate)} - {formatDate(e.endDate)}
                        </p>
                      </motion.div>
                    ))}
                </div>
              )}
            </div>

            {/* Draft Elections (BARU) */}
            <div>
              <h2 className="text-xl font-semibold text-emerald-300 mb-4">
                Draft Elections
              </h2>
              {/* PERBAIKAN: Gunakan recentElections karena detailedStatistics mungkin kosong */}
              {stats.recentElections.filter(
                (e) => e.status === "DRAFT"
              ).length === 0 ? (
                <p className="text-gray-400">No draft elections.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {stats.recentElections
                    .filter((e) => e.status === "DRAFT")
                    .map((e) => (
                      <motion.div
                        key={e.id}
                        whileHover={{
                          scale: 1.02,
                          boxShadow: darkMode
                            ? "0 0 10px rgba(72, 187, 120, 0.4)"
                            : "0 4px 10px rgba(0,0,0,0.08)",
                        }}
                        className={`p-4 rounded-lg border shadow transition-all duration-300 ${
                          darkMode
                            ? "bg-neutral-900/70 border-emerald-800 text-white"
                            : "bg-white border-gray-200 text-gray-900"
                        }`}
                      >
                        <h3 className="text-lg font-semibold text-emerald-600">
                          {e.title}
                        </h3>
                        <p
                          className={
                            darkMode ? "text-gray-300" : "text-gray-700"
                          }
                        >
                          Status: {e.status}
                        </p>
                        <p
                          className={
                            darkMode ? "text-gray-300" : "text-gray-700"
                          }
                        >
                          Registered Voters: {e.voterCount}
                        </p>
                        <p
                          className={
                            darkMode ? "text-gray-300" : "text-gray-700"
                          }
                        >
                          Votes Cast: {e.voteCount}
                        </p>
                        <p
                          className={`${
                            darkMode ? "text-gray-400" : "text-gray-500"
                          } text-xs mt-1`}
                        >
                          {formatDate(e.startDate)} - {formatDate(e.endDate)}
                        </p>
                      </motion.div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Elections Tab */}
        {activeTab === "Elections" && stats && (
          <div className="space-y-6">
            {/* --- Tombol Create Baru Ditambahkan Di Sini --- */}
            <div className="flex justify-between items-center mb-4">
              <h2
                className={`text-xl font-semibold ${
                  darkMode ? "text-emerald-300" : "text-gray-800"
                }`}
              >
                All Elections
              </h2>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => router.push("/elections/create")} // PERBAIKAN: Arahkan ke route, bukan komponen
                className={`px-4 py-2 rounded-lg text-sm font-medium shadow-md transition-colors ${
                  darkMode
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white"
                }`}
              >
                + Create New Election
              </motion.button>
            </div>
            {/* --- Akhir Tombol Create Baru --- */}

            {/* PERBAIKAN: Gunakan recentElections karena detailedStatistics mungkin kosong */}
            {stats.recentElections.length === 0 ? (
              <p className={darkMode ? "text-gray-300" : "text-gray-700"}>
                No elections available. Click &quot;Create New Election&quot; to get
                started.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* PERBAIKAN: Gunakan recentElections */}
                {stats.recentElections.map((e) => (
                  <motion.div
                    key={e.id}
                    whileHover={{
                      scale: 1.02,
                      boxShadow: darkMode
                        ? "0 0 10px rgba(72, 187, 120, 0.4)"
                        : "0 4px 10px rgba(0,0,0,0.08)",
                    }}
                    className={`p-4 rounded-lg border shadow transition-all duration-300 ${
                      darkMode
                        ? "bg-neutral-900/70 border-emerald-800 text-white"
                        : "bg-white border-gray-200 text-gray-900"
                    }`}
                  >
                    <h3 className="text-lg font-semibold text-emerald-600">
                      {e.title}
                    </h3>
                    <p
                      className={darkMode ? "text-gray-300" : "text-gray-700"}
                    >
                      Status: {e.status}
                    </p>
                    <p
                      className={darkMode ? "text-gray-300" : "text-gray-700"}
                    >
                      Registered Voters: {e.voterCount}
                    </p>
                    <p
                      className={darkMode ? "text-gray-300" : "text-gray-700"}
                    >
                      Votes Cast: {e.voteCount}
                    </p>
                    <p
                      className={darkMode ? "text-gray-300" : "text-gray-700"}
                    >
                      Participation: {e.participationRate}%
                    </p>
                    <p
                      className={`${
                        darkMode ? "text-gray-400" : "text-gray-500"
                      } text-xs mt-1`}
                    >
                      {formatDate(e.startDate)} - {formatDate(e.endDate)}
                    </p>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Di bagian render, tambahkan tab Voters */}
        {activeTab === "Voters" && (
          <div className="overflow-x-auto">
            {votersLoading ? (
              <p className="text-gray-400">Loading voters...</p>
            ) : votersError ? (
              <p className="text-red-500">{votersError}</p>
            ) : voters.length === 0 ? (
              <p className="text-gray-400">No voters found.</p>
            ) : (
              <table className="min-w-full border border-gray-300 dark:border-emerald-700 text-left">
                <thead className="bg-gray-100 dark:bg-neutral-800">
                  <tr>
                    <th className="px-4 py-2 border-b">ID</th>
                    <th className="px-4 py-2 border-b">Username</th>
                    <th className="px-4 py-2 border-b">Email</th>
                    <th className="px-4 py-2 border-b">Role</th>
                    <th className="px-4 py-2 border-b">Status</th>
                    <th className="px-4 py-2 border-b">Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {voters.map((v) => (
                    <tr
                      key={v.id}
                      className="hover:bg-gray-50 dark:hover:bg-neutral-700"
                    >
                      <td className="px-4 py-2 border-b">{v.id}</td>
                      <td className="px-4 py-2 border-b">{v.username}</td>
                      <td className="px-4 py-2 border-b">{v.email}</td>
                      <td className="px-4 py-2 border-b capitalize">
                        {v.role}
                      </td>
                      <td className="px-4 py-2 border-b capitalize">
                        {v.status}
                      </td>
                      <td className="px-4 py-2 border-b">
                        {formatDate(v.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Other tabs - Sekarang hanya akan menangani "Results" */}
        {activeTab !== "Overview" &&
          activeTab !== "Elections" &&
          activeTab !== "Voters" && (
            <div
              className={`mt-6 p-6 rounded-lg shadow ${
                darkMode
                  ? "bg-neutral-900/70 border border-emerald-800 text-white"
                  : "bg-white border-gray-200 text-gray-900"
              }`}
            >
              <h2 className="text-xl font-semibold text-emerald-600 capitalize">
                {activeTab} Management
              </h2>
              <p
                className={`${
                  darkMode ? "text-gray-300" : "text-gray-700"
                } text-xs mt-2`}
              >
                This section is under development.
              </p>
            </div>
          )}
      </main>
    </div>
  );
}