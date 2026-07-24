import { parsePhoneNumberFromString } from 'libphonenumber-js';

export type PhoneResult = { ok: true; e164: string } | { ok: false; error: string };

/**
 * Normalize a raw phone string to E.164 using UAE (+971) as the default region.
 * This is the identity key for the whole tool: +971..., 0..., and bare local
 * numbers for the same line all resolve to a single canonical value.
 */
export function normalizePhone(raw: string): PhoneResult {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return { ok: false, error: 'Phone is required' };
  const parsed = parsePhoneNumberFromString(trimmed, 'AE');
  if (!parsed || !parsed.isValid()) return { ok: false, error: 'Not a valid phone number' };
  return { ok: true, e164: parsed.number };
}
