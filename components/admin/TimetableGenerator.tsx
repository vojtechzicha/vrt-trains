'use client';

import { useState } from 'react';
import { OperatingDay } from '@/types';
import { Button, Input } from '@/components/ui';
import { OperatingDaysSelector } from './OperatingDaysSelector';

interface TimetableGeneratorProps {
  onGenerate: (params: {
    firstDeparture: string;
    interval: number;
    endTime: string;
    operatingDays: OperatingDay[];
    trainNumberPrefix: string;
    clearExisting: boolean;
  }) => Promise<void>;
  defaultPrefix: string;
  generating?: boolean;
}

export function TimetableGenerator({
  onGenerate,
  defaultPrefix,
  generating = false,
}: TimetableGeneratorProps) {
  const [firstDeparture, setFirstDeparture] = useState('06:00');
  const [interval, setInterval] = useState(60);
  const [endTime, setEndTime] = useState('22:00');
  const [operatingDays, setOperatingDays] = useState<OperatingDay[]>([
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ]);
  const [trainNumberPrefix, setTrainNumberPrefix] = useState(defaultPrefix);
  const [clearExisting, setClearExisting] = useState(true);

  async function handleGenerate() {
    await onGenerate({
      firstDeparture,
      interval,
      endTime,
      operatingDays,
      trainNumberPrefix,
      clearExisting,
    });
  }

  // Calculate preview of number of trains
  const calculateTrainCount = () => {
    const [startH, startM] = firstDeparture.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    if (endMinutes <= startMinutes || interval <= 0) return 0;
    return Math.floor((endMinutes - startMinutes) / interval) + 1;
  };

  const trainCount = calculateTrainCount();

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
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
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Interval (minutes)
          </label>
          <input
            type="number"
            value={interval}
            onChange={(e) => setInterval(parseInt(e.target.value) || 60)}
            min={5}
            max={240}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            End Time
          </label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <Input
          label="Train Number Prefix"
          value={trainNumberPrefix}
          onChange={(e) => setTrainNumberPrefix(e.target.value)}
          placeholder="SPR"
        />
      </div>

      <OperatingDaysSelector value={operatingDays} onChange={setOperatingDays} />

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="clearExisting"
          checked={clearExisting}
          onChange={(e) => setClearExisting(e.target.checked)}
          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
        <label htmlFor="clearExisting" className="text-sm text-gray-700">
          Clear existing timetables before generating
        </label>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-gray-200">
        <div className="text-sm text-gray-500">
          Will generate <strong>{trainCount}</strong> train{trainCount !== 1 ? 's' : ''}
        </div>
        <Button onClick={handleGenerate} disabled={generating || trainCount === 0}>
          {generating ? 'Generating...' : `Generate ${trainCount} Timetables`}
        </Button>
      </div>
    </div>
  );
}
