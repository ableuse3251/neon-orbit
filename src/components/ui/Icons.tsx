import React, { useState, useEffect, useRef } from 'react';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  color?: string;
  glowColor?: string;
  className?: string;
}

// 1. Sleek Orbit Rocket Icon
export const OrbitRocketIcon: React.FC<IconProps> = ({
  size = 20,
  color = '#00f5d4',
  glowColor = '#00f5d4',
  className = '',
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`transition-all duration-200 ${className}`}
    style={{ filter: glowColor ? `drop-shadow(0 0 6px ${glowColor})` : undefined }}
    {...props}
  >
    <defs>
      <linearGradient id="rocketGrad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#00f5d4" />
        <stop offset="100%" stopColor="#9d4edd" />
      </linearGradient>
    </defs>
    <path
      d="M12 2.5C12 2.5 17.5 5 18.5 11C18.5 14 17 17.5 15.5 19L12 16.5L8.5 19C7 17.5 5.5 14 5.5 11C6.5 5 12 2.5 12 2.5Z"
      fill="url(#rocketGrad)"
      fillOpacity="0.25"
      stroke={color}
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="10" r="2" fill={color} />
    <path
      d="M4.5 15L2 17.5L5 18"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M19.5 15L22 17.5L19 18"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12 17V22"
      stroke="#ff007f"
      strokeWidth="2"
      strokeLinecap="round"
      style={{ filter: 'drop-shadow(0 0 4px #ff007f)' }}
    />
  </svg>
);

