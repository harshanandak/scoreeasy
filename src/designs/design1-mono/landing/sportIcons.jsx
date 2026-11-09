import { useId } from 'react';
import PropTypes from 'prop-types';

const iconPropTypes = {
  size: PropTypes.number,
  color: PropTypes.string,
  strokeWidth: PropTypes.number,
};

// Owner-approved set (forge-1049). Solid glyphs on a 24x24 grid painted with the `color` prop;
// only hockey and kabaddi are stroke-drawn. Cut-outs use evenodd paths where they can, and a
// luminance <mask> (white/black keywords, no raw colour literals) where seams must reach the edge.
// Frisbee keeps its original 32x32 outline drawing.

// Mask ids must be unique per rendered instance: many icons share one page.
function useMaskId(prefix) {
  return `${prefix}-${useId().replaceAll(':', '')}`;
}

// Hockey and kabaddi are stroke-drawn at the widths below. A caller that passes strokeWidth
// scales them against the Kit's standard stroke of 2; with no strokeWidth the designed widths apply.
const DESIGN_STROKE = 2;
const strokeScale = (strokeWidth) => (strokeWidth === undefined ? 1 : strokeWidth / DESIGN_STROKE);

const SOLID = { viewBox: '0 0 24 24' };

// Volleyball adapts Lucide `volleyball` (ISC); the licence notice is in THIRD_PARTY_NOTICES.md.
function VolleyballIcon({ size = 32, color = 'currentColor' }) {
  const maskId = useMaskId('se-volleyball');
  const seam = { fill: 'none', stroke: 'black', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
  return (
    <svg width={size} height={size} {...SOLID}>
      <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
        <rect width="24" height="24" fill="white" />
        <path d="M11.1 7.1a16.55 16.55 0 0 1 10.9 4" {...seam} />
        <path d="M12 12a12.6 12.6 0 0 1-8.7 5" {...seam} />
        <path d="M16.8 13.6a16.55 16.55 0 0 1-9 7.5" {...seam} />
        <path d="M20.7 17a12.8 12.8 0 0 0-8.7-5 13.3 13.3 0 0 1 0-10" {...seam} />
        <path d="M6.3 3.8a16.55 16.55 0 0 0 1.9 11.5" {...seam} />
      </mask>
      <g mask={`url(#${maskId})`}>
        <circle cx="12" cy="12" r="10" fill={color} />
      </g>
    </svg>
  );
}

function CricketIcon({ size = 32, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} {...SOLID} fill={color}>
      <path d="M9.3 7L11.5 7L11.5 21.4L9.3 21.4zM12.8 7L15 7L15 21.4L12.8 21.4zM16.3 7L18.5 7L18.5 21.4L16.3 21.4z" />
      <path d="M9.6 4.2L13.5 4.2L13.5 5.8L9.6 5.8zM14.3 4.2L18.2 4.2L18.2 5.8L14.3 5.8z" />
      <path fillRule="evenodd" d="M1.5 17.6a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0 -7 0zM2.71 19.21A3.33 3.33 0 0 1 7.29 15.99A9.33 9.33 0 0 0 2.71 19.21z" />
    </svg>
  );
}

function TennisIcon({ size = 32, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} {...SOLID} fill={color}>
      <path fillRule="evenodd" d="M6.3 6.54A5.5 7.1 22 1 1 16.5 10.66A5.5 7.1 22 1 1 6.3 6.54zM8.25 7.33A3.4 5 22 1 1 14.55 9.87A3.4 5 22 1 1 8.25 7.33z" />
      <path d="M13.08 2.91L8.66 13.85L9.72 14.29L14.14 3.35zM7.95 5.67L15.92 8.89L16.35 7.82L8.38 4.6zM6.49 9.28L14.46 12.51L14.89 11.44L6.92 8.22zM7.81 14.16L4.81 21.58L7.13 22.51L10.12 15.09z" />
      <path fillRule="evenodd" d="M15.2 18.2a3.2 3.2 0 1 0 6.4 0a3.2 3.2 0 1 0 -6.4 0zM16.3 16.73A2.91 2.91 0 0 1 20.5 19.67A6.52 6.52 0 0 0 16.3 16.73z" />
    </svg>
  );
}

