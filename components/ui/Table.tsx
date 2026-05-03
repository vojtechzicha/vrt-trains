import { ReactNode } from 'react';

interface TableProps {
  children: ReactNode;
  className?: string;
}

export function Table({ children, className = '' }: TableProps) {
  return (
    <table className={`divide-y divide-gray-200 dark:divide-gray-700 ${className}`}>
      {children}
    </table>
  );
}

export function TableHeader({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-gray-50 dark:bg-gray-950">
      {children}
    </thead>
  );
}

export function TableBody({ children }: { children: ReactNode }) {
  return (
    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
      {children}
    </tbody>
  );
}

export function TableRow({ children, className = '' }: TableProps) {
  return (
    <tr className={className}>
      {children}
    </tr>
  );
}

export function TableHead({ children, className = '' }: TableProps) {
  return (
    <th
      className={`px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${className}`}
    >
      {children}
    </th>
  );
}

export function TableCell({ children, className = '' }: TableProps) {
  return (
    <td className={`px-4 py-3 whitespace-nowrap text-sm ${className}`}>
      {children}
    </td>
  );
}
