"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Sun, Moon } from "lucide-react";
import ProfileSettingsModal from "@/components/voter/ProfileSettingsModal";


interface User {
  id: number;
  studentId?: string;
  username: string;
  email: string;
  fullName?: string;
  role: "admin" | "organization" | "voter";
  status: "active" | "inactive";
  emailVerified: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
}

interface Election {
  id: number;
  title: string;
  description: string;
  status: "draft" | "active" | "ended";
  startDate: string;
  endDate: string;
  organization: {
    id: number;
    username: string;
    email: string;
  };
  _count: {
    votes: number;
    voters: number;
  };
}

interface UserElectionParticipation {
  id: number;
  userId: number;
  electionId: number;
  inviteStatus: "pending" | "accepted" | "declined";
  hasVoted: boolean;
  invitedAt: string;
  respondedAt?: string;
  votedAt?: string;
  election?: Election;
}

interface VotingHistoryEntry {
  id: number;
  electionId: number;
  voterId: number;
  blockHash: string;
  transactionHash: string;
  votedAt: string;
  election: {
    id: number;
    title: string;
    description: string;
    status: string;
    startDate: string;
    endDate: string;
    organization: {
      username: string;
    };
  };
}

interface Props {
  open: boolean;
  onClose: () => void;
  darkMode: boolean;
  user: {
    id: number;
    username: string | null;
    email: string;
    fullName: string | null;
    profileImage: string | null;
  } | null;
}


interface VoterDashboardData {
  participations: UserElectionParticipation[];
  activeElections: Election[];
  votingHistory: UserElectionParticipation[];
  pendingInvitations: UserElectionParticipation[];
  statistics: {
    totalInvitations: number;
    totalVoted: number;
    participationRate: number;
    pendingInvitations: number;
  };
}

export default function VoterDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [dashboardData, setDashboardData] = useState<VoterDashboardData>({
    participations: [],
    activeElections: [],
    votingHistory: [],
    pendingInvitations: [],
    statistics: {
      totalInvitations: 0,
      totalVoted: 0,
      participationRate: 0,
      pendingInvitations: 0,
    },
  });
  const [activeTab, setActiveTab] = useState<
    "overview" | "active" | "history" | "invitations"
  >("overview");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Theme: DARK by default (emerald style). Toggle to LIGHT (Original UI).
  const [darkMode, setDarkMode] = useState(true);

  // State for Voting History. 
  const [voteHistory, setVoteHistory] = useState<VotingHistoryEntry[]>([]);
  const loadVoteHistory = async () => {
    try {
      const token = localStorage.getItem("accessToken");

      const res = await fetch("/api/voter/history", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const json = await res.json();
        setVoteHistory(json.data);
      }
    } catch (e) {
      console.error("Failed loading history:", e);
    }
  };
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [userData, setUserData] = useState<{
    id: number;
    username: string;
    email: string;
    fullName: string | null;
    profileImage: string | null;
  } | null>(null);