function FootballIcon({ size = 32, color = 'currentColor' }) {
  const maskId = useMaskId('se-football');
  return (
    <svg width={size} height={size} {...SOLID}>
      <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
        <rect width="24" height="24" fill="white" />
        <path d="M12 8L15.8 10.76L14.35 15.24L9.65 15.24L8.2 10.76z" fill="black" />
        <path d="M12 5.5L8.67 3.08L9.94 -0.83L14.06 -0.83L15.33 3.08z" fill="black" />
        <path d="M18.18 9.99L19.45 6.08L23.57 6.08L24.84 9.99L21.51 12.41z" fill="black" />
        <path d="M15.82 17.26L19.94 17.26L21.21 21.17L17.88 23.59L14.55 21.17z" fill="black" />
        <path d="M8.18 17.26L9.45 21.17L6.12 23.59L2.79 21.17L4.06 17.26z" fill="black" />
        <path d="M5.82 9.99L2.49 12.41L-0.84 9.99L0.43 6.08L4.55 6.08z" fill="black" />
        <circle cx="12" cy="12" r="9.25" fill="none" stroke="white" strokeWidth="1.5" />
      </mask>
      <g mask={`url(#${maskId})`}>
        <circle cx="12" cy="12" r="10" fill={color} />
      </g>
    </svg>
  );
}

function BasketballIcon({ size = 32, color = 'currentColor' }) {
  const maskId = useMaskId('se-basketball');
  return (
    <svg width={size} height={size} {...SOLID}>
      <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
        <rect width="24" height="24" fill="white" />
        <g transform="rotate(-20 12 12)" fill="none" stroke="black">
          <path d="M12 0V24M0 12H24" strokeWidth="1.6" />
          <path d="M4 3.8A9.61 9.61 0 0 1 4 20.2M20 3.8A9.61 9.61 0 0 0 20 20.2" strokeWidth="1.5" />
        </g>
      </mask>
      <g mask={`url(#${maskId})`}>
        <circle cx="12" cy="12" r="10" fill={color} />
      </g>
    </svg>
  );
}

function KabaddiIcon({ size = 32, color = 'currentColor', strokeWidth }) {
  const k = strokeScale(strokeWidth);
  const limb = { fill: 'none', stroke: color, strokeLinecap: 'round', strokeLinejoin: 'round' };
  return (
    <svg width={size} height={size} {...SOLID}>
      <rect x="17" y="2" width="1.9" height="4.2" rx="0.95" fill={color} />
      <rect x="17" y="7.4" width="1.9" height="3" rx="0.95" fill={color} />
      <rect x="17" y="17.6" width="1.9" height="4.4" rx="0.95" fill={color} />
      <circle cx="12.4" cy="6.2" r="2.6" fill={color} />
      <path d="M10.6 10.8L6.4 14.4" {...limb} strokeWidth={4.2 * k} />
      <path d="M10.6 10.8L20.6 12.6" {...limb} strokeWidth={3.2 * k} />
      <path d="M6.4 14.4L11.6 17L12 21.8" {...limb} strokeWidth={3.6 * k} />
      <path d="M6.4 14.4L3.8 18.2L2.2 21.8" {...limb} strokeWidth={3.4 * k} />
    </svg>
  );
}

KabaddiIcon.propTypes = iconPropTypes;

function BadmintonIcon({ size = 32, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} {...SOLID} fill={color}>
      <path fillRule="evenodd" d="M11.68 1.81Q18.81 3.88 22.09 10.55L11.06 16.7L7.54 13.74zM9.88 14.53A19.91 19.91 0 0 1 16.24 6.94A19.91 19.91 0 0 1 9.88 14.53zM8.81 13.63A20.56 20.56 0 0 1 13.79 4.89A20.56 20.56 0 0 1 8.81 13.63zM10.95 15.43A20.56 20.56 0 0 1 18.69 9A20.56 20.56 0 0 1 10.95 15.43z" />
      <path fillRule="evenodd" d="M4.32 18.05a2.6 2.6 0 1 0 5.2 0a2.6 2.6 0 1 0 -5.2 0z" />
    </svg>
  );
}

function HockeyIcon({ size = 32, color = 'currentColor', strokeWidth }) {
  const k = strokeScale(strokeWidth);
  const stick = { fill: 'none', stroke: color, strokeLinecap: 'round', strokeLinejoin: 'round' };
  return (
    <svg width={size} height={size} {...SOLID}>
      <path d="M21 3L14.6 15.6" {...stick} strokeWidth={3 * k} />
      <path d="M14.6 15.6C13.4 18 11.8 19.8 9.2 19.8" {...stick} strokeWidth={4 * k} />
      <circle cx="3.8" cy="19" r="2.6" fill={color} />
    </svg>
  );
}

