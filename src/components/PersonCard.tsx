import Link from 'next/link';
import StageBadge from '@/components/StageBadge';
import type { Person } from '@/lib/types';

export default function PersonCard({
  person,
  ownerLabel,
}: {
  person: Pick<Person, 'id' | 'full_name' | 'phone_e164' | 'stage'>;
  ownerLabel: string;
}) {
  return (
    <Link
      href={`/people/${person.id}`}
      className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4 active:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:active:bg-neutral-800"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-medium" dir="auto">
          {person.full_name || 'Unnamed'}
        </p>
        <p className="mt-0.5 truncate text-sm text-neutral-500" dir="ltr">
          {person.phone_e164}
        </p>
        <p className="mt-0.5 text-xs text-neutral-400">{ownerLabel}</p>
      </div>
      <StageBadge stage={person.stage} />
    </Link>
  );
}
