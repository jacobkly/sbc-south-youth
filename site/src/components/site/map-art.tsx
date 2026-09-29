/**
 * A drawn map with a pin, standing in for a real static map image of the
 * church (no Maps API key needed). It's decorative: the address and the
 * Directions button beside it carry the information.
 *
 * TODO(leadership): swap for a static map image of the real location.
 */
export function MapArt({ label, className = "" }: { label: string; className?: string }) {
  return (
    <div aria-hidden className={`absolute inset-0 overflow-hidden bg-[#111218] ${className}`}>
      <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full">
        {/* A park and the church block. */}
        <rect x="36" y="206" width="120" height="70" rx="10" fill="#17a589" fillOpacity="0.14" />
        <rect x="262" y="120" width="92" height="56" rx="8" className="fill-accent/10 stroke-accent/35" />
        <g stroke="#ffffff" strokeLinecap="round" fill="none">
          {/* Side streets. */}
          <g strokeOpacity="0.06" strokeWidth="3">
            <path d="M0 40 H400" />
            <path d="M0 110 H400" />
            <path d="M0 250 H400" />
            <path d="M60 0 V300" />
            <path d="M170 0 V300" />
            <path d="M360 0 V300" />
          </g>
          {/* Main roads. */}
          <g strokeOpacity="0.12">
            <path d="M-10 196 H410" strokeWidth="14" />
            <path d="M240 -10 V310" strokeWidth="10" />
            <path d="M-10 20 C 120 60, 200 150, 410 150" strokeWidth="7" />
          </g>
        </g>
      </svg>

      {/* The pin sits on the church block. */}
      <div className="absolute top-[49%] left-[76%] -translate-1/2">
        <span className="absolute inset-0 rounded-full bg-accent/40 motion-safe:animate-ping" />
        <span className="relative grid size-7 place-items-center rounded-full bg-accent ring-6 ring-accent/18">
          <span className="size-2.5 rounded-full bg-[#0b0b0f]" />
        </span>
      </div>
      <p className="absolute top-[49%] right-[calc(24%+1.25rem)] -translate-y-1/2 rounded-full bg-[#0b0b0f]/80 px-3 py-1 text-small font-semibold text-white ring-1 ring-white/15 backdrop-blur">
        {label}
      </p>
      <div className="grain absolute inset-0 opacity-20 mix-blend-overlay" />
    </div>
  );
}
