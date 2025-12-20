'use client';

import { useState, useEffect } from 'react';
import { Timetable, Variant, OperatingDay, TimetableDeparture } from '@/types';
import { Button } from '@/components/ui';
import { TrainNumberInput } from './TrainNumberInput';
import { OperatingDaysSelector } from './OperatingDaysSelector';
import { parseTrainNumber, calculateCoreNumber, formatTrainNumber, extractBaseNumber } from '@/lib/trainNumbers';

interface TimetableEditModalProps {
  timetable: Timetable;
  variant: Variant;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, updates: Partial<Timetable>) => Promise<void>;
}

export function TimetableEditModal({
  timetable,
  variant,
  isOpen,
  onClose,
  onSave,
}: TimetableEditModalProps) {
  // Parse existing train number
  const parsed = parseTrainNumber(timetable.trainNumber);
  const initialPrefix = parsed?.prefix || '';
  const initialBaseNumber = parsed
    ? extractBaseNumber(parsed.coreNumber, variant.direction)
    : 1;

  const [prefix, setPrefix] = useState(initialPrefix);
  const [baseNumber, setBaseNumber] = useState(initialBaseNumber);
  const [firstDeparture, setFirstDeparture] = useState(
    timetable.departures[0]?.departure || '06:00'
  );
  const [operatingDays, setOperatingDays] = useState<OperatingDay[]>(
    timetable.operatingDays
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens with different timetable
  useEffect(() => {
    if (isOpen) {
      const parsed = parseTrainNumber(timetable.trainNumber);
      setPrefix(parsed?.prefix || '');
      setBaseNumber(
        parsed ? extractBaseNumber(parsed.coreNumber, variant.direction) : 1
      );
      setFirstDeparture(timetable.departures[0]?.departure || '06:00');
      setOperatingDays(timetable.operatingDays);
      setError(null);
    }
  }, [isOpen, timetable, variant.direction]);

  function recalculateDepartures(newFirstDeparture: string): TimetableDeparture[] {
    const [hours, mins] = newFirstDeparture.split(':').map(Number);
    const baseMinutes = hours * 60 + mins;

    return variant.stations.map((stop) => {
      const arrivalMinutes =
        stop.arrivalOffset !== null ? baseMinutes + stop.arrivalOffset : null;
      const departureMinutes =
        stop.departureOffset !== null ? baseMinutes + stop.departureOffset : null;

      const formatTime = (minutes: number | null) => {
        if (minutes === null) return null;
        const h = Math.floor(minutes / 60) % 24;
        const m = minutes % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      };

      return {
        stationId: stop.stationId,
        arrival: formatTime(arrivalMinutes),
        departure: formatTime(departureMinutes),
      };
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    const coreNumber = calculateCoreNumber(baseNumber, variant.direction);
    const newTrainNumber = formatTrainNumber(prefix, coreNumber);

    try {
      await onSave(timetable.id, {
        trainNumber: newTrainNumber,
        operatingDays,
        departures: recalculateDepartures(firstDeparture),
      });
      onClose();
    } catch (err: unknown) {
      const apiError = err as { code?: string; message?: string };
      if (apiError.code === 'DUPLICATE_TRAIN_NUMBER') {
        setError('This train number is already in use');
      } else {
        setError('Failed to save changes');
      }
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <h2 className="text-lg font-semibold mb-4">Edit Train</h2>

        <div className="space-y-4">
          <TrainNumberInput
            prefix={prefix}
            onPrefixChange={setPrefix}
            baseNumber={baseNumber}
            onBaseNumberChange={setBaseNumber}
            direction={variant.direction}
            error={error && error.includes('number') ? error : undefined}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Departure
            </label>
            <input
              type="time"
              value={firstDeparture}
              onChange={(e) => setFirstDeparture(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <OperatingDaysSelector
            value={operatingDays}
            onChange={setOperatingDays}
          />
        </div>

        {error && !error.includes('number') && (
          <p className="mt-3 text-sm text-red-600">{error}</p>
        )}

        <div className="flex gap-2 mt-6">
          <Button onClick={handleSave} disabled={saving || !prefix}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
