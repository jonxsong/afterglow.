type BrandMarkProps = {
  className?: string;
  title?: string;
};

export function BrandMark({ className = "", title = "Afterglow" }: BrandMarkProps) {
  return (
    <svg
      className={`brand-mark ${className}`}
      viewBox="0 0 48 48"
      role={title ? "img" : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="afterglow-sky" x1="24" y1="3" x2="24" y2="45" gradientUnits="userSpaceOnUse">
          <stop stopColor="#766FA7" />
          <stop offset="0.46" stopColor="#D58CA6" />
          <stop offset="1" stopColor="#F2B28D" />
        </linearGradient>
        <clipPath id="afterglow-frame">
          <rect x="2" y="2" width="44" height="44" rx="15" />
        </clipPath>
      </defs>
      <g clipPath="url(#afterglow-frame)">
        <rect x="2" y="2" width="44" height="44" rx="15" fill="url(#afterglow-sky)" />
        <circle cx="24" cy="29" r="7" fill="#FCE1B9" />
        <path d="M-2 39C8 32.6 17.2 33.2 25.7 35.4C34.1 37.5 41.2 36.6 50 31.8V50H-2V39Z" fill="#302B2D" />
        <path d="M5.5 33.8C13.6 30.1 20.4 30.6 27.1 32.1C34.4 33.7 39.2 33.1 44.5 30.2" fill="none" stroke="#FFF8F0" strokeWidth="1.35" strokeLinecap="round" opacity="0.72" />
      </g>
      <rect x="2" y="2" width="44" height="44" rx="15" fill="none" stroke="#24211F" strokeWidth="2" />
    </svg>
  );
}

export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <span className={`brand-logo ${className}`}>
      <BrandMark title="" />
      <span className="wordmark" aria-hidden="true">afterglow<span>.</span></span>
    </span>
  );
}

