import Link from 'next/link';
import { Navigation } from './Navigation';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold text-gray-900 dark:text-gray-100">VRT</span>
          <span className="text-sm text-gray-500 dark:text-gray-400">Train Lines</span>
        </Link>
        <Navigation />
      </div>
    </header>
  );
}
