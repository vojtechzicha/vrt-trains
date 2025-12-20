'use client';

import { useDroppable } from '@dnd-kit/core';
import { Badge } from '@/components/ui';
import { Direction } from '@/types';

interface LineItem {
  id: string;
  identifier: string;
  color: string;
  textColor: string;
  direction?: Direction;
  variantCode?: string;
  tooltip?: string;
}

interface PlatformDropZoneProps {
  platformNumber: string;
  items: LineItem[];
  showVariantMode: boolean;
  onRemove?: (itemId: string) => void;
}

export function PlatformDropZone({
  platformNumber,
  items,
  showVariantMode,
  onRemove,
}: PlatformDropZoneProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `platform-${platformNumber}`,
    data: {
      platformNumber,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={`
        border-2 rounded-lg p-4 min-h-[80px] transition-colors
        ${isOver ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}
      `}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm font-semibold text-gray-700">
          Platform {platformNumber}
        </span>
        <div className="flex-1 h-1 bg-gray-300 rounded" />
      </div>

      <div className="flex flex-wrap gap-2 min-h-[32px]">
        {items.length === 0 ? (
          <span className="text-sm text-gray-400 italic">
            Drop lines here
          </span>
        ) : (
          items.map((item) => {
            const directionArrow = item.direction
              ? item.direction === 'outbound' ? ' \u2192' : ' \u2190'
              : '';

            // Build label
            let label = item.identifier;
            if (showVariantMode && item.variantCode) {
              label = `${item.identifier} (${item.variantCode})`;
            }
            label = label + directionArrow;

            // Direction-based ring color for visual distinction
            const ringClass = item.direction === 'inbound'
              ? 'ring-2 ring-blue-400 ring-offset-1'
              : item.direction === 'outbound'
                ? 'ring-2 ring-green-400 ring-offset-1'
                : '';

            return (
              <div key={item.id} className="group relative" title={item.tooltip}>
                <Badge
                  color={item.color}
                  textColor={item.textColor}
                  className={`font-bold ${ringClass}`}
                >
                  {label}
                </Badge>
                {onRemove && (
                  <button
                    onClick={() => onRemove(item.id)}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                    title="Remove from platform"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
