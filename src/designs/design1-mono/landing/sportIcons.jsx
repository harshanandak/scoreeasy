import PropTypes from 'prop-types';

const iconPropTypes = {
  size: PropTypes.number,
  color: PropTypes.string,
};

function VolleyballIcon({ size = 32, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="16" cy="16" r="13.5" />
      <path d="M16 2.5c0 0-1.2 6.8 3.5 12.5s11.2 5.8 11.2 5.8" />
      <path d="M4.2 8.5c0 0 6.2 2.2 12.8 0s9-7.2 9-7.2" />
      <path d="M4 22c0 0 5.5-4.5 4.8-12S3.5 3 3.5 3" />
      <path d="M16 29.5c0 0 1-7-3.8-12.5S1.5 11.5 1.5 11.5" />
      <path d="M28 22.5c0 0-6 2-12.5-.5s-8.8-7.5-8.8-7.5" />
      <path d="M28.5 9c0 0-5.8 4.2-5 12s5 8.5 5 8.5" />
    </svg>
  );
}

function CricketIcon({ size = 32, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 28l3.5-5" />
      <path d="M9.5 23l4-6.5c0.8-1.3 2.5-1.5 3.5-0.5l1.5 1.5c0.8 0.8 0.5 2.2-0.5 3l-6.5 4z" />
      <line x1="22" y1="8" x2="22" y2="22" />
      <line x1="25" y1="8" x2="25" y2="22" />
      <line x1="28" y1="8" x2="28" y2="22" />
      <path d="M21.5 8.5c0.8-1 1.8-1 2.8 0" />
      <path d="M24.5 8.5c0.8-1 1.8-1 2.8 0" />
    </svg>
  );
}

function TennisIcon({ size = 32, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="18" cy="11" rx="7.5" ry="9" transform="rotate(-20 18 11)" />
      <line x1="14" y1="6" x2="14.5" y2="17" />
      <line x1="18" y1="4" x2="18.5" y2="18.5" />
      <line x1="22" y1="5" x2="22" y2="16" />
      <line x1="11.5" y1="9" x2="24" y2="7.5" />
      <line x1="11" y1="13" x2="24.5" y2="11.5" />
      <path d="M12 18.5l-4.5 7" />
      <circle cx="6" cy="6.5" r="2.8" />
      <path d="M4 4.5c1.2 1 2.5 2.8 2.5 4.2" />
    </svg>
  );
}

function PickleballIcon({ size = 32, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="13" cy="13" r="8" />
      <path d="M18.5 18.5l7 7" />
      <path d="M22 22l3-3" />
      <circle cx="20.5" cy="8" r="2.5" />
      <circle cx="10" cy="10" r="0.6" fill={color} stroke="none" />
      <circle cx="13.5" cy="8" r="0.6" fill={color} stroke="none" />
      <circle cx="16" cy="11.5" r="0.6" fill={color} stroke="none" />
      <circle cx="12" cy="14" r="0.6" fill={color} stroke="none" />
      <circle cx="15" cy="16" r="0.6" fill={color} stroke="none" />
    </svg>
  );
}

function SquashIcon({ size = 32, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="14" cy="10" rx="5.5" ry="8" transform="rotate(-28 14 10)" />
      <path d="M17.5 16.5l6.5 9" />
      <path d="M21.5 23.5l3.5-2.5" />
      <path d="M10.5 5.5c2 2.5 4.5 6 6 9" />
      <path d="M8.5 9.5c3 1 7 2 11 1.5" />
      <circle cx="24" cy="7" r="2.4" />
    </svg>
  );
}

function FootballIcon({ size = 32, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="16" cy="16" r="13.5" />
      <path d="M16 8.5l4.5 3.2-1.8 5.3h-5.5l-1.8-5.3z" />
      <path d="M16 8.5l0-6" /><path d="M20.5 11.7l5-2.5" /><path d="M18.7 17l3.5 4.5" /><path d="M13.2 17l-3.5 4.5" /><path d="M11.5 11.7l-5-2.5" />
    </svg>
  );
}

function FutsalIcon({ size = 32, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="5" width="24" height="18" rx="2" />
      <path d="M4 14h24" />
      <path d="M16 5v18" />
      <circle cx="16" cy="14" r="3.5" />
      <circle cx="23" cy="26" r="3" />
      <path d="M20.8 24.2l4.4 3.6" />
      <path d="M25.2 24.2l-4.4 3.6" />
    </svg>
  );
}

function BasketballIcon({ size = 32, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="16" cy="16" r="13.5" /><path d="M2.5 16h27" /><path d="M16 2.5v27" />
      <path d="M5 5.5c3.5 4 5.5 7 5.8 10.5" /><path d="M5.2 26c3.2-3.8 5.2-6.8 5.6-10" />
      <path d="M27 5.5c-3.5 4-5.5 7-5.8 10.5" /><path d="M26.8 26c-3.2-3.8-5.2-6.8-5.6-10" />
    </svg>
  );
}

function KabaddiIcon({ size = 32, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="7" r="3" />
      <path d="M12 10l-2.5 7 4.5 4" />
      <path d="M10.5 14h7" />
      <path d="M17.5 14l3-3" />
      <path d="M14 21l-1.5 6" />
      <path d="M14 21l5 4" />
      <path d="M22 7h5" />
      <path d="M24.5 4.5v5" />
      <path d="M23 20c2 0 3.5-1 4-3" />
    </svg>
  );
}

