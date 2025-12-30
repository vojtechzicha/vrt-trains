'use client';

import { useState } from 'react';
import { ShortTurnSuggestion, Station } from '@/types';
import { Button, Input } from '@/components/ui';

interface ShortTurnSuggestionCardProps {
  suggestion: ShortTurnSuggestion;
  stations: Station[];
  confirmed: boolean;
  onConfirm: (code: string, name: string) => void;
  onSkip: () => void;
}

export function ShortTurnSuggestionCard({
  suggestion,
  stations,
  confirmed,
  onConfirm,
  onSkip,
}: ShortTurnSuggestionCardProps) {
  const [code, setCode] = useState(suggestion.suggestedCode);
  const [name, setName] = useState(suggestion.suggestedName);

  const startStation = stations.find((s) => s.id === suggestion.startStationId);
  const endStation = stations.find((s) => s.id === suggestion.endStationId);

  const purposeLabel =
    suggestion.purpose === 'morning-starter'
      ? 'Morning Starter'
      : 'Evening Terminator';

  const directionLabel = suggestion.direction === 'outbound' ? 'Outbound' : 'Inbound';

  if (confirmed) {
    return (
      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-green-700">
              <span>&#10003;</span>
              <span className="font-medium">{purposeLabel} ({directionLabel})</span>
            </div>
            <div className="text-sm text-green-600 mt-1">
              {startStation?.name || suggestion.startStationId} →{' '}
              {endStation?.name || suggestion.endStationId}
            </div>
            <div className="text-sm font-mono text-green-600 mt-1">
              Code: {code} | Name: {name}
            </div>
          </div>
          <Button variant="secondary" onClick={onSkip}>
            Undo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="font-medium text-amber-800">
            {purposeLabel} ({directionLabel})
          </div>
          <div className="text-sm text-amber-700 mt-1">
            {startStation?.name || suggestion.startStationId} →{' '}
            {endStation?.name || suggestion.endStationId}
          </div>
          <div className="text-sm text-amber-600 mt-1">
            {suggestion.trainsNeeded} trains, {suggestion.timeRange.start} -{' '}
            {suggestion.timeRange.end} at anchor
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 mb-3">
        <Input
          label="Variant Code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="e.g., Spr1-am"
        />
        <Input
          label="Variant Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Spr1 Morning"
        />
      </div>

      <div className="flex items-center gap-2 justify-end">
        <Button variant="secondary" onClick={onSkip}>
          Skip
        </Button>
        <Button onClick={() => onConfirm(code, name)} disabled={!code.trim() || !name.trim()}>
          Create Variant
        </Button>
      </div>
    </div>
  );
}
