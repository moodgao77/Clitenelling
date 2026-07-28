import { createServerSupabase } from '@/lib/supabase/server';
import { getSessionProfile } from '@/lib/auth';
import { signOut } from '@/app/login/actions';
import PersonCard from '@/components/PersonCard';
import { STAGES, STAGE_META, type Person, type Stage } from '@/lib/types';
import Link from 'next/link';

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stage?: string }>;
}) {
  const { q, stage } = await searchParams;
  const me = await getSessionProfile();
  const supabase = await createServerSupabase();

  // Owner names for labels (small table; RLS lets everyone read profiles).
  const { data: profiles } = await supabase.from('profiles').select('id, full_name');
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  let query = supabase
    .from('people')
    .select('id, full_name, phone_e164, stage, owner_id')
    .order('updated_at', { ascending: false })
    .limit(200);

  const activeStage = STAGES.includes(stage as Stage) ? (stage as Stage) : undefined;
  if (activeStage) query = query.eq('stage', activeStage);

  const cleaned = (q ?? '').replace(/[,()%]/g, ' ').trim();
  if (cleaned) {
    query = query.or(`full_name.ilike.%${cleaned}%,phone_e164.ilike.%${cleaned}%`);
  }

  const { data: people } = await query;

  function ownerLabel(p: Pick<Person, 'owner_id'>) {
    if (p.owner_id && me && p.owner_id === me.id) return 'You';
    if (!p.owner_id) return 'Unassigned';
    return nameById.get(p.owner_id) ?? 'Another associate';
  }

  return (
    <main className="mx-auto w-full max-w-xl px-4 pb-6">
      <header className="flex items-center justify-between py-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Clients</h1>
          {me && <p className="text-sm text-neutral-500">Hi, {me.full_name.split(' ')[0]}</p>}
        </div>
        <form action={signOut}>
          <button className="text-sm text-neutral-500 underline-offset-2 hover:underline">
            Sign out
          </button>
        </form>
      </header>

      <form method="get" className="mb-3">
        <input
          name="q"
          defaultValue={q ?? ''}
          placeholder="Search name or phone…"
          className="h-11 w-full rounded-xl border border-neutral-300 px-4 text-base outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900"
        />
        {activeStage && <input type="hidden" name="stage" value={activeStage} />}
      </form>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        <FilterChip label="All" href={buildHref(q, undefined)} active={!activeStage} />
        {STAGES.map((s) => (
          <FilterChip
            key={s}
            label={STAGE_META[s].label}
            href={buildHref(q, s)}
            active={activeStage === s}
          />
        ))}
      </div>

      <p className="mb-2 text-xs text-neutral-400">
        {people?.length ?? 0} {people?.length === 1 ? 'person' : 'people'}
      </p>

      <ul className="flex flex-col gap-2">
        {(people ?? []).map((p) => (
          <li key={p.id}>
            <PersonCard person={p} ownerLabel={ownerLabel(p)} />
          </li>
        ))}
      </ul>

      {people && people.length === 0 && (
        <p className="mt-10 text-center text-sm text-neutral-500">
          No one here yet. Tap <span className="font-medium">＋ Add</span> to add a contact.
        </p>
      )}
    </main>
  );
}

function buildHref(q: string | undefined, stage: Stage | undefined) {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (stage) params.set('stage', stage);
  const s = params.toString();
  return s ? `/people?${s}` : '/people';
}

function FilterChip({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm ${
        active
          ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900'
          : 'border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300'
      }`}
    >
      {label}
    </Link>
  );
}
