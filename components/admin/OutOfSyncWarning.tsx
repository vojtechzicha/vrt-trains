'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Variant, Line } from '@/types';

interface OutOfSyncWarningProps {
  variants: Variant[];
  lines: Line[];
}

export function OutOfSyncWarning({ variants, lines }: OutOfSyncWarningProps) {
  const lineMap = new Map(lines.map((l) => [l.id, l]));
  const router = useRouter();
  const [isClearing, setIsClearing] = useState(false);

  if (variants.length === 0) {
    return null;
  }

  const handleMarkAllSolved = async () => {
    if (!confirm(`Mark all ${variants.length} variant(s) as reviewed? This will not change any variant data.`)) {
      return;
    }

    setIsClearing(true);
    try {
      const res = await fetch('/api/admin/variants/clear-out-of-sync', {
        method: 'POST',
      });

      if (res.ok) {
        router.refresh();
      }
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="mb-6 p-4 bg-yellow-50 border border-yellow-300 rounded-lg">
      <div className="flex items-start gap-3">
        <span className="text-yellow-600 text-xl">⚠</span>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <p className="font-medium text-yellow-800">
              {variants.length} variant{variants.length > 1 ? 's' : ''} need{variants.length === 1 ? 's' : ''} review
            </p>
            <button
              onClick={handleMarkAllSolved}
              disabled={isClearing}
              className="px-3 py-1 text-sm bg-yellow-200 hover:bg-yellow-300 text-yellow-800 rounded transition-colors disabled:opacity-50"
            >
              {isClearing ? 'Clearing...' : 'Mark all as solved'}
            </button>
          </div>
          <p className="text-sm text-yellow-700 mt-1">
            These variants are out of sync with their source routes and may need to be updated.
          </p>
          <ul className="mt-2 space-y-1">
            {variants.slice(0, 5).map((variant) => {
              const line = lineMap.get(variant.lineId);
              return (
                <li key={variant.id} className="text-sm">
                  <Link
                    href={`/admin/lines/${variant.lineId}/variants/${variant.id}`}
                    className="text-yellow-800 hover:underline font-medium"
                  >
                    {line?.identifier || 'Unknown'} - {variant.code}: {variant.name}
                  </Link>
                </li>
              );
            })}
            {variants.length > 5 && (
              <li className="text-sm text-yellow-700">
                ... and {variants.length - 5} more
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
