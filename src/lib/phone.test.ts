import { describe, it, expect } from 'vitest';
import { normalizePhone } from './phone';

describe('normalizePhone (region AE)', () => {
  it.each([
    ['+971501234567', '+971501234567'],
    ['0501234567', '+971501234567'],
    ['501234567', '+971501234567'],
    ['05 0123 4567', '+971501234567'],
    ['00971501234567', '+971501234567'],
  ])('resolves %s to one identity %s', (raw, e164) => {
    expect(normalizePhone(raw)).toEqual({ ok: true, e164 });
  });

  it('accepts valid non-UAE numbers', () => {
    expect(normalizePhone('+966501234567')).toEqual({ ok: true, e164: '+966501234567' });
  });

  it.each([['', 'empty'], ['abc', 'letters'], ['123', 'too short']])(
    'rejects %s (%s)',
    (raw) => {
      expect(normalizePhone(raw).ok).toBe(false);
    },
  );
});
