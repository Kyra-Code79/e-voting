"use client";

import { useState } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  darkMode: boolean;
  user: {
    username: string;
    fullName: string | null;
    profileImage?: string | null;
  } | null;
}

export default function ProfileSettingsModal({ open, onClose, darkMode, user }: Props) {
  const [username, setUsername] = useState(user?.username || "");
  const [fullName, setFullName] = useState(user?.fullName || "");
  const [profileImage, setProfileImage] = useState(user?.profileImage || "");
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  /** Convert file to base64 */
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setProfileImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  /** Save Profile Data */
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
          profileImage, // base64 stored
        }),
      });

      const json = await res.json();
      if (json.success) {
        alert("Profile updated!");
        onClose();
      } else {
        alert(json.message);
      }
    } finally {
      setLoading(false);
    }
  };

  /** Change Password */
  const handleChangePassword = async () => {
    try {
      setLoading(true);

      const token = localStorage.getItem("accessToken");

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
      } else {
        alert(json.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* BACKDROP */}
      <div
        className="fixed inset-0 bg-black/60 z-[9998]"
        onClick={onClose}
      ></div>

      {/* MODAL CONTAINER */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
        <div
          className={`pointer-events-auto w-full max-w-md rounded-xl p-6 shadow-xl border
          ${darkMode ? "bg-neutral-900 border-emerald-700 text-emerald-100" : "bg-white border-gray-200 text-gray-900"}
        `}
        >
          <h2 className="text-xl font-bold mb-4">Profile Settings</h2>

          {/* PROFILE IMAGE */}
          <div className="mb-4 flex items-center space-x-4">
            <img
              src={
                profileImage ||
                "https://ui-avatars.com/api/?name=User&background=10a37f&color=fff"
              }
              alt="profile"
              className="w-16 h-16 rounded-full object-cover border"
            />

            <div>
              <label className="text-sm opacity-70">Change Profile Image</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="mt-1 text-sm"
              />
            </div>
          </div>

          {/* USERNAME */}
          <div className="mb-3">
            <label className="text-sm opacity-70">Username</label>
            <input
              className={`w-full px-3 py-2 rounded-md mt-1 border ${
                darkMode
                  ? "bg-neutral-800 border-emerald-700 text-emerald-100"
                  : "bg-white border-gray-300"
              }`}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          {/* FULL NAME */}
          <div className="mb-6">
            <label className="text-sm opacity-70">Full Name</label>
            <input
              className={`w-full px-3 py-2 rounded-md mt-1 border ${
                darkMode
                  ? "bg-neutral-800 border-emerald-700 text-emerald-100"
                  : "bg-white border-gray-300"
              }`}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>

          {/* PASSWORD SECTION */}
          <h3 className="font-semibold mb-2">Change Password</h3>

          <div className="mb-3">
            <label className="text-sm opacity-70">Current Password</label>
            <input
              type="password"
              className={`w-full px-3 py-2 rounded-md mt-1 border ${
                darkMode
                  ? "bg-neutral-800 border-emerald-700 text-emerald-100"
                  : "bg-white border-gray-300"
              }`}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>

          <div className="mb-6">
            <label className="text-sm opacity-70">New Password</label>
            <input
              type="password"
              className={`w-full px-3 py-2 rounded-md mt-1 border ${
                darkMode
                  ? "bg-neutral-800 border-emerald-700 text-emerald-100"
                  : "bg-white border-gray-300"
              }`}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>

          {/* ACTION BUTTONS */}
          <div className="flex justify-between mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-md bg-gray-300 hover:bg-gray-400 text-black"
            >
              Close
            </button>

            <button
              onClick={handleSaveProfile}
              disabled={loading}
              className="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Save
            </button>
          </div>

          <button
            onClick={handleChangePassword}
            disabled={loading}
            className="mt-3 w-full px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white"
          >
            Change Password
          </button>
        </div>
      </div>
    </>
  );
}
