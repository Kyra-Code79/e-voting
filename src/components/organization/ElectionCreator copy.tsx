"use client";

import React, { useState } from "react";

interface Candidate {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
}

interface ElectionFormData {
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  candidates: Candidate[];
}

interface ElectionCreatorProps {
  onClose: () => void;
  onSubmit: (data: ElectionFormData) => Promise<void>;
  isLoading?: boolean;
}

export default function ElectionCreator({
  onClose,
  onSubmit,
  isLoading = false,
}: ElectionCreatorProps) {
  const [formData, setFormData] = useState<ElectionFormData>({
    title: "",
    description: "",
    startDate: "",
    endDate: "",
    candidates: [
      { id: "1", name: "", description: "" },
      { id: "2", name: "", description: "" },
    ],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const handleCandidateChange = (
    candidateId: string,
    field: "name" | "description" | "imageUrl",
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      candidates: prev.candidates.map((candidate) =>
        candidate.id === candidateId
          ? { ...candidate, [field]: value }
          : candidate
      ),
    }));
    // Clear candidate errors
    const errorKey = `candidate-${candidateId}-${field}`;
    if (errors[errorKey]) {
      setErrors((prev) => ({
        ...prev,
        [errorKey]: "",
      }));
    }
  };

  const addCandidate = () => {
    const newId = (formData.candidates.length + 1).toString();
    setFormData((prev) => ({
      ...prev,
      candidates: [
        ...prev.candidates,
        { id: newId, name: "", description: "" },
      ],
    }));
  };

  const removeCandidate = (candidateId: string) => {
    if (formData.candidates.length > 2) {
      setFormData((prev) => ({
        ...prev,
        candidates: prev.candidates.filter((c) => c.id !== candidateId),
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Basic validation
    if (!formData.title.trim()) {
      newErrors.title = "Election title is required";
    }
    if (!formData.description.trim()) {
      newErrors.description = "Election description is required";
    }
    if (!formData.startDate) {
      newErrors.startDate = "Start date is required";
    }
    if (!formData.endDate) {
      newErrors.endDate = "End date is required";
    }

    // Date validation
    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      const now = new Date();

      if (start < now) {
        newErrors.startDate = "Start date cannot be in the past";
      }
      if (end <= start) {
        newErrors.endDate = "End date must be after start date";
      }
    }

    // Candidate validation
    let validCandidates = 0;
    formData.candidates.forEach((candidate) => {
      if (!candidate.name.trim()) {
        newErrors[`candidate-${candidate.id}-name`] = "Candidate name is required";
      } else {
        validCandidates++;
      }
      if (!candidate.description.trim()) {
        newErrors[`candidate-${candidate.id}-description`] =
          "Candidate description is required";
      }
    });

    if (validCandidates < 2) {
      newErrors.candidates = "At least 2 valid candidates are required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await onSubmit(formData);
    } catch (error) {
      console.error("Error creating election:", error);
    }
  };

  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30); // At least 30 minutes from now
    return now.toISOString().slice(0, 16);
  };

  const getMinEndDateTime = () => {
    if (formData.startDate) {
      const start = new Date(formData.startDate);
      start.setHours(start.getHours() + 1); // At least 1 hour after start
      return start.toISOString().slice(0, 16);
    }
    return getMinDateTime();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        ></div>

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full sm:p-6">
          <form onSubmit={handleSubmit}>
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Create New Election
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="bg-white rounded-md text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="mt-1 text-sm text-gray-600">
                Create a secure blockchain-based election for your organization.
              </p>
            </div>

            {/* Election Details */}
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6">
                {/* Title */}
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                    Election Title *
                  </label>
                  <input
                    type="text"
                    name="title"
                    id="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="e.g., Student Council President Election 2024"
                  />
                  {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                    Election Description *
                  </label>
                  <textarea
                    name="description"
                    id="description"
                    rows={3}
                    value={formData.description}
                    onChange={handleInputChange}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Provide details about the election, voting process, and any important information for voters..."
                  />
                  {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description}</p>}
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">
                      Start Date & Time *
                    </label>
                    <input
                      type="datetime-local"
                      name="startDate"
                      id="startDate"
                      value={formData.startDate}
                      onChange={handleInputChange}
                      min={getMinDateTime()}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                    {errors.startDate && <p className="mt-1 text-sm text-red-600">{errors.startDate}</p>}
                  </div>

                  <div>
                    <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">
                      End Date & Time *
                    </label>
                    <input
                      type="datetime-local"
                      name="endDate"
                      id="endDate"
                      value={formData.endDate}
                      onChange={handleInputChange}
                      min={getMinEndDateTime()}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                    {errors.endDate && <p className="mt-1 text-sm text-red-600">{errors.endDate}</p>}
                  </div>
                </div>
              </div>

              {/* Candidates Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-md font-medium text-gray-900">Candidates</h4>
                  <button
                    type="button"
                    onClick={addCandidate}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md text-sm font-medium"
                  >
                    Add Candidate
                  </button>
                </div>

                <div className="space-y-4">
                  {formData.candidates.map((candidate, index) => (
                    <div key={candidate.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-4">
                        <h5 className="text-sm font-medium text-gray-900">
                          Candidate {index + 1}
                        </h5>
                        {formData.candidates.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeCandidate(candidate.id)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Name *
                          </label>
                          <input
                            type="text"
                            value={candidate.name}
                            onChange={(e) =>
                              handleCandidateChange(candidate.id, "name", e.target.value)
                            }
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            placeholder="Candidate full name"
                          />
                          {errors[`candidate-${candidate.id}-name`] && (
                            <p className="mt-1 text-sm text-red-600">
                              {errors[`candidate-${candidate.id}-name`]}
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            Description *
                          </label>
                          <textarea
                            rows={2}
                            value={candidate.description}
                            onChange={(e) =>
                              handleCandidateChange(candidate.id, "description", e.target.value)
                            }
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            placeholder="Brief description or platform"
                          />
                          {errors[`candidate-${candidate.id}-description`] && (
                            <p className="mt-1 text-sm text-red-600">
                              {errors[`candidate-${candidate.id}-description`]}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {errors.candidates && (
                  <p className="mt-1 text-sm text-red-600">{errors.candidates}</p>
                )}
              </div>

              {/* Security Notice */}
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800">
                      Blockchain Security
                    </h3>
                    <div className="mt-2 text-sm text-blue-700">
                      <p>
                        Your election will be secured using blockchain technology with cryptographic
                        signatures and immutable vote recording. Once created, election details
                        cannot be modified for security reasons.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2 px-4 rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {isLoading ? "Creating..." : "Create Election"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
