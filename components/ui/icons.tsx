// Line icons on a 24 px grid, 2 px ink stroke (doc 09, section 4). Decorative unless a label is passed.
type IconProps = { size?: number; label?: string };

function Icon({ size = 24, label, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {children}
    </svg>
  );
}

export const SlidersIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="10" cy="17" r="2" />
  </Icon>
);
export const CaretIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m7 10 5 5 5-5" />
  </Icon>
);
// Social marks drawn as line icons in the same 24 px grid, so the share sheet needs no brand assets.
export const WhatsAppIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m3.5 20.5 1.3-4A8.5 8.5 0 1 1 8 19.3z" />
    <path d="M9 8.5c0 3.6 2.9 6.5 6.5 6.5l1-1.6-2-1-1 .8a5 5 0 0 1-2.7-2.7l.8-1-1-2z" />
  </Icon>
);
export const XIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 4h4l12 16h-4zM20 4l-6.6 7.5M4 20l6.6-7.5" />
  </Icon>
);
export const InstagramIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="0.5" />
  </Icon>
);
export const FacebookIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M15 3h-2.5A3.5 3.5 0 0 0 9 6.5V9H7v3.5h2V21h3.5v-8.5H15l.5-3.5h-3V7a1 1 0 0 1 1-1H15z" />
  </Icon>
);
export const HouseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z" />
  </Icon>
);
export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="6" />
    <path d="m20 20-4.5-4.5" />
  </Icon>
);
export const ChevronIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m9 6 6 6-6 6" />
  </Icon>
);
export const PotIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 11h16v3a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6z" />
    <path d="M2 11h20M9 8h6M12 5v3" />
  </Icon>
);
export const CompassIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m15.5 8.5-2 5-5 2 2-5z" />
  </Icon>
);
export const ChefHatIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 17h10v3H7z" />
    <path d="M7 17v-4.2A4 4 0 0 1 8.5 5a4 4 0 0 1 7 0A4 4 0 0 1 17 12.8V17" />
    <path d="M10 13v4M14 13v4" />
  </Icon>
);
export const HeartIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
  </Icon>
);
export const UserIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </Icon>
);
export const SparkleIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
  </Icon>
);
export const DownloadIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
  </Icon>
);
export const ChatIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20l1.5-4A8 8 0 1 1 8.5 19z" />
  </Icon>
);
export const LinkIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </Icon>
);
export const CloseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
);

// The SoWetin mark from public/icon.svg (enamel plate on palm), for the header and cards. Colours come from tokens.
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden>
      <rect width="512" height="512" rx="112" className="fill-palm" />
      <circle cx="256" cy="268" r="150" className="fill-cream stroke-ink" strokeWidth={20} />
      <circle cx="256" cy="268" r="92" className="fill-egusi" />
    </svg>
  );
}
export const BackIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m15 6-6 6 6 6" />
  </Icon>
);
export const CopyIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
  </Icon>
);
export const ShareIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
  </Icon>
);