function TableTennisIcon({ size = 32, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} {...SOLID} fill={color}>
      <circle cx="13.6" cy="9.6" r="6.9" />
      <path d="M10.84 14.34L6.32 19.71L3.49 16.88L8.86 12.36z" />
      <circle cx="4.9" cy="18.3" r="2" />
      <circle cx="19.4" cy="19.4" r="2.8" />
    </svg>
  );
}

function GolfIcon({ size = 32, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} {...SOLID} fill={color}>
      <path d="M7.4 2.6L7.4 19.6L9.4 19.6L9.4 2.6zM9.4 3.2L19.4 6.9L9.4 10.6z" />
      <path d="M2.4 21.2A17.34 17.34 0 0 1 21.6 21.2A153.75 153.75 0 0 0 2.4 21.2z" />
      <path fillRule="evenodd" d="M14 16.1a2.4 2.4 0 1 0 4.8 0a2.4 2.4 0 1 0 -4.8 0z" />
    </svg>
  );
}

function PoolIcon({ size = 32, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} {...SOLID} fill={color}>
      <path fillRule="evenodd" d="M2 12a10 10 0 1 0 20 0a10 10 0 1 0 -20 0zM6.8 12a5.2 5.2 0 1 0 10.4 0a5.2 5.2 0 1 0 -10.4 0z" />
      <path fillRule="evenodd" d="M10.45 10.3a1.55 1.55 0 1 0 3.1 0a1.55 1.55 0 1 0 -3.1 0zM11.38 10.3a0.62 0.62 0 1 0 1.24 0a0.62 0.62 0 1 0 -1.24 0zM10.15 13.5a1.85 1.85 0 1 0 3.7 0a1.85 1.85 0 1 0 -3.7 0zM11.18 13.5a0.82 0.82 0 1 0 1.64 0a0.82 0.82 0 1 0 -1.64 0z" />
    </svg>
  );
}

function ChessIcon({ size = 32, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} {...SOLID} fill={color}>
      <path fillRule="evenodd" d="M8.9 6.3a3.1 3.1 0 1 0 6.2 0a3.1 3.1 0 1 0 -6.2 0z" />
      <path fillRule="evenodd" d="M7.9 10.4h8.2a1 1 0 0 1 1 1v.2a1 1 0 0 1-1 1H7.9a1 1 0 0 1-1-1v-.2a1 1 0 0 1 1-1z" />
      <path fillRule="evenodd" d="M9.5 13.4h5c0 2.6 1.3 4.2 2.9 5.6H6.6c1.6-1.4 2.9-3 2.9-5.6z" />
      <path fillRule="evenodd" d="M5.8 19.7h12.4a.9.9 0 0 1 .9.9v.5a.9.9 0 0 1-.9.9H5.8a.9.9 0 0 1-.9-.9v-.5a.9.9 0 0 1 .9-.9z" />
    </svg>
  );
}

function FrisbeeIcon({ size = 32, color = 'currentColor', strokeWidth = 1.5 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="18" cy="15" rx="11" ry="4.5" transform="rotate(-8 18 15)" />
      <path d="M7.5 16.5c2.5 2.5 8 3.5 13 2.5s7-3 8-4.5" />
      <ellipse cx="18" cy="14.5" rx="5" ry="2" transform="rotate(-8 18 14.5)" />
      <path d="M2 11h5" />
      <path d="M1 14.5h4.5" />
      <path d="M2.5 18h4" />
    </svg>
  );
}


export const ICON_MAP = {
  Volleyball: VolleyballIcon, Cricket: CricketIcon, Tennis: TennisIcon,
  Football: FootballIcon, Basketball: BasketballIcon, Badminton: BadmintonIcon,
  Hockey: HockeyIcon, Kabaddi: KabaddiIcon,
  'Table Tennis': TableTennisIcon, Golf: GolfIcon,
  Pool: PoolIcon, Chess: ChessIcon, Frisbee: FrisbeeIcon,
};

// The same sport icons keyed by registry id (registry names differ in case, e.g. 'Table Tennis').
export const ICON_BY_SPORT_ID = {
  volleyball: VolleyballIcon, cricket: CricketIcon, tennis: TennisIcon,
  football: FootballIcon, basketball: BasketballIcon, badminton: BadmintonIcon,
  hockey: HockeyIcon, kabaddi: KabaddiIcon, tabletennis: TableTennisIcon,
};

// strokeWidth is forwarded only when the caller sets it: frisbee falls back to 1.5, hockey and
// kabaddi to their designed widths, and the solid icons ignore it.
export default function SportIcon({ name, size = 32, color = 'currentColor', strokeWidth }) {
  const Icon = ICON_MAP[name];
  return Icon ? <Icon size={size} color={color} strokeWidth={strokeWidth} /> : null;
}
