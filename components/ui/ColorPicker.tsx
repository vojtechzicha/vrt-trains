'use client';

import { useState, useRef, useEffect } from 'react';

interface ColorPickerProps {
  label?: string;
  value: string;
  onChange: (color: string) => void;
  presets?: string[];
}

const defaultPresets = [
  '#E31E24', // Red
  '#0066B3', // Blue
  '#00A651', // Green
  '#8E44AD', // Purple
  '#F39C12', // Orange
  '#1ABC9C', // Teal
  '#E91E63', // Pink
  '#795548', // Brown
  '#607D8B', // Blue Grey
  '#000000', // Black
];

export function ColorPicker({
  label,
  value,
  onChange,
  presets = defaultPresets,
}: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="w-full" ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-3 py-2 text-sm text-left rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center gap-2"
        >
          <span
            className="w-6 h-6 rounded border border-gray-300 dark:border-gray-600"
            style={{ backgroundColor: value }}
          />
          <span className="font-mono text-gray-600 dark:text-gray-400">{value.toUpperCase()}</span>
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
            <div className="grid grid-cols-5 gap-2 mb-3">
              {presets.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => {
                    onChange(color);
                    setIsOpen(false);
                  }}
                  className={`w-8 h-8 rounded border-2 transition-transform hover:scale-110 ${
                    value === color ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer"
              />
              <input
                type="text"
                value={value}
                onChange={(e) => {
                  const val = e.target.value;
                  if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                    onChange(val);
                  }
                }}
                placeholder="#000000"
                className="flex-1 px-2 py-1 text-sm font-mono border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
