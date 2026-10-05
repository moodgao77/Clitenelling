import { conversationNotes, noteWrittenAt } from '@/lib/notes';
import type { Activity } from '@/lib/types';

/** Full date + time, so "when was the last note left?" is answerable at a glance. */
const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Dubai',
  });

/** The client's conversation notes as dated entries, newest first. */
export default function NotesLog({ activities }: { activities: Activity[] }) {
  const notes = conversationNotes(activities);

  if (notes.length === 0) {
    return <p className="text-sm text-muted">No notes yet. Add the first one above.</p>;
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {notes.map((n) => (
        <li key={n.id} className="rounded-xl border border-line bg-surface p-3.5">
          <p className="text-xs font-medium text-gold">{when(noteWrittenAt(n))}</p>
          {/* pre-wrap: the team writes multi-line call summaries */}
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink" dir="auto">
            {n.body}
          </p>
        </li>
      ))}
    </ul>
  );
}
