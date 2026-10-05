import type { Activity } from '@/lib/types';

type NoteLike = Pick<Activity, 'type' | 'body'>;
type DatedLike = Pick<Activity, 'created_at' | 'completed_at'>;

/**
 * A conversation note is one an associate typed about a client interaction.
 * The auto-logged rows (the "Messaged on WhatsApp" tap) carry an empty body,
 * so they stay in the activity trail instead of crowding the note log.
 */
export function isConversationNote(a: NoteLike): boolean {
  return a.type === 'note' && a.body.trim() !== '';
}

/** When a note was written — notes complete the moment they're saved. */
export function noteWrittenAt(a: DatedLike): string {
  return a.completed_at ?? a.created_at;
}

/** The client's conversation notes, newest first. */
export function conversationNotes<T extends NoteLike & DatedLike>(activities: T[]): T[] {
  return activities
    .filter(isConversationNote)
    .sort((a, b) => noteWrittenAt(b).localeCompare(noteWrittenAt(a)));
}

/**
 * The most recent activity per client, newest first — the "what's happening
 * now" view. Collapses a client's repeat follow-ups to their latest touch so a
 * single busy client can't crowd out everyone else.
 */
export function latestPerClient<T extends DatedLike & { people: { id: string } | null }>(
  rows: T[],
  limit: number,
): T[] {
  const seen = new Set<string>();
  const latest: T[] = [];

  for (const row of [...rows].sort((a, b) => noteWrittenAt(b).localeCompare(noteWrittenAt(a)))) {
    const person = row.people;
    if (!person || seen.has(person.id)) continue;
    seen.add(person.id);
    latest.push(row);
    if (latest.length >= limit) break;
  }

  return latest;
}

/**
 * Outcome value meaning "close this lead out" rather than move it to a stage.
 * Lives here rather than in the actions module because a `'use server'` file
 * may only export async functions.
 */
export const CLOSE_OUTCOME = 'not_interested';
