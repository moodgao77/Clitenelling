'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/people', label: 'Clients', icon: '👥', match: (p: string) => p === '/people' || p.startsWith('/people/') && p !== '/people/new' },
  { href: '/people/new', label: 'Add', icon: '＋', match: (p: string) => p === '/people/new' },
];

export default function BottomNav() {
  const pathname = usePathname();
  if (pathname === '/login') return null;

  return (
    <nav className="sticky bottom-0 z-10 grid grid-cols-2 border-t border-neutral-200 bg-white/90 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-col items-center gap-0.5 py-2.5 text-xs ${
              active ? 'text-neutral-900 dark:text-white' : 'text-neutral-400'
            }`}
          >
            <span className="text-lg leading-none">{tab.icon}</span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
