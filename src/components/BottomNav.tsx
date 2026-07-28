'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  {
    href: '/people',
    label: 'Clients',
    match: (p: string) => p === '/people' || (p.startsWith('/people/') && p !== '/people/new'),
    icon: (
      <path d="M16 3.13a4 4 0 0 1 0 7.75M21 21v-2a4 4 0 0 0-3-3.87M7 6a4 4 0 1 0 8 0 4 4 0 0 0-8 0Zm-4 15v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
    ),
  },
  {
    href: '/people/new',
    label: 'Add',
    match: (p: string) => p === '/people/new',
    icon: <path d="M12 5v14M5 12h14" />,
  },
];

export default function BottomNav() {
  const pathname = usePathname();
  if (pathname === '/login') return null;

  return (
    <nav className="sticky bottom-0 z-10 grid grid-cols-2 border-t border-line bg-surface/90 backdrop-blur">
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors ${
              active ? 'text-heading' : 'text-muted'
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {tab.icon}
            </svg>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
