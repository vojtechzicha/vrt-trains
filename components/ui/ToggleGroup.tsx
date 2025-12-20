'use client';

interface ToggleOption {
  value: string;
  label: string;
}

interface Preset {
  label: string;
  values: string[];
}

interface ToggleGroupProps {
  label?: string;
  options: ToggleOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  presets?: Preset[];
}

export function ToggleGroup({
  label,
  options,
  selected,
  onChange,
  presets,
}: ToggleGroupProps) {
  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const applyPreset = (preset: Preset) => {
    onChange(preset.values);
  };

  const isPresetActive = (preset: Preset) => {
    return (
      preset.values.length === selected.length &&
      preset.values.every((v) => selected.includes(v))
    );
  };

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}

      {presets && presets.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => applyPreset(preset)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                isPresetActive(preset)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => toggle(option.value)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
              selected.includes(option.value)
                ? 'bg-blue-50 border-blue-500 text-blue-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