PickleballIcon.propTypes = iconPropTypes;
SquashIcon.propTypes = iconPropTypes;
FutsalIcon.propTypes = iconPropTypes;
KabaddiIcon.propTypes = iconPropTypes;

function BadmintonIcon({ size = 32, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="16" cy="24" rx="3.5" ry="2.5" />
      <path d="M12.5 24c-2-4-3.5-10-2-16" />
      <path d="M19.5 24c2-4 3.5-10 2-16" />
      <path d="M10.5 8c1.5-1 3.2-1.5 5.5-1.5s4 0.5 5.5 1.5" />
      <path d="M13 21c-0.5-3.5-0.5-8 1-13" />
      <path d="M19 21c0.5-3.5 0.5-8-1-13" />
      <path d="M16 22v-15" />
    </svg>
  );
}

function HockeyIcon({ size = 32, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3l10 18" />
      <path d="M18 21c1 1.8 3 2.8 6 2.8" />
      <path d="M9.5 3.5l10 18" />
      <path d="M19.5 21.5c1 1.5 2.8 2.2 5.5 2.2" />
      <path d="M24 23.8v1.2" />
      <ellipse cx="14" cy="27.5" rx="4.5" ry="1.8" />
    </svg>
  );
}

function TableTennisIcon({ size = 32, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="14" cy="12" r="8.5" />
      <path d="M8 5.5c3.5 3 8.5 9 12 13" />
      <path d="M20 19l4 6.5" />
      <path d="M22 18l4 6.5" />
      <line x1="24" y1="25.5" x2="26" y2="24.5" />
      <circle cx="5.5" cy="25" r="2.5" />
    </svg>
  );
}

function GolfIcon({ size = 32, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4v22" /><path d="M16 4l9 3.5-9 3.5" />
      <path d="M6 26c2.5-1.5 6-2 10-2s7.5 0.5 10 2" /><circle cx="22" cy="24.5" r="2" />
    </svg>
  );
}

function PoolIcon({ size = 32, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 8l8 16h-16z" />
      <circle cx="16" cy="12" r="2" />
      <circle cx="14" cy="16.5" r="2" />
      <circle cx="18" cy="16.5" r="2" />
      <circle cx="12" cy="21" r="2" />
      <circle cx="16" cy="21" r="2" />
      <circle cx="20" cy="21" r="2" />
      <line x1="3" y1="4" x2="13" y2="11" />
    </svg>
  );
}

function ChessIcon({ size = 32, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4v3" /><path d="M14.5 5.5h3" /><path d="M11 10c0-2.8 2.2-3 5-3s5 0.2 5 3" /><path d="M10 10h12" />
      <path d="M11 10l-1 12" /><path d="M21 10l1 12" /><path d="M10 22h12" />
      <path d="M9 22l-0.5 2.5" /><path d="M23 22l0.5 2.5" /><path d="M8.5 24.5h15" /><path d="M8 27h16" />
      <path d="M8.5 24.5l-0.5 2.5" /><path d="M23.5 24.5l0.5 2.5" />
    </svg>
  );
}

function RugbyIcon({ size = 32, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="16" cy="16" rx="13" ry="7.5" transform="rotate(-35 16 16)" />
      <path d="M8.5 8.5l15 15" /><path d="M13.5 12l1.5-1.5" /><path d="M15.5 14l1.5-1.5" /><path d="M17.5 16l1.5-1.5" /><path d="M19.5 18l1.5-1.5" />
    </svg>
  );
}

function FrisbeeIcon({ size = 32, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="18" cy="15" rx="11" ry="4.5" transform="rotate(-8 18 15)" />
      <path d="M7.5 16.5c2.5 2.5 8 3.5 13 2.5s7-3 8-4.5" />
      <ellipse cx="18" cy="14.5" rx="5" ry="2" transform="rotate(-8 18 14.5)" />
      <path d="M2 11h5" />
      <path d="M1 14.5h4.5" />
      <path d="M2.5 18h4" />
    </svg>
  );
}

function HandballIcon({ size = 32, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="16" cy="17" r="10" />
      <path d="M8 12c3 3.5 6.5 5 8 10" />
      <path d="M24 12c-3 3.5-6.5 5-8 10" />
      <path d="M10 10V5.5" />
      <path d="M13.5 8V3" />
      <path d="M17 8V3" />
      <path d="M20.5 8V4" />
      <path d="M23 10.5V7" />
    </svg>
  );
}

export const ICON_MAP = {
  Volleyball: VolleyballIcon, Cricket: CricketIcon, Tennis: TennisIcon,
  Pickleball: PickleballIcon, Squash: SquashIcon,
  Football: FootballIcon, Basketball: BasketballIcon, Badminton: BadmintonIcon,
  Hockey: HockeyIcon, Futsal: FutsalIcon, Kabaddi: KabaddiIcon,
  'Table Tennis': TableTennisIcon, Golf: GolfIcon,
  Pool: PoolIcon, Chess: ChessIcon, Rugby: RugbyIcon,
  Frisbee: FrisbeeIcon, Handball: HandballIcon,
};

export default function SportIcon({ name, size = 32, color = 'currentColor' }) {
  const Icon = ICON_MAP[name];
  return Icon ? <Icon size={size} color={color} /> : null;
}
