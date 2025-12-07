"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sun, Moon, Users, FileText, CheckCircle, Database, 
  Activity, Shield, AlertTriangle, Search, Plus, Trash2, Edit, X, RefreshCw,
  ChevronLeft, ChevronRight, ChevronDown, Download, HardDrive, Server
} from "lucide-react";
import AdminProfileModal from "@/components/admin/AdminProfileModal";
import { BarChart } from "@/components/charts/BarChart";   // Pastikan path ini benar
import { DonutChart } from "@/components/charts/DonutChart"; // Pastikan path ini benar

// --- TYPES ---
interface User {
  id: number;
  username: string;
  email: string;
  role: "admin" | "organization" | "voter";
  status: "active" | "inactive";
  createdAt: string;
  profileImage?: string | null;
}

interface OrganizationRegistration {
  id: number;
  organizationName: string;
  contactName: string;
  contactEmail: string;
  username: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  submittedAt: string;
}

interface AuditLog {
  id: number;
  action: string;
  resource: string;
  details: string;
  ipAddress: string;
  createdAt: string;
  user: {
    username: string;
    role: string;
  };
}

interface SystemStats {
  totalUsers: number;
  totalElections: number;
  totalVotes: number;
  totalBlocks: number;
}

// Interface baru untuk Chart System
interface SystemChartData {
  roles: { label: string; value: number }[];
  elections: { label: string; value: number }[];
  volume: { label: string; value: number }[];
}

type Tab = "Overview" | "Users" | "Organizations" | "System" | "Logs";

