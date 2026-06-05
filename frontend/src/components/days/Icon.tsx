import { type ReactNode, type CSSProperties } from 'react';

const ICON_PATHS: Record<string, ReactNode> = {
  user: <><circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c0-3.5 3.1-6 7-6s7 2.5 7 6"/></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></>,
  camera: <><path d="M3 8h3l2-2h8l2 2h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/></>,
  bell: <><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2H4.5z"/><path d="M10 20a2 2 0 0 0 4 0"/></>,
  cake: <><rect x="4" y="12" width="16" height="8" rx="1.5"/><path d="M4 16c2 1.5 4 1.5 6 0s4 1.5 6 0 2 1.5 4 0"/><path d="M9 8v2M12 7v3M15 8v2"/><circle cx="9" cy="6.5" r="0.7" fill="currentColor"/><circle cx="12" cy="5.5" r="0.7" fill="currentColor"/><circle cx="15" cy="6.5" r="0.7" fill="currentColor"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 14.6a1.7 1.7 0 0 0 .4 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.4 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .4-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.4-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.4h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.9-.4l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.4 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></>,
  'chevron-left': <path d="M15 6l-6 6 6 6"/>,
  'chevron-right': <path d="M9 6l6 6-6 6"/>,
  'arrow-left': <><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></>,
  'arrow-right': <><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></>,
  'arrow-up': <><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></>,
  plus: <path d="M12 5v14M5 12h14"/>,
  close: <path d="M6 6l12 12M18 6L6 18"/>,
  check: <path d="M4 12l5 5L20 6"/>,
  pencil: <><path d="M14 4l6 6L9 21l-7 1 1-7z"/><path d="M14 4l4 4"/></>,
  cloud: <path d="M7 18h11a4 4 0 1 0-1-7.9 6 6 0 0 0-11.5 1.4A3.5 3.5 0 0 0 7 18z"/>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></>,
  book: <><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19a2 2 0 0 1 2-2h13"/></>,
  sparkles: <><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z"/><path d="M19 16l.7 1.8L21.5 18.5l-1.8.7L19 21l-.7-1.8L16.5 18.5l1.8-.7z"/></>,
  home: <><path d="M3 12L12 3l9 9"/><path d="M9 21V12h6v9"/><path d="M3 12v9h18v-9"/></>,
  sunrise: <><path d="M12 7V3M4.2 10.2l2.8 2.8M19.8 10.2l-2.8 2.8M2 17h20M5 17a7 7 0 0 1 14 0"/></>,
  save: <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/></>,
  download: <><path d="M12 4v12M5 10l7 7 7-7"/><path d="M4 20h16"/></>,
  'share-ios': <><path d="M4 13v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M12 3v12M8 7l4-4 4 4"/></>,
  music: <><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></>,
  film: <><rect x="2" y="2" width="20" height="20" rx="2.5"/><path d="M7 2v20M17 2v20M2 12h20M2 7h5M17 7h5M2 17h5M17 17h5"/></>,
  'map-pin': <><path d="M12 21C12 21 5 13.5 5 8.5a7 7 0 0 1 14 0c0 5-7 12.5-7 12.5z"/><circle cx="12" cy="8.5" r="2.5"/></>,
  users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
};

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  stroke?: number;
  style?: CSSProperties;
}

export function Icon({ name, size = 20, color = 'currentColor', stroke = 1.75, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label={name}
      role="img"
      style={{ flexShrink: 0, ...style }}
    >
      {ICON_PATHS[name] ?? null}
    </svg>
  );
}

export { ICON_PATHS };
