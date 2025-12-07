"use client";

import React, { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sun, Moon, Plus, X, Calendar, Users, FileText, CheckCircle, 
  AlertCircle, ChevronDown, UserPlus, Search, BarChart2, PieChart, 
  Loader2, Save, LogOut 
} from "lucide-react";
import ProfileSettingsModal from "@/components/organization/ProfileSettingsModal";
import { BarChart } from "@/components/charts/BarChart";
import { DonutChart } from "@/components/charts/DonutChart";

// ----------------------------------------------------------------------
// TYPES & INTERFACES
// ----------------------------------------------------------------------

interface User {
  id: number;
  username: string;
  email: string;
  role: "admin" | "organization" | "voter";
  status: "active" | "inactive" | "suspended";
  createdAt: string;
  profileImage?: string | null;
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

interface CandidateInput {
  name: string;
  description: string;
}

interface SimpleVoter {
  id: number;
  username: string;
  email: string;
  isAssigned?: boolean;
}

type Tab = "Overview" | "Elections" | "Voters" | "Results";

// ----------------------------------------------------------------------
// MAIN COMPONENT
// ----------------------------------------------------------------------

export default function OrganizationDashboard() {
  const router = useRouter();
  
  // --- Global UI State ---
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [darkMode, setDarkMode] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // --- User Data State ---
  // 'user' = data statis dari localStorage saat login awal
  const [user, setUser] = useState<User | null>(null); 
  // 'userData' = data live dari API (setelah update profile/image)
  const [userData, setUserData] = useState<User | null>(null);

  // --- Dashboard Data State ---
  const [stats, setStats] = useState<OrganizationStats | null>(null);
  
  // --- Voters List State ---
  const [voters, setVoters] = useState<User[]>([]);
  const [votersLoading, setVotersLoading] = useState(false);
  const [votersError, setVotersError] = useState<string | null>(null);

  // --- Results Tab State ---
  const [selectedResultElection, setSelectedResultElection] = useState<DetailedStatistic | null>(null);

  // --- Modal Visibility States ---
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  // --- Create Election Form State ---
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [candidates, setCandidates] = useState<CandidateInput[]>([]);
  const [newCandidateName, setNewCandidateName] = useState("");
  const [newCandidateDesc, setNewCandidateDesc] = useState("");
  const [minDate] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });

  // --- Assign Voter Form State ---
  const [selectedElectionForAssign, setSelectedElectionForAssign] = useState<{id: number, title: string} | null>(null);
  const [availableVoters, setAvailableVoters] = useState<SimpleVoter[]>([]);
  const [selectedVoterIds, setSelectedVoterIds] = useState<number[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // --- Update Status State ---
  const [updateLoading, setUpdateLoading] = useState<number | null>(null);

  // ----------------------------------------------------------------------
  // API HELPERS & DATA LOADERS
  // ----------------------------------------------------------------------

  const loadUserProfile = async () => {
    try {
      const token = localStorage.getItem("accessToken");
      if (!token) return;
      const res = await fetch("/api/user/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setUserData(json.user);
        // Sync local storage agar konsisten saat refresh
        const currentLocal = JSON.parse(localStorage.getItem("user") || "{}");
        localStorage.setItem("user", JSON.stringify({ ...currentLocal, ...json.user }));
      }
    } catch (e) { 
      console.error("Failed loading profile:", e); 
    }
  };

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

  const loadAvailableVoters = async (electionId?: number) => {
    const token = localStorage.getItem("accessToken");
    if(!token) return;
    try {
      // API ini harus support filter `?electionId=...` untuk menandai voter yg sudah assigned
      const url = electionId 
          ? `/api/organization/voters/all?electionId=${electionId}`
          : "/api/organization/voters/all";
      
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if(data.success) setAvailableVoters(data.data);
    } catch(e) { 
      console.error("Failed to load available voters", e); 
    }
  };

  // ----------------------------------------------------------------------
  // ACTION HANDLERS
  // ----------------------------------------------------------------------

  const handleLogout = () => {
    localStorage.clear();
    router.push("/auth/login");
  };

  const handleStatusChange = async (electionId: number, newStatus: string) => {
    const token = localStorage.getItem("accessToken");
    if (!token) return;

    setUpdateLoading(electionId);
    try {
        const res = await fetch("/api/organization/elections", {
            method: "PATCH",
            headers: { 
              "Content-Type": "application/json", 
              "Authorization": `Bearer ${token}` 
            },
            body: JSON.stringify({ electionId, status: newStatus })
        });
        const data = await res.json();
        
        if (data.success) {
            await loadStats(token); // Refresh UI
        } else {
            alert(data.message || "Failed to update status");
        }
    } catch (error) { 
        alert("Error updating status"); 
    } finally { 
        setUpdateLoading(null); 
    }
  };

  // --- Create Election Handlers ---

  const resetForm = () => {
    setTitle(""); 
    setDescription(""); 
    setStartDate(""); 
    setEndDate(""); 
    setCandidates([]); 
    setNewCandidateName(""); 
    setNewCandidateDesc(""); 
    setCreateError(null); 
    setCreateSuccess(null);
  };

  const handleAddCandidate = () => {
    if (newCandidateName.trim() && newCandidateDesc.trim()) {
      setCandidates([...candidates, { name: newCandidateName, description: newCandidateDesc }]);
      setNewCandidateName(""); 
      setNewCandidateDesc("");
    }
  };

  const handleRemoveCandidate = (index: number) => {
    setCandidates(candidates.filter((_, i) => i !== index));
  };

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);

    // Validation
    if (!title || !description || !startDate || !endDate) { 
        setCreateError("All fields are required."); return; 
    }
    if (candidates.length < 2) { 
        setCreateError("Please add at least 2 candidates."); return; 
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();
    if (start < now) { setCreateError("Start date cannot be in the past."); return; }
    if (end <= start) { setCreateError("End date must be after start date."); return; }

    setCreateLoading(true);
    try {
      const token = localStorage.getItem("accessToken");
      if (!token) throw new Error("No access token found.");

      const payload = { 
        title, 
        description, 
        startDate: start.toISOString(), 
        endDate: end.toISOString(), 
        candidates 
      };
      
      const res = await fetch("/api/organization/elections", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setCreateSuccess("Election created successfully! It is now in Draft mode.");
        await loadStats(token);
        setTimeout(() => { setIsCreateModalOpen(false); resetForm(); }, 2000);
      } else {
        setCreateError(data.message || "Failed to create election.");
      }
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setCreateLoading(false);
    }
  };

  // --- Assign Voters Handlers ---

  const openAssignModal = (electionId: number, electionTitle: string) => {
    setSelectedElectionForAssign({ id: electionId, title: electionTitle });
    setSelectedVoterIds([]); 
    setSearchTerm(""); 
    loadAvailableVoters(electionId);
    setIsAssignModalOpen(true);
  };

  const toggleVoterSelection = (voterId: number) => {
    setSelectedVoterIds(prev => 
        prev.includes(voterId) ? prev.filter(id => id !== voterId) : [...prev, voterId]
    );
  };

  const handleAssignSubmit = async () => {
    if(!selectedElectionForAssign || selectedVoterIds.length === 0) return;
    
    setAssignLoading(true);
    const token = localStorage.getItem("accessToken");
    try {
        const res = await fetch("/api/organization/elections/assign", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ 
                electionId: selectedElectionForAssign.id, 
                voterIds: selectedVoterIds 
            })
        });
        const data = await res.json();
        if(data.success) {
            alert(data.message);
            setIsAssignModalOpen(false);
            if(token) loadStats(token);
        } else {
            alert(data.message || "Failed to assign voters");
        }
    } catch(e) { 
        alert("Error assigning voters"); 
    } finally { 
        setAssignLoading(false); 
    }
  };

  // ----------------------------------------------------------------------
  // UTILS
  // ----------------------------------------------------------------------

  const getInitials = (name: string) => name.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();
  
  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString("en-US", { 
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" 
  });
  
  const getStatusColor = (status: string, isDark: boolean) => {
    switch (status) {
      case 'ACTIVE': return isDark ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'ENDED': return isDark ? 'bg-red-500/20 text-red-400 border-red-500/50' : 'bg-red-100 text-red-700 border-red-200';
      default: return isDark ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' : 'bg-yellow-100 text-yellow-700 border-yellow-200';
    }
  };

  const filteredVoters = availableVoters.filter(v => 
    v.username.toLowerCase().includes(searchTerm.toLowerCase()) || 
    v.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ----------------------------------------------------------------------
  // EFFECTS
  // ----------------------------------------------------------------------

  useEffect(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
 

    const storedUser = localStorage.getItem("user");
    const token = localStorage.getItem("accessToken");
    if (!storedUser || !token) { 
        router.push("/auth/login"); return; 
    }
    
    const userDataLocal = JSON.parse(storedUser);
    if (userDataLocal.role !== "organization") { 
        router.push("/auth/login"); return; 
    }
    
    setUser(userDataLocal);
    loadStats(token);
    loadUserProfile(); // Initial load for fresh image
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    if (activeTab === "Voters") {
      const token = localStorage.getItem("accessToken");
      if (token) loadVoters(token);
    }
  }, [activeTab]);

  // ----------------------------------------------------------------------
  // RENDER
  // ----------------------------------------------------------------------
  
  if (loading) return (
    <div className={`min-h-screen flex items-center justify-center ${darkMode ? "bg-black" : "bg-gray-50"}`}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
    </div>
  );

  const currentUser = userData || user;
  const endedElectionsList = stats?.detailedStatistics.filter(e => e.electionStatus === "ENDED") || [];

  return (
    <div className={darkMode ? "min-h-screen flex flex-col bg-gradient-to-br from-black via-neutral-900 to-emerald-950 text-white" : "min-h-screen flex flex-col bg-gray-100 text-gray-900"}>
      
      {/* HEADER */}
      <header className={darkMode ? "bg-neutral-950/30 border-b border-emerald-800/30 sticky top-0 z-30 backdrop-blur-md" : "bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm backdrop-blur-md"}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center py-4">
          <div>
            <h1 className={`text-xl font-bold ${darkMode ? "text-emerald-300" : "text-emerald-700"}`}>Organization Dashboard</h1>
            <p className={darkMode ? "text-gray-400 text-xs" : "text-gray-500 text-xs"}>BlockVote Election Management</p>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
             <button onClick={() => setDarkMode((s) => !s)} className={`p-2 rounded-full transition-all border ${darkMode ? "bg-neutral-900/50 border-emerald-800/50 text-emerald-300 hover:bg-neutral-800" : "bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100 hover:border-gray-400"}`} title="Toggle Theme">
                {darkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>

              <button
                onClick={() => setSettingsOpen(true)}
                className={`flex items-center gap-2 sm:gap-3 pl-1 pr-3 py-1 rounded-full border transition-all group max-w-[150px] sm:max-w-none ${darkMode ? "border-emerald-800/50 bg-neutral-900/50 hover:bg-neutral-800 hover:border-emerald-700" : "border-gray-300 bg-white hover:bg-gray-50 hover:border-emerald-500 shadow-sm"}`}
              >
                <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden border ${darkMode ? "bg-emerald-900 border-emerald-700 text-emerald-300" : "bg-emerald-100 border-emerald-200 text-emerald-700"}`}>
                  {currentUser?.profileImage ? (
                    <img src={currentUser.profileImage} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold">{getInitials(currentUser?.username || "ORG")}</span>
                  )}
                </div>
                <div className="hidden sm:block text-left overflow-hidden">
                  <p className={`text-sm font-medium leading-none truncate ${darkMode ? "text-emerald-100" : "text-gray-800"}`}>{currentUser?.username}</p>
                  <p className={`text-[10px] mt-0.5 ${darkMode ? "text-emerald-500/70" : "text-gray-500"}`}>Manage Org</p>
                </div>
              </button>
          </div>
        </div>
      </header>

      {/* NAVIGATION TABS */}
      <nav className={darkMode ? "bg-neutral-900/40 border-b border-emerald-800/30" : "bg-white border-b border-gray-200"}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="w-full overflow-x-auto">
            <div className="flex space-x-6 min-w-max pb-1">
                {["Overview", "Elections", "Voters", "Results"].map((tab) => (
                <button
                    key={tab}
                    onClick={() => setActiveTab(tab as Tab)}
                    className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors flex-shrink-0 ${
                    activeTab === tab
                        ? darkMode ? "border-emerald-400 text-emerald-300" : "border-emerald-600 text-emerald-700"
                        : darkMode ? "border-transparent text-gray-400 hover:text-white hover:border-emerald-500/50" : "border-transparent text-gray-600 hover:text-gray-900 hover:border-emerald-300"
                    }`}
                >
                    {tab}
                </button>
                ))}
            </div>
          </div>
        </div>
      </nav>

      {/* MAIN BODY CONTENT */}
      <main className="flex-grow max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-8 w-full">
        {error && <p className="text-red-500 text-center">{error}</p>}

        {/* 1. OVERVIEW TAB */}
        {activeTab === "Overview" && stats && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            {/* Top Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { label: "Total Elections", value: stats.totalElections, icon: FileText },
                { label: "Active Elections", value: stats.activeElections, icon: CheckCircle },
                { label: "Total Voters", value: stats.totalVoters, icon: Users },
                { label: "Participation Rate", value: `${stats.averageParticipation}%`, icon: Calendar },
              ].map((card, i) => (
                <motion.div key={i} whileHover={{ scale: 1.02 }} className={`p-5 rounded-xl border shadow-sm transition-all ${darkMode ? "bg-neutral-900 border-emerald-800 text-white" : "bg-white border-gray-200 text-gray-900"}`}>
                  <div className="flex justify-between items-start">
                    <div><p className={`text-sm font-medium ${darkMode ? "text-gray-400" : "text-gray-500"}`}>{card.label}</p><p className="text-3xl font-bold mt-2 text-emerald-500">{card.value}</p></div>
                    <div className={`p-2 rounded-lg ${darkMode ? "bg-emerald-900/30 text-emerald-400" : "bg-emerald-50 text-emerald-600"}`}><card.icon size={20} /></div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Recent & Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-4">
                <h2 className="text-xl font-semibold text-emerald-500">Active Elections</h2>
                {stats.recentElections.filter(e => e.status === "ACTIVE").length === 0 ? (
                  <div className={`p-8 rounded-xl border text-center ${darkMode ? "bg-neutral-900/50 border-emerald-900 text-gray-400" : "bg-gray-50 border-gray-200 text-gray-500"}`}><p>No active elections currently running.</p></div>
                ) : (
                  <div className="grid gap-4">
                    {stats.recentElections.filter(e => e.status === "ACTIVE").slice(0, 3).map(e => (
                      <div key={e.id} className={`p-4 rounded-xl border flex justify-between items-center ${darkMode ? "bg-neutral-900 border-emerald-900" : "bg-white border-gray-200"}`}>
                        <div><h3 className="font-bold text-lg">{e.title}</h3><p className="text-sm opacity-60">Ends: {formatDate(e.endDate)}</p></div>
                        <div className="text-right"><p className="text-2xl font-bold text-emerald-500">{e.voteCount}</p><p className="text-xs opacity-60">Votes Cast</p></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className={`p-6 rounded-xl border h-fit ${darkMode ? "bg-gradient-to-br from-emerald-900/20 to-neutral-900 border-emerald-800" : "bg-white border-gray-200"}`}>
                <h3 className="text-lg font-bold mb-2">Quick Actions</h3>
                <p className="text-sm opacity-70 mb-6">Start a new voting session immediately.</p>
                <button onClick={() => { resetForm(); setIsCreateModalOpen(true); }} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-lg transition-all flex items-center justify-center gap-2"><Plus size={20} /> Create Election</button>
              </div>
            </div>
          </motion.div>
        )}

        {/* 2. ELECTIONS TAB */}
        {activeTab === "Elections" && stats && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <h2 className={`text-2xl font-bold ${darkMode ? "text-white" : "text-gray-800"}`}>All Elections</h2>
              <button onClick={() => { resetForm(); setIsCreateModalOpen(true); }} className="px-5 py-2.5 rounded-lg text-sm font-bold shadow-lg transition-all flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"><Plus size={18} /> Create New Election</button>
            </div>

            {stats.recentElections.length === 0 ? (
              <div className={`text-center py-12 rounded-xl border border-dashed ${darkMode ? "border-gray-700 text-gray-400" : "border-gray-300 text-gray-500"}`}><FileText size={48} className="mx-auto mb-4 opacity-50" /><p>No elections found. Create your first one!</p></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {stats.recentElections.map((e) => (
                  <motion.div key={e.id} whileHover={{ y: -5 }} className={`p-5 rounded-xl border shadow-md transition-all overflow-hidden relative ${darkMode ? "bg-neutral-900 border-emerald-900/50 text-white" : "bg-white border-gray-200 text-gray-900"}`}>
                    <div className="absolute top-4 right-4 z-10">
                        {updateLoading === e.id ? <div className="p-2 bg-gray-800/50 rounded-lg"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div></div> : (
                            <div className="relative group">
                                <select value={e.status} onChange={(ev) => handleStatusChange(e.id, ev.target.value)} className={`appearance-none pl-3 pr-8 py-1.5 rounded-lg text-xs font-bold uppercase cursor-pointer outline-none border transition-colors ${getStatusColor(e.status, darkMode)}`}>
                                    <option value="DRAFT">Draft</option><option value="ACTIVE">Active</option><option value="ENDED">Ended</option>
                                </select>
                                <ChevronDown size={12} className={`absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${darkMode ? "text-white/50" : "text-black/50"}`} />
                            </div>
                        )}
                    </div>
                    <h3 className="text-lg font-bold text-emerald-600 pr-24 truncate">{e.title}</h3>
                    <div className="mt-2 mb-4"><button onClick={() => openAssignModal(e.id, e.title)} disabled={e.status === 'ENDED'} className={`text-xs flex items-center gap-1 px-3 py-1.5 rounded-md border transition-colors ${darkMode ? "bg-neutral-800 border-neutral-700 hover:bg-neutral-700 text-emerald-400" : "bg-gray-50 border-gray-200 hover:bg-gray-100 text-emerald-700"} disabled:opacity-50 disabled:cursor-not-allowed`}><UserPlus size={12} /> Assign Voters</button></div>
                    <div className="mt-4 space-y-2 text-sm">
                        <div className="flex justify-between"><span className="opacity-60">Registered</span><span className="font-mono">{e.voterCount}</span></div>
                        <div className="flex justify-between"><span className="opacity-60">Votes</span><span className="font-mono">{e.voteCount}</span></div>
                        <div className="flex justify-between"><span className="opacity-60">Turnout</span><span className={`font-bold ${e.participationRate > 50 ? 'text-emerald-500' : 'text-yellow-500'}`}>{e.participationRate}%</span></div>
                    </div>
                    <div className={`mt-4 pt-3 border-t text-xs flex justify-between items-center ${darkMode ? "border-gray-800 text-gray-400" : "border-gray-100 text-gray-500"}`}><span>{formatDate(e.startDate)}</span><span>&rarr;</span><span>{formatDate(e.endDate)}</span></div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* 3. VOTERS TAB */}
        {activeTab === "Voters" && (
           <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="overflow-hidden rounded-xl border border-gray-200 dark:border-emerald-900 shadow-sm">
            {votersLoading ? <div className="p-8 text-center text-gray-400">Loading voters data...</div> : 
             votersError ? <div className="p-8 text-center text-red-500">{votersError}</div> : 
             voters.length === 0 ? <div className="p-8 text-center text-gray-400">No voters registered yet.</div> : (
              <div className="overflow-x-auto">
                <table className={`min-w-full text-left text-sm ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                  <thead className={darkMode ? "bg-neutral-900 text-emerald-500 uppercase tracking-wider font-semibold" : "bg-gray-50 text-gray-700 uppercase tracking-wider font-semibold"}>
                    <tr><th className="px-6 py-4">ID</th><th className="px-6 py-4">Username</th><th className="px-6 py-4">Email</th><th className="px-6 py-4">Status</th><th className="px-6 py-4">Joined</th></tr>
                  </thead>
                  <tbody className={`divide-y ${darkMode ? "divide-neutral-800 bg-neutral-900/50" : "divide-gray-200 bg-white"}`}>
                    {voters.map((v) => (
                      <tr key={v.id} className={`transition-colors ${darkMode ? "hover:bg-neutral-800" : "hover:bg-gray-50"}`}>
                        <td className="px-6 py-4 font-mono text-xs opacity-50">{v.id}</td><td className="px-6 py-4 font-medium text-emerald-600">{v.username}</td><td className="px-6 py-4">{v.email}</td><td className="px-6 py-4"><span className={`px-2 py-1 rounded text-xs font-bold ${v.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>{v.status}</span></td><td className="px-6 py-4 opacity-60">{formatDate(v.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}

        {/* 4. RESULTS TAB (CHARTS) */}
        {activeTab === "Results" && (
           <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
             <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Results Management</h2>
                <p className="text-sm opacity-60">Analysis for {endedElectionsList.length} ended elections</p>
             </div>
             {endedElectionsList.length === 0 ? (
               <div className={`p-12 rounded-xl border border-dashed text-center ${darkMode ? "border-gray-700 text-gray-400" : "border-gray-300 text-gray-500"}`}>
                 <BarChart2 size={48} className="mx-auto mb-4 opacity-50" />
                 <p>No elections have ended yet.</p>
               </div>
             ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left: List */}
                  <div className={`lg:col-span-1 rounded-xl border overflow-hidden ${darkMode ? "bg-neutral-900 border-emerald-900" : "bg-white border-gray-200"}`}>
                     <div className={`p-4 border-b font-semibold ${darkMode ? "border-emerald-900 bg-neutral-950/50" : "border-gray-100 bg-gray-50"}`}>Ended Elections</div>
                     <div className="divide-y divide-gray-100 dark:divide-emerald-900/50 max-h-[600px] overflow-y-auto">
                        {endedElectionsList.map((election) => (
                           <div key={election.electionId} onClick={() => setSelectedResultElection(election)} className={`p-4 cursor-pointer transition-colors hover:bg-emerald-500/5 ${selectedResultElection?.electionId === election.electionId ? (darkMode ? "bg-emerald-900/20 border-l-4 border-l-emerald-500" : "bg-emerald-50 border-l-4 border-l-emerald-500") : "border-l-4 border-l-transparent"}`}>
                              <h4 className="font-bold text-sm truncate">{election.electionTitle}</h4>
                              <p className="text-xs opacity-60 mt-1">Ended: {formatDate(election.endDate)}</p>
                              <div className="flex justify-between mt-2 text-xs"><span>Turnout: {/* Gunakan toFixed(1) agar hanya 1 angka di belakang koma (misal: 83.3%) */}
<span className="font-mono">{Number(election.participationRate).toFixed(2)}%</span></span><span className="text-emerald-500">View Results &rarr;</span></div>
                           </div>
                        ))}
                     </div>
                  </div>
                  {/* Right: Charts */}
                  <div className="lg:col-span-2 space-y-6">
                     {selectedResultElection ? (
                        <>
                           <div className="grid grid-cols-3 gap-4">
                              <div className={`p-4 rounded-lg border text-center ${darkMode ? "bg-neutral-800 border-emerald-800" : "bg-white border-gray-200"}`}><div className="text-xs opacity-60 mb-1">Registered</div><div className="text-xl font-bold">{selectedResultElection.totalRegisteredVoters}</div></div>
                              <div className={`p-4 rounded-lg border text-center ${darkMode ? "bg-neutral-800 border-emerald-800" : "bg-white border-gray-200"}`}><div className="text-xs opacity-60 mb-1">Votes</div><div className="text-xl font-bold text-emerald-500">{selectedResultElection.totalVotesCast}</div></div>
                              <div className={`p-4 rounded-lg border text-center ${darkMode ? "bg-neutral-800 border-emerald-800" : "bg-white border-gray-200"}`}><div className="text-xs opacity-60 mb-1">Participation</div><div className="text-xl font-bold text-blue-500">{Number(selectedResultElection.participationRate).toFixed(2)}%</div></div>
                           </div>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className={`p-6 rounded-xl border flex flex-col items-center justify-center ${darkMode ? "bg-neutral-900 border-emerald-900" : "bg-white border-gray-200"}`}>
                                 <h4 className="text-sm font-semibold mb-6 flex items-center gap-2"><PieChart size={16} /> Participation Rate</h4>
                                 <DonutChart data={[{ label: "Voted", value: selectedResultElection.totalVotesCast, color: "#10B981" }, { label: "Abstained", value: selectedResultElection.totalRegisteredVoters - selectedResultElection.totalVotesCast, color: darkMode ? "#374151" : "#E5E7EB" }]} size={180} />
                              </div>
                              <div className={`p-6 rounded-xl border ${darkMode ? "bg-neutral-900 border-emerald-900" : "bg-white border-gray-200"}`}>
                                 <h4 className="text-sm font-semibold mb-6 flex items-center gap-2"><BarChart2 size={16} /> Voter Turnout</h4>
                                 <div className="h-[180px] flex items-end justify-center"><BarChart data={[{ label: "Registered", value: selectedResultElection.totalRegisteredVoters, color: "#6B7280" }, { label: "Votes Cast", value: selectedResultElection.totalVotesCast, color: "#10B981" }]} height={180} /></div>
                              </div>
                           </div>
                        </>
                     ) : (
                        <div className={`h-full min-h-[300px] flex flex-col items-center justify-center rounded-xl border border-dashed ${darkMode ? "border-emerald-900/50 bg-neutral-900/30" : "border-gray-300 bg-gray-50"}`}><p className="opacity-50">Select an election to view detailed analytics.</p></div>
                     )}
                  </div>
                </div>
             )}
           </motion.div>
        )}
      </main>

      {/* ---------------------------------------------------------------------- */}
      {/* MODALS SECTION */}
      {/* ---------------------------------------------------------------------- */}
      
      {/* 1. Create Election Modal */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className={`relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl border ${darkMode ? "bg-neutral-900 border-emerald-800 text-white" : "bg-white border-gray-200 text-gray-900"}`}>
              <div className={`sticky top-0 z-10 flex justify-between items-center p-6 border-b ${darkMode ? 'bg-neutral-900 border-emerald-800' : 'bg-white border-gray-100'}`}>
                <h2 className="text-2xl font-bold text-emerald-600 flex items-center gap-2"><CheckCircle className="w-6 h-6" /> Create New Election</h2>
                <button onClick={() => setIsCreateModalOpen(false)} className="p-2 rounded-full hover:bg-gray-500/10 transition-colors"><X size={24} /></button>
              </div>
              <div className="p-6 space-y-6">
                {createError && <div className="p-3 bg-red-500/10 border border-red-500 text-red-500 rounded-lg text-sm flex items-center justify-center gap-2"><AlertCircle size={16} /> {createError}</div>}
                {createSuccess && <div className="p-3 bg-emerald-500/10 border border-emerald-500 text-emerald-500 rounded-lg text-sm flex items-center justify-center gap-2"><CheckCircle size={16} /> {createSuccess}</div>}
                
                <form id="createElectionForm" onSubmit={handleCreateSubmit} className="space-y-6">
                  <div className="space-y-4">
                    <div><label className="block text-sm font-medium mb-1 flex items-center gap-2"><FileText size={16} /> Election Title</label><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Annual Chairman Election 2024" className={`w-full p-3 rounded-lg border focus:ring-2 focus:ring-emerald-500 outline-none ${darkMode ? "bg-neutral-800 border-emerald-700" : "bg-gray-50 border-gray-300"}`} /></div>
                    <div><label className="block text-sm font-medium mb-1">Description</label><textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Explain the purpose of this election..." className={`w-full p-3 rounded-lg border focus:ring-2 focus:ring-emerald-500 outline-none ${darkMode ? "bg-neutral-800 border-emerald-700" : "bg-gray-50 border-gray-300"}`} /></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div><label className="block text-sm font-medium mb-1 flex items-center gap-2"><Calendar size={16} /> Start Date</label><input type="datetime-local" min={minDate} value={startDate} onChange={(e) => setStartDate(e.target.value)} className={`w-full p-3 rounded-lg border focus:ring-2 focus:ring-emerald-500 outline-none ${darkMode ? "bg-neutral-800 border-emerald-700" : "bg-gray-50 border-gray-300"}`} /></div>
                      <div><label className="block text-sm font-medium mb-1 flex items-center gap-2"><Calendar size={16} /> End Date</label><input type="datetime-local" min={startDate || minDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} className={`w-full p-3 rounded-lg border focus:ring-2 focus:ring-emerald-500 outline-none ${darkMode ? "bg-neutral-800 border-emerald-700" : "bg-gray-50 border-gray-300"}`} /></div>
                    </div>
                  </div>
                  <div className={`p-4 rounded-xl border ${darkMode ? "bg-neutral-950/30 border-emerald-800" : "bg-gray-50 border-gray-200"}`}>
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><Users size={18} /> Candidates</h3>
                    <div className="space-y-3 mb-4">
                      {candidates.map((c, idx) => (
                        <div key={idx} className={`flex justify-between items-center p-3 rounded-lg border ${darkMode ? "bg-neutral-800 border-emerald-700/50" : "bg-white border-gray-200"}`}>
                          <div><p className="font-bold text-emerald-500">{c.name}</p><p className="text-xs opacity-70">{c.description}</p></div>
                          <button type="button" onClick={() => handleRemoveCandidate(idx)} className="text-red-500 hover:bg-red-500/10 p-2 rounded-full transition-colors"><X size={16} /></button>
                        </div>
                      ))}
                      {candidates.length === 0 && <p className="text-sm text-center opacity-50 italic py-2">No candidates added yet.</p>}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input type="text" value={newCandidateName} onChange={(e) => setNewCandidateName(e.target.value)} placeholder="Candidate Name" className={`p-2 rounded-lg border text-sm ${darkMode ? "bg-neutral-800 border-emerald-700" : "bg-white border-gray-300"}`} />
                      <input type="text" value={newCandidateDesc} onChange={(e) => setNewCandidateDesc(e.target.value)} placeholder="Short slogan/description" className={`p-2 rounded-lg border text-sm ${darkMode ? "bg-neutral-800 border-emerald-700" : "bg-white border-gray-300"}`} />
                    </div>
                    <button type="button" onClick={handleAddCandidate} disabled={!newCandidateName.trim() || !newCandidateDesc.trim()} className="mt-3 w-full py-2 flex items-center justify-center gap-2 text-sm font-medium text-emerald-600 border border-emerald-600 rounded-lg hover:bg-emerald-600/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"><Plus size={16} /> Add Candidate</button>
                  </div>
                </form>
              </div>
              <div className={`p-6 border-t flex justify-end gap-3 ${darkMode ? 'bg-neutral-900 border-emerald-800' : 'bg-gray-50 border-gray-200'}`}>
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className={`px-5 py-2 rounded-lg font-medium text-sm transition-colors ${darkMode ? "hover:bg-neutral-800 text-gray-300" : "hover:bg-gray-200 text-gray-600"}`}>Cancel</button>
                <button type="submit" form="createElectionForm" disabled={createLoading} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm shadow-lg hover:shadow-emerald-600/20 transition-all disabled:opacity-70 disabled:cursor-wait flex items-center gap-2">{createLoading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating...</> : "Create Election"}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Assign Voter Modal */}
      <AnimatePresence>
        {isAssignModalOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className={`w-full max-w-lg rounded-xl shadow-2xl border flex flex-col max-h-[85vh] ${darkMode ? "bg-neutral-900 border-emerald-800 text-white" : "bg-white border-gray-200 text-gray-900"}`}>
                <div className="p-5 border-b border-gray-200 dark:border-emerald-800 flex justify-between items-center">
                    <div><h3 className="text-xl font-bold text-emerald-600">Assign Voters</h3><p className="text-xs opacity-60">To: {selectedElectionForAssign?.title}</p></div>
                    <button onClick={() => setIsAssignModalOpen(false)}><X size={20} /></button>
                </div>
                <div className="p-5 overflow-y-auto flex-1 space-y-4">
                    <div className={`flex items-center px-3 py-2 rounded-lg border ${darkMode ? "bg-neutral-800 border-emerald-700" : "bg-gray-50 border-gray-300"}`}>
                        <Search size={18} className="opacity-50 mr-2"/><input type="text" placeholder="Search by name or email..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="bg-transparent outline-none w-full text-sm" />
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs opacity-50 pb-2"><span>Voter Name</span><span>{selectedVoterIds.length} selected</span></div>
                        {filteredVoters.length === 0 ? <p className="text-center py-4 text-sm opacity-50">No voters found.</p> : filteredVoters.map(voter => {
                            const isAssigned = voter.isAssigned === true;
                            return (
                                <div key={voter.id} onClick={() => !isAssigned && toggleVoterSelection(voter.id)} className={`flex items-center justify-between p-3 rounded-lg border transition-all ${isAssigned ? (darkMode ? "bg-neutral-900 border-neutral-800 opacity-50 cursor-not-allowed" : "bg-gray-100 border-gray-200 opacity-50 cursor-not-allowed") : selectedVoterIds.includes(voter.id) ? "bg-emerald-500/10 border-emerald-500 cursor-pointer" : (darkMode ? "bg-neutral-800 border-transparent hover:border-emerald-700 cursor-pointer" : "bg-gray-50 border-gray-200 hover:border-emerald-300 cursor-pointer")}`}>
                                    <div><div className="flex items-center gap-2"><p className="font-bold text-sm">{voter.username}</p>{isAssigned && <span className="text-[10px] px-1.5 py-0.5 bg-gray-500 text-white rounded-full">Assigned</span>}</div><p className="text-xs opacity-60">{voter.email}</p></div>
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center ${isAssigned ? "bg-gray-400 border-gray-400" : selectedVoterIds.includes(voter.id) ? "bg-emerald-500 border-emerald-500" : "border-gray-400"}`}>{(selectedVoterIds.includes(voter.id) || isAssigned) && <CheckCircle size={12} className="text-white" />}</div>
                                </div>
                            )
                        })}
                    </div>
                </div>
                <div className="p-5 border-t border-gray-200 dark:border-emerald-800 flex justify-end gap-3">
                    <button onClick={() => setIsAssignModalOpen(false)} className="px-4 py-2 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800">Cancel</button>
                    <button onClick={handleAssignSubmit} disabled={assignLoading || selectedVoterIds.length === 0} className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">{assignLoading ? "Saving..." : `Assign ${selectedVoterIds.length} Voters`}</button>
                </div>
            </motion.div>
            </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Profile Settings Modal */}
      <ProfileSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        darkMode={darkMode}
        user={currentUser}
        onLogout={handleLogout}
        onUpdateSuccess={() => { loadUserProfile(); setSettingsOpen(false); }}
      />
    </div>
  );
}