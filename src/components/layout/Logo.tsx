export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="luma-logo-gradient" x1="4" y1="4" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#F7C948" />
          <stop offset="1" stopColor="#D99A1E" />
        </linearGradient>
      </defs>
      <rect x="2" y="9" width="36" height="24" rx="10" fill="url(#luma-logo-gradient)" />
      <path d="M20 4.5L22.6 13.6L31.5 16L22.6 18.4L20 27.5L17.4 18.4L8.5 16L17.4 13.6L20 4.5Z" fill="#FFFFFF" />
      <circle cx="29" cy="21" r="2.4" fill="#1F2937" fillOpacity="0.14" />
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
          <p className="text-[15px] font-bold text-ink">Luma</p>
          <p className="text-[11px] text-ink-soft">Personal OS</p>
        </div>
      )}
    </div>
  )
}
