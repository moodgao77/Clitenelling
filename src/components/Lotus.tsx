/** Marushika lotus motif — line art in the current gold token. Decorative. */
export default function Lotus({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 96"
      className={className}
      aria-hidden="true"
      fill="none"
      stroke="var(--gold)"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M60 8 C52 28 52 42 60 54 C68 42 68 28 60 8 Z" />
      <path d="M60 54 C47 46 37 35 35 20 C49 25 58 38 60 54 Z" />
      <path d="M60 54 C73 46 83 35 85 20 C71 25 62 38 60 54 Z" />
      <path d="M60 56 C43 54 27 47 17 35 C31 53 45 59 60 56 Z" />
      <path d="M60 56 C77 54 93 47 103 35 C89 53 75 59 60 56 Z" />
      <line x1="60" y1="57" x2="60" y2="72" />
      <circle cx="60" cy="77" r="3.2" fill="var(--gold)" stroke="none" />
    </svg>
  );
}
