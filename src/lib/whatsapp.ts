/**
 * Build a click-to-chat link. wa.me expects digits only (no leading +).
 * The associate messages from their own WhatsApp; we never use the API.
 */
export function waLink(e164: string, message: string): string {
  const digits = e164.replace(/[^\d]/g, '');
  const text = encodeURIComponent(message);
  return `https://wa.me/${digits}?text=${text}`;
}

/** A friendly default opener the associate can edit before sending. */
export function defaultMessage(name: string): string {
  const first = (name || '').trim().split(' ')[0];
  return first
    ? `Hi ${first}, this is your stylist from the showroom. `
    : `Hi, this is your stylist from the showroom. `;
}
