'use client';

import { forwardRef } from 'react';

interface NumberInputProps {
  label?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  (
    {
      label,
      value,
      onChange,
      min,
      max,
      step = 1,
      suffix,
      error,
      disabled = false,
      placeholder,
    },
    ref
  ) => {
    const handleChange = (newValue: number) => {
      if (min !== undefined && newValue < min) newValue = min;
      if (max !== undefined && newValue > max) newValue = max;
      onChange(newValue);
    };

    const increment = () => handleChange(value + step);
    const decrement = () => handleChange(value - step);

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {label}
          </label>
        )}
        <div className="flex items-center">
          <button
            type="button"
            onClick={decrement}
            disabled={disabled || (min !== undefined && value <= min)}
            className="px-3 py-2 border border-r-0 border-gray-300 dark:border-gray-600 rounded-l-lg bg-gray-50 dark:bg-gray-950 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            −
          </button>
          <div className="relative flex-1">
            <input
              ref={ref}
              type="number"
              value={value}
              onChange={(e) => handleChange(Number(e.target.value))}
              min={min}
              max={max}
              step={step}
              disabled={disabled}
              placeholder={placeholder}
              className={`
                w-full px-3 py-2 text-sm text-center border-y
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                disabled:bg-gray-50 dark:disabled:bg-gray-950 disabled:text-gray-500 dark:disabled:text-gray-400
                [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
                ${error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}
                ${suffix ? 'pr-10' : ''}
              `}
            />
            {suffix && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 dark:text-gray-400">
                {suffix}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={increment}
            disabled={disabled || (max !== undefined && value >= max)}
            className="px-3 py-2 border border-l-0 border-gray-300 dark:border-gray-600 rounded-r-lg bg-gray-50 dark:bg-gray-950 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            +
          </button>
        </div>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    );
  }
);

NumberInput.displayName = 'NumberInput';
