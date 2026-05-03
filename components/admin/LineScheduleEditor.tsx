'use client';

import { useState, useEffect, useMemo } from 'react';
import { Line, Variant, OperatingPattern, LineSchedule, ShortTurnSuggestion, Station } from '@/types';
import { Button, Input, Select, Card, CardBody, CardHeader } from '@/components/ui';
import { PatternEditor } from './PatternEditor';
import { ShortTurnSuggestionCard } from './ShortTurnSuggestionCard';
import { calculateCoreNumber, formatTrainNumber } from '@/lib/trainNumbers';

interface LineScheduleEditorProps {
  line: Line;
  variants: Variant[];
  stations: Station[];
  initialSchedule?: LineSchedule;
  patterns: OperatingPattern[];
  onSave: (schedule: Omit<LineSchedule, 'id'>) => Promise<LineSchedule>;
  onGenerate: (scheduleId: string, options: GenerateOptions) => Promise<{ success: boolean; generated: { total: number } }>;
  onAnalyze: (scheduleId: string) => Promise<AnalysisResult>;
  onCreatePattern: (pattern: Omit<OperatingPattern, 'id'>) => Promise<OperatingPattern>;
}

interface GenerateOptions {
  clearExisting: boolean;
  shortTurnVariants?: {
    outboundMorningId?: string;
    inboundMorningId?: string;
    outboundEveningId?: string;
    inboundEveningId?: string;
  };
}

interface AnalysisResult {
  suggestions: ShortTurnSuggestion[];
  coverage: {
    outbound: { firstAnchorTime: string; lastAnchorTime: string };
    inbound: { firstAnchorTime: string; lastAnchorTime: string };
  };
  trainCounts: {
    fullOutbound: number;
    fullInbound: number;
    shortTurnOutbound: number;
    shortTurnInbound: number;
    total: number;
  };
  departurePreview: {
    outbound: string[];
    inbound: string[];
  };
}

