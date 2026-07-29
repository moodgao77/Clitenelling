'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Tab = {
  href: string;
  label: string;
  match: (p: string) => boolean;
  icon: React.ReactNode;
  managerOnly?: boolean;
};

const TABS: Tab[] = [
  {
    href: '/',
    label: 'Today',
    match: (p) => p === '/',
    icon: <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />,
  },
  {
    href: '/people',
    label: 'Clients',
    match: (p) => p === '/people' || (p.startsWith('/people/') && p !== '/people/new'),
    icon: <path d="M16 3.13a4 4 0 0 1 0 7.75M21 21v-2a4 4 0 0 0-3-3.87M7 6a4 4 0 1 0 8 0 4 4 0 0 0-8 0Zm-4 15v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />,
  },
  {
    href: '/people/new',
    label: 'Add',
    match: (p) => p === '/people/new',
    icon: <path d="M12 5v14M5 12h14" />,
  },
  {
    href: '/reports',
    label: 'Funnel',
    match: (p) => p.startsWith('/reports'),
    managerOnly: true,
    icon: <path d="M3 3v18h18M8 16v-5M13 16V8M18 16v-9" />,
  },
];

export default function BottomNav({
  dueCount = 0,
  isManager = false,
}: {
  dueCount?: number;
  isManager?: boolean;
}) {
  const pathname = usePathname();
  if (pathname === '/login') return null;

  const tabs = TABS.filter((t) => !t.managerOnly || isManager);

  return (
    <nav
      className="sticky bottom-0 z-10 border-t border-line bg-surface/90 backdrop-blur"
      style={{ display: 'grid', gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}
    >
      {tabs.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`relative flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors ${
              active ? 'text-heading' : 'text-muted'
            }`}
          >
            <span className="relative">
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
              {tab.href === '/' && dueCount > 0 && (
                <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-accent-fg">
                  {dueCount > 99 ? '99+' : dueCount}
                </span>
              )}
            </span>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