const loadUserProfile = async () => {
  try {
    const token = localStorage.getItem("accessToken");

    const res = await fetch("/api/user/profile", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      const json = await res.json();
      setUserData(json.user);
    }
  } catch (e) {
    console.error("Failed loading profile:", e);
  }
};


  // --- Auth check & initial load ---
  useEffect(() => {
    const checkAuth = () => {
      const storedUser = localStorage.getItem("user");
      const token = localStorage.getItem("accessToken");

      if (!storedUser || !token) {
        router.push("/auth/login");
        return;
      }

      try {
        const userData = JSON.parse(storedUser) as User;
        if (userData.role !== "voter") {
          router.push("/auth/login");
          return;
        }
        setUser(userData);
      } catch {
        router.push("/auth/login");
      }
    };

    checkAuth();
    loadDashboardData();
    loadVoteHistory();
    loadUserProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // --- API calls (kept as original endpoints) ---
  const loadDashboardData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem("accessToken");
      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      const response = await fetch("/api/voter/dashboard", { headers });
      if (response.ok) {
        const data = await response.json();
        // Expecting { data: VoterDashboardData } or similar
        const payload = data.data ?? data;
        setDashboardData(payload);
      } else {
        setError("Failed to load dashboard data");
      }
    } catch (err) {
      console.error("Dashboard loading error:", err);
      setError("Failed to load dashboard data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvitationResponse = async (
    participationId: number,
    action: "accept" | "decline"
  ) => {
    try {
      const token = localStorage.getItem("accessToken");
      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      const response = await fetch("/api/voter/invitations", {
        method: "POST",
        headers,
        body: JSON.stringify({
          participationId,
          action,
        }),
      });

      if (response.ok) {
        // refresh data
        await loadDashboardData();
      } else {
        alert("Failed to respond to invitation");
      }
    } catch (err) {
      console.error("Error responding to invitation:", err);
      alert("Failed to respond to invitation");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    router.push("/auth/login");
  };

  const getElectionStatusBadge = (status: string) => {
    const statusStyles: Record<string, string> = {
      active: "bg-emerald-100 text-emerald-800",
      draft: "bg-yellow-100 text-yellow-800",
      ended: "bg-gray-100 text-gray-800",
    };
    return statusStyles[status] ?? statusStyles.draft;
  };

  const isElectionActive = (election: Election) => {
    const now = new Date();
    const start = new Date(election.startDate);
    const end = new Date(election.endDate);
    return election.status === "active" && now >= start && now <= end;
  };

  const formatTimeRemaining = (endDate: string) => {
    const now = new Date();
    const end = new Date(endDate);
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) return "Ended";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days}d ${hours}h remaining`;
    return `${hours}h remaining`;
  };

  if (isLoading) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${
          darkMode ? "bg-gradient-to-br from-black via-neutral-900 to-emerald-950 text-white" : "bg-gray-50 text-gray-700"
        }`}
      >
        <div className="text-center">
          <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${darkMode ? "border-emerald-400" : "border-blue-600"} mx-auto`} />
          <p className="mt-4">{darkMode ? "Loading dashboard..." : "Loading dashboard..."}</p>
        </div>
      </div>
    );
  }

  return (
  <div
    className={
      darkMode
        ? "min-h-screen flex flex-col bg-gradient-to-br from-black via-neutral-900 to-emerald-950 text-white"
        : "min-h-screen flex flex-col bg-gray-50 text-gray-900"
    }
  >    {/* Theme toggle */}
      <div className="fixed top-4 right-4 z-50">
        <motion.button
          whileTap={{ rotate: 180, scale: 0.95 }}
          onClick={() => setDarkMode((s) => !s)}
          className={`p-2 rounded-full border shadow-sm backdrop-blur-md ${
            darkMode
              ? "bg-neutral-900/80 border-emerald-700 text-emerald-300"
              : "bg-white/90 border-gray-300 text-emerald-700"
          }`}
          aria-label="Toggle theme"
        >
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
        </motion.button>
      </div>

      {/* Header */}
      <header className={darkMode ? "bg-neutral-950/30 border-b border-emerald-800/30 sticky top-0 z-40" : "bg-white border-b border-gray-200 sticky top-0 z-40"}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className={darkMode ? "text-xl font-bold text-emerald-300" : "text-2xl font-bold text-gray-900"}>Voter Dashboard</h1>
              <p className={darkMode ? "text-sm text-gray-300" : "text-sm text-gray-600"}>
                Welcome back, {user?.fullName || user?.username} {user?.studentId && `(${user.studentId})`}
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <button
                 onClick={() => setSettingsOpen(true)}
                className={darkMode ? "px-3 py-2 rounded-md text-sm font-medium bg-emerald-700/10 border border-emerald-700 text-emerald-300" : "px-3 py-2 rounded-md text-sm font-medium bg-emerald-50 text-emerald-600 border border-emerald-100"}
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
        </div>
      </header>

      {/* Tabs */}
      <nav className={darkMode ? "bg-neutral-900/40 border-b border-emerald-800/30" : "bg-white shadow-sm"}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-6">
            {[
              { key: "overview", label: "Overview" },
              { key: "active", label: "Active Elections" },
              { key: "invitations", label: `Invitations (${dashboardData.statistics.pendingInvitations})` },
              { key: "history", label: "Voting History" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() =>
                  setActiveTab(
                    tab.key as "overview" | "active" | "history" | "invitations"
                  )
                }
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.key
                    ? darkMode
                      ? "border-emerald-400 text-emerald-300"
                      : "border-emerald-600 text-emerald-700"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main */}
      <main className="flex-grow max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-8">
        {error && (
          <div className="mb-6 rounded-md bg-red-50 p-4">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        {/* Overview */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              <div className={darkMode ? "p-5 rounded-lg bg-neutral-900 border border-emerald-800 shadow" : "p-5 rounded-lg bg-white border border-gray-200 shadow-sm"}>
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                        <svg
                          className="w-5 h-5 text-white"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                  <div className="ml-4">
                    <dt className={darkMode ? "text-sm text-gray-400" : "text-sm text-gray-500"}>Total Invitations</dt>
                    <dd className={darkMode ? "text-lg font-semibold text-white" : "text-lg font-semibold text-gray-900"}>{dashboardData.statistics.totalInvitations}</dd>
                  </div>
                </div>
              </div>

              <div className={darkMode ? "p-5 rounded-lg bg-neutral-900 border border-emerald-800 shadow" : "p-5 rounded-lg bg-white border border-gray-200 shadow-sm"}>
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                        <svg
                          className="w-5 h-5 text-white"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                    </div>
                  <div className="ml-4">
                    <dt className={darkMode ? "text-sm text-gray-400" : "text-sm text-gray-500"}>Votes Cast</dt>
                    <dd className={darkMode ? "text-lg font-semibold text-white" : "text-lg font-semibold text-gray-900"}>{dashboardData.statistics.totalVoted}</dd>
                  </div>
                </div>
              </div>

              <div className={darkMode ? "p-5 rounded-lg bg-neutral-900 border border-emerald-800 shadow" : "p-5 rounded-lg bg-white border border-gray-200 shadow-sm"}>
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                        <svg
                          className="w-5 h-5 text-white"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                            clipRule="evenodd"
                          />
                        </svg>
                    </div>
                  <div className="ml-4">
                    <dt className={darkMode ? "text-sm text-gray-400" : "text-sm text-gray-500"}>Pending Invitations</dt>
                    <dd className={darkMode ? "text-lg font-semibold text-white" : "text-lg font-semibold text-gray-900"}>{dashboardData.statistics.pendingInvitations}</dd>
                  </div>
                </div>
              </div>

              <div className={darkMode ? "p-5 rounded-lg bg-neutral-900 border border-emerald-800 shadow" : "p-5 rounded-lg bg-white border border-gray-200 shadow-sm"}>
                <div className="flex items-center">
                 <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                        <svg
                          className="w-5 h-5 text-white"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                  <div className="ml-4">
                    <dt className={darkMode ? "text-sm text-gray-400" : "text-sm text-gray-500"}>Participation Rate</dt>
                    <dd className={darkMode ? "text-lg font-semibold text-white" : "text-lg font-semibold text-gray-900"}>{dashboardData.statistics.participationRate.toFixed(1)}%</dd>
                  </div>
                </div>
              </div>
            </div>

            {/* Active Elections preview */}
            <div className={darkMode ? "bg-neutral-900 border border-emerald-800 rounded-lg shadow-lg" : "bg-white border border-gray-200 rounded-lg shadow-sm"}>
              <div className="p-4 sm:p-6">
                <h3 className={darkMode ? "text-lg font-medium text-emerald-300 mb-4" : "text-lg font-medium text-gray-900 mb-4"}>Active Elections</h3>

                {dashboardData.activeElections.length === 0 ? (
                  <p className={darkMode ? "text-gray-400 text-center py-8" : "text-gray-500 text-center py-8"}>No active elections at the moment</p>
                ) : (
                  <div className="space-y-4">
                    {dashboardData.activeElections.slice(0, 3).map((election) => (
                      <div key={election.id} className={darkMode ? "border border-emerald-800 rounded-lg p-4" : "border border-gray-200 rounded-lg p-4"}>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className={darkMode ? "font-medium text-emerald-200" : "font-medium text-gray-900"}>{election.title}</h4>
                            <p className={darkMode ? "text-gray-400 mt-1" : "text-gray-600 mt-1"}>{election.description}</p>
                            <div className="flex items-center mt-2 text-xs text-gray-500">
                              <span>By {election.organization.username}</span>
                              <span className="mx-2">•</span>
                              <span>{election._count.votes} votes</span>
                            </div>
                          </div>

                          <div className="ml-4 flex flex-col items-end">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${isElectionActive(election) ? (darkMode ? "bg-emerald-600/20 text-emerald-200 border border-emerald-600" : "bg-emerald-50 text-emerald-700 border border-emerald-100") : (darkMode ? "bg-red-600/20 text-red-300 border border-red-600" : "bg-red-50 text-red-700 border border-red-100")}`}>
                              {isElectionActive(election) ? "Active" : election.status}
                            </span>
                            {isElectionActive(election) && (
                              <span className={darkMode ? "text-xs text-gray-400 mt-1" : "text-xs text-gray-500 mt-1"}>{formatTimeRemaining(election.endDate)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Active Elections Tab */}
        {activeTab === "active" && (
          <div className={darkMode ? "bg-neutral-900 border border-emerald-800 rounded-lg shadow-lg" : "bg-white border border-gray-200 rounded-lg shadow-sm"}>
            <div className="p-4 sm:p-6">
              <h3 className={darkMode ? "text-lg font-medium text-emerald-300 mb-4" : "text-lg font-medium text-gray-900 mb-4"}>All Active Elections</h3>
              <p className={darkMode ? "text-gray-400 mb-6" : "text-gray-600 mb-6"}>Elections currently accepting votes. You can see all ongoing elections for transparency.</p>

              {dashboardData.activeElections.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" /></svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No active elections</h3>
                  <p className="mt-1 text-sm text-gray-500">There are currently no active elections.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {dashboardData.activeElections.map((election) => (
                    <div key={election.id} className={darkMode ? "border border-emerald-800 rounded-lg p-6" : "border border-gray-200 rounded-lg p-6"}>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center">
                            <h4 className={darkMode ? "text-lg font-medium text-emerald-200" : "text-lg font-medium text-gray-900"}>{election.title}</h4>
                            <span className={`ml-3 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${isElectionActive(election) ? (darkMode ? "bg-emerald-600/20 text-emerald-200 border border-emerald-600" : "bg-emerald-50 text-emerald-700 border border-emerald-100") : (darkMode ? "bg-red-600/20 text-red-300 border border-red-600" : "bg-red-50 text-red-700 border border-red-100")}`}>
                              {isElectionActive(election) ? "Active Now" : election.status}
                            </span>
                          </div>
                          <p className={darkMode ? "text-gray-400 mt-2" : "text-gray-600 mt-2"}>{election.description}</p>

                          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                            <div><span className="font-medium text-gray-500">Organization:</span><span className={darkMode ? "text-gray-400 mt-2" : "text-gray-600 mt-2"}>{election.organization.username}</span></div>
                            <div><span className="font-medium text-gray-500">Total Votes:</span><span className={darkMode ? "text-gray-400 mt-2" : "text-gray-600 mt-2"}>{election._count.votes}</span></div>
                            <div><span className="font-medium text-gray-500">Start Date:</span><span className={darkMode ? "text-gray-400 mt-2" : "text-gray-600 mt-2"}>{new Date(election.startDate).toLocaleString()}</span></div>
                            <div><span className="font-medium text-gray-500">End Date:</span><span className={darkMode ? "text-gray-400 mt-2" : "text-gray-600 mt-2"}>{new Date(election.endDate).toLocaleString()}</span></div>
                          </div>
                        </div>

                        <div className="ml-6">
                          {isElectionActive(election) && (
                            <div className="text-right">
                              <div className="text-sm font-medium text-green-400">{formatTimeRemaining(election.endDate)}</div>
                              <div className="text-xs text-gray-400 mt-1">Time remaining</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Invitations Tab */}
        {activeTab === "invitations" && (
          <div className={darkMode ? "bg-neutral-900 border border-emerald-800 rounded-lg shadow-lg" : "bg-white shadow rounded-lg"}>
            <div className="px-4 py-5 sm:p-6">
              <h3 className={darkMode ? "text-lg leading-6 font-medium text-emerald-300 mb-4" : "text-lg leading-6 font-medium text-gray-900 mb-4"}>Election Invitations</h3>
              <p className={darkMode ? "text-sm text-gray-400 mb-6" : "text-sm text-gray-600 mb-6"}>Respond to election invitations from organizations.</p>

              {dashboardData.pendingInvitations.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m13-8V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v1M7 8h10l-1 8H8l-1-8z" />
                  </svg>
                  <h3 className={darkMode ? "mt-2 text-sm font-medium text-gray-200" : "mt-2 text-sm font-medium text-gray-900"}>No pending invitations</h3>
                  <p className={darkMode ? "mt-1 text-sm text-gray-400" : "mt-1 text-sm text-gray-500"}>You have no pending election invitations.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {dashboardData.pendingInvitations.map((invitation) => (
                    <div key={invitation.id} className={darkMode ? "border border-emerald-800 bg-neutral-900/60 rounded-lg p-6" : "border border-emerald-200 bg-emerald-50 rounded-lg p-6"}>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className={darkMode ? "text-lg font-medium text-emerald-200" : "text-lg font-medium text-gray-900"}>{invitation.election?.title}</h4>
                          <p className={darkMode ? "text-gray-400 mt-2" : "text-gray-600 mt-2"}>{invitation.election?.description}</p>

                          <div className="mt-4 text-sm">
                            <div className="flex items-center">
                              <span className={darkMode ? "font-medium text-gray-300" : "font-medium text-gray-500"}>Organization:</span>
                              <span className={darkMode ? "ml-2 text-emerald-200" : "ml-2 text-gray-900"}>{invitation.election?.organization.username}</span>
                            </div>

                            <div className="flex items-center mt-1">
                              <span className={darkMode ? "font-medium text-gray-300" : "font-medium text-gray-500"}>Invited on:</span>
                              <span className={darkMode ? "ml-2 text-emerald-200" : "ml-2 text-gray-900"}>{new Date(invitation.invitedAt).toLocaleDateString()}</span>
                            </div>

                            {invitation.election && (
                              <div className="flex items-center mt-1">
                                <span className={darkMode ? "font-medium text-gray-300" : "font-medium text-gray-500"}>Election period:</span>
                                <span className={darkMode ? "ml-2 text-emerald-200" : "ml-2 text-gray-900"}>
                                  {new Date(invitation.election.startDate).toLocaleDateString()} - {new Date(invitation.election.endDate).toLocaleDateString()}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="ml-6 flex space-x-2">
                          <button
                            onClick={() => handleInvitationResponse(invitation.id, "accept")}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleInvitationResponse(invitation.id, "decline")}
                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Voting History */}
        {activeTab === "history" && (
  <div
    className={
      darkMode
        ? "bg-neutral-900 border border-emerald-800 rounded-lg shadow-lg mt-4"
        : "bg-white border border-gray-200 rounded-lg shadow-sm mt-4"
    }
  >
    <div className="p-4 sm:p-6">
      {/* HEADER */}
      <h3
        className={
          darkMode
            ? "text-lg font-medium text-emerald-300 mb-4"
            : "text-lg font-medium text-gray-900 mb-4"
        }
      >
        All Voting History
      </h3>

      <p className={darkMode ? "text-gray-400 mb-6" : "text-gray-600 mb-6"}>
        A complete record of all elections you have participated in. 
        These entries include blockchain verification and timestamps.
      </p>

      {/* EMPTY STATE */}
      {voteHistory.length === 0 ? (
        <div className="text-center py-8">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2"
            />
          </svg>

          <h3 className="mt-2 text-sm font-medium">
            No voting history
          </h3>

          <p className="mt-1 text-sm opacity-70">
            You haven&apos;t participated in any elections yet.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {voteHistory.map((vote) => (
            <div
              key={vote.id}
              className={`p-6 border rounded-lg shadow ${
                darkMode
                  ? "bg-neutral-900 border-emerald-800"
                  : "bg-white border-gray-200"
              }`}
            >
              <div className="flex justify-between items-start">
                
                {/* LEFT SIDE */}
                <div className="flex-1">
                  <div className="flex items-center">
                    <h4
                      className={
                        darkMode
                          ? "text-lg font-medium text-emerald-200"
                          : "text-lg font-medium text-gray-900"
                      }
                    >
                      {vote.election.title}
                    </h4>

                    {/* BADGE */}
                    <span
                    className={`ml-3 inline-flex px-2 py-1 text-xs font-semibold rounded-full
                      ${
                        vote.election.status === "ENDED"
                          ? darkMode
                            ? "bg-blue-600/20 text-blue-300 border border-blue-600"
                            : "bg-blue-50 text-blue-700 border border-blue-100"
                          : vote.election.status === "ACTIVE"
                          ? darkMode
                            ? "bg-emerald-600/20 text-emerald-200 border border-emerald-600"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                          : darkMode
                            ? "bg-yellow-600/20 text-yellow-200 border border-yellow-600"
                            : "bg-yellow-50 text-yellow-700 border border-yellow-100"
                      }
                    `}
                  >
                    {vote.election.status === "ACTIVE"
                      ? "Active"
                      : vote.election.status === "ENDED"
                      ? "Completed"
                      : "Draft"}
                  </span>
                  </div>

                  {/* DESCRIPTION */}
                  <p
                    className={
                      darkMode ? "text-gray-400 mt-2" : "text-gray-600 mt-2"
                    }
                  >
                    {vote.election.description}
                  </p>

                  {/* GRID DETAILS */}
                  <div className="grid grid-cols-2 gap-4 text-sm mt-4">

                    <div>
                      <span className="font-medium opacity-70">
                        Organization:
                      </span>
                      <span className="ml-2">
                        {vote.election.organization.username}
                      </span>
                    </div>

                    <div>
                      <span className="font-medium opacity-70">
                        Voted at:
                      </span>
                      <span className="ml-2">
                        {new Date(vote.votedAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* RIGHT SIDE BUTTON */}
                <div className="ml-6">
                  {vote.election.status === "ended" && (
                    <button
                      onClick={() =>
                        router.push(
                          `/voter/election/${vote.election.id}/results`
                        )
                      }
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm"
                    >
                      View Results
                    </button>
                  )}
                </div>

              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
)}
<ProfileSettingsModal
  open={settingsOpen}
  onClose={() => setSettingsOpen(false)}
  darkMode={darkMode}
  user={userData}
/>

      </main>

      <footer className={darkMode ? "mt-12 border-t border-emerald-800/30 py-8 bg-neutral-950/30 text-center text-sm text-emerald-300" : "mt-12 border-t border-gray-200 py-8 bg-white text-center text-sm text-gray-600"}>
        <div className="max-w-7xl mx-auto px-4">
          © 2025 BlockVote — Secure blockchain voting
        </div>
      </footer>
    </div>
  );
}
