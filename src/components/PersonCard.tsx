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
      className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-line-strong active:bg-surface-2"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-ink" dir="auto">
          {person.full_name || 'Unnamed'}
        </p>
        <p className="mt-0.5 truncate text-sm text-muted" dir="ltr">
          {person.phone_e164}
        </p>
        <p className="mt-1 text-xs text-muted">{ownerLabel}</p>
      </div>
      <StageBadge stage={person.stage} />
    </Link>
  );
}
