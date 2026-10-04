import { useSyncExternalStore } from 'react'

/**
 * Light ("Evolved editorial") / Dark ("Midnight ledger") / Auto (follows the phone).
 * A per-device preference, so it lives under lumaui:* and survives sign-out.
 * index.css holds the colours; this only sets <html data-theme> and the browser chrome colour.
 */
export type ThemePref = 'light' | 'dark' | 'auto'

const KEY = 'lumaui:theme'
const CHROME = { light: '#f4efe4', dark: '#0e1424' }
const listeners = new Set<() => void>()
const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

let pref = readPref()

export function resolvedTheme(p: ThemePref = pref): 'light' | 'dark' {
  return p === 'auto' ? (media?.matches ? 'dark' : 'light') : p
}

function apply() {
  const theme = resolvedTheme()
  const root = document.documentElement
  root.dataset.theme = theme
  root.style.colorScheme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', CHROME[theme])
}

/** Call once, before the first render, so the app never flashes the wrong theme. */
export function initTheme() {
  apply()
  media?.addEventListener('change', () => {
    if (pref !== 'auto') return
    apply()
    listeners.forEach((l) => l())
  })
}

export function setThemePref(next: ThemePref) {
  pref = next
  try {
    if (next === 'auto') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, next)
  } catch {
    // kept for this page only
  }
  apply()
  listeners.forEach((l) => l())
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useThemePref(): { pref: ThemePref; theme: 'light' | 'dark' } {
  const p = useSyncExternalStore(subscribe, () => pref)
  const theme = useSyncExternalStore(subscribe, () => resolvedTheme())
  return { pref: p, theme }
}
