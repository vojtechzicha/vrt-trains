import Link from 'next/link';
import { Navigation } from './Navigation';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold text-gray-900">VRT</span>
          <span className="text-sm text-gray-500">Train Lines</span>
        </Link>
        <Navigation />
      </div>
    </header>
  );
}
