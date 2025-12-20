'use client';

import { OperatingDay } from '@/types';
import { ToggleGroup } from '@/components/ui';

const dayOptions = [
  { value: 'monday', label: 'Mon' },
  { value: 'tuesday', label: 'Tue' },
  { value: 'wednesday', label: 'Wed' },
  { value: 'thursday', label: 'Thu' },
  { value: 'friday', label: 'Fri' },
  { value: 'saturday', label: 'Sat' },
  { value: 'sunday', label: 'Sun' },
];

const presets = [
  {
    label: 'All Days',
    values: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
  },
  {
    label: 'Weekdays',
    values: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  },
  {
    label: 'Weekends',
    values: ['saturday', 'sunday'],
  },
];

interface OperatingDaysSelectorProps {
  value: OperatingDay[];
  onChange: (days: OperatingDay[]) => void;
  label?: string;
}

export function OperatingDaysSelector({
  value,
  onChange,
  label = 'Operating Days',
}: OperatingDaysSelectorProps) {
  return (
    <ToggleGroup
      label={label}
      options={dayOptions}
      selected={value as string[]}
      onChange={(selected) => onChange(selected as OperatingDay[])}
      presets={presets}
    />
  );
}
