export function LogoMark() {
  return (
    <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden="true">
      <rect width="32" height="32" rx="10" fill="#8d4324" />
      <path
        d="M7 21.5 13 15l4 3.5 8-9"
        fill="none"
        stroke="#fffdf8"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" strokeWidth="1.8" />
      <path d="M16 16.5 20 20.5" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function UpIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M8 2.5 13 9H3L8 2.5Z" fill="currentColor" />
    </svg>
  );
}

export function DownIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
      <path d="M8 13.5 3 7h10L8 13.5Z" fill="currentColor" />
    </svg>
  );
}
