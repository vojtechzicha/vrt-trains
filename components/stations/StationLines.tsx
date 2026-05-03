import Link from 'next/link';
import { Line } from '@/types';
import { LineBadge } from '@/components/lines';

interface StationLinesProps {
  lines: Line[];
}

export function StationLines({ lines }: StationLinesProps) {
  if (lines.length === 0) {
    return (
      <p className="text-gray-500 dark:text-gray-400">No lines serve this station</p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {lines.map((line) => (
        <Link key={line.id} href={`/lines/${line.id}`}>
          <LineBadge
            identifier={line.identifier}
            color={line.color}
            textColor={line.textColor}
            className="hover:opacity-80 transition-opacity cursor-pointer"
          />
        </Link>
      ))}
    </div>
  );
}