// --- COMPONENT ---
export default function AdminDashboard() {
  const router = useRouter();
  
  // State Global
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [darkMode, setDarkMode] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Data State
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [pendingOrgs, setPendingOrgs] = useState<OrganizationRegistration[]>([]);
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);
  const [systemChartData, setSystemChartData] = useState<SystemChartData | null>(null); // State Chart
  
  // --- STATE KHUSUS LOGS ---
  const [logsList, setLogsList] = useState<AuditLog[]>([]);
  const [logPage, setLogPage] = useState(1);
  const [logTotalPages, setLogTotalPages] = useState(1);
  const [logLoading, setLogLoading] = useState(false);
  
  // FILTER STATES (DUAL FILTER)
  const [logFilter, setLogFilter] = useState("ALL"); 
  const [actorFilter, setActorFilter] = useState("ALL"); 

  const [usersList, setUsersList] = useState<User[]>([]);
  
  // Modals
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  
  // Form State (User)
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState({ username: "", email: "", password: "", role: "voter" });
  
  // Filters
  const [userSearch, setUserSearch] = useState("");

  // --- API CALLS ---

  const loadDashboardData = async (token: string) => {
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${token}` };

      const [statsRes, orgRes, logsRes] = await Promise.all([
        fetch("/api/admin/stats", { headers }),
        fetch("/api/admin/organizations/pending", { headers }),
        fetch("/api/admin/audit?limit=5", { headers })
      ]);

      const statsData = await statsRes.json();
      const orgData = await orgRes.json();
      const logsData = await logsRes.json();

      if(statsData.success) setStats(statsData.data);
      if(orgData.success) setPendingOrgs(orgData.data);
      if(logsData.success) setRecentLogs(logsData.data);

    } catch (e) {
      console.error("Dashboard Load Error:", e);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    const token = localStorage.getItem("accessToken");
    if(!token) return;
    try {
      const res = await fetch("/api/admin/users?limit=100", { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      const data = await res.json();
      if(data.success) setUsersList(data.data);
    } catch(e) { console.error(e); }
  };

  // Load Data Chart untuk System Tab
  const loadSystemChartData = async () => {
    const token = localStorage.getItem("accessToken");
    if(!token) return;
    try {
        const res = await fetch("/api/admin/system", { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if(data.success) setSystemChartData(data.data);
    } catch(e) { console.error("System Data Error:", e); }
  };

  // Load Logs dengan Dual Filter & Pagination
  const loadLogsByPage = async (page: number) => {
    const token = localStorage.getItem("accessToken");
    if(!token) return;
    
    setLogLoading(true);
    try {
      let url = `/api/admin/audit?page=${page}&limit=20`; 
      if(logFilter !== "ALL") url += `&action=${logFilter}`;
      if(actorFilter !== "ALL") url += `&role=${actorFilter.toLowerCase()}`;
      
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      
      if(data.success) {
          setLogsList(data.data);
          if(data.pagination) setLogTotalPages(data.pagination.totalPages);
      }
    } catch(e) { 
        console.error("Logs Load Error:", e); 
    } finally {
        setLogLoading(false);
    }
  };

  // --- HANDLERS (EXPORT / BACKUP) ---

  const handleSystemAction = async (action: "backup_full" | "export_users" | "export_logs") => {
      const token = localStorage.getItem("accessToken");
      if(!token) return;

      try {
          const res = await fetch("/api/admin/system", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ action })
          });
          const data = await res.json();

          if(data.success) {
              // Trigger Download
              const blob = new Blob([data.content], { type: data.type });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = data.filename;
              a.click();
              window.URL.revokeObjectURL(url);
          } else {
              alert("Operation failed: " + data.message);
          }
      } catch(e) {
          console.error(e);
          alert("Error performing system action");
      }
  };

  const handleApproveOrg = async (id: number) => {
    if(!confirm("Approve this organization?")) return;
    const token = localStorage.getItem("accessToken");
    await fetch(`/api/admin/organizations/${id}/approve`, { 
        method: "POST", headers: { Authorization: `Bearer ${token}` } 
    });
    loadDashboardData(token!);
  };

  const handleRejectOrg = async (id: number) => {
    if(!confirm("Reject this organization?")) return;
    const token = localStorage.getItem("accessToken");
    await fetch(`/api/admin/organizations/${id}/reject`, { 
        method: "POST", headers: { Authorization: `Bearer ${token}` } 
    });
    loadDashboardData(token!);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem("accessToken");
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
    
    if (editingUser) {
        await fetch("/api/admin/users", {
            method: "PUT", headers,
            body: JSON.stringify({ userId: editingUser.id, updates: userForm })
        });
    } else {
        await fetch("/api/admin/users", {
            method: "POST", headers,
            body: JSON.stringify(userForm)
        });
    }
    setIsUserModalOpen(false);
    loadUsers();
  };

  const handleDeleteUser = async (id: number) => {
      if(!confirm("Delete this user?")) return;
      const token = localStorage.getItem("accessToken");
      await fetch(`/api/admin/users?userId=${id}`, {
          method: "DELETE", headers: { Authorization: `Bearer ${token}` }
      });
      loadUsers();
  };

  const handleCleanupLogs = async () => {
      if(!confirm("WARNING: This will delete audit logs older than 30 days. Continue?")) return;
      const token = localStorage.getItem("accessToken");
      await fetch("/api/admin/audit", {
          method: "DELETE",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ daysToKeep: 30, confirm: true })
      });
      alert("Logs cleaned up.");
      if(activeTab === "Logs") loadLogsByPage(1);
  };

  const handleLogout = () => {
    localStorage.clear();
    router.push("/auth/login");
  };

  // --- EFFECTS ---

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    const storedUser = localStorage.getItem("user");
    
    if (!token || !storedUser) {
        router.push("/auth/login");
        return;
    }

    try {
      const userData = JSON.parse(storedUser);
      if(userData.role !== "admin") {
          router.push("/auth/login");
          return;
      }
      setUser(userData);
      loadDashboardData(token);
    } catch(e) {
      router.push("/auth/login");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
      if(activeTab === "Users") loadUsers();
      if(activeTab === "System") loadSystemChartData(); // NEW
      if(activeTab === "Logs") {
          setLogPage(1); 
          loadLogsByPage(1);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
      if(activeTab === "Logs") {
          loadLogsByPage(logPage);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logPage, logFilter, actorFilter]); 

  // --- UTILS ---
  const getInitials = (name: string) => name.substring(0, 2).toUpperCase();

  return (
    <div className={darkMode ? "min-h-screen flex flex-col bg-gradient-to-br from-black via-neutral-900 to-emerald-950 text-white" : "min-h-screen flex flex-col bg-gray-100 text-gray-900"}>
      
      {/* HEADER */}
      <header className={darkMode ? "bg-neutral-950/30 border-b border-emerald-800/30 sticky top-0 z-30 backdrop-blur-md" : "bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm backdrop-blur-md"}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center py-4">
          <div>
            <h1 className={`text-xl font-bold ${darkMode ? "text-emerald-300" : "text-emerald-700"}`}>Admin Dashboard</h1>
            <p className={darkMode ? "text-gray-400 text-xs" : "text-gray-500 text-xs"}>System Administration</p>
          </div>

          <div className="flex items-center space-x-3">
             <button onClick={() => setDarkMode(!darkMode)} className={`p-2 rounded-full border ${darkMode ? "bg-neutral-900/50 border-emerald-800/50 text-emerald-300" : "bg-white text-gray-600"}`}>
                {darkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>

              <button onClick={() => setSettingsOpen(true)} className={`flex items-center gap-3 pl-1 pr-3 py-1 rounded-full border ${darkMode ? "border-emerald-800/50 bg-neutral-900/50" : "bg-white border-gray-300"}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${darkMode ? "bg-emerald-900 border-emerald-700 text-emerald-300" : "bg-emerald-100 text-emerald-700"}`}>
                  {user?.profileImage ? <img src={user.profileImage} className="w-full h-full object-cover rounded-full"/> : <span className="text-xs font-bold">{getInitials(user?.username || "AD")}</span>}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium leading-none">{user?.username}</p>
                  <p className="text-[10px] opacity-70">Administrator</p>
                </div>
              </button>
          </div>
        </div>
      </header>

      {/* TABS */}
      <nav className={darkMode ? "bg-neutral-900/40 border-b border-emerald-800/30" : "bg-white border-b border-gray-200"}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-6 overflow-x-auto pb-1">
            {["Overview", "Users", "Organizations", "System", "Logs"].map(tab => (
               <button key={tab} onClick={() => setActiveTab(tab as Tab)} className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${activeTab === tab ? (darkMode ? "border-emerald-400 text-emerald-300" : "border-emerald-600 text-emerald-700") : "border-transparent opacity-60"}`}>
                 {tab}
               </button>
            ))}
          </div>
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <main className="flex-grow max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 space-y-8 w-full">
        
        {/* 1. OVERVIEW TAB */}
        {activeTab === "Overview" && stats && (
           <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                 {[
                    { label: "Total Users", value: stats.totalUsers, icon: Users },
                    { label: "Total Elections", value: stats.totalElections, icon: FileText },
                    { label: "Total Votes", value: stats.totalVotes, icon: CheckCircle },
                    { label: "Blockchain Blocks", value: stats.totalBlocks, icon: Database },
                 ].map((card, i) => (
                    <div key={i} className={`p-5 rounded-xl border shadow-sm flex justify-between items-center ${darkMode ? "bg-neutral-900 border-emerald-800" : "bg-white border-gray-200"}`}>
                       <div><p className="text-sm opacity-60">{card.label}</p><p className="text-3xl font-bold text-emerald-500">{card.value}</p></div>
                       <div className={`p-3 rounded-lg ${darkMode ? "bg-emerald-900/30 text-emerald-400" : "bg-emerald-50 text-emerald-600"}`}><card.icon size={24}/></div>
                    </div>
                 ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 {/* Pending Orgs */}
                 <div className={`p-6 rounded-xl border ${darkMode ? "bg-neutral-900 border-emerald-800" : "bg-white border-gray-200"}`}>
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Activity size={18}/> Pending Organizations</h3>
                    {pendingOrgs.length === 0 ? <p className="opacity-50 text-sm">No pending registrations.</p> : (
                        <div className="space-y-4">
                            {pendingOrgs.slice(0, 5).map(org => (
                                <div key={org.id} className={`p-3 rounded border flex justify-between items-center ${darkMode ? "bg-black/20 border-emerald-900" : "bg-gray-50 border-gray-200"}`}>
                                    <div><p className="font-bold text-sm">{org.organizationName}</p><p className="text-xs opacity-60">{org.contactEmail}</p></div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleApproveOrg(org.id)} className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700">Approve</button>
                                        <button onClick={() => handleRejectOrg(org.id)} className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700">Reject</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                 </div>

                 {/* Recent Activity */}
                 <div className={`p-6 rounded-xl border ${darkMode ? "bg-neutral-900 border-emerald-800" : "bg-white border-gray-200"}`}>
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Shield size={18}/> Recent Activity (Live)</h3>
                    <div className="space-y-3">
                        {recentLogs.map(log => (
                            <div key={log.id} className="text-sm flex justify-between border-b border-gray-100 dark:border-gray-800 pb-2 last:border-0">
                                <div>
                                    <span className="font-mono text-emerald-500 font-bold">{log.action}</span>
                                    <span className="mx-2 opacity-50">|</span>
                                    <span>{log.user.username}</span>
                                </div>
                                <span className="opacity-50 text-xs">{new Date(log.createdAt).toLocaleTimeString()}</span>
                            </div>
                        ))}
                    </div>
                 </div>
              </div>
           </motion.div>
        )}

        {/* 2. USERS TAB */}
        {activeTab === "Users" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="flex justify-between items-center mb-6">
                    <div className={`flex items-center px-3 py-2 rounded-lg border w-full max-w-md ${darkMode ? "bg-neutral-800 border-emerald-800" : "bg-white border-gray-300"}`}>
                        <Search size={18} className="opacity-50 mr-2"/>
                        <input type="text" placeholder="Search users..." value={userSearch} onChange={e => setUserSearch(e.target.value)} className="bg-transparent outline-none w-full text-sm"/>
                    </div>
                    <button onClick={() => { setEditingUser(null); setUserForm({username:"", email:"", password:"", role:"voter"}); setIsUserModalOpen(true); }} className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-emerald-700 font-medium text-sm">
                        <Plus size={16}/> Add User
                    </button>
                </div>

                <div className={`overflow-hidden rounded-xl border ${darkMode ? "border-emerald-900" : "border-gray-200"}`}>
                    <table className={`min-w-full text-sm ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                        <thead className={darkMode ? "bg-neutral-900 text-emerald-500" : "bg-gray-50 text-gray-700"}>
                            <tr><th className="px-6 py-4 text-left">User</th><th className="px-6 py-4 text-left">Role</th><th className="px-6 py-4 text-left">Status</th><th className="px-6 py-4 text-right">Actions</th></tr>
                        </thead>
                        <tbody className={`divide-y ${darkMode ? "divide-neutral-800 bg-neutral-900/50" : "divide-gray-200 bg-white"}`}>
                            {usersList.filter(u => u.username.toLowerCase().includes(userSearch.toLowerCase())).map(u => (
                                <tr key={u.id} className={darkMode ? "hover:bg-neutral-800" : "hover:bg-gray-50"}>
                                    <td className="px-6 py-4"><div><p className="font-bold">{u.username}</p><p className="text-xs opacity-50">{u.email}</p></div></td>
                                    <td className="px-6 py-4"><span className="px-2 py-1 rounded text-xs bg-blue-500/10 text-blue-500 border border-blue-500/20">{u.role}</span></td>
                                    <td className="px-6 py-4"><span className={`px-2 py-1 rounded text-xs ${u.status === 'active' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>{u.status}</span></td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <button onClick={() => { setEditingUser(u); setUserForm({ username: u.username, email: u.email, role: u.role, password: "" }); setIsUserModalOpen(true); }} className="p-1 hover:text-emerald-500"><Edit size={16}/></button>
                                        <button onClick={() => handleDeleteUser(u.id)} className="p-1 hover:text-red-500"><Trash2 size={16}/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </motion.div>
        )}

        {/* 3. ORGANIZATIONS TAB */}
        {activeTab === "Organizations" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                <div className={`p-6 rounded-xl border ${darkMode ? "bg-neutral-900 border-emerald-800" : "bg-white border-gray-200"}`}>
                    <h3 className="font-bold text-lg mb-4 text-yellow-500 flex items-center gap-2"><AlertTriangle size={18}/> Needs Approval</h3>
                    {pendingOrgs.length === 0 ? <p className="opacity-50 text-sm">No pending organizations.</p> : (
                        <div className="grid gap-4">
                            {pendingOrgs.map(org => (
                                <div key={org.id} className={`p-4 rounded-lg border flex justify-between items-center ${darkMode ? "bg-black/20 border-emerald-900" : "bg-gray-50 border-gray-200"}`}>
                                    <div>
                                        <p className="font-bold text-lg">{org.organizationName}</p>
                                        <p className="text-sm opacity-60">Applicant: {org.contactName} ({org.username})</p>
                                        <p className="text-xs opacity-40 mt-1">Submitted: {new Date(org.submittedAt).toLocaleDateString()}</p>
                                    </div>
                                    <div className="flex gap-3">
                                        <button onClick={() => handleApproveOrg(org.id)} className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700">Approve</button>
                                        <button onClick={() => handleRejectOrg(org.id)} className="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700">Reject</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="flex justify-end">
                    <button onClick={() => { setEditingUser(null); setUserForm({username:"", email:"", password:"", role:"organization"}); setIsUserModalOpen(true); }} className="bg-emerald-600 text-white px-6 py-3 rounded-lg flex items-center gap-2 hover:bg-emerald-700 font-bold shadow-lg">
                        <Plus size={20}/> Create Organization Account Manually
                    </button>
                </div>
            </motion.div>
        )}

        {/* 4. SYSTEM TAB (NEW FEATURES) */}
        {activeTab === "System" && systemChartData && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                
                {/* System Overview Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className={`p-6 rounded-xl border flex flex-col items-center justify-center ${darkMode ? "bg-neutral-900 border-emerald-800" : "bg-white border-gray-200"}`}>
                        <h4 className="text-lg font-bold mb-6 flex items-center gap-2"><Users size={18}/> User Roles Distribution</h4>
                        {/* Map API data to color scheme */}
                        <DonutChart 
                            data={systemChartData.roles.map((r, i) => ({
                                label: r.label,
                                value: r.value,
                                color: ["#10B981", "#3B82F6", "#F59E0B"][i % 3] // Emerald, Blue, Amber
                            }))} 
                            size={200}
                        />
                    </div>
                    <div className={`p-6 rounded-xl border ${darkMode ? "bg-neutral-900 border-emerald-800" : "bg-white border-gray-200"}`}>
                        <h4 className="text-lg font-bold mb-6 flex items-center gap-2"><Server size={18}/> System Volume</h4>
                        <div className="h-[200px] flex items-end justify-center">
                            <BarChart 
                                data={systemChartData.volume.map((v, i) => ({
                                    label: v.label,
                                    value: v.value,
                                    color: ["#10B981", "#6366F1", "#EC4899"][i % 3]
                                }))}
                                height={200}
                            />
                        </div>
                    </div>
                </div>

                {/* Data Management Card */}
                <div className={`p-6 rounded-xl border ${darkMode ? "bg-neutral-900 border-emerald-800" : "bg-white border-gray-200"}`}>
                    <h3 className="text-xl font-bold mb-2 flex items-center gap-2"><HardDrive size={20}/> Data Management</h3>
                    <p className="opacity-60 mb-6 text-sm">Export system data for backup or analysis. All exports are generated in real-time.</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <button onClick={() => handleSystemAction("backup_full")} className="p-4 border rounded-lg hover:bg-emerald-500/10 hover:border-emerald-500 transition-all text-left group">
                            <Database className="mb-2 text-emerald-500" size={24}/>
                            <div className="font-bold">Full Database Backup</div>
                            <div className="text-xs opacity-60">Export complete system state as JSON</div>
                        </button>
                        <button onClick={() => handleSystemAction("export_users")} className="p-4 border rounded-lg hover:bg-blue-500/10 hover:border-blue-500 transition-all text-left group">
                            <Users className="mb-2 text-blue-500" size={24}/>
                            <div className="font-bold">Export Users</div>
                            <div className="text-xs opacity-60">Download user list as CSV</div>
                        </button>
                        <button onClick={() => handleSystemAction("export_logs")} className="p-4 border rounded-lg hover:bg-purple-500/10 hover:border-purple-500 transition-all text-left group">
                            <FileText className="mb-2 text-purple-500" size={24}/>
                            <div className="font-bold">Export Logs</div>
                            <div className="text-xs opacity-60">Download audit trail as CSV</div>
                        </button>
                    </div>
                </div>

                {/* Maintenance Card */}
                <div className={`p-6 rounded-xl border border-red-900/30 bg-red-900/5`}>
                    <h3 className="text-xl font-bold mb-2 text-red-500 flex items-center gap-2"><AlertTriangle size={20}/> Danger Zone</h3>
                    <p className="opacity-60 mb-6 text-sm">Irreversible actions for system maintenance.</p>
                    <button onClick={handleCleanupLogs} className="px-6 py-3 bg-red-600 text-white hover:bg-red-700 rounded-lg transition-all flex items-center gap-2">
                        <Trash2 size={18}/> Clean Old Audit Logs (30+ Days)
                    </button>
                </div>
            </motion.div>
        )}

        {/* 5. AUDIT LOGS TAB */}
        {activeTab === "Logs" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="flex flex-col md:flex-row gap-4 mb-6 justify-between items-start md:items-center">
                    <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto items-center">
                        <div className="relative w-full sm:w-48">
                            <select 
                                value={actorFilter}
                                onChange={(e) => { setActorFilter(e.target.value); setLogPage(1); }}
                                className={`w-full appearance-none pl-10 pr-8 py-2 rounded-lg text-sm font-medium border outline-none cursor-pointer ${darkMode ? "bg-neutral-800 border-emerald-800 text-emerald-100" : "bg-white border-gray-300 text-gray-700"}`}
                            >
                                <option value="ALL">All Actors</option>
                                <option value="ADMIN">Admins</option>
                                <option value="ORGANIZATION">Organizations</option>
                                <option value="VOTER">Voters</option>
                            </select>
                            <Users size={16} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50"/>
                            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50"/>
                        </div>

                        <div className="flex gap-2 flex-wrap">
                            {["ALL", "LOGIN", "LOGOUT", "CREATE", "UPDATE", "DELETE"].map(filter => (
                                <button 
                                    key={filter} 
                                    onClick={() => { setLogFilter(filter); setLogPage(1); }} 
                                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${logFilter === filter ? "bg-emerald-600 text-white border-emerald-600" : "border-gray-500 opacity-50 hover:opacity-100"}`}
                                >
                                    {filter}
                                </button>
                            ))}
                        </div>
                    </div>
                    <button onClick={() => loadLogsByPage(logPage)} className="p-2 rounded-full hover:bg-gray-500/20"><RefreshCw size={18} className={logLoading ? "animate-spin" : ""}/></button>
                </div>

                <div className={`rounded-xl border overflow-hidden ${darkMode ? "border-emerald-900" : "border-gray-200"}`}>
                    <table className={`min-w-full text-sm ${darkMode ? "text-gray-300" : "text-gray-700"}`}>
                        <thead className={darkMode ? "bg-neutral-900" : "bg-gray-50"}>
                            <tr><th className="px-6 py-3 text-left">Time</th><th className="px-6 py-3 text-left">Actor</th><th className="px-6 py-3 text-left">Action</th><th className="px-6 py-3 text-left">Details</th></tr>
                        </thead>
                        <tbody className={`divide-y ${darkMode ? "divide-neutral-800 bg-neutral-900/50" : "divide-gray-200 bg-white"}`}>
                            {logsList.length === 0 && !logLoading ? (
                                <tr><td colSpan={4} className="px-6 py-8 text-center opacity-50">No logs found matching your filters.</td></tr>
                            ) : logsList.map(log => (
                                <tr key={log.id} className="hover:opacity-80">
                                    <td className="px-6 py-3 font-mono text-xs opacity-50">{new Date(log.createdAt).toLocaleString()}</td>
                                    <td className="px-6 py-3 font-bold">
                                        {log.user.username} 
                                        <span className={`ml-2 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide border ${
                                            log.user.role === 'admin' ? 'border-red-500/30 text-red-500' : 
                                            log.user.role === 'organization' ? 'border-blue-500/30 text-blue-500' : 
                                            'border-gray-500/30 text-gray-500'
                                        }`}>
                                            {log.user.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3">
                                        <span className={`px-2 py-0.5 rounded text-xs border ${
                                            log.action.includes("DELETE") ? "bg-red-500/10 text-red-500 border-red-500/20" :
                                            log.action.includes("UPDATE") ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" :
                                            log.action === "LOGOUT" ? "bg-gray-500/10 text-gray-400 border-gray-500/20" :
                                            "bg-blue-500/10 text-blue-500 border-blue-500/20"
                                        }`}>
                                            {log.action}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 opacity-80 truncate max-w-xs" title={log.details}>{log.details}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    
                    <div className={`px-6 py-4 border-t flex justify-between items-center ${darkMode ? "border-emerald-900 bg-neutral-900" : "border-gray-200 bg-gray-50"}`}>
                        <span className="text-xs opacity-50">Page {logPage} of {logTotalPages}</span>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setLogPage(p => Math.max(1, p - 1))} 
                                disabled={logPage === 1 || logLoading}
                                className="p-1 rounded hover:bg-gray-500/20 disabled:opacity-30"
                            >
                                <ChevronLeft size={20}/>
                            </button>
                            <button 
                                onClick={() => setLogPage(p => Math.min(logTotalPages, p + 1))} 
                                disabled={logPage === logTotalPages || logLoading}
                                className="p-1 rounded hover:bg-gray-500/20 disabled:opacity-30"
                            >
                                <ChevronRight size={20}/>
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>
        )}

      </main>

      <AdminProfileModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        darkMode={darkMode}
        user={user}
        onLogout={handleLogout}
        onUpdateSuccess={() => { /* Reload Logic */ }}
      />

      {/* --- MODAL: CREATE/EDIT USER --- */}
      <AnimatePresence>
        {isUserModalOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <div className={`w-full max-w-md p-6 rounded-xl border shadow-2xl ${darkMode ? "bg-neutral-900 border-emerald-700 text-white" : "bg-white border-gray-200 text-gray-900"}`}>
                    <h3 className="text-xl font-bold mb-4">{editingUser ? "Edit User" : "Create New User"}</h3>
                    <form onSubmit={handleSaveUser} className="space-y-4">
                        <div><label className="block text-sm mb-1 opacity-70">Username</label><input type="text" required value={userForm.username} onChange={e => setUserForm({...userForm, username: e.target.value})} className={`w-full p-2 rounded border bg-transparent ${darkMode ? "border-emerald-800" : "border-gray-300"}`}/></div>
                        <div><label className="block text-sm mb-1 opacity-70">Email</label><input type="email" required value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} className={`w-full p-2 rounded border bg-transparent ${darkMode ? "border-emerald-800" : "border-gray-300"}`}/></div>
                        {!editingUser && <div><label className="block text-sm mb-1 opacity-70">Password</label><input type="password" required value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} className={`w-full p-2 rounded border bg-transparent ${darkMode ? "border-emerald-800" : "border-gray-300"}`}/></div>}
                        <div>
                            <label className="block text-sm mb-1 opacity-70">Role</label>
                            <select value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value})} className={`w-full p-2 rounded border bg-transparent ${darkMode ? "border-emerald-800 bg-neutral-900" : "border-gray-300 bg-white"}`}>
                                <option value="voter">Voter</option>
                                <option value="organization">Organization</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                            <button type="button" onClick={() => setIsUserModalOpen(false)} className="px-4 py-2 rounded hover:bg-gray-500/10">Cancel</button>
                            <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700">{editingUser ? "Update" : "Create"}</button>
                        </div>
                    </form>
                </div>
            </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}