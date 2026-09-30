const CLEAR_AFTER_MS = 30_000
let clearTimer: number | undefined

/**
 * Copies a value; secrets are wiped from the clipboard again after 30 seconds so a password
 * doesn't linger for the next paste. Returns false when the browser refused.
 */
export async function copyToClipboard(text: string, secret = false): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    return false
  }
  window.clearTimeout(clearTimer)
  if (secret) {
    clearTimer = window.setTimeout(() => {
      navigator.clipboard.writeText('').catch(() => {
        // Tab not focused any more — the browser won't let us touch the clipboard.
      })
    }, CLEAR_AFTER_MS)
  }
  return true
}
