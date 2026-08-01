// Small geometric icons built only from basic SVG primitives (circles, rects,
// lines, straight-segment paths) — kept deliberately simple over ornate to
// render cleanly at nav/stat-card sizes without a new icon-library dependency.
type IconProps = { className?: string };

const base = {
  width: 18,
  height: 18,
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function HomeIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <polyline points="3,9 10,3 17,9" />
      <rect x="5" y="9" width="10" height="8" rx="1" />
      <rect x="8.5" y="13" width="3" height="4" />
    </svg>
  );
}

export function CalendarIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="4" width="14" height="13" rx="2" />
      <line x1="3" y1="8" x2="17" y2="8" />
      <line x1="7" y1="2" x2="7" y2="6" />
      <line x1="13" y1="2" x2="13" y2="6" />
      <circle cx="10" cy="12.5" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ChartIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3" y="10" width="3" height="6" fill="currentColor" stroke="none" />
      <rect x="8.5" y="6" width="3" height="10" fill="currentColor" stroke="none" />
      <rect x="14" y="12" width="3" height="4" fill="currentColor" stroke="none" />
      <line x1="2" y1="17" x2="18" y2="17" />
    </svg>
  );
}

export function MegaphoneIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <polygon points="3,8 3,12 7,12 13,16 13,4 7,8" />
      <line x1="15" y1="6" x2="17" y2="4" />
      <line x1="15" y1="14" x2="17" y2="16" />
      <line x1="16.5" y1="10" x2="18.5" y2="10" />
    </svg>
  );
}

export function EnvelopeIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="2" y="4" width="16" height="12" rx="2" />
      <polyline points="2,5 10,12 18,5" />
    </svg>
  );
}

export function SearchIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="8" cy="8" r="5" />
      <line x1="12" y1="12" x2="17" y2="17" />
    </svg>
  );
}

export function DocumentIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M5 2h6l4 4v12H5z" />
      <polyline points="11,2 11,6 15,6" />
      <line x1="7" y1="10" x2="13" y2="10" />
      <line x1="7" y1="13" x2="13" y2="13" />
    </svg>
  );
}

export function NetworkIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <line x1="10" y1="10" x2="10" y2="3.5" />
      <line x1="10" y1="10" x2="16" y2="13" />
      <line x1="10" y1="10" x2="4" y2="13" />
      <circle cx="10" cy="10" r="2" fill="currentColor" stroke="none" />
      <circle cx="10" cy="3.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="16" cy="13" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="4" cy="13" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function PhoneIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="6" y="2" width="8" height="16" rx="2" />
      <line x1="9" y1="16" x2="11" y2="16" />
    </svg>
  );
}

export function GearIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="10" cy="10" r="3" />
      <circle cx="10" cy="10" r="6.5" strokeDasharray="2.2 2.2" />
    </svg>
  );
}

export function UsersIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="7" cy="7" r="3" />
      <circle cx="14.5" cy="8.5" r="2.3" />
      <path d="M2 17c0-3 2.2-5.2 5-5.2s5 2.2 5 5.2" />
      <path d="M12.5 17c0-2 1.3-3.8 3.5-3.8s4 1.8 4 3.8" />
    </svg>
  );
}
