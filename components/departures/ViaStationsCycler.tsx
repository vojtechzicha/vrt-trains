'use client';

import { useState, useEffect } from 'react';

interface ViaStationsCyclerProps {
  stations: string[];
  variantName: string;
  className?: string;
}

export function ViaStationsCycler({ stations, variantName, className = '' }: ViaStationsCyclerProps) {
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);

  // Build display items based on number of via stations:
  // 0 stations: [variantName]
  // 1 station: [variantName, "via Station1"]
  // 2+ stations: ["via Station1", "via Station2", ..., variantName]
  const displayItems: string[] = [];

  if (stations.length === 0) {
    displayItems.push(variantName);
  } else if (stations.length === 1) {
    displayItems.push(variantName);
    displayItems.push(`via ${stations[0]}`);
  } else {
    stations.forEach((s) => displayItems.push(`via ${s}`));
    displayItems.push(variantName);
  }

  const shouldCycle = displayItems.length > 1;

  useEffect(() => {
    if (!shouldCycle) return;

    const interval = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setIndex((i) => (i + 1) % displayItems.length);
        setFading(false);
      }, 300);
    }, 3000);

    return () => clearInterval(interval);
  }, [shouldCycle, displayItems.length]);

  if (displayItems.length === 0 || !displayItems[0]) {
    return null;
  }

  const currentItem = displayItems[index];
  const isVia = currentItem.startsWith('via ');

  return (
    <span
      className={`transition-all duration-300 ${className} ${
        fading ? 'opacity-0' : 'opacity-100'
      } ${
        isVia
          ? 'text-sm text-gray-400 dark:text-gray-500 italic'
          : 'text-xs text-amber-400 font-semibold tracking-wide uppercase'
      }`}
    >
      {currentItem}
    </span>
  );
}
