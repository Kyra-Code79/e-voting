"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon, CheckCircle, AlertCircle, X, Loader2, Vote } from "lucide-react";
import ProfileSettingsModal from "@/components/voter/ProfileSettingsModal";

// --- Interfaces ---

// UPDATE: Menyesuaikan tipe data agar kompatibel dengan ProfileSettingsModal & Prisma
interface User {
  id: number;
  studentId?: string;
  username: string;
  email: string;
  // Perubahan di sini: fullName dan profileImage bisa null (sesuai DB), bukan undefined (?)
  fullName: string | null; 
  profileImage: string | null;
  role: "admin" | "organization" | "voter";
  status: "active" | "inactive";
  emailVerified: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
}

interface Candidate {
  id: number;
  name: string;
  description: string;
  electionId: number;
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
  candidates?: Candidate[]; 
}

interface UserElectionParticipation {
  id: number;
  userId: number;
  electionId: number;
  inviteStatus: "PENDING" | "ACCEPTED" | "DECLINED"; 
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

type TabKey = "overview" | "active" | "history" | "invitations";

// --- Component: Voting Modal ---

interface VotingModalProps {
  isOpen: boolean;
  onClose: () => void;
  election: Election | null;
  darkMode: boolean;
  onVoteSuccess: () => void;
}

const VotingModal: React.FC<VotingModalProps> = ({ isOpen, onClose, election, darkMode, onVoteSuccess }) => {
  const [selectedCandidate, setSelectedCandidate] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);

