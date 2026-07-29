'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { logWhatsAppContact } from '@/app/people/[id]/actions';

/** Opens WhatsApp (new tab) AND logs the contact. The link's default action
 *  opens the chat on tap (a real user gesture); the click handler records the
 *  outreach and refreshes the profile so the stage updates in place. */
export default function WhatsAppButton({
  href,
  personId,
}: {
  href: string;
  personId: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() =>
        start(async () => {
          await logWhatsAppContact(personId);
          router.refresh();
        })
      }
      className="flex h-12 items-center justify-center gap-2 rounded-xl bg-accent text-base font-semibold text-accent-fg transition-opacity active:opacity-90"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-[var(--accent-fg)]" aria-hidden="true">
        <path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.8 4.9-1.3A10 10 0 1 0 12 2zm0 2a8 8 0 1 1-4.1 14.9l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 0 1 12 4zm-2.7 4.3c-.2 0-.5 0-.7.3-.3.3-1 1-1 2.3s1 2.7 1.2 2.9c.1.2 2 3 4.8 4.1 2.4 1 2.9.8 3.4.8.5-.1 1.6-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3l-2-1c-.3-.1-.5-.2-.7.1l-.7.9c-.1.2-.3.2-.5.1-.3-.1-1.2-.5-2.3-1.4-.8-.7-1.4-1.6-1.6-1.9-.1-.3 0-.4.1-.5l.4-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-1-2.3c-.2-.5-.4-.4-.6-.4z" />
      </svg>
      {pending ? 'Opening…' : 'Message on WhatsApp'}
    </a>
  );
}
