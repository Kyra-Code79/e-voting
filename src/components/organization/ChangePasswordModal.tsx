"use client";

import { useState } from "react";
import { X, Loader2, Eye, EyeOff } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  darkMode: boolean;
}

export default function ChangePasswordModal({ open, onClose, darkMode }: Props) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleChangePassword = async () => {
    setError(null);
    if (!currentPassword || !newPassword) {
      setError("Please fill in all fields");
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem("accessToken");

      // Menggunakan endpoint yang sama karena backend membedakan user dari token
      const res = await fetch("/api/user/profile/password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const json = await res.json();

      if (json.success) {
        alert("Password changed successfully!");
        setNewPassword("");
        setCurrentPassword("");
        setShowCurrentPassword(false);
        setShowNewPassword(false);
        onClose();
      } else {
        setError(json.message || "Failed to change password");
      }
    } catch (err) {
      setError("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[10000]" onClick={onClose}></div>
      <div className="fixed inset-0 z-[10001] flex items-center justify-center pointer-events-none p-4">
        <div className={`pointer-events-auto w-full max-w-md rounded-xl p-6 shadow-2xl border relative ${
          darkMode ? "bg-neutral-900 border-emerald-700 text-emerald-100" : "bg-white border-gray-200 text-gray-900"
        }`}>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold">Change Password</h3>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-500/20 transition-colors">
              <X size={20} />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/50 rounded text-red-500 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-sm opacity-70 block mb-1">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  className={`w-full px-3 py-2 pr-10 rounded-md border outline-none focus:ring-1 focus:ring-emerald-500 ${
                    darkMode ? "bg-neutral-800 border-emerald-700" : "bg-white border-gray-300"
                  }`}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 opacity-50 hover:opacity-100"
                >
                  {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm opacity-70 block mb-1">New Password</label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  className={`w-full px-3 py-2 pr-10 rounded-md border outline-none focus:ring-1 focus:ring-emerald-500 ${
                    darkMode ? "bg-neutral-800 border-emerald-700" : "bg-white border-gray-300"
                  }`}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 opacity-50 hover:opacity-100"
                >
                  {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm rounded-md hover:bg-gray-500/10 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleChangePassword}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium rounded-md bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              Update Password
            </button>
          </div>
        </div>
      </div>
    </>
  );
}