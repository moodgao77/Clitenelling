'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { assignOwner } from '@/app/people/[id]/actions';

/** Manager-only control to assign a client to any team member. */
export default function AssignOwner({
  personId,
  currentOwnerId,
  members,
}: {
  personId: string;
  currentOwnerId: string | null;
  members: { id: string; full_name: string }[];
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted">Assign to</span>
      <select
        defaultValue={currentOwnerId ?? ''}
        disabled={pending}
        onChange={(e) =>
          start(async () => {
            await assignOwner(personId, e.target.value || null);
            router.refresh();
          })
        }
        className="h-9 rounded-lg border border-line bg-surface px-2 text-sm text-ink outline-none focus:border-gold"
      >
        <option value="">Unassigned</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.full_name}
          </option>
        ))}
      </select>
    </label>
  );
}
