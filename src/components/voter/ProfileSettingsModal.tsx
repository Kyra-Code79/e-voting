"use client";

import { useState } from "react";
import { X, Camera, LogOut, Lock, Save, Loader2 } from "lucide-react";
import ChangePasswordModal from "./ChangePasswordModal";

interface Props {
  open: boolean;
  onClose: () => void;
  darkMode: boolean;
  user: {
    username: string;
    fullName: string | null;
    profileImage?: string | null;
    studentId?: string; // Menambahkan studentId jika ada di schema
  } | null;
  onLogout: () => void; // Prop baru untuk handle logout
}

export default function ProfileSettingsModal({ open, onClose, darkMode, user, onLogout }: Props) {
  const [username, setUsername] = useState(user?.username || "");
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [profileImage, setProfileImage] = useState(user?.profileImage || "");
  
  // State untuk Change Password Modal
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setProfileImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("accessToken");

      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username,
          fullName,
          profileImage,
        }),
      });

      const json = await res.json();
      if (json.success) {
        alert("Profile updated successfully!");
        // Opsional: onClose(); // Tutup modal setelah save jika diinginkan
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
      {/* BACKDROP */}
      <div className="fixed inset-0 bg-black/60 z-[9998]" onClick={onClose}></div>

      {/* MODAL CONTAINER */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none p-4">
        <div
          className={`pointer-events-auto w-full max-w-md rounded-2xl p-6 shadow-2xl border relative flex flex-col max-h-[90vh] overflow-y-auto
          ${darkMode ? "bg-neutral-900 border-emerald-700 text-emerald-100" : "bg-white border-gray-200 text-gray-900"}
        `}
        >
          {/* HEADER: TITLE & CLOSE BUTTON */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Edit Profile</h2>
            <button 
              onClick={onClose} 
              className={`p-2 rounded-full transition-colors ${darkMode ? "hover:bg-neutral-800 text-gray-400 hover:text-white" : "hover:bg-gray-100 text-gray-500 hover:text-black"}`}
            >
              <X size={20} />
            </button>
          </div>

          {/* PROFILE IMAGE SECTION */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative group cursor-pointer">
              <img
                src={profileImage || `https://ui-avatars.com/api/?name=${username}&background=10a37f&color=fff`}
                alt="profile"
                className={`w-24 h-24 rounded-full object-cover border-4 ${darkMode ? "border-emerald-800" : "border-emerald-100"}`}
              />
              <label className="absolute bottom-0 right-0 bg-emerald-600 p-2 rounded-full text-white cursor-pointer shadow-lg hover:bg-emerald-700 transition-colors">
                <Camera size={16} />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>
            <p className={`mt-3 text-sm ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
              Click camera icon to upload
            </p>
          </div>

          {/* FORM INPUTS */}
          <div className="space-y-4 mb-8">
            <div>
              <label className="text-sm font-medium opacity-80 mb-1 block">Username</label>
              <input
                className={`w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all ${
                  darkMode
                    ? "bg-neutral-800 border-emerald-800 text-emerald-100 focus:border-emerald-500"
                    : "bg-gray-50 border-gray-300 text-gray-900 focus:border-emerald-500"
                }`}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium opacity-80 mb-1 block">Full Name</label>
              <input
                className={`w-full px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all ${
                  darkMode
                    ? "bg-neutral-800 border-emerald-800 text-emerald-100 focus:border-emerald-500"
                    : "bg-gray-50 border-gray-300 text-gray-900 focus:border-emerald-500"
                }`}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
          </div>

          {/* ACTION BUTTONS (Change Password & Logout) */}
          <div className="space-y-3 pt-6 border-t border-gray-200 dark:border-gray-800">
            <button
              onClick={() => setIsPasswordModalOpen(true)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-all ${
                darkMode 
                  ? "bg-neutral-800/50 border-emerald-800 hover:bg-neutral-800 hover:border-emerald-600" 
                  : "bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-md ${darkMode ? "bg-neutral-700 text-emerald-400" : "bg-white text-emerald-600 shadow-sm"}`}>
                  <Lock size={18} />
                </div>
                <div className="text-left">
                  <span className="block text-sm font-semibold">Change Password</span>
                  <span className="block text-xs opacity-60">Update your security credentials</span>
                </div>
              </div>
              <span className="text-xs opacity-50">Edit</span>
            </button>

            <button
              onClick={() => {
                if(confirm("Are you sure you want to logout?")) {
                    onLogout();
                }
              }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition-all group ${
                darkMode 
                  ? "bg-red-900/10 border-red-900/30 text-red-400 hover:bg-red-900/20 hover:border-red-900/50" 
                  : "bg-red-50 border-red-100 text-red-600 hover:bg-red-100"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-md ${darkMode ? "bg-red-900/20" : "bg-white shadow-sm"}`}>
                  <LogOut size={18} />
                </div>
                <span className="text-sm font-semibold">Log Out</span>
              </div>
            </button>
          </div>

          {/* MAIN SAVE BUTTON */}
          <button
            onClick={handleSaveProfile}
            disabled={loading}
            className="mt-6 w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-900/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
            Save Changes
          </button>

          {/* NESTED MODAL FOR PASSWORD */}
          <ChangePasswordModal 
            open={isPasswordModalOpen} 
            onClose={() => setIsPasswordModalOpen(false)} 
            darkMode={darkMode}
          />
        </div>
      </div>
    </>
  );
}