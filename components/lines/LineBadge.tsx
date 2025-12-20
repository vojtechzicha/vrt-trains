import { Badge } from '@/components/ui';

interface LineBadgeProps {
  identifier: string;
  color: string;
  textColor: string;
  className?: string;
}

export function LineBadge({ identifier, color, textColor, className = '' }: LineBadgeProps) {
  return (
    <Badge color={color} textColor={textColor} className={`font-bold ${className}`}>
      {identifier}
    </Badge>
  );
}
