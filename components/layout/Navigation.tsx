'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', label: 'Home' },
  { href: '/lines', label: 'Lines' },
  { href: '/routes', label: 'Routes' },
  { href: '/stations', label: 'Stations' },
  { href: '/departures', label: 'Departures' },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-6">
      {navItems.map((item) => {
        const isActive = item.href === '/'
          ? pathname === '/'
          : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`text-sm font-medium transition-colors hover:text-blue-600 ${
              isActive ? 'text-blue-600' : 'text-gray-600'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
