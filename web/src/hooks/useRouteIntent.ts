import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

/** What another screen (e.g. the command palette) asks a page to show when it opens. */
export interface RouteIntent {
  /** Prefill the page's search box. */
  search?: string
  /** Open one specific record. */
  openId?: string
  /** Finance: which tab to show. */
  tab?: string
  accountId?: string
}

/**
 * Applies the router state a navigation carried, once per navigation (keyed on location.key),
 * so arriving again with a new search or record works even when the page is already open.
 */
export function useRouteIntent(apply: (intent: RouteIntent) => void) {
  const location = useLocation()
  const applyRef = useRef(apply)
  useEffect(() => {
    applyRef.current = apply
  })
  useEffect(() => {
    const intent = location.state as RouteIntent | null
    if (intent && typeof intent === 'object') applyRef.current(intent)
  }, [location.key, location.state])
}
