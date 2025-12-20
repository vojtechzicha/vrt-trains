'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@/components/ui';
import { Direction } from '@/types';

interface DraggableLineBadgeProps {
  id: string;
  identifier: string;
  color: string;
  textColor: string;
  direction?: Direction;
  showDirection?: boolean;
  variantCode?: string;
  tooltip?: string;
}

export function DraggableLineBadge({
  id,
  identifier,
  color,
  textColor,
  direction,
  showDirection = false,
  variantCode,
  tooltip,
}: DraggableLineBadgeProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    data: {
      id,
      identifier,
      color,
      textColor,
      direction,
      variantCode,
    },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab',
  };

  const directionArrow = direction === 'outbound' ? ' \u2192' : ' \u2190';

  // Build label based on what info we have
  let label = identifier;
  if (variantCode) {
    label = `${identifier} (${variantCode})`;
  }
  if (showDirection && direction) {
    label = label + directionArrow;
  }

  // Direction-based ring color for visual distinction
  const ringClass = direction === 'inbound'
    ? 'ring-2 ring-blue-400 ring-offset-1'
    : direction === 'outbound'
      ? 'ring-2 ring-green-400 ring-offset-1'
      : '';

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} title={tooltip}>
      <Badge
        color={color}
        textColor={textColor}
        className={`font-bold select-none touch-none ${ringClass}`}
      >
        {label}
      </Badge>
    </div>
  );
}
