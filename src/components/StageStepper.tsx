import { setStageAction } from '@/app/people/[id]/actions';
import { STAGES, STAGE_META, type Stage } from '@/lib/types';

/** One-tap stage change. Each pill is a server-action form; the DB trigger
 *  timestamps the change into stage_history. */
export default function StageStepper({
  personId,
  current,
}: {
  personId: string;
  current: Stage;
}) {
  const currentIdx = STAGES.indexOf(current);
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {STAGES.map((s, i) => {
        const isCurrent = s === current;
        const isPast = i < currentIdx;
        const cls = isCurrent
          ? 'bg-accent text-accent-fg border-accent font-semibold'
          : isPast
            ? 'bg-gold-soft text-gold border-transparent'
            : 'border-line text-muted';
        return (
          <form key={s} action={setStageAction}>
            <input type="hidden" name="personId" value={personId} />
            <input type="hidden" name="stage" value={s} />
            <button
              type="submit"
              disabled={isCurrent}
              className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm transition-colors ${cls}`}
            >
              {STAGE_META[s].label}
            </button>
          </form>
        );
      })}
    </div>
  );
}