  useEffect(() => {
    if (isOpen && election) {
      loadCandidates(election.id);
      setSelectedCandidate(null);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, election]);

  const loadCandidates = async (electionId: number) => {
    setIsLoadingCandidates(true);
    setError(null);
    
    try {
      const token = localStorage.getItem("accessToken");
      
      const response = await fetch(`/api/voter/elections/${electionId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Gagal mengambil data kandidat dari server.");
      }

      const json = await response.json();
      
      if (json.success && json.data && json.data.candidates) {
        setCandidates(json.data.candidates);
      } else {
        setCandidates([]);
        setError("Data kandidat tidak ditemukan.");
      }

    } catch (err: unknown) {
      console.error("Error loading candidates:", err);
      setError("Gagal memuat data kandidat. Silakan coba lagi.");
    } finally {
      setIsLoadingCandidates(false);
    }
  };

  const handleVote = async () => {
    if (!selectedCandidate || !election) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const token = localStorage.getItem("accessToken");
      
      const response = await fetch("/api/voter/vote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          electionId: election.id,
          candidateId: selectedCandidate,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Gagal melakukan voting");
      }

      onVoteSuccess();
      onClose();
      
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Terjadi kesalahan sistem";
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !election) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl ${
              darkMode ? "bg-neutral-900 border border-emerald-800" : "bg-white"
            }`}
          >
            <div className={`sticky top-0 z-10 flex justify-between items-center p-6 border-b ${
              darkMode ? "bg-neutral-900/95 border-emerald-800" : "bg-white/95 border-gray-200"
            }`}>
              <div>
                <h2 className={`text-xl font-bold ${darkMode ? "text-emerald-400" : "text-emerald-700"}`}>
                  {election.title}
                </h2>
                <p className={`text-sm mt-1 ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                  Pilih kandidat terbaik menurut Anda. Voting Anda direkam di Blockchain.
                </p>
              </div>
              <button onClick={onClose} className={`p-2 rounded-full hover:bg-gray-200/20 ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
                <X size={24} />
              </button>
            </div>

            <div className="p-6">
              {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-lg flex items-center gap-3 text-red-500">
                  <AlertCircle size={20} />
                  <span>{error}</span>
                </div>
              )}

              {isLoadingCandidates ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className={`animate-spin mb-4 ${darkMode ? "text-emerald-400" : "text-emerald-600"}`} size={32} />
                  <p className={darkMode ? "text-gray-400" : "text-gray-600"}>Memuat kandidat dari database...</p>
                </div>
              ) : candidates.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p>Belum ada kandidat terdaftar untuk pemilihan ini.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {candidates.map((candidate, index) => (
                    <div
                      key={candidate.id}
                      onClick={() => setSelectedCandidate(candidate.id)}
                      className={`relative cursor-pointer rounded-xl border-2 transition-all duration-200 overflow-hidden group flex flex-col ${
                        selectedCandidate === candidate.id
                          ? darkMode 
                            ? "border-emerald-500 bg-emerald-900/20" 
                            : "border-emerald-600 bg-emerald-50"
                          : darkMode 
                            ? "border-neutral-700 bg-neutral-800/50 hover:border-emerald-700" 
                            : "border-gray-200 bg-white hover:border-emerald-300"
                      }`}
                    >
                      {selectedCandidate === candidate.id && (
                        <div className="absolute top-3 right-3 bg-emerald-500 text-white rounded-full p-1 z-10">
                          <CheckCircle size={20} />
                        </div>
                      )}

                      <div className="p-5 flex-grow">
                        <div className={`flex items-center gap-4 mb-4`}>
                          <div className={`w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-xl font-bold ${
                             darkMode ? "bg-neutral-700 text-emerald-400" : "bg-gray-200 text-emerald-700"
                          }`}>
                            {index + 1}
                          </div>
                          <h3 className={`font-bold text-lg leading-tight ${darkMode ? "text-white" : "text-gray-900"}`}>
                            {candidate.name}
                          </h3>
                        </div>

                        <div className="space-y-3">
                           <div>
                             <h4 className={`text-xs uppercase font-semibold tracking-wider mb-2 ${darkMode ? "text-emerald-500" : "text-emerald-700"}`}>
                               Deskripsi & Program Kerja
                             </h4>
                             <p className={`text-sm whitespace-pre-line ${darkMode ? "text-gray-300" : "text-gray-600"}`}>
                               {candidate.description}
                             </p>
                           </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={`sticky bottom-0 p-6 border-t flex justify-end items-center gap-3 ${
              darkMode ? "bg-neutral-900 border-emerald-800" : "bg-white border-gray-200"
            }`}>
              <button
                onClick={onClose}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  darkMode ? "text-gray-300 hover:bg-neutral-800" : "text-gray-600 hover:bg-gray-100"
                }`}
                disabled={isSubmitting}
              >
                Batal
              </button>
              <button
                onClick={handleVote}
                disabled={!selectedCandidate || isSubmitting}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium text-white transition-all ${
                  !selectedCandidate || isSubmitting
                    ? "bg-gray-500 cursor-not-allowed opacity-50"
                    : "bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-900/20"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Processing Block...
                  </>
                ) : (
                  <>
                    <Vote size={18} />
                    Submit Vote
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// --- Main Component ---

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
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(true);
  
  // Modal States
  const [isVoteModalOpen, setIsVoteModalOpen] = useState(false);
  const [selectedElectionForVote, setSelectedElectionForVote] = useState<Election | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [voteHistory, setVoteHistory] = useState<VotingHistoryEntry[]>([]);
  // UPDATE: Memastikan userData menggunakan tipe User yang benar
  const [userData, setUserData] = useState<User | null>(null);

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
    } catch (e: unknown) {
      console.error("Failed loading history:", e);
    }
  };

  const loadUserProfile = async () => {
    try {
      const token = localStorage.getItem("accessToken");
      const res = await fetch("/api/user/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        // Pastikan data dari API sesuai dengan interface User
        setUserData(json.user);
      }
    } catch (e: unknown) {
      console.error("Failed loading profile:", e);
    }
  };

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
        const payload = data.data ?? data;
        setDashboardData(payload);
      } else {
        setError("Failed to load dashboard data");
      }
    } catch (err: unknown) {
      console.error("Dashboard loading error:", err);
      setError("Failed to load dashboard data");
    } finally {
      setIsLoading(false);
    }
  };

  // Function to reload all data
  const refreshAllData = async () => {
     await Promise.all([
        loadDashboardData(),
        loadVoteHistory()
     ]);
  };

  useEffect(() => {
    const checkAuth = () => {
      const storedUser = localStorage.getItem("user");
      const token = localStorage.getItem("accessToken");

      if (!storedUser || !token) {
        router.push("/auth/login");
        return;
      }

      try {
        const parsedUser = JSON.parse(storedUser) as User;
        if (parsedUser.role !== "voter") {
          router.push("/auth/login");
          return;
        }
        setUser(parsedUser);
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

  const handleInvitationResponse = async (participationId: number, action: "accept" | "decline") => {
    try {
      const token = localStorage.getItem("accessToken");
      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      const response = await fetch("/api/voter/invitations", {
        method: "POST",
        headers,
        body: JSON.stringify({ participationId, action }),
      });

      if (response.ok) {
        await loadDashboardData();
      } else {
        alert("Failed to respond to invitation");
      }
    } catch (err: unknown) {
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

  const handleOpenVoteModal = (election: Election) => {
    setSelectedElectionForVote(election);
    setIsVoteModalOpen(true);
  };

  const handleVoteSuccess = () => {
      refreshAllData();
      alert("Vote berhasil direkam di blockchain!");
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

  const hasUserVoted = (electionId: number) => {
      const inHistory = voteHistory.some(v => v.electionId === electionId);
      const inParticipation = dashboardData.participations.some(p => p.electionId === electionId && p.hasVoted);
      return inHistory || inParticipation;
  };

  if (isLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? "bg-gradient-to-br from-black via-neutral-900 to-emerald-950 text-white" : "bg-gray-50 text-gray-700"}`}>
        <div className="text-center">
          <div className={`animate-spin rounded-full h-12 w-12 border-b-2 ${darkMode ? "border-emerald-400" : "border-blue-600"} mx-auto`} />
          <p className="mt-4">{darkMode ? "Loading dashboard..." : "Loading dashboard..."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={darkMode ? "min-h-screen flex flex-col bg-gradient-to-br from-black via-neutral-900 to-emerald-950 text-white" : "min-h-screen flex flex-col bg-gray-50 text-gray-900"}>
      <div className="fixed top-4 right-4 z-50">
        <motion.button
          whileTap={{ rotate: 180, scale: 0.95 }}
          onClick={() => setDarkMode((s) => !s)}
          className={`p-2 rounded-full border shadow-sm backdrop-blur-md ${darkMode ? "bg-neutral-900/80 border-emerald-700 text-emerald-300" : "bg-white/90 border-gray-300 text-emerald-700"}`}
        >
          {darkMode ? <Sun size={16} /> : <Moon size={16} />}
        </motion.button>
      </div>

      <header className={darkMode ? "bg-neutral-950/30 border-b border-emerald-800/30 sticky top-0 z-40 backdrop-blur-md" : "bg-white border-b border-gray-200 sticky top-0 z-40"}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className={darkMode ? "text-xl font-bold text-emerald-300" : "text-2xl font-bold text-gray-900"}>Voter Dashboard</h1>
              <p className={darkMode ? "text-sm text-gray-300" : "text-sm text-gray-600"}>
                Welcome back, {user?.fullName || user?.username}
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button onClick={() => setSettingsOpen(true)} className={darkMode ? "px-3 py-2 rounded-md text-sm font-medium bg-emerald-700/10 border border-emerald-700 text-emerald-300 hover:bg-emerald-700/20" : "px-3 py-2 rounded-md text-sm font-medium bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100"}>
                Settings
              </button>
              <button onClick={handleLogout} className="px-3 py-2 rounded-md text-sm font-medium bg-red-600 hover:bg-red-700 text-white transition-colors">
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <nav className={darkMode ? "bg-neutral-900/40 border-b border-emerald-800/30" : "bg-white shadow-sm"}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-6 overflow-x-auto">
            {[
              { key: "overview", label: "Overview" },
              { key: "active", label: "Active Elections" },
              { key: "invitations", label: `Invitations (${dashboardData.statistics.pendingInvitations})` },
              { key: "history", label: "Voting History" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as TabKey)}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                  activeTab === tab.key
                    ? darkMode ? "border-emerald-400 text-emerald-300" : "border-emerald-600 text-emerald-700"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="flex-grow max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-8 w-full">
        {error && (
          <div className="mb-6 rounded-md bg-red-50 p-4 border border-red-200">
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
               <div className={darkMode ? "p-5 rounded-lg bg-neutral-900 border border-emerald-800 shadow hover:border-emerald-600 transition-colors" : "p-5 rounded-lg bg-white border border-gray-200 shadow-sm"}>
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center text-white">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div className="ml-4">
                    <dt className="text-sm opacity-70">Total Invitations</dt>
                    <dd className="text-lg font-bold">{dashboardData.statistics.totalInvitations}</dd>
                  </div>
                </div>
              </div>
              <div className={darkMode ? "p-5 rounded-lg bg-neutral-900 border border-emerald-800 shadow hover:border-emerald-600 transition-colors" : "p-5 rounded-lg bg-white border border-gray-200 shadow-sm"}>
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center text-white">
                     <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  </div>
                  <div className="ml-4">
                    <dt className="text-sm opacity-70">Votes Cast</dt>
                    <dd className="text-lg font-bold">{dashboardData.statistics.totalVoted}</dd>
                  </div>
                </div>
              </div>
               <div className={darkMode ? "p-5 rounded-lg bg-neutral-900 border border-emerald-800 shadow hover:border-emerald-600 transition-colors" : "p-5 rounded-lg bg-white border border-gray-200 shadow-sm"}>
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center text-white">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                  </div>
                  <div className="ml-4">
                    <dt className="text-sm opacity-70">Pending</dt>
                    <dd className="text-lg font-bold">{dashboardData.statistics.pendingInvitations}</dd>
                  </div>
                </div>
              </div>
               <div className={darkMode ? "p-5 rounded-lg bg-neutral-900 border border-emerald-800 shadow hover:border-emerald-600 transition-colors" : "p-5 rounded-lg bg-white border border-gray-200 shadow-sm"}>
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center text-white">
                       <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                  </div>
                  <div className="ml-4">
                    <dt className="text-sm opacity-70">Participation Rate</dt>
                    <dd className="text-lg font-bold">{dashboardData.statistics.participationRate.toFixed(1)}%</dd>
                  </div>
                </div>
              </div>
            </div>

            <div className={darkMode ? "bg-neutral-900 border border-emerald-800 rounded-lg shadow-lg overflow-hidden" : "bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden"}>
              <div className="p-6 border-b border-gray-200/10">
                <h3 className={darkMode ? "text-lg font-medium text-emerald-300" : "text-lg font-medium text-gray-900"}>Active Elections</h3>
              </div>
              <div className="p-6">
                 {dashboardData.activeElections.length === 0 ? (
                  <p className="text-center opacity-60 py-4">No active elections at the moment.</p>
                 ) : (
                   <div className="space-y-4">
                     {dashboardData.activeElections.slice(0, 3).map((election) => {
                       const voted = hasUserVoted(election.id);
                       return (
                         <div key={election.id} className={`flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 rounded-lg border ${darkMode ? "border-emerald-800/50 bg-black/20" : "border-gray-100 bg-gray-50"}`}>
                           <div>
                             <h4 className="font-medium">{election.title}</h4>
                             <div className="flex items-center gap-3 mt-1 text-sm opacity-70">
                               <span>By {election.organization.username}</span>
                               <span>•</span>
                               <span className={isElectionActive(election) ? "text-green-500" : "text-gray-500"}>
                                 {isElectionActive(election) ? formatTimeRemaining(election.endDate) : "Ended"}
                               </span>
                             </div>
                           </div>
                           <div className="mt-3 sm:mt-0">
                              {voted ? (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  <CheckCircle size={12} className="mr-1"/> Voted
                                </span>
                              ) : (
                                isElectionActive(election) && (
                                  <button 
                                    onClick={() => handleOpenVoteModal(election)}
                                    className="px-4 py-2 text-xs font-medium rounded-md bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                                  >
                                    Vote Now
                                  </button>
                                )
                              )}
                           </div>
                         </div>
                       );
                     })}
                   </div>
                 )}
                 {dashboardData.activeElections.length > 0 && (
                   <button 
                     onClick={() => setActiveTab("active")}
                     className={`mt-4 w-full py-2 text-sm font-medium rounded border transition-colors ${darkMode ? "border-emerald-800 text-emerald-400 hover:bg-emerald-900/20" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}
                   >
                     View All Active Elections
                   </button>
                 )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "active" && (
          <div className="grid gap-6">
             {dashboardData.activeElections.length === 0 ? (
               <div className={`text-center py-12 rounded-lg border border-dashed ${darkMode ? "border-gray-700 text-gray-400" : "border-gray-300 text-gray-500"}`}>
                 No active elections currently available.
               </div>
             ) : (
               dashboardData.activeElections.map(election => {
                 const voted = hasUserVoted(election.id);
                 return (
                   <div key={election.id} className={`rounded-xl border overflow-hidden shadow-lg transition-all ${darkMode ? "bg-neutral-900 border-emerald-800" : "bg-white border-gray-200"}`}>
                      <div className="p-6">
                        <div className="flex justify-between items-start">
                           <div className="flex-1 pr-4">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className={`text-xl font-bold ${darkMode ? "text-white" : "text-gray-900"}`}>{election.title}</h3>
                                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/20 text-emerald-500 border border-emerald-500/30">
                                  ACTIVE
                                </span>
                              </div>
                              <p className={`mb-4 ${darkMode ? "text-gray-400" : "text-gray-600"}`}>{election.description}</p>
                              
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm opacity-80">
                                <div>
                                  <span className="block text-xs uppercase tracking-wider opacity-70">Organization</span>
                                  <span className="font-medium">{election.organization.username}</span>
                                </div>
                                <div>
                                  <span className="block text-xs uppercase tracking-wider opacity-70">Votes</span>
                                  <span className="font-medium">{election._count.votes}</span>
                                </div>
                                <div>
                                  <span className="block text-xs uppercase tracking-wider opacity-70">Ends In</span>
                                  <span className="font-medium text-emerald-500">{formatTimeRemaining(election.endDate)}</span>
                                </div>
                              </div>
                           </div>

                           <div className="flex flex-col items-end justify-center min-w-[120px]">
                              {voted ? (
                                <div className="flex flex-col items-end text-green-500">
                                   <CheckCircle size={32} className="mb-2"/>
                                   <span className="font-bold text-sm">Voted</span>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleOpenVoteModal(election)}
                                  className="w-full py-3 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-900/30 transition-transform hover:scale-105 flex items-center justify-center gap-2"
                                >
                                  <Vote size={18} />
                                  Vote Now
                                </button>
                              )}
                           </div>
                        </div>
                      </div>
                      <div className="h-1.5 w-full bg-gray-200 dark:bg-gray-800">
                        <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, (election._count.votes / Math.max(1, election._count.voters)) * 100)}%` }}></div>
                      </div>
                   </div>
                 );
               })
             )}
          </div>
        )}

        {activeTab === "invitations" && (
           <div className={`rounded-lg shadow overflow-hidden ${darkMode ? "bg-neutral-900 border border-emerald-800" : "bg-white border border-gray-200"}`}>
             <div className="p-6 border-b border-gray-200/10">
                <h3 className="text-lg font-medium">Pending Invitations</h3>
             </div>
             <div className="p-6 space-y-4">
                {dashboardData.pendingInvitations.length === 0 ? (
                  <div className="text-center py-8 opacity-60">No pending invitations.</div>
                ) : (
                  dashboardData.pendingInvitations.map(invite => (
                    <div key={invite.id} className={`flex flex-col sm:flex-row justify-between items-center p-4 rounded-lg border ${darkMode ? "border-gray-700 bg-gray-800/50" : "border-gray-200 bg-gray-50"}`}>
                       <div className="mb-4 sm:mb-0 text-center sm:text-left">
                         <h4 className="font-medium text-lg">{invite.election?.title}</h4>
                         <p className="text-sm opacity-70">{invite.election?.description}</p>
                         <div className="mt-1 text-xs opacity-50">Invited on {new Date(invite.invitedAt).toLocaleDateString()}</div>
                       </div>
                       <div className="flex gap-3">
                         <button onClick={() => handleInvitationResponse(invite.id, "accept")} className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 text-white text-sm font-medium">Accept</button>
                         <button onClick={() => handleInvitationResponse(invite.id, "decline")} className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white text-sm font-medium">Decline</button>
                       </div>
                    </div>
                  ))
                )}
             </div>
           </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-4">
            {voteHistory.length === 0 ? (
              <div className={`text-center py-12 rounded-lg border border-dashed ${darkMode ? "border-gray-700 text-gray-400" : "border-gray-300 text-gray-500"}`}>
                 You haven&apos;t voted in any elections yet.
               </div>
            ) : (
              voteHistory.map((vote) => (
                <div key={vote.id} className={`p-6 rounded-xl border shadow-sm ${darkMode ? "bg-neutral-900 border-emerald-800" : "bg-white border-gray-200"}`}>
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                         <h4 className="text-lg font-bold text-emerald-500">{vote.election.title}</h4>
                         <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">
                           {vote.election.status}
                         </span>
                      </div>
                      <p className="opacity-70 text-sm mb-4">{vote.election.description}</p>
                      
                      <div className="space-y-1">
                        <div className="flex items-center text-xs opacity-60 font-mono">
                           <span className="w-24">Block Hash:</span>
                           <span className="truncate max-w-[200px] md:max-w-md">{vote.blockHash}</span>
                        </div>
                        <div className="flex items-center text-xs opacity-60 font-mono">
                           <span className="w-24">Tx Hash:</span>
                           <span className="truncate max-w-[200px] md:max-w-md">{vote.transactionHash}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end justify-between">
                       <div className="text-right text-sm opacity-70">
                         <div>Voted At</div>
                         <div className="font-medium">{new Date(vote.votedAt).toLocaleString()}</div>
                       </div>
                       
                       {vote.election.status === 'ended' && (
                          <button onClick={() => router.push(`/voter/election/${vote.election.id}/results`)} className="mt-4 px-4 py-2 text-sm border border-emerald-500 text-emerald-500 rounded hover:bg-emerald-500 hover:text-white transition-colors">
                             See Results
                          </button>
                       )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      <footer className={darkMode ? "mt-auto border-t border-emerald-800/30 py-8 bg-neutral-950/30 text-center text-sm text-emerald-300" : "mt-auto border-t border-gray-200 py-8 bg-white text-center text-sm text-gray-600"}>
        <div className="max-w-7xl mx-auto px-4">
          © 2025 BlockVote — Secure blockchain voting
        </div>
      </footer>

      <VotingModal 
        isOpen={isVoteModalOpen} 
        onClose={() => setIsVoteModalOpen(false)} 
        election={selectedElectionForVote}
        darkMode={darkMode}
        onVoteSuccess={handleVoteSuccess}
      />
      
      <ProfileSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        darkMode={darkMode}
        user={userData}
      />
    </div>
  );
}