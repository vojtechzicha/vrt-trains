import Link from 'next/link';
import { Line } from '@/types';
import { Card, CardBody } from '@/components/ui';
import { LineBadge } from './LineBadge';

interface LineCardProps {
  line: Line;
}

export function LineCard({ line }: LineCardProps) {
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
            <h3 className="font-semibold text-gray-900">{line.name}</h3>
            <p className="text-sm text-gray-500 capitalize">{line.type}</p>
          </div>
          <div className="text-sm text-gray-400">
            {line.variants.length} variant{line.variants.length !== 1 ? 's' : ''}
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}
