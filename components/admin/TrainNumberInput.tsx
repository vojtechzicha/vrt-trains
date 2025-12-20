'use client';

import { Direction } from '@/types';
import { calculateCoreNumber, formatTrainNumber } from '@/lib/trainNumbers';

interface TrainNumberInputProps {
  prefix: string;
  onPrefixChange: (prefix: string) => void;
  baseNumber: number;
  onBaseNumberChange: (baseNumber: number) => void;
  direction: Direction;
  error?: string;
  disabled?: boolean;
  label?: string;
}

export function TrainNumberInput({
  prefix,
  onPrefixChange,
  baseNumber,
  onBaseNumberChange,
  direction,
  error,
  disabled,
  label = 'Train Number',
}: TrainNumberInputProps) {
  const coreNumber = calculateCoreNumber(baseNumber, direction);
  const displayNumber = formatTrainNumber(prefix, coreNumber);

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="flex gap-2 items-center">
        <input
          type="text"
          value={prefix}
          onChange={(e) => onPrefixChange(e.target.value)}
          placeholder="Ex"
          disabled={disabled}
          className={`
            w-20 px-3 py-2 text-sm rounded-lg border
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            disabled:bg-gray-50 disabled:text-gray-500
            ${error ? 'border-red-500' : 'border-gray-300'}
          `}
        />
        <input
          type="number"
          value={baseNumber}
          onChange={(e) => onBaseNumberChange(parseInt(e.target.value) || 1)}
          min={1}
          max={9999}
          disabled={disabled}
          className={`
            w-24 px-3 py-2 text-sm rounded-lg border
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
            disabled:bg-gray-50 disabled:text-gray-500
            ${error ? 'border-red-500' : 'border-gray-300'}
          `}
        />
        <span className="text-gray-400">→</span>
        <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm font-mono min-w-[80px]">
          {displayNumber || '—'}
        </div>
        <span className="text-xs text-gray-500">
          ({direction === 'outbound' ? 'odd' : 'even'})
        </span>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
