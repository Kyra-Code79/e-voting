"use client";

import { useState } from "react";
import { X, Camera, LogOut, Lock, Save, Loader2 } from "lucide-react";
import ChangePasswordModal from "@/components/organization/ChangePasswordModal"; // Re-use component yang sama

interface Props {
  open: boolean;
  onClose: () => void;
  darkMode: boolean;
  user: {
    username: string;
    email: string;
    profileImage?: string | null;
  } | null;
  onLogout: () => void;
  onUpdateSuccess?: () => void;
}

export default function AdminProfileModal({ open, onClose, darkMode, user, onLogout, onUpdateSuccess }: Props) {
  const [username, setUsername] = useState(user?.username || "");
  const [profileImage, setProfileImage] = useState(user?.profileImage || "");
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Sync state
  if (!open) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setProfileImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("accessToken");
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ username, profileImage }),
      });
      const json = await res.json();
      if (json.success) {
        alert("Profile updated successfully!");
        if (onUpdateSuccess) onUpdateSuccess();
      } else {
        alert(json.message);
      }
    } catch (e) {
      alert("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[9998]" onClick={onClose}></div>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none p-4">
        <div className={`pointer-events-auto w-full max-w-md rounded-2xl p-6 shadow-2xl border relative flex flex-col ${darkMode ? "bg-neutral-900 border-emerald-700 text-emerald-100" : "bg-white border-gray-200 text-gray-900"}`}>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Admin Profile</h2>
            <button onClick={onClose} className={`p-2 rounded-full transition-colors ${darkMode ? "hover:bg-neutral-800 text-gray-400 hover:text-white" : "hover:bg-gray-100 text-gray-500 hover:text-black"}`}><X size={20} /></button>
          </div>

          <div className="flex flex-col items-center mb-8">
            <div className="relative group cursor-pointer">
              <img src={profileImage || `https://ui-avatars.com/api/?name=${username}&background=10a37f&color=fff`} alt="profile" className={`w-24 h-24 rounded-full object-cover border-4 ${darkMode ? "border-emerald-800" : "border-emerald-100"}`} />
              <label className="absolute bottom-0 right-0 bg-emerald-600 p-2 rounded-full text-white cursor-pointer shadow-lg hover:bg-emerald-700 transition-colors">
                <Camera size={16} />
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            <div>
              <label className="text-sm font-medium opacity-80 mb-1 block">Username</label>
              <input className={`w-full px-4 py-2.5 rounded-lg border outline-none ${darkMode ? "bg-neutral-800 border-emerald-800" : "bg-gray-50 border-gray-300"}`} value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium opacity-80 mb-1 block">Email</label>
              <input disabled className={`w-full px-4 py-2.5 rounded-lg border opacity-60 cursor-not-allowed ${darkMode ? "bg-neutral-800 border-emerald-800" : "bg-gray-50 border-gray-300"}`} value={user?.email || ""} />
            </div>
          </div>

          <div className="space-y-3 pt-6 border-t border-gray-200 dark:border-gray-800">
            <button onClick={() => setIsPasswordModalOpen(true)} className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-all ${darkMode ? "bg-neutral-800/50 border-emerald-800 hover:bg-neutral-800" : "bg-gray-50 border-gray-200 hover:bg-gray-100"}`}>
              <div className="flex items-center gap-3"><Lock size={18} className="text-emerald-500" /> <span className="text-sm font-semibold">Change Password</span></div>
            </button>
            <button onClick={() => { if(confirm("Logout?")) onLogout(); }} className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-all ${darkMode ? "bg-red-900/10 border-red-900/30 text-red-400 hover:bg-red-900/20" : "bg-red-50 border-red-100 text-red-600 hover:bg-red-100"}`}>
              <div className="flex items-center gap-3"><LogOut size={18} /> <span className="text-sm font-semibold">Log Out</span></div>
            </button>
          </div>

          <button onClick={handleSaveProfile} disabled={loading} className="mt-6 w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-2">
            {loading ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />} Save Changes
          </button>

          <ChangePasswordModal open={isPasswordModalOpen} onClose={() => setIsPasswordModalOpen(false)} darkMode={darkMode} />
        </div>
      </div>
    </>
  );
}