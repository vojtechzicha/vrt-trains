import Link from 'next/link';
import { Line } from '@/types';
import { Card, CardBody } from '@/components/ui';
import { LineBadge } from './LineBadge';

interface LineCardProps {
  line: Line;
  variantCount?: number;
}

export function LineCard({ line, variantCount }: LineCardProps) {
  const count = variantCount ?? line.variants.length;

  return (
    <Link href={`/lines/${line.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardBody className="flex items-center gap-4">
          <LineBadge
            identifier={line.identifier}
            color={line.color}
            textColor={line.textColor}
            className="text-lg px-3 py-1"
          />
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{line.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{line.type}</p>
          </div>
          <div className="text-sm text-gray-400 dark:text-gray-500">
            {count} variant{count !== 1 ? 's' : ''}
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}
