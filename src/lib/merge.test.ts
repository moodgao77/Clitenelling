import { describe, it, expect } from 'vitest';
import { mergePerson } from './merge';

describe('mergePerson', () => {
  it('keeps existing owner and name, appends note', () => {
    const merged = mergePerson(
      { full_name: 'Aisha K', owner_id: 'u1', notes: 'likes silk' },
      { full_name: 'Aisha Khalid', owner_id: null, notes: 'size 52' },
    );
    expect(merged.owner_id).toBe('u1');
    expect(merged.full_name).toBe('Aisha K');
    expect(merged.notes).toBe('likes silk\n---\nsize 52');
  });

  it('fills blank name from incoming', () => {
    expect(
      mergePerson(
        { full_name: '', owner_id: null, notes: '' },
        { full_name: 'Noor', owner_id: 'u2', notes: '' },
      ).full_name,
    ).toBe('Noor');
  });

  it('fills blank owner from incoming', () => {
    expect(
      mergePerson(
        { full_name: 'Sara', owner_id: null, notes: '' },
        { full_name: 'Sara', owner_id: 'u3', notes: '' },
      ).owner_id,
    ).toBe('u3');
  });

  it('does not duplicate an identical note', () => {
    expect(
      mergePerson(
        { full_name: 'X', owner_id: 'u1', notes: 'VIP' },
        { full_name: 'X', owner_id: null, notes: 'VIP' },
      ).notes,
    ).toBe('VIP');
  });

  it('keeps existing notes when incoming note is empty', () => {
    expect(
      mergePerson(
        { full_name: 'X', owner_id: 'u1', notes: 'existing' },
        { full_name: 'X', owner_id: null, notes: '' },
      ).notes,
    ).toBe('existing');
  });
});
