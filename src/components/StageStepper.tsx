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
        return (
          <form key={s} action={setStageAction}>
            <input type="hidden" name="personId" value={personId} />
            <input type="hidden" name="stage" value={s} />
            <button
              type="submit"
              disabled={isCurrent}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${
                isCurrent
                  ? STAGE_META[s].classes + ' font-semibold ring-2 ring-neutral-900 dark:ring-white'
                  : isPast
                    ? 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400'
                    : 'border border-dashed border-neutral-300 text-neutral-500 dark:border-neutral-700'
              }`}
            >
              {STAGE_META[s].label}
            </button>
          </form>
        );
      })}
    </div>
  );
}
