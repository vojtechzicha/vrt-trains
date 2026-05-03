import { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  color?: string;
  textColor?: string;
  className?: string;
}

export function Badge({ children, color, textColor, className = '' }: BadgeProps) {
  const style = color ? { backgroundColor: color, color: textColor || '#fff' } : undefined;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-semibold ${
        !color ? 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200' : ''
      } ${className}`}
      style={style}
    >
      {children}
    </span>
  );
}
