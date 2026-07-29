'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Lotus from '@/components/Lotus';
import { signOut } from '@/app/login/actions';

/** Persistent top bar on every signed-in page: brand on the left,
 *  sign-out on the right. Hidden on the login screen. */
export default function TopBar() {
  const pathname = usePathname();
  if (pathname === '/login') return null;

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-bg/90 px-4 py-2.5 backdrop-blur">
      <Link href="/" className="flex items-center gap-2">
        <Lotus className="w-6" />
        <span className="text-sm font-semibold uppercase tracking-[0.18em] text-heading">
          Marushika
        </span>
      </Link>
      <form action={signOut}>
        <button className="text-sm text-muted underline-offset-4 transition-colors hover:text-ink hover:underline">
          Sign out
        </button>
      </form>
    </header>
  );
}
