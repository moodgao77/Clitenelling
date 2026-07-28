/**
 * Pure merge logic for the phone-identity rule: when a person arrives from a
 * second source (quick-add, Excel import, Shopify) and matches an existing
 * record by normalized phone, we MERGE rather than create a duplicate.
 *
 * Rules: never overwrite existing data; only fill blanks. An existing owner is
 * always kept. Notes are appended (deduplicated), so history is never lost.
 */
export type MergeableFields = {
  full_name: string;
  owner_id: string | null;
  notes: string;
};

export function mergePerson(
  existing: MergeableFields,
  incoming: MergeableFields,
): MergeableFields {
  return {
    full_name: existing.full_name.trim() || incoming.full_name.trim(),
    owner_id: existing.owner_id ?? incoming.owner_id,
    notes: appendNote(existing.notes, incoming.notes),
  };
}

function appendNote(existing: string, incoming: string): string {
  const a = existing.trim();
  const b = incoming.trim();
  if (!b) return a;
  if (!a) return b;
  if (a === b || a.split('\n---\n').includes(b)) return a;
  return `${a}\n---\n${b}`;
}