// 2. Futuristic Hangar Ship Icon
export const HangarShipIcon: React.FC<IconProps> = ({
  size = 20,
  color = '#00f5d4',
  glowColor = '#00f5d4',
  className = '',
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`transition-all duration-200 ${className}`}
    style={{ filter: glowColor ? `drop-shadow(0 0 6px ${glowColor})` : undefined }}
    {...props}
  >
    <defs>
      <linearGradient id="hangarGrad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#00f5d4" />
        <stop offset="100%" stopColor="#00b4d8" />
      </linearGradient>
    </defs>
    <path
      d="M12 3L20 8V18L12 21L4 18V8L12 3Z"
      fill="url(#hangarGrad)"
      fillOpacity="0.15"
      stroke={color}
      strokeWidth="1.75"
      strokeLinejoin="round"
    />
    <path
      d="M12 7L16 14H8L12 7Z"
      fill={color}
      fillOpacity="0.8"
      stroke={color}
      strokeWidth="1"
    />
    <path d="M12 14V18" stroke="#ffb703" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

// 3. Cosmic Ranks Crown Icon
export const RanksCrownIcon: React.FC<IconProps> = ({
  size = 20,
  color = '#ffb703',
  glowColor = '#ffb703',
  className = '',
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`transition-all duration-200 ${className}`}
    style={{ filter: glowColor ? `drop-shadow(0 0 6px ${glowColor})` : undefined }}
    {...props}
  >
    <path
      d="M3 18L5 8L9.5 12L12 5L14.5 12L19 8L21 18H3Z"
      fill="#ffb703"
      fillOpacity="0.2"
      stroke={color}
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="5" cy="7" r="1.25" fill="#ffb703" />
    <circle cx="12" cy="4" r="1.5" fill="#00f5d4" />
    <circle cx="19" cy="7" r="1.25" fill="#ffb703" />
    <path d="M5 20H19" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// 4. Daily Flame & Streak Icon
export const DailyStreakIcon: React.FC<IconProps> = ({
  size = 20,
  color = '#ff007f',
  glowColor = '#ff007f',
  className = '',
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`transition-all duration-200 ${className}`}
    style={{ filter: glowColor ? `drop-shadow(0 0 6px ${glowColor})` : undefined }}
    {...props}
  >
    <defs>
      <linearGradient id="flameGrad" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#ff007f" />
        <stop offset="100%" stopColor="#ffb703" />
      </linearGradient>
    </defs>
    <path
      d="M12 2C12 2 15.5 5.5 15.5 9.5C15.5 11.5 14.5 13 13.5 14C15.5 14 18.5 12.5 18.5 9.5C18.5 15.5 14.5 21 10.5 21C6.5 21 4.5 17 4.5 13.5C4.5 8.5 9.5 5 12 2Z"
      fill="url(#flameGrad)"
      fillOpacity="0.3"
      stroke={color}
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12 13C12 13 13.5 14.5 13.5 16C13.5 17.5 12.5 19 11 19C9.5 19 8.5 17.5 8.5 16.5C8.5 14.5 11 13.5 12 13Z"
      fill="#ffb703"
    />
  </svg>
);

// 5. Quests Target Crosshair Icon
export const QuestsTargetIcon: React.FC<IconProps> = ({
  size = 20,
  color = '#9d4edd',
  glowColor = '#9d4edd',
  className = '',
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`transition-all duration-200 ${className}`}
    style={{ filter: glowColor ? `drop-shadow(0 0 6px ${glowColor})` : undefined }}
    {...props}
  >
    <circle cx="12" cy="12" r="8" stroke={color} strokeWidth="1.75" />
    <circle cx="12" cy="12" r="3" fill={color} fillOpacity="0.4" stroke={color} strokeWidth="1.5" />
    <path d="M12 2V6" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
    <path d="M12 18V22" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
    <path d="M2 12H6" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
    <path d="M18 12H22" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
  </svg>
);

// 6. Squad / Friends Pilots Icon
export const SquadUsersIcon: React.FC<IconProps> = ({
  size = 20,
  color = '#00f5d4',
  glowColor = '#00f5d4',
  className = '',
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`transition-all duration-200 ${className}`}
    style={{ filter: glowColor ? `drop-shadow(0 0 6px ${glowColor})` : undefined }}
    {...props}
  >
    <path
      d="M16 21V19C16 16.7909 14.2091 15 12 15C9.79086 15 8 16.7909 8 19V21"
      stroke={color}
      strokeWidth="1.75"
      strokeLinecap="round"
    />
    <circle cx="12" cy="8" r="4" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.75" />
    <path
      d="M21 21V19C20.9986 17.18 19.78 15.6 18 15.13"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      opacity="0.7"
    />
    <path
      d="M17 4.13001C18.78 4.60001 19.9986 6.18001 20 8.00001C19.9986 9.82001 18.78 11.4 17 11.87"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      opacity="0.7"
    />
  </svg>
);

// 7. Stardust Crystal Icon
export const StardustCrystalIcon: React.FC<IconProps> = ({
  size = 18,
  color = '#ffb703',
  glowColor = '#ffb703',
  className = '',
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`transition-all duration-200 ${className}`}
    style={{ filter: glowColor ? `drop-shadow(0 0 5px ${glowColor})` : undefined }}
    {...props}
  >
    <path
      d="M12 2L17 7L12 22L7 7L12 2Z"
      fill={color}
      fillOpacity="0.3"
      stroke={color}
      strokeWidth="1.75"
      strokeLinejoin="round"
    />
    <path d="M12 2V22" stroke={color} strokeWidth="1.25" opacity="0.8" />
    <path d="M7 7H17" stroke={color} strokeWidth="1.25" opacity="0.8" />
  </svg>
);

// 8. Telegram Stars XTR Icon
export const StarXtrIcon: React.FC<IconProps> = ({
  size = 18,
  color = '#ffb703',
  glowColor = '#ffb703',
  className = '',
  ...props
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`transition-all duration-200 ${className}`}
    style={{ filter: glowColor ? `drop-shadow(0 0 6px ${glowColor})` : undefined }}
    {...props}
  >
    <defs>
      <linearGradient id="starGrad" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#ffe600" />
        <stop offset="100%" stopColor="#ff9100" />
      </linearGradient>
    </defs>
    <path
      d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
      fill="url(#starGrad)"
      stroke="#ffffff"
      strokeWidth="1.25"
      strokeLinejoin="round"
    />
  </svg>
);

// ----------------------------------------------------
// NEW MODERN CATEGORY BADGES (Inspired by thiings.co)
// ----------------------------------------------------

export const ShipCategoryIcon: React.FC<IconProps> = ({ size = 20, color = '#00f5d4' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 2L20 18L12 14L4 18L12 2Z" fill={color} fillOpacity="0.25" stroke={color} strokeWidth="1.75" strokeLinejoin="round" />
    <path d="M12 14V22" stroke="#ff007f" strokeWidth="2" strokeLinecap="round" />
    <circle cx="12" cy="8" r="2" fill={color} />
  </svg>
);

export const TrailCategoryIcon: React.FC<IconProps> = ({ size = 20, color = '#ff007f' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M4 18C8 18 10 6 20 6" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    <path d="M4 14C7 14 9 10 16 10" stroke="#00f5d4" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
    <circle cx="20" cy="6" r="2.5" fill={color} />
    <circle cx="16" cy="10" r="1.5" fill="#00f5d4" />
  </svg>
);

export const BackdropCategoryIcon: React.FC<IconProps> = ({ size = 20, color = '#9d4edd' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="4" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.75" />
    <circle cx="8.5" cy="8.5" r="2" fill="#ffb703" />
    <path d="M3 16L8 11L14 17L18 13L21 16" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ExplosionCategoryIcon: React.FC<IconProps> = ({ size = 20, color = '#ffb703' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 2L14.5 8.5L21 9.5L16 14L17.5 21L12 17.5L6.5 21L8 14L3 9.5L9.5 8.5L12 2Z" fill={color} fillOpacity="0.3" stroke={color} strokeWidth="1.75" strokeLinejoin="round" />
    <circle cx="12" cy="12" r="3" fill="#ff007f" />
  </svg>
);

export const FrameCategoryIcon: React.FC<IconProps> = ({ size = 20, color = '#00f5d4' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="3" stroke={color} strokeWidth="2" strokeDasharray="3 3" />
    <rect x="6" y="6" width="12" height="12" rx="2" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.5" />
  </svg>
);

export const ThemeCategoryIcon: React.FC<IconProps> = ({ size = 20, color = '#ff007f' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="8" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.75" />
    <circle cx="9" cy="10" r="1.5" fill="#00f5d4" />
    <circle cx="15" cy="10" r="1.5" fill="#ffb703" />
    <circle cx="12" cy="15" r="1.5" fill="#ff007f" />
  </svg>
);

export const TitleCategoryIcon: React.FC<IconProps> = ({ size = 20, color = '#ffb703' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M5 16L3 5L8.5 9L12 3L15.5 9L21 5L19 16H5Z" fill={color} fillOpacity="0.25" stroke={color} strokeWidth="1.75" strokeLinejoin="round" />
    <path d="M5 19H19" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// ----------------------------------------------------
// 3D RANK EMBLEMS & SHIELDS (BRONZE TO GRANDMASTER)
// ----------------------------------------------------

export const RankShield3D: React.FC<{ tier: string; size?: number; className?: string }> = ({
  tier = 'bronze',
  size = 32,
  className = '',
}) => {
  const configs: Record<string, { mainGrad: [string, string]; stroke: string; glow: string; label: string }> = {
    bronze: { mainGrad: ['#cd7f32', '#8b4513'], stroke: '#e69a58', glow: 'rgba(205,127,50,0.5)', label: 'I' },
    silver: { mainGrad: ['#e0e0e0', '#808080'], stroke: '#ffffff', glow: 'rgba(224,224,224,0.5)', label: 'II' },
    gold: { mainGrad: ['#ffd700', '#ff8c00'], stroke: '#ffe600', glow: 'rgba(255,215,0,0.6)', label: 'III' },
    platinum: { mainGrad: ['#00f5d4', '#0077b6'], stroke: '#80ffea', glow: 'rgba(0,245,212,0.6)', label: 'IV' },
    diamond: { mainGrad: ['#b9f2ff', '#7000ff'], stroke: '#e0f8ff', glow: 'rgba(185,242,255,0.7)', label: 'V' },
    master: { mainGrad: ['#ff007f', '#9d4edd'], stroke: '#ff66b3', glow: 'rgba(255,0,127,0.7)', label: 'M' },
    grandmaster: { mainGrad: ['#ffb703', '#ff007f'], stroke: '#ffffff', glow: 'rgba(255,183,3,0.85)', label: 'GM' },
  };

  const cfg = configs[tier.toLowerCase()] || configs.bronze;

  return (
    <div
      className={`inline-flex items-center justify-center relative shrink-0 transition-transform duration-200 hover:scale-105 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        style={{ filter: `drop-shadow(0 0 8px ${cfg.glow})` }}
      >
        <defs>
          <linearGradient id={`rankGrad_${tier}`} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={cfg.mainGrad[0]} />
            <stop offset="100%" stopColor={cfg.mainGrad[1]} />
          </linearGradient>
        </defs>
        {/* Outer Shield */}
        <path
          d="M16 2L28 7V16C28 23.5 22.5 28.5 16 30C9.5 28.5 4 23.5 4 16V7L16 2Z"
          fill={`url(#rankGrad_${tier})`}
          stroke={cfg.stroke}
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        {/* Inner Facet Lines */}
        <path
          d="M16 4V28M8 9L24 23M24 9L8 23"
          stroke={cfg.stroke}
          strokeWidth="0.75"
          opacity="0.35"
        />
        {/* Core Star Emblem */}
        <circle cx="16" cy="15" r="5" fill="#0b071e" stroke={cfg.stroke} strokeWidth="1" />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-pixel text-[9px] font-bold tracking-tighter text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
        style={{ fontSize: Math.max(9, Math.round(size * 0.32)) }}
      >
        {cfg.label}
      </span>
    </div>
  );
};

// ----------------------------------------------------
// 3D LOOT CHESTS & VAULT ICONS
// ----------------------------------------------------

export const DailyChest3DIcon: React.FC<IconProps> = ({ size = 28, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    className={`transition-all duration-200 ${className}`}
    style={{ filter: 'drop-shadow(0 0 8px rgba(255, 183, 3, 0.6))' }}
  >
    <defs>
      <linearGradient id="chestGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#ffb703" />
        <stop offset="100%" stopColor="#d48800" />
      </linearGradient>
    </defs>
    {/* Chest Body */}
    <rect x="4" y="12" width="24" height="15" rx="3" fill="url(#chestGrad)" stroke="#ffffff" strokeWidth="1.5" />
    {/* Lid */}
    <path d="M3 13C3 9 7 6 16 6C25 6 29 9 29 13H3Z" fill="#210b42" stroke="#ffb703" strokeWidth="1.5" />
    {/* Keyhole Lock */}
    <rect x="13" y="15" width="6" height="7" rx="1.5" fill="#00f5d4" stroke="#ffffff" strokeWidth="1" />
    <circle cx="16" cy="17.5" r="1" fill="#0b071e" />
  </svg>
);

// ----------------------------------------------------
// TACTILE BUTTON WRAPPER (PRESERVED & ENHANCED)
// ----------------------------------------------------

export const TactileButton: React.FC<{
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'cyan' | 'magenta' | 'purple' | 'gold' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  className?: string;
  disabled?: boolean;
}> = ({
  children,
  onClick,
  variant = 'cyan',
  size = 'md',
  fullWidth = false,
  className = '',
  disabled = false,
}) => {
  const variantStyles = {
    cyan: 'bg-[#00f5d4] text-[#0b071e] hover:bg-[#00f5d4]/90 shadow-[0_0_20px_rgba(0,245,212,0.4)] hover:shadow-[0_0_25px_rgba(0,245,212,0.7)] border border-[#00f5d4]',
    magenta: 'bg-[#210b42] text-white border-2 border-[#ff007f] hover:border-[#00f5d4] shadow-[0_0_15px_rgba(255,0,127,0.4)] hover:shadow-[0_0_22px_rgba(255,0,127,0.7)]',
    purple: 'bg-[#120a2e] text-[#00f5d4] border border-[#9d4edd]/60 hover:border-[#00f5d4] shadow-[0_0_12px_rgba(157,78,221,0.3)]',
    gold: 'bg-[#210b42] text-[#ffb703] border border-[#ffb703]/60 hover:border-[#00f5d4] shadow-[0_0_12px_rgba(255,183,3,0.3)]',
    dark: 'bg-[#0d0722]/90 text-gray-200 border border-gray-700 hover:border-[#00f5d4] hover:text-white shadow',
  };

  const sizeStyles = {
    sm: 'py-1.5 px-3 text-xs rounded-lg gap-1.5',
    md: 'py-2.5 px-4 text-xs font-bold rounded-xl gap-2',
    lg: 'py-3.5 px-5 text-sm font-bold rounded-xl gap-2.5',
  };

  return (    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`font-pixel flex items-center justify-center transition-all duration-150 active:scale-[0.97] cursor-pointer select-none ${
        fullWidth ? 'w-full' : ''
      } ${variantStyles[variant]} ${sizeStyles[size]} ${
        disabled ? 'opacity-50 cursor-not-allowed active:scale-100' : ''
      } ${className}`}
    >
      {children}
    </button>
  );
};

// ----------------------------------------------------
// INTERACTIVE 3D MOTION SHIP PREVIEW ENGINE
// Real-time Canvas/SVG rendering with mouse/tilt physics,
// animated particle thrusters, orbital shield rings & weapon flare
// ----------------------------------------------------

export const MotionShipPreview: React.FC<{
  shipId?: string;
  color?: string;
  accentColor?: string;
  size?: number;
  interactive?: boolean;
}> = ({
  shipId = 'ship_cyber_wing',
  color = '#00f5d4',
  accentColor = '#ff007f',
  size = 140,
  interactive = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [isFiring, setIsFiring] = useState(false);

  useEffect(() => {
    if (!interactive) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const rotY = ((e.clientX - centerX) / (rect.width / 2)) * 25; // max 25deg
      const rotX = -((e.clientY - centerY) / (rect.height / 2)) * 20; // max 20deg
      setRotation({ x: rotX, y: rotY });
    };

    const handleMouseLeave = () => {
      setRotation({ x: 0, y: 0 });
    };

    const el = containerRef.current;
    if (el) {
      el.addEventListener('mousemove', handleMouseMove);
      el.addEventListener('mouseleave', handleMouseLeave);
    }
    return () => {
      if (el) {
        el.removeEventListener('mousemove', handleMouseMove);
        el.removeEventListener('mouseleave', handleMouseLeave);
      }
    };
  }, [interactive]);

  return (
    <div
      ref={containerRef}
      onClick={() => setIsFiring((prev) => !prev)}
      className="relative flex items-center justify-center select-none cursor-pointer group"
      style={{
        width: size,
        height: size,
        perspective: '600px',
      }}
    >
      {/* Ambient Radial Backlight Glow */}
      <div
        className="absolute inset-0 rounded-full opacity-40 blur-xl animate-pulse transition-all duration-300 group-hover:opacity-80"
        style={{
          background: `radial-gradient(circle, ${color} 0%, ${accentColor} 60%, transparent 100%)`,
        }}
      />

      {/* Orbiting Hologram Particle Ring */}
      <div
        className="absolute inset-2 rounded-full border border-dashed opacity-30 animate-[spin_10s_linear_infinite]"
        style={{ borderColor: color }}
      />

      {/* 3D Motion Vessel Wrapper with Tilt Physics */}
      <div
        className="relative transition-transform duration-150 ease-out flex items-center justify-center animate-[bounce_3s_easeInOut_infinite]"
        style={{
          transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
          transformStyle: 'preserve-3d',
        }}
      >
        <svg
          width={size * 0.75}
          height={size * 0.75}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            filter: `drop-shadow(0 0 14px ${color}) drop-shadow(0 0 28px ${accentColor})`,
          }}
        >
          <defs>
            <linearGradient id={`shipGrad_${shipId}`} x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={color} />
              <stop offset="100%" stopColor={accentColor} />
            </linearGradient>
            <linearGradient id={`engineGrad_${shipId}`} x1="50" y1="70" x2="50" y2="100" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#ff007f" />
              <stop offset="100%" stopColor="#ffb703" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Engine Thruster Plumes */}
          <path
            d="M42 72L50 96L58 72Z"
            fill={`url(#engineGrad_${shipId})`}
            className="animate-pulse"
          />
          <path
            d="M32 68L38 88L42 68Z"
            fill={`url(#engineGrad_${shipId})`}
            opacity="0.8"
          />
          <path
            d="M58 68L62 88L68 68Z"
            fill={`url(#engineGrad_${shipId})`}
            opacity="0.8"
          />

          {/* Ship Main Hull Wings */}
          <path
            d="M50 10L82 68L50 54L18 68L50 10Z"
            fill={`url(#shipGrad_${shipId})`}
            fillOpacity="0.85"
            stroke="#ffffff"
            strokeWidth="2"
            strokeLinejoin="round"
          />

          {/* Cockpit Gem & Inner Structural Facets */}
          <polygon points="50,22 62,48 50,42 38,48" fill="#ffffff" fillOpacity="0.9" />
          <line x1="50" y1="10" x2="50" y2="54" stroke={color} strokeWidth="2" />
          <circle cx="50" cy="32" r="4" fill="#0b071e" stroke={color} strokeWidth="1.5" />

          {/* Side Wingtips & Laser Cannons */}
          <line x1="18" y1="68" x2="12" y2="52" stroke={color} strokeWidth="3" strokeLinecap="round" />
          <line x1="82" y1="68" x2="88" y2="52" stroke={color} strokeWidth="3" strokeLinecap="round" />

          {/* Interactive Firing Laser Beams */}
          {isFiring && (
            <>
              <line x1="12" y1="52" x2="12" y2="-10" stroke="#00f5d4" strokeWidth="3" className="animate-pulse" />
              <line x1="88" y1="52" x2="88" y2="-10" stroke="#00f5d4" strokeWidth="3" className="animate-pulse" />
            </>
          )}
        </svg>

        {/* Tactical Status Tag Overlay */}
        <div className="absolute -bottom-1 bg-[#0b071e]/90 border border-[#00f5d4]/60 px-2 py-0.5 rounded-full text-[9px] font-pixel text-[#00f5d4] shadow-md tracking-wider uppercase">
          {isFiring ? '⚡ FIRING ⚡' : '3D MOTION ACTIVE'}
        </div>
      </div>
    </div>
  );
};
