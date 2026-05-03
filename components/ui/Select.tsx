'use client';

import { useState, useRef, useEffect, KeyboardEvent } from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  label?: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchable?: boolean;
  error?: string;
  disabled?: boolean;
}

export function Select({
  label,
  options,
  value,
  onChange,
  placeholder = 'Select...',
  searchable = false,
  error,
  disabled = false,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  const filteredOptions = searchable && search
    ? options.filter((o) =>
        o.label.toLowerCase().includes(search.toLowerCase())
      )
    : options;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchable && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, searchable]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [search, isOpen]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        if (isOpen && filteredOptions[highlightedIndex]) {
          onChange(filteredOptions[highlightedIndex].value);
          setIsOpen(false);
          setSearch('');
        } else {
          setIsOpen(true);
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setHighlightedIndex((i) =>
            i < filteredOptions.length - 1 ? i + 1 : i
          );
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((i) => (i > 0 ? i - 1 : i));
        break;
      case 'Escape':
        setIsOpen(false);
        setSearch('');
        break;
    }
  };

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
          onClick={() => !disabled && setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className={`
            w-full px-3 py-2 text-sm text-left rounded-lg border
            focus:outline-none focus:ring-2 focus:ring-blue-500
            disabled:bg-gray-50 dark:disabled:bg-gray-950 disabled:cursor-not-allowed
            ${error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}
            ${isOpen ? 'ring-2 ring-blue-500' : ''}
          `}
        >
          <span className={selectedOption ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}>
            {selectedOption?.label || placeholder}
          </span>
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
            ▼
          </span>
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-auto">
            {searchable && (
              <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search..."
                  className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No options</div>
            ) : (
              filteredOptions.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`
                    w-full px-3 py-2 text-sm text-left
                    ${option.value === value ? 'bg-blue-50 text-blue-700' : 'text-gray-900 dark:text-gray-100'}
                    ${index === highlightedIndex ? 'bg-gray-100 dark:bg-gray-800' : ''}
                    hover:bg-gray-100 dark:hover:bg-gray-800
                  `}
                >
                  {option.label}
                </button>
              ))
            )}
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
