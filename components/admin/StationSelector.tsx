'use client';

import { useState, useEffect, useRef, KeyboardEvent, useMemo } from 'react';
import { Station } from '@/types';
import { smartMatchStation } from '@/lib/search/smartSearch';

interface StationSelectorProps {
  stations: Station[];
  value: string | null;
  onChange: (stationId: string) => void;
  placeholder?: string;
  excludeIds?: string[];
  autoFocus?: boolean;
}

export function StationSelector({
  stations,
  value,
  onChange,
  placeholder = 'Select station...',
  excludeIds = [],
  autoFocus = false,
}: StationSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedStation = stations.find((s) => s.id === value);

  const filteredStations = useMemo(
    () =>
      stations
        .filter((s) => !excludeIds.includes(s.id))
        .filter((s) => smartMatchStation(search, s)),
    [stations, excludeIds, search]
  );

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
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [search]);

  useEffect(() => {
    if (autoFocus) {
      setIsOpen(true);
    }
  }, [autoFocus]);

  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        if (isOpen && filteredStations[highlightedIndex]) {
          onChange(filteredStations[highlightedIndex].id);
          setIsOpen(false);
          setSearch('');
        } else if (!isOpen) {
          setIsOpen(true);
        }
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setHighlightedIndex((i) =>
            i < filteredStations.length - 1 ? i + 1 : i
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
      case 'Tab':
        if (isOpen && filteredStations[highlightedIndex]) {
          onChange(filteredStations[highlightedIndex].id);
          setIsOpen(false);
          setSearch('');
        }
        break;
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3 py-2 text-sm text-left rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          isOpen ? 'ring-2 ring-blue-500' : ''
        }`}
      >
        {selectedStation ? (
          <span>
            <span className="font-mono text-gray-500 dark:text-gray-400 mr-2">{selectedStation.code}</span>
            {selectedStation.name}
          </span>
        ) : (
          <span className="text-gray-400 dark:text-gray-500">{placeholder}</span>
        )}
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-auto">
          <div className="p-2 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-900">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search (try 'p h n')..."
              className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          {filteredStations.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No stations found</div>
          ) : (
            filteredStations.map((station, index) => (
              <button
                key={station.id}
                type="button"
                onClick={() => {
                  onChange(station.id);
                  setIsOpen(false);
                  setSearch('');
                }}
                className={`w-full px-3 py-2 text-sm text-left flex items-center gap-2 ${
                  station.id === value ? 'bg-blue-50 text-blue-700' : 'text-gray-900 dark:text-gray-100'
                } ${index === highlightedIndex ? 'bg-gray-100 dark:bg-gray-800' : ''} hover:bg-gray-100 dark:hover:bg-gray-800`}
              >
                <span className="font-mono text-gray-500 dark:text-gray-400 w-10">{station.code}</span>
                <span>{station.name}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
