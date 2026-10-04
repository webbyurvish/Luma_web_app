interface LogoMarkProps {
  size?: number
  inverted?: boolean
}

/** `inverted` is kept for callers; the mark reads the theme tokens either way. */
export function LogoMark({ size = 30 }: LogoMarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="0.5" y="0.5" width="29" height="29" rx="4" fill="var(--color-rust)" />
      <text
        x="15"
        y="21.5"
        textAnchor="middle"
        fontFamily="'Fraunces', serif"
        fontStyle="italic"
        fontWeight="600"
        fontSize="17"
        fill="var(--color-on-accent)"
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
          <p className={`font-display text-[15px] italic ${inverted ? 'text-rail-ink' : 'text-ink'}`}>Luma</p>
          <p className={`text-[10px] uppercase tracking-[0.12em] ${inverted ? 'text-rail-ink/50' : 'text-ink-muted'}`}>Personal OS</p>
        </div>
      )}
    </div>
  )
}
