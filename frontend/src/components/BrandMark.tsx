const BrandMark = ({ className = '' }: { className?: string }) => (
  <span aria-hidden="true" className={className}>
    <svg fill="none" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <rect fill="url(#brandmark-gradient)" height="64" rx="18" width="64" />
      <path
        d="M20 25.5C20 21.3579 23.3579 18 27.5 18C31.6421 18 35 21.3579 35 25.5C35 29.6421 31.6421 33 27.5 33C23.3579 33 20 29.6421 20 25.5Z"
        fill="white"
        fillOpacity="0.95"
      />
      <path
        d="M35.5 27.5C35.5 24.4624 37.9624 22 41 22C44.0376 22 46.5 24.4624 46.5 27.5C46.5 30.5376 44.0376 33 41 33C37.9624 33 35.5 30.5376 35.5 27.5Z"
        fill="white"
        fillOpacity="0.65"
      />
      <path
        d="M16.5 45C18.1022 39.9826 22.7957 36.5 28.125 36.5H30.375C34.2376 36.5 37.748 38.3291 40 41.25"
        stroke="white"
        strokeLinecap="round"
        strokeWidth="5"
      />
      <path
        d="M39 44.5L43.5 49L51 39.5"
        stroke="white"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="5"
      />
      <defs>
        <linearGradient gradientUnits="userSpaceOnUse" id="brandmark-gradient" x1="7" x2="58" y1="6" y2="60">
          <stop stopColor="#4F46E5" />
          <stop offset="1" stopColor="#10B981" />
        </linearGradient>
      </defs>
    </svg>
  </span>
);

export default BrandMark;
