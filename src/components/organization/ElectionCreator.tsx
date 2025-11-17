"use client";

import React, { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Sun, Moon, Plus, X, ArrowLeft } from "lucide-react";

// Tipe untuk kandidat
interface CandidateInput {
  name: string;
  description: string;
}

// Komponen Halaman Create Election
export default function CreateElectionPage() {
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(true);

  // State untuk form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  // State untuk manajemen kandidat
  const [candidates, setCandidates] = useState<CandidateInput[]>([]);
  const [newCandidateName, setNewCandidateName] = useState("");
  const [newCandidateDesc, setNewCandidateDesc] = useState("");

  // State untuk UI
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Mengatur tanggal minimum untuk input datetime-local
  const [minDate, setMinDate] = useState("");
  useEffect(() => {
    const now = new Date();
    // Format ke YYYY-MM-DDTHH:MM (ISO 8601 tanpa detik/ms)
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setMinDate(now.toISOString().slice(0, 16));
  }, []);

  // Handler untuk menambah kandidat baru
  const handleAddCandidate = () => {
    if (newCandidateName.trim() && newCandidateDesc.trim()) {
      setCandidates([...candidates, { name: newCandidateName, description: newCandidateDesc }]);
      setNewCandidateName("");
      setNewCandidateDesc("");
    } else {
      setError("Candidate name and description are required.");
    }
  };

  // Handler untuk menghapus kandidat
  const handleRemoveCandidate = (indexToRemove: number) => {
    setCandidates(candidates.filter((_, index) => index !== indexToRemove));
  };

  // Handler untuk submit form
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    // --- Validasi Front-end ---
    if (!title || !description || !startDate || !endDate) {
      setError("Please fill in all election details (title, description, start date, end date).");
      return;
    }
    if (candidates.length < 2) {
      setError("At least 2 candidates are required.");
      return;
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();

    if (start < now) {
      setError("Start date cannot be in the past.");
      return;
    }
    if (end <= start) {
      setError("End date must be after the start date.");
      return;
    }

    setIsLoading(true);

    try {
      const token = localStorage.getItem("accessToken");
      if (!token) {
        throw new Error("Authentication token not found.");
      }

      const response = await fetch("/api/organization/elections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          description,
          startDate,
          endDate,
          candidates, // Kirim array kandidat
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccessMessage("Election created successfully! Redirecting to dashboard...");
        // Reset form (opsional)
        setTitle("");
        setDescription("");
        setStartDate("");
        setEndDate("");
        setCandidates([]);
        // Redirect kembali ke dashboard setelah 2 detik
        setTimeout(() => {
          router.push("/dashboard/organization"); // Asumsi path dashboard Anda
        }, 2000);
      } else {
        setError(data.message || "Failed to create election.");
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={
        darkMode
          ? "min-h-screen flex flex-col bg-gradient-to-br from-black via-neutral-900 to-emerald-950 text-white"
          : "min-h-screen flex flex-col bg-gradient-to-br from-gray-100 via-gray-50 to-white text-gray-900"
      }
    >
      {/* Theme toggle (opsional, tapi konsisten) */}
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

      {/* Konten Utama */}
      <main className="flex-grow max-w-3xl mx-auto py-12 px-4 sm:px-6 lg:px-8 space-y-8 w-full">
        <div
          className={`p-8 rounded-lg border shadow-lg transition-all duration-300 ${
            darkMode
              ? "bg-neutral-900/70 border-emerald-800 text-white"
              : "bg-white border-gray-200 text-gray-900"
          }`}
        >
          <button
            onClick={() => router.back()}
            className={`flex items-center space-x-2 text-sm mb-6 ${
              darkMode ? "text-emerald-300 hover:text-emerald-200" : "text-emerald-700 hover:text-emerald-600"
            }`}
          >
            <ArrowLeft size={16} />
            <span>Back to Dashboard</span>
          </button>

          <h1 className="text-2xl font-bold text-emerald-600 mb-6">
            Create New Election
          </h1>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Detail Election */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={`w-full p-2 rounded-md border ${
                    darkMode
                      ? "bg-neutral-800 border-emerald-700"
                      : "bg-gray-50 border-gray-300"
                  }`}
                  placeholder="e.g., Student Council President 2024"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className={`w-full p-2 rounded-md border ${
                    darkMode
                      ? "bg-neutral-800 border-emerald-700"
                      : "bg-gray-50 border-gray-300"
                  }`}
                  placeholder="A brief description of the election."
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Start Date</label>
                  <input
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    min={minDate}
                    className={`w-full p-2 rounded-md border ${
                      darkMode
                        ? "bg-neutral-800 border-emerald-700"
                        : "bg-gray-50 border-gray-300"
                    }`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End Date</label>
                  <input
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate || minDate} // End date tidak bisa sebelum start date
                    className={`w-full p-2 rounded-md border ${
                      darkMode
                        ? "bg-neutral-800 border-emerald-700"
                        : "bg-gray-50 border-gray-300"
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Manajemen Kandidat */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-emerald-600 border-t pt-4 border-emerald-700/50">
                Candidates
              </h2>
              {/* Daftar kandidat yang sudah ditambah */}
              <div className="space-y-2">
                {candidates.map((candidate, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex items-center justify-between p-2 rounded-md ${
                      darkMode ? "bg-neutral-800" : "bg-gray-100"
                    }`}
                  >
                    <div>
                      <p className="font-semibold">{candidate.name}</p>
                      <p className="text-sm opacity-80">{candidate.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveCandidate(index)}
                      className="p-1 rounded-full text-red-500 hover:bg-red-500/10"
                    >
                      <X size={16} />
                    </button>
                  </motion.div>
                ))}
                {candidates.length < 2 && (
                  <p className="text-yellow-500 text-sm">Please add at least 2 candidates.</p>
                )}
              </div>

              {/* Form untuk menambah kandidat baru */}
              <div
                className={`p-3 rounded-lg border space-y-3 ${
                  darkMode ? "bg-neutral-950/50 border-emerald-800" : "bg-gray-50 border-gray-200"
                }`}
              >
                <h3 className="text-md font-medium">Add New Candidate</h3>
                <input
                  type="text"
                  value={newCandidateName}
                  onChange={(e) => setNewCandidateName(e.target.value)}
                  className={`w-full p-2 rounded-md border ${
                    darkMode
                      ? "bg-neutral-800 border-emerald-700"
                      : "bg-gray-50 border-gray-300"
                  }`}
                  placeholder="Candidate Name"
                />
                <input
                  type="text"
                  value={newCandidateDesc}
                  onChange={(e) => setNewCandidateDesc(e.target.value)}
                  className={`w-full p-2 rounded-md border ${
                    darkMode
                      ? "bg-neutral-800 border-emerald-700"
                      : "bg-gray-50 border-gray-300"
                  }`}
                  placeholder="Candidate Description (e.g., Vision & Mission)"
                />
                <button
                  type="button"
                  onClick={handleAddCandidate}
                  className={`w-full flex items-center justify-center p-2 rounded-md text-sm font-medium ${
                    darkMode
                      ? "bg-emerald-700/50 hover:bg-emerald-700/80 text-white"
                      : "bg-emerald-100 hover:bg-emerald-200 text-emerald-800"
                  }`}
                >
                  <Plus size={16} className="mr-1" />
                  Add Candidate
                </button>
              </div>
            </div>

            {/* Error & Success Messages */}
            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-red-500 text-sm text-center"
              >
                {error}
              </motion.p>
            )}
            {successMessage && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-green-500 text-sm text-center"
              >
                {successMessage}
              </motion.p>
            )}

            {/* Tombol Aksi Form */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-emerald-700/50">
              <button
                type="button"
                onClick={() => router.back()}
                disabled={isLoading}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${
                  darkMode
                    ? "bg-neutral-700 hover:bg-neutral-600 text-white"
                    : "bg-gray-200 hover:bg-gray-300 text-gray-800"
                }`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-6 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-wait"
              >
                {isLoading ? "Creating..." : "Create Election"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}