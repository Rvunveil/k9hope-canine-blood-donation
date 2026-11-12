/**
 * K9HOPE wordmark: the "9" doubles as a drop, the mark sits on a single
 * connection line. Inherits text colour.
 */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
        <path d="M13 2.5c3.6 4.6 7 8.6 7 12.6a7 7 0 1 1-14 0c0-4 3.4-8 7-12.6Z" fill="#FF806C" />
        <circle cx="13" cy="15.4" r="2.6" fill="#0B201C" />
      </svg>
      <span className="font-display text-[19px] font-bold tracking-[-0.01em]">
        K9<span className="font-semibold">HOPE</span>
      </span>
    </span>
  );
}
