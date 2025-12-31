'use client';

import { useState, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { Badge, Button } from '@/components/ui';
import { DraggableLineBadge } from './DraggableLineBadge';
import { PlatformDropZone } from './PlatformDropZone';
import { Direction, Platform } from '@/types';

interface VariantInfo {
  id: string;
  code: string;
  name: string;
  lineId: string;
  direction: Direction;
  platform: string;
  routeDescription: string;
}

interface LineInfo {
  id: string;
  identifier: string;
  name: string;
  color: string;
  textColor: string;
}

interface PlatformAssignmentEditorProps {
  stationId: string;
  stationName: string;
  platforms: Platform[];
  variants: VariantInfo[];
  lines: LineInfo[];
  onSave: (assignments: { variantId: string; platform: string }[]) => Promise<void>;
}

interface AssignmentState {
  [variantId: string]: string; // variantId -> platform
}

export function PlatformAssignmentEditor({
  stationId,
  stationName,
  platforms,
  variants,
  lines,
  onSave,
}: PlatformAssignmentEditorProps) {
  const [variantMode, setVariantMode] = useState(false);
  const [assignments, setAssignments] = useState<AssignmentState>(() => {
    const initial: AssignmentState = {};
    for (const v of variants) {
      initial[v.id] = v.platform || '';
    }
    return initial;
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  // Create line lookup
  const lineMap = new Map(lines.map((l) => [l.id, l]));

  // Get items for each platform
  const getPlatformItems = useCallback((platformNumber: string) => {
    if (variantMode) {
      // Variant mode: show individual variants with direction styling
      return variants
        .filter((v) => assignments[v.id] === platformNumber)
        .map((v) => {
          const line = lineMap.get(v.lineId);
          return {
            id: v.id,
            identifier: line?.identifier || '',
            color: line?.color || '#ccc',
            textColor: line?.textColor || '#000',
            direction: v.direction,
            variantCode: v.code,
            tooltip: `${v.code}: ${v.routeDescription}`,
          };
        });
    } else {
      // Line mode: separate by direction - show line+direction as separate items
      const lineDirectionGroups = new Map<string, VariantInfo[]>();

      for (const v of variants) {
        if (assignments[v.id] === platformNumber) {
          const key = `${v.lineId}::${v.direction}`;
          if (!lineDirectionGroups.has(key)) {
            lineDirectionGroups.set(key, []);
          }
          lineDirectionGroups.get(key)!.push(v);
        }
      }

      return Array.from(lineDirectionGroups.entries()).map(([key, groupVariants]) => {
        const [lineId, direction] = key.split('::') as [string, Direction];
        const line = lineMap.get(lineId);
        // Use route description from first variant of this line+direction
        const routeDesc = groupVariants[0]?.routeDescription || '';
        return {
          id: `linedir::${lineId}::${direction}::${platformNumber}`,
          identifier: line?.identifier || '',
          color: line?.color || '#ccc',
          textColor: line?.textColor || '#000',
          direction: direction,
          lineId,
          tooltip: `${line?.identifier || ''}: ${routeDesc}`,
        };
      });
    }
  }, [variants, assignments, lineMap, variantMode]);

  // Get unassigned items
  const getUnassignedItems = useCallback(() => {
    if (variantMode) {
      // Variant mode: show individual unassigned variants
      return variants
        .filter((v) => !assignments[v.id] || assignments[v.id] === '')
        .map((v) => {
          const line = lineMap.get(v.lineId);
          return {
            id: v.id,
            identifier: line?.identifier || '',
            color: line?.color || '#ccc',
            textColor: line?.textColor || '#000',
            direction: v.direction,
            variantCode: v.code,
            tooltip: `${v.code}: ${v.routeDescription}`,
          };
        });
    } else {
      // Line mode: separate by direction
      const lineDirectionGroups = new Map<string, VariantInfo[]>();

      for (const v of variants) {
        if (!assignments[v.id] || assignments[v.id] === '') {
          const key = `${v.lineId}::${v.direction}`;
          if (!lineDirectionGroups.has(key)) {
            lineDirectionGroups.set(key, []);
          }
          lineDirectionGroups.get(key)!.push(v);
        }
      }

      return Array.from(lineDirectionGroups.entries()).map(([key, groupVariants]) => {
        const [lineId, direction] = key.split('::') as [string, Direction];
        const line = lineMap.get(lineId);
        const routeDesc = groupVariants[0]?.routeDescription || '';
        return {
          id: `linedir::${lineId}::${direction}::unassigned`,
          identifier: line?.identifier || '',
          color: line?.color || '#ccc',
          textColor: line?.textColor || '#000',
          direction: direction,
          lineId,
          variants: groupVariants,
          tooltip: `${line?.identifier || ''}: ${routeDesc}`,
        };
      });
    }
  }, [variants, assignments, lineMap, variantMode]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);

    const { active, over } = event;
    if (!over) return;

    const overId = over.id as string;
    if (!overId.startsWith('platform-')) return;

    const platformNumber = overId.replace('platform-', '');
    const activeIdStr = active.id as string;

    if (variantMode) {
      // Variant mode: assign single variant
      setAssignments((prev) => ({
        ...prev,
        [activeIdStr]: platformNumber,
      }));
    } else {
      // Line mode: assign all variants of the line+direction
      if (activeIdStr.startsWith('linedir::')) {
        // Parse: linedir::{lineId}::{direction}::{source}
        const parts = activeIdStr.split('::');
        const lineId = parts[1];
        const direction = parts[2] as Direction;

        // Only assign variants matching this line AND direction
        const matchingVariants = variants.filter(
          (v) => v.lineId === lineId && v.direction === direction
        );

        setAssignments((prev) => {
          const next = { ...prev };
          for (const v of matchingVariants) {
            next[v.id] = platformNumber;
          }
          return next;
        });
      }
    }
  };

  const handleRemove = (itemId: string) => {
    if (variantMode) {
      setAssignments((prev) => ({
        ...prev,
        [itemId]: '',
      }));
    } else if (itemId.startsWith('linedir::')) {
      // Parse: linedir::{lineId}::{direction}::{platform}
      const parts = itemId.split('::');
      const lineId = parts[1];
      const direction = parts[2] as Direction;

      const matchingVariants = variants.filter(
        (v) => v.lineId === lineId && v.direction === direction
      );

      setAssignments((prev) => {
        const next = { ...prev };
        for (const v of matchingVariants) {
          next[v.id] = '';
        }
        return next;
      });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const assignmentsList = Object.entries(assignments).map(([variantId, platform]) => ({
        variantId,
        platform,
      }));
      await onSave(assignmentsList);
    } finally {
      setSaving(false);
    }
  };

  // Check if there are unsaved changes
  const hasChanges = variants.some((v) => (v.platform || '') !== (assignments[v.id] || ''));

  // Create a map for platform metadata lookup
  const platformMetaMap = new Map(platforms.map((p) => [p.code, p]));
  const unassignedItems = getUnassignedItems();

  // Get active item for drag overlay
  const activeVariant = activeId && variantMode
    ? variants.find((v) => v.id === activeId)
    : null;

  // Parse line mode active item
  let activeLineInfo: { line: LineInfo; direction: Direction } | null = null;
  if (activeId && !variantMode && activeId.startsWith('linedir::')) {
    const parts = activeId.split('::');
    const lineId = parts[1];
    const direction = parts[2] as Direction;
    const line = lineMap.get(lineId);
    if (line) {
      activeLineInfo = { line, direction };
    }
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-6">
        {/* Mode toggle */}
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">Assignment mode:</span>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setVariantMode(false)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                !variantMode
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Line Mode
            </button>
            <button
              onClick={() => setVariantMode(true)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                variantMode
                  ? 'bg-blue-500 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Variant Mode
            </button>
          </div>
          <span className="text-xs text-gray-500">
            {variantMode
              ? 'Assign individual variants to platforms'
              : 'Assign line directions (inbound/outbound) to platforms'}
          </span>
        </div>

        {/* Platforms grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {platforms.map((platform) => (
            <PlatformDropZone
              key={platform.code}
              platformNumber={platform.code}
              platformName={platform.name}
              isBay={platform.isBay}
              items={getPlatformItems(platform.code)}
              showVariantMode={variantMode}
              onRemove={handleRemove}
            />
          ))}
        </div>

        {/* Unassigned area */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Unassigned</h3>
          <div className="flex flex-wrap gap-2">
            {unassignedItems.length === 0 ? (
              <span className="text-sm text-gray-400 italic">
                All {variantMode ? 'variants' : 'line directions'} are assigned
              </span>
            ) : (
              unassignedItems.map((item) => (
                <DraggableLineBadge
                  key={item.id}
                  id={item.id}
                  identifier={item.identifier}
                  color={item.color}
                  textColor={item.textColor}
                  direction={item.direction}
                  showDirection={true}
                  variantCode={'variantCode' in item ? item.variantCode : undefined}
                  tooltip={item.tooltip}
                />
              ))
            )}
          </div>
        </div>

        {/* Save button */}
        <div className="flex items-center gap-4">
          <Button
            onClick={handleSave}
            disabled={saving || !hasChanges}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
          {hasChanges && (
            <span className="text-sm text-orange-600">
              You have unsaved changes
            </span>
          )}
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeVariant && (
          <Badge
            color={lineMap.get(activeVariant.lineId)?.color || '#ccc'}
            textColor={lineMap.get(activeVariant.lineId)?.textColor || '#000'}
            className={`font-bold ${activeVariant.direction === 'inbound' ? 'ring-2 ring-blue-400' : 'ring-2 ring-green-400'}`}
          >
            {lineMap.get(activeVariant.lineId)?.identifier} ({activeVariant.code}) {activeVariant.direction === 'outbound' ? '\u2192' : '\u2190'}
          </Badge>
        )}
        {activeLineInfo && (
          <Badge
            color={activeLineInfo.line.color}
            textColor={activeLineInfo.line.textColor}
            className={`font-bold ${activeLineInfo.direction === 'inbound' ? 'ring-2 ring-blue-400' : 'ring-2 ring-green-400'}`}
          >
            {activeLineInfo.line.identifier} {activeLineInfo.direction === 'outbound' ? '\u2192' : '\u2190'}
          </Badge>
        )}
      </DragOverlay>
    </DndContext>
  );
}
