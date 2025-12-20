'use client';

import { useState, useEffect, useMemo } from 'react';
import { Variant, Station, Timetable, Direction } from '@/types';
import { Button } from '@/components/ui';

interface BulkTimeAdjustModalProps {
  isOpen: boolean;
  onClose: () => void;
  variants: Variant[];
  stations: Station[];
  onApply: () => void;
}

interface TimetablePreview {
  trainNumber: string;
  currentTime: string;
  newTime: string;
  isOvernight: boolean;
}

function addMinutesToTime(time: string, minutes: number): string {
  const [hours, mins] = time.split(':').map(Number);
  let totalMinutes = hours * 60 + mins + minutes;
  // Normalize to [0, 1440) range for proper midnight handling
  totalMinutes = ((totalMinutes % 1440) + 1440) % 1440;
  const newHours = Math.floor(totalMinutes / 60);
  const newMins = totalMinutes % 60;
  return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`;
}

function isOvernightTransition(oldTime: string, newTime: string): boolean {
  const oldMinutes = parseInt(oldTime.split(':')[0]) * 60 + parseInt(oldTime.split(':')[1]);
  const newMinutes = parseInt(newTime.split(':')[0]) * 60 + parseInt(newTime.split(':')[1]);
  // Overnight if we cross midnight (large jump in either direction)
  return Math.abs(oldMinutes - newMinutes) > 720;
}

export function BulkTimeAdjustModal({
  isOpen,
  onClose,
  variants,
  stations,
  onApply,
}: BulkTimeAdjustModalProps) {
  const [selectedStationId, setSelectedStationId] = useState<string>('');
  const [direction, setDirection] = useState<Direction>('inbound');
  const [offsetAmount, setOffsetAmount] = useState<number>(5);
  const [offsetDirection, setOffsetDirection] = useState<'forward' | 'back'>('forward');
  const [timetables, setTimetables] = useState<Timetable[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get unique stations that appear in any variant of this line
  const availableStations = useMemo(() => {
    const stationIds = new Set<string>();
    variants.forEach((v) => {
      v.stations.forEach((s) => stationIds.add(s.stationId));
    });
    return stations
      .filter((s) => stationIds.has(s.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [variants, stations]);

  // Filter variants by direction and containing selected station
  const affectedVariants = useMemo(() => {
    if (!selectedStationId) return [];
    return variants.filter((v) => {
      if (v.direction !== direction) return false;
      return v.stations.some((s) => s.stationId === selectedStationId);
    });
  }, [variants, selectedStationId, direction]);

  // Fetch timetables when affected variants change
  useEffect(() => {
    if (affectedVariants.length === 0) {
      setTimetables([]);
      return;
    }

    const variantIds = affectedVariants.map((v) => v.id);
    setLoading(true);

    fetch(`/api/admin/timetables?variantIds=${variantIds.join(',')}`)
      .then((res) => res.json())
      .then((data) => {
        setTimetables(data);
        setLoading(false);
      })
      .catch(() => {
        setTimetables([]);
        setLoading(false);
      });
  }, [affectedVariants]);

  // Calculate preview
  const previews = useMemo((): TimetablePreview[] => {
    if (!selectedStationId || timetables.length === 0) return [];

    const offsetMinutes = offsetDirection === 'forward' ? offsetAmount : -offsetAmount;

    return timetables
      .map((tt) => {
        // Find departure time at selected station
        const stop = tt.departures.find((d) => d.stationId === selectedStationId);
        const currentTime = stop?.departure || stop?.arrival;
        if (!currentTime) return null;

        const newTime = addMinutesToTime(currentTime, offsetMinutes);
        const isOvernight = isOvernightTransition(currentTime, newTime);

        return {
          trainNumber: tt.trainNumber,
          currentTime,
          newTime,
          isOvernight,
        };
      })
      .filter((p): p is TimetablePreview => p !== null)
      .sort((a, b) => a.currentTime.localeCompare(b.currentTime));
  }, [timetables, selectedStationId, offsetAmount, offsetDirection]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedStationId('');
      setDirection('inbound');
      setOffsetAmount(5);
      setOffsetDirection('forward');
      setError(null);
    }
  }, [isOpen]);

  async function handleApply() {
    if (affectedVariants.length === 0) return;

    setApplying(true);
    setError(null);

    const offsetMinutes = offsetDirection === 'forward' ? offsetAmount : -offsetAmount;

    try {
      const res = await fetch('/api/admin/timetables/bulk-offset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variantIds: affectedVariants.map((v) => v.id),
          offsetMinutes,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to apply changes');
      }

      const result = await res.json();
      onApply();
      onClose();
    } catch (err) {
      setError('Failed to apply changes');
    } finally {
      setApplying(false);
    }
  }

  if (!isOpen) return null;

  const offsetMinutes = offsetDirection === 'forward' ? offsetAmount : -offsetAmount;
  const offsetLabel = offsetMinutes > 0 ? `+${offsetMinutes}` : `${offsetMinutes}`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">Bulk Time Adjustment</h2>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Station selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Station
            </label>
            <select
              value={selectedStationId}
              onChange={(e) => setSelectedStationId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a station...</option>
              {availableStations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Direction selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Direction
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="direction"
                  checked={direction === 'inbound'}
                  onChange={() => setDirection('inbound')}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm">Inbound</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="direction"
                  checked={direction === 'outbound'}
                  onChange={() => setDirection('outbound')}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm">Outbound</span>
              </label>
            </div>
          </div>

          {/* Offset amount and direction */}
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Offset (minutes)
              </label>
              <input
                type="number"
                min={1}
                max={120}
                value={offsetAmount}
                onChange={(e) => setOffsetAmount(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-4 pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="offsetDirection"
                  checked={offsetDirection === 'forward'}
                  onChange={() => setOffsetDirection('forward')}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm">Forward</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="offsetDirection"
                  checked={offsetDirection === 'back'}
                  onChange={() => setOffsetDirection('back')}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm">Back</span>
              </label>
            </div>
          </div>

          {/* Preview section */}
          <div className="border-t pt-4 mt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              Affected Trains ({previews.length})
            </h3>

            {loading ? (
              <p className="text-sm text-gray-500 py-4">Loading...</p>
            ) : previews.length === 0 ? (
              <p className="text-sm text-gray-500 py-4">
                {selectedStationId
                  ? 'No trains found for this station and direction'
                  : 'Select a station to see affected trains'}
              </p>
            ) : (
              <div className="max-h-64 overflow-y-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-gray-700">Train</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-700">At Station</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-700">All Times</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {previews.map((p) => (
                      <tr key={p.trainNumber} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-mono">{p.trainNumber}</td>
                        <td className="px-3 py-2">
                          <span className="text-gray-500">{p.currentTime}</span>
                          <span className="mx-2">→</span>
                          <span className="font-medium">{p.newTime}</span>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`text-sm ${offsetMinutes > 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                            {offsetLabel} min
                          </span>
                          {p.isOvernight && (
                            <span className="ml-2 text-xs text-amber-600">(overnight)</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>

        <div className="p-6 border-t flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={applying || previews.length === 0}
          >
            {applying ? 'Applying...' : `Apply to ${previews.length} trains`}
          </Button>
        </div>
      </div>
    </div>
  );
}
