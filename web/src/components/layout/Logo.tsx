interface LogoMarkProps {
  size?: number
  inverted?: boolean
}

export function LogoMark({ size = 30, inverted }: LogoMarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="0.5" y="0.5" width="29" height="29" rx="4" fill={inverted ? '#F6F1E7' : '#B5482A'} />
      <text
        x="15"
        y="21.5"
        textAnchor="middle"
        fontFamily="'Fraunces', serif"
        fontStyle="italic"
        fontWeight="600"
        fontSize="17"
        fill={inverted ? '#B5482A' : '#F6F1E7'}
      >
        L
      </text>
    </svg>
  )
}

interface LogoProps {
  collapsed?: boolean
  inverted?: boolean
}

export function Logo({ collapsed, inverted }: LogoProps) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark size={30} inverted={inverted} />
      {!collapsed && (
        <div className="leading-tight">
          <p className={`font-display text-[15px] italic ${inverted ? 'text-paper' : 'text-ink'}`}>Luma</p>
          <p className={`text-[10px] uppercase tracking-[0.12em] ${inverted ? 'text-paper/50' : 'text-ink-muted'}`}>Personal OS</p>
        </div>
      )}
    </div>
  )
}
