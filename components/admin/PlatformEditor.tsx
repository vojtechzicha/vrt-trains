'use client';

import { useState } from 'react';
import { Platform } from '@/types';
import { validatePlatformCodes } from '@/lib/platforms/helpers';

interface PlatformEditorProps {
  platforms: Platform[];
  onChange: (platforms: Platform[]) => void;
}

export function PlatformEditor({ platforms, onChange }: PlatformEditorProps) {
  const [error, setError] = useState<string | null>(null);

  const handleAddPlatform = () => {
    // Generate next sequential code
    const existingNums = platforms
      .map((p) => parseInt(p.code, 10))
      .filter((n) => !isNaN(n));
    const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1;

    const newPlatforms = [
      ...platforms,
      { code: String(nextNum), name: '', isBay: false },
    ];
    onChange(newPlatforms);
    setError(null);
  };

  const handleRemovePlatform = (index: number) => {
    const newPlatforms = platforms.filter((_, i) => i !== index);
    onChange(newPlatforms);
    setError(null);
  };

  const handleUpdatePlatform = (index: number, updates: Partial<Platform>) => {
    const newPlatforms = [...platforms];
    newPlatforms[index] = { ...newPlatforms[index], ...updates };

    // Validate
    const validationError = validatePlatformCodes(newPlatforms);
    setError(validationError);

    onChange(newPlatforms);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Platforms ({platforms.length})
        </label>
        <button
          type="button"
          onClick={handleAddPlatform}
          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
        >
          + Add Platform
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="space-y-2">
        {platforms.map((platform, index) => (
          <div
            key={index}
            className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
          >
            {/* Code input */}
            <div className="w-16">
              <input
                type="text"
                value={platform.code}
                onChange={(e) =>
                  handleUpdatePlatform(index, { code: e.target.value })
                }
                placeholder="1"
                className="w-full px-2 py-1.5 text-sm text-center border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <span className="block text-xs text-gray-400 text-center mt-0.5">
                Code
              </span>
            </div>

            {/* Name input */}
            <div className="flex-1">
              <input
                type="text"
                value={platform.name}
                onChange={(e) =>
                  handleUpdatePlatform(index, { name: e.target.value })
                }
                placeholder="e.g., to Ostrava"
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <span className="block text-xs text-gray-400 mt-0.5">
                Name (optional)
              </span>
            </div>

            {/* Bay checkbox */}
            <label className="flex items-center gap-2 cursor-pointer px-2">
              <input
                type="checkbox"
                checked={platform.isBay}
                onChange={(e) =>
                  handleUpdatePlatform(index, { isBay: e.target.checked })
                }
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm text-gray-600">Bay</span>
            </label>

            {/* Remove button */}
            <button
              type="button"
              onClick={() => handleRemovePlatform(index)}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
              title="Remove platform"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        ))}

        {platforms.length === 0 && (
          <p className="text-sm text-gray-500 italic py-4 text-center bg-gray-50 rounded-lg">
            No platforms defined. Click &quot;Add Platform&quot; to add one.
          </p>
        )}
      </div>
    </div>
  );
}
