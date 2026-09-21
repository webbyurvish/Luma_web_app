export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="luma-logo-gradient" x1="3" y1="3" x2="37" y2="37" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFCF6E" />
          <stop offset="0.55" stopColor="#F4B83F" />
          <stop offset="1" stopColor="#D9961F" />
        </linearGradient>
        <radialGradient id="luma-logo-sheen" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(13 10) rotate(90) scale(20)">
          <stop stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="2" y="2" width="36" height="36" rx="13" fill="url(#luma-logo-gradient)" />
      <rect x="2" y="2" width="36" height="36" rx="13" fill="url(#luma-logo-sheen)" />
      {/* orbit — continuity of personal life */}
      <ellipse cx="20" cy="20.5" rx="12.4" ry="6" stroke="#FFFFFF" strokeOpacity="0.5" strokeWidth="1.3" fill="none" transform="rotate(-28 20 20.5)" />
      {/* spark — intelligence */}
      <path d="M20 10.5L22.1 17.9L29.5 20L22.1 22.1L20 29.5L17.9 22.1L10.5 20L17.9 17.9L20 10.5Z" fill="#FFFFFF" />
      {/* node — financial point */}
      <circle cx="29" cy="12" r="2" fill="#FFFFFF" fillOpacity="0.85" />
    </svg>
  )
}

interface LogoProps {
  collapsed?: boolean
}

export function Logo({ collapsed }: LogoProps) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark size={34} />
      {!collapsed && (
        <div className="leading-tight">
          <p className="text-[15px] font-bold tracking-tight text-ink">Luma</p>
          <p className="text-[11px] text-ink-soft">Personal OS</p>
        </div>
      )}
    </div>
  )
}
