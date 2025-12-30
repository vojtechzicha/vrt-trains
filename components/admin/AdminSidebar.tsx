'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: '⌂' },
  { href: '/admin/stations', label: 'Stations', icon: '◉' },
  { href: '/admin/routes', label: 'Routes', icon: '⇢' },
  { href: '/admin/lines', label: 'Lines', icon: '━' },
  { href: '/admin/patterns', label: 'Patterns', icon: '⟳' },
];

export function AdminSidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/admin') {
      return pathname === '/admin';
    }
    return pathname.startsWith(href);
  };

  return (
    <aside className="w-56 bg-gray-900 text-white min-h-screen">
      <div className="p-4 border-b border-gray-800">
        <Link href="/admin" className="flex items-center gap-2">
          <span className="text-xl font-bold">VRT</span>
          <span className="text-xs text-gray-400">Admin</span>
        </Link>
      </div>
      <nav className="p-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg mb-1 transition-colors ${
              isActive(item.href)
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            <span className="text-sm font-medium">{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="absolute bottom-0 left-0 w-56 p-4 border-t border-gray-800">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          ← Back to site
        </Link>
      </div>
    </aside>
  );
}
