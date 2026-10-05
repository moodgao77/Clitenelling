import { describe, expect, it } from 'vitest';
import { conversationNotes, isConversationNote, latestPerClient, noteWrittenAt } from './notes';

const note = (over: Partial<ReturnType<typeof base>> = {}) => ({ ...base(), ...over });
function base() {
  return {
    id: 'a1',
    type: 'note' as const,
    body: 'Called her about the Eid collection.',
    created_at: '2026-09-07T16:00:00.000Z',
    completed_at: '2026-09-07T16:00:00.000Z',
  };
}

describe('isConversationNote', () => {
  it('counts a typed note', () => {
    expect(isConversationNote(note())).toBe(true);
  });

  it('skips the auto-logged WhatsApp tap, which has an empty body', () => {
    expect(isConversationNote(note({ body: '' }))).toBe(false);
    expect(isConversationNote(note({ body: '   ' }))).toBe(false);
  });

  it('skips follow-ups and appointments', () => {
    expect(isConversationNote({ type: 'follow_up', body: 'Confirm a date.' })).toBe(false);
    expect(isConversationNote({ type: 'appointment', body: 'Come with wife.' })).toBe(false);
  });
});

describe('noteWrittenAt', () => {
  it('prefers the completion time', () => {
    expect(
      noteWrittenAt({ created_at: '2026-09-01T10:00:00.000Z', completed_at: '2026-09-02T10:00:00.000Z' }),
    ).toBe('2026-09-02T10:00:00.000Z');
  });

  it('falls back to creation time', () => {
    expect(noteWrittenAt({ created_at: '2026-09-01T10:00:00.000Z', completed_at: null })).toBe(
      '2026-09-01T10:00:00.000Z',
    );
  });
});

describe('conversationNotes', () => {
  it('returns typed notes newest first, so the latest note is never buried', () => {
    const september = note({ id: 'sep', body: 'Followed up in September.', completed_at: '2026-09-07T16:00:00.000Z' });
    const october = note({ id: 'oct', body: 'New note in October.', completed_at: '2026-10-05T09:30:00.000Z' });
    const whatsappTap = note({ id: 'wa', body: '' });

    expect(conversationNotes([september, whatsappTap, october]).map((n) => n.id)).toEqual(['oct', 'sep']);
  });

  it('is empty when nothing has been written yet', () => {
    expect(conversationNotes([note({ body: '' })])).toEqual([]);
  });
});

describe('latestPerClient', () => {
  const touch = (id: string, personId: string, at: string) => ({
    id,
    created_at: at,
    completed_at: at,
    people: { id: personId },
  });

  it('keeps only each client’s most recent touch, newest first', () => {
    const rows = [
      touch('t1', 'alice', '2026-10-01T09:00:00.000Z'),
      touch('t2', 'bob', '2026-10-03T09:00:00.000Z'),
      touch('t3', 'alice', '2026-10-04T09:00:00.000Z'),
    ];

    expect(latestPerClient(rows, 10).map((r) => r.id)).toEqual(['t3', 't2']);
  });

  it('respects the limit', () => {
    const rows = [
      touch('t1', 'alice', '2026-10-01T09:00:00.000Z'),
      touch('t2', 'bob', '2026-10-02T09:00:00.000Z'),
      touch('t3', 'carol', '2026-10-03T09:00:00.000Z'),
    ];

    expect(latestPerClient(rows, 2).map((r) => r.id)).toEqual(['t3', 't2']);
  });

  it('skips rows whose client is missing', () => {
    expect(latestPerClient([{ created_at: 'x', completed_at: null, people: null }], 5)).toEqual([]);
  });
});
