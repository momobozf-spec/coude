/* Iconen: inline SVG, geen icon-package. Altijd decoratief (aria-hidden); de naam staat op de knop of link. */
import type { ReactNode } from 'react';

function Icon({ children, size = 22, className = '' }: { children: ReactNode; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {children}
    </svg>
  );
}

type P = { size?: number; className?: string };

export const HomeIcon = (p: P) => (
  <Icon {...p}>
    <path d="M3.5 11 12 4l8.5 7" />
    <path d="M5.5 9.5V20h13V9.5" />
    <path d="M10 20v-5h4v5" />
  </Icon>
);

export const SearchIcon = (p: P) => (
  <Icon {...p}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m15.5 15.5 5 5" />
  </Icon>
);

export const ListIcon = (p: P) => (
  <Icon {...p}>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <path d="m3.5 6 1 1 2-2M3.5 12l1 1 2-2M3.5 18l1 1 2-2" />
  </Icon>
);

export const BellIcon = (p: P) => (
  <Icon {...p}>
    <path d="M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Z" />
    <path d="M10 20.5a2 2 0 0 0 4 0" />
  </Icon>
);

export const UserIcon = (p: P) => (
  <Icon {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20.5a8 8 0 0 1 16 0" />
  </Icon>
);

export const ListAddIcon = (p: P) => (
  <Icon {...p}>
    <path d="M4 6h11M4 12h8M4 18h6" />
    <path d="M17 13v8M13 17h8" />
  </Icon>
);

export const BellPlusIcon = (p: P) => (
  <Icon {...p}>
    <path d="M13 3.1A6 6 0 0 0 6 9v5l-1.5 2h12" />
    <path d="M9 19.5a2 2 0 0 0 4 0" />
    <path d="M18 7v8M14 11h8" />
  </Icon>
);

export const FilterIcon = (p: P) => (
  <Icon {...p}>
    <path d="M4 6h16M7 12h10M10 18h4" />
  </Icon>
);

export const ChevronRightIcon = (p: P) => (
  <Icon {...p}>
    <path d="m9 5 7 7-7 7" />
  </Icon>
);

export const ShareIcon = (p: P) => (
  <Icon {...p}>
    <path d="M12 15V3.5M8 7.5l4-4 4 4" />
    <path d="M6 11H5v9.5h14V11h-1" />
  </Icon>
);

export const TagIcon = (p: P) => (
  <Icon {...p}>
    <path d="M3.5 12.5V4.5a1 1 0 0 1 1-1h8l8 8-9 9-8-8Z" />
    <circle cx="8.5" cy="8.5" r="1.4" />
  </Icon>
);

export const InfoIcon = (p: P) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </Icon>
);
