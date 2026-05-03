'use client';

import { useState, useMemo } from 'react';
import { OperatingDay, Direction } from '@/types';
import { Button, Input } from '@/components/ui';
import { OperatingDaysSelector } from './OperatingDaysSelector';
import { calculateCoreNumber, formatTrainNumber } from '@/lib/trainNumbers';

interface TimetableGeneratorProps {
  onGenerate: (params: {
    firstDeparture: string;
    interval: number;
    endTime: string;
    operatingDays: OperatingDay[];
    trainNumberPrefix: string;
    startBaseNumber: number;
    clearExisting: boolean;
  }) => Promise<void>;
  defaultPrefix: string;
  direction: Direction;
  generating?: boolean;
}

export function TimetableGenerator({
  onGenerate,
  defaultPrefix,
  direction,
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
  const [startBaseNumber, setStartBaseNumber] = useState(100);
  const [clearExisting, setClearExisting] = useState(true);

  async function handleGenerate() {
    await onGenerate({
      firstDeparture,
      interval,
      endTime,
      operatingDays,
      trainNumberPrefix,
      startBaseNumber,
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

  // Preview first few train numbers
  const previewNumbers = useMemo(() => {
    const numbers: string[] = [];
    for (let i = 0; i < Math.min(3, trainCount); i++) {
      const base = startBaseNumber + (i * 2); // Increment by 2 for each train
      const core = calculateCoreNumber(base, direction);
      numbers.push(formatTrainNumber(trainNumberPrefix, core));
    }
    return numbers;
  }, [trainNumberPrefix, startBaseNumber, direction, trainCount]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            First Departure
          </label>
          <input
            type="time"
            value={firstDeparture}
            onChange={(e) => setFirstDeparture(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Interval (minutes)
          </label>
          <input
            type="number"
            value={interval}
            onChange={(e) => setInterval(parseInt(e.target.value) || 60)}
            min={5}
            max={240}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            End Time
          </label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Input
          label="Train Number Prefix"
          value={trainNumberPrefix}
          onChange={(e) => setTrainNumberPrefix(e.target.value)}
          placeholder="Ex"
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Start Base Number
          </label>
          <input
            type="number"
            value={startBaseNumber}
            onChange={(e) => setStartBaseNumber(parseInt(e.target.value) || 100)}
            min={1}
            max={9999}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {trainCount > 0 && trainNumberPrefix && (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          <span>Numbers: </span>
          <span className="font-mono">
            {previewNumbers.join(', ')}
            {trainCount > 3 && '...'}
          </span>
          <span className="text-xs ml-2">
            ({direction === 'outbound' ? 'odd' : 'even'} numbers)
          </span>
        </div>
      )}

      <OperatingDaysSelector value={operatingDays} onChange={setOperatingDays} />

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="clearExisting"
          checked={clearExisting}
          onChange={(e) => setClearExisting(e.target.checked)}
          className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
        />
        <label htmlFor="clearExisting" className="text-sm text-gray-700 dark:text-gray-300">
          Clear existing timetables before generating
        </label>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Will generate <strong>{trainCount}</strong> train{trainCount !== 1 ? 's' : ''}
        </div>
        <Button onClick={handleGenerate} disabled={generating || trainCount === 0 || !trainNumberPrefix}>
          {generating ? 'Generating...' : `Generate ${trainCount} Timetables`}
        </Button>
      </div>
    </div>
  );
}