export function LineScheduleEditor({
  line,
  variants,
  stations,
  initialSchedule,
  patterns,
  onSave,
  onGenerate,
  onAnalyze,
  onCreatePattern,
}: LineScheduleEditorProps) {
  // Form state
  const [name, setName] = useState(initialSchedule?.name || `${line.identifier} Schedule`);
  const [patternId, setPatternId] = useState(initialSchedule?.patternId || '');
  const [outboundVariantId, setOutboundVariantId] = useState(
    initialSchedule?.primaryPair.outboundVariantId || ''
  );
  const [inboundVariantId, setInboundVariantId] = useState(
    initialSchedule?.primaryPair.inboundVariantId || ''
  );
  const [anchorStationId, setAnchorStationId] = useState(
    initialSchedule?.anchorStationId || ''
  );
  const [outboundAnchorMinute, setOutboundAnchorMinute] = useState(
    initialSchedule?.outboundAnchorMinute ?? 0
  );
  const [inboundAnchorMinute, setInboundAnchorMinute] = useState(
    initialSchedule?.inboundAnchorMinute ?? 30
  );
  const [trainNumberPrefix, setTrainNumberPrefix] = useState(
    initialSchedule?.trainNumberPrefix || line.identifier
  );
  const [startBaseNumber, setStartBaseNumber] = useState(
    initialSchedule?.startBaseNumber ?? 101
  );
  const [startingStations, setStartingStations] = useState<string[]>(
    initialSchedule?.shortTurnConfig?.startingStations || []
  );
  const [endingStations, setEndingStations] = useState<string[]>(
    initialSchedule?.shortTurnConfig?.endingStations || []
  );

  // UI state
  const [showPatternEditor, setShowPatternEditor] = useState(false);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [savedScheduleId, setSavedScheduleId] = useState(initialSchedule?.id);
  const [clearExisting, setClearExisting] = useState(true);
  const [confirmedSuggestions, setConfirmedSuggestions] = useState<Set<number>>(new Set());

  // Filter variants by direction
  const outboundVariants = variants.filter((v) => v.direction === 'outbound');
  const inboundVariants = variants.filter((v) => v.direction === 'inbound');

  // Get selected variants
  const outboundVariant = variants.find((v) => v.id === outboundVariantId);
  const inboundVariant = variants.find((v) => v.id === inboundVariantId);

  // Get common stations between both variants (for anchor station selection)
  const commonStations = useMemo(() => {
    if (!outboundVariant || !inboundVariant) return [];
    const outboundStationIds = new Set(outboundVariant.stations.map((s) => s.stationId));
    const inboundStationIds = new Set(inboundVariant.stations.map((s) => s.stationId));
    return stations.filter(
      (s) => outboundStationIds.has(s.id) && inboundStationIds.has(s.id)
    );
  }, [outboundVariant, inboundVariant, stations]);

  // Get stations for short-turn selection (intermediate stations on the route)
  const shortTurnStationOptions = useMemo(() => {
    if (!outboundVariant) return [];
    // Exclude first and last stations
    const stationIds = outboundVariant.stations
      .slice(1, -1)
      .map((s) => s.stationId);
    return stations.filter((s) => stationIds.includes(s.id));
  }, [outboundVariant, stations]);

  // Preview train numbers
  const previewNumbers = useMemo(() => {
    const outbound: string[] = [];
    const inbound: string[] = [];
    for (let i = 0; i < 3; i++) {
      const base = startBaseNumber + i * 2;
      outbound.push(formatTrainNumber(trainNumberPrefix, calculateCoreNumber(base, 'outbound')));
      inbound.push(formatTrainNumber(trainNumberPrefix, calculateCoreNumber(base, 'inbound')));
    }
    return { outbound, inbound };
  }, [trainNumberPrefix, startBaseNumber]);

  // Reset anchor station when variants change
  useEffect(() => {
    if (anchorStationId && !commonStations.find((s) => s.id === anchorStationId)) {
      setAnchorStationId('');
    }
  }, [commonStations, anchorStationId]);

  async function handleSave() {
    setSaving(true);
    try {
      const scheduleData: Omit<LineSchedule, 'id'> = {
        lineId: line.id,
        name,
        patternId,
        primaryPair: {
          outboundVariantId,
          inboundVariantId,
        },
        anchorStationId,
        outboundAnchorMinute,
        inboundAnchorMinute,
        trainNumberPrefix,
        startBaseNumber,
        shortTurnConfig: {
          startingStations,
          endingStations,
          generatedVariants: [],
        },
      };

      const saved = await onSave(scheduleData);
      setSavedScheduleId(saved.id);
    } finally {
      setSaving(false);
    }
  }

  async function handleAnalyze() {
    if (!savedScheduleId) {
      // Save first, then analyze
      await handleSave();
    }
    if (!savedScheduleId) return;

    setAnalyzing(true);
    setAnalysisResult(null);
    setConfirmedSuggestions(new Set());
    try {
      const result = await onAnalyze(savedScheduleId);
      setAnalysisResult(result);
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleGenerate() {
    if (!savedScheduleId) return;

    setGenerating(true);
    try {
      // TODO: Pass confirmed short-turn variant IDs once variant creation is implemented
      const result = await onGenerate(savedScheduleId, { clearExisting });
      if (result.success) {
        alert(`Generated ${result.generated.total} timetables successfully!`);
      }
    } finally {
      setGenerating(false);
    }
  }

  async function handleCreatePattern(patternData: Omit<OperatingPattern, 'id'>) {
    const pattern = await onCreatePattern(patternData);
    setPatternId(pattern.id);
    setShowPatternEditor(false);
  }

  function toggleStartingStation(stationId: string) {
    setStartingStations((prev) =>
      prev.includes(stationId)
        ? prev.filter((id) => id !== stationId)
        : [...prev, stationId]
    );
  }

  function toggleEndingStation(stationId: string) {
    setEndingStations((prev) =>
      prev.includes(stationId)
        ? prev.filter((id) => id !== stationId)
        : [...prev, stationId]
    );
  }

  const isValid =
    name.trim() &&
    patternId &&
    outboundVariantId &&
    inboundVariantId &&
    anchorStationId &&
    trainNumberPrefix;

  const canAnalyze = isValid && (savedScheduleId || !initialSchedule);

  return (
    <div className="space-y-6">
      {/* Pattern Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Pattern</h3>
            <Button variant="secondary" onClick={() => setShowPatternEditor(true)}>
              + New Pattern
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          {showPatternEditor ? (
            <PatternEditor
              onSave={handleCreatePattern}
              onCancel={() => setShowPatternEditor(false)}
            />
          ) : (
            <Select
              label="Operating Pattern"
              value={patternId}
              onChange={setPatternId}
              options={patterns.map((p) => ({
                value: p.id,
                label: `${p.name} (${p.periods.length} period${p.periods.length > 1 ? 's' : ''})`,
              }))}
              placeholder="Select a pattern..."
            />
          )}
        </CardBody>
      </Card>

      {/* Primary Variants Section */}
      <Card>
        <CardHeader>
          <h3 className="font-medium">Primary Variants</h3>
        </CardHeader>
        <CardBody>
          <div className="grid gap-4 md:grid-cols-2">
            <Select
              label="Outbound Variant"
              value={outboundVariantId}
              onChange={setOutboundVariantId}
              options={outboundVariants.map((v) => ({
                value: v.id,
                label: `${v.code} - ${v.name}`,
              }))}
              placeholder="Select outbound variant..."
            />
            <Select
              label="Inbound Variant"
              value={inboundVariantId}
              onChange={setInboundVariantId}
              options={inboundVariants.map((v) => ({
                value: v.id,
                label: `${v.code} - ${v.name}`,
              }))}
              placeholder="Select inbound variant..."
            />
          </div>
        </CardBody>
      </Card>

      {/* Anchor Station Section */}
      <Card>
        <CardHeader>
          <h3 className="font-medium">Anchor Station</h3>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Select a station that appears on both variants. Departure times will be anchored to this station.
          </p>
          <Select
            label="Anchor Station"
            value={anchorStationId}
            onChange={setAnchorStationId}
            options={commonStations.map((s) => ({
              value: s.id,
              label: `${s.name} (${s.code})`,
            }))}
            placeholder="Select anchor station..."
            disabled={commonStations.length === 0}
            searchable
          />

          {anchorStationId && (
            <div className="grid gap-4 md:grid-cols-2 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Outbound departs at minute
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 dark:text-gray-400">:</span>
                  <input
                    type="number"
                    value={outboundAnchorMinute}
                    onChange={(e) =>
                      setOutboundAnchorMinute(
                        Math.max(0, Math.min(59, parseInt(e.target.value) || 0))
                      )
                    }
                    min={0}
                    max={59}
                    className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    (e.g., trains depart at XX:{String(outboundAnchorMinute).padStart(2, '0')})
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Inbound departs at minute
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 dark:text-gray-400">:</span>
                  <input
                    type="number"
                    value={inboundAnchorMinute}
                    onChange={(e) =>
                      setInboundAnchorMinute(
                        Math.max(0, Math.min(59, parseInt(e.target.value) || 0))
                      )
                    }
                    min={0}
                    max={59}
                    className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    (e.g., trains depart at XX:{String(inboundAnchorMinute).padStart(2, '0')})
                  </span>
                </div>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Short-Turn Stations Section */}
      {shortTurnStationOptions.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="font-medium">Short-Turn Stations</h3>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Select stations where trains can start (morning) or end (evening) for partial routes.
            </p>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Starting stations (morning)
                </label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {shortTurnStationOptions.map((station) => (
                    <label
                      key={station.id}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={startingStations.includes(station.id)}
                        onChange={() => toggleStartingStation(station.id)}
                        className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm">{station.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Ending stations (evening)
                </label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {shortTurnStationOptions.map((station) => (
                    <label
                      key={station.id}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={endingStations.includes(station.id)}
                        onChange={() => toggleEndingStation(station.id)}
                        className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm">{station.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Train Numbers Section */}
      <Card>
        <CardHeader>
          <h3 className="font-medium">Train Numbers</h3>
        </CardHeader>
        <CardBody>
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Prefix"
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
                onChange={(e) => setStartBaseNumber(parseInt(e.target.value) || 101)}
                min={1}
                max={9999}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {trainNumberPrefix && (
            <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              <div>
                Outbound: <span className="font-mono">{previewNumbers.outbound.join(', ')}...</span>{' '}
                <span className="text-xs">(odd)</span>
              </div>
              <div>
                Inbound: <span className="font-mono">{previewNumbers.inbound.join(', ')}...</span>{' '}
                <span className="text-xs">(even)</span>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Analysis & Generation Section */}
      <Card>
        <CardHeader>
          <h3 className="font-medium">Analyze & Generate</h3>
        </CardHeader>
        <CardBody>
          <div className="flex items-center justify-between mb-4">
            <Button
              onClick={handleAnalyze}
              disabled={!canAnalyze || analyzing}
              variant="secondary"
            >
              {analyzing ? 'Analyzing...' : 'Analyze Schedule'}
            </Button>

            {!savedScheduleId && (
              <span className="text-sm text-amber-600">
                Schedule will be saved before analysis
              </span>
            )}
          </div>

          {analysisResult && (
            <div className="space-y-4">
              {/* Short-turn suggestions */}
              {analysisResult.suggestions.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-amber-600">
                    <span>&#9888;</span>
                    <span className="font-medium">Short-turn variants needed</span>
                  </div>
                  {analysisResult.suggestions.map((suggestion, index) => (
                    <ShortTurnSuggestionCard
                      key={index}
                      suggestion={suggestion}
                      stations={stations}
                      confirmed={confirmedSuggestions.has(index)}
                      onConfirm={() =>
                        setConfirmedSuggestions((prev) => new Set([...prev, index]))
                      }
                      onSkip={() =>
                        setConfirmedSuggestions((prev) => {
                          const next = new Set(prev);
                          next.delete(index);
                          return next;
                        })
                      }
                    />
                  ))}
                </div>
              )}

              {/* Coverage info */}
              <div className="p-4 bg-green-50 rounded-lg">
                <div className="flex items-center gap-2 text-green-700 mb-2">
                  <span>&#10003;</span>
                  <span className="font-medium">Full variant coverage</span>
                </div>
                <div className="text-sm text-green-600">
                  Outbound: {analysisResult.coverage.outbound.firstAnchorTime} -{' '}
                  {analysisResult.coverage.outbound.lastAnchorTime}
                </div>
                <div className="text-sm text-green-600">
                  Inbound: {analysisResult.coverage.inbound.firstAnchorTime} -{' '}
                  {analysisResult.coverage.inbound.lastAnchorTime}
                </div>
              </div>

              {/* Generation summary */}
              <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <div className="font-medium mb-2">Generation Summary</div>
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <div>Full outbound: {analysisResult.trainCounts.fullOutbound} trains</div>
                  <div>Full inbound: {analysisResult.trainCounts.fullInbound} trains</div>
                  {analysisResult.trainCounts.shortTurnOutbound > 0 && (
                    <div>Short-turn outbound: {analysisResult.trainCounts.shortTurnOutbound} trains</div>
                  )}
                  {analysisResult.trainCounts.shortTurnInbound > 0 && (
                    <div>Short-turn inbound: {analysisResult.trainCounts.shortTurnInbound} trains</div>
                  )}
                  <div className="font-medium pt-1 border-t border-gray-300 dark:border-gray-600">
                    Total: {analysisResult.trainCounts.total} trains
                  </div>
                </div>
              </div>

              {/* Clear existing checkbox */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="clearExisting"
                  checked={clearExisting}
                  onChange={(e) => setClearExisting(e.target.checked)}
                  className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="clearExisting" className="text-sm text-gray-700 dark:text-gray-300">
                  Clear existing timetables for this line
                </label>
              </div>

              {/* Generate button */}
              <div className="flex justify-end">
                <Button onClick={handleGenerate} disabled={generating}>
                  {generating ? 'Generating...' : 'Generate All Timetables'}
                </Button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Save button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={!isValid || saving}>
          {saving ? 'Saving...' : savedScheduleId ? 'Update Schedule' : 'Save Schedule'}
        </Button>
      </div>
    </div>
  );
}
