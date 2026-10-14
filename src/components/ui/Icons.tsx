import React from 'react';

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

// 9. Tactile Cyber Button / Icon Wrapper
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

  return (
    <button
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
