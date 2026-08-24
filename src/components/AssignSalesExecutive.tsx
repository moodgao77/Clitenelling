'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { assignSalesExecutive } from '@/app/people/[id]/actions';

export default function AssignSalesExecutive({
  personId,
  currentSalesExecutiveId,
  executives,
}: {
  personId: string;
  currentSalesExecutiveId: string | null;
  executives: { id: string; name: string }[];
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted">Sales executive</span>
      <select
        defaultValue={currentSalesExecutiveId ?? ''}
        disabled={pending}
        onChange={(e) =>
          start(async () => {
            await assignSalesExecutive(personId, e.target.value || null);
            router.refresh();
          })
        }
        className="h-9 rounded-lg border border-line bg-surface px-2 text-sm text-ink outline-none focus:border-gold"
      >
        <option value="">Unassigned</option>
        {executives.map((executive) => (
          <option key={executive.id} value={executive.id}>
            {executive.name}
          </option>
        ))}
      </select>
    </label>
  );
}
