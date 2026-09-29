import { useCallback, useEffect, useRef, useState } from 'react'
import { getSpeechToken } from '@/services/googleSheetsApi'

export type SpeechState = 'idle' | 'starting' | 'listening'

type SpeechSdk = typeof import('microsoft-cognitiveservices-speech-sdk')
type Recognizer = import('microsoft-cognitiveservices-speech-sdk').SpeechRecognizer

/*
 * Starting the mic used to wait on two slow things after the click: a token round-trip through
 * Apps Script (~2–4s) and downloading the Speech SDK. Both now happen ahead of time
 * (prewarmSpeech), so a click only has to open the microphone.
 */
const SAFETY_MARGIN_MS = 60_000
// Older script deployments don't say when a token expires; it may already be up to 9 min old.
const UNKNOWN_EXPIRY_REUSE_MS = 45_000

let cachedToken: { token: string; region: string; usableUntil: number } | null = null
let tokenPromise: Promise<{ token: string; region: string }> | null = null
let sdkPromise: Promise<SpeechSdk> | null = null
let refreshTimer: ReturnType<typeof setTimeout> | null = null

function loadSdk() {
  sdkPromise ??= import('microsoft-cognitiveservices-speech-sdk').catch((err: unknown) => {
    sdkPromise = null
    throw err
  })
  return sdkPromise
}

function usableToken() {
  return cachedToken && Date.now() < cachedToken.usableUntil ? cachedToken : null
}

function fetchToken(): Promise<{ token: string; region: string }> {
  const ready = usableToken()
  if (ready) return Promise.resolve(ready)
  tokenPromise ??= getSpeechToken()
    .then(({ token, region, expiresAt }) => {
      const usableUntil = expiresAt ? expiresAt - SAFETY_MARGIN_MS : Date.now() + UNKNOWN_EXPIRY_REUSE_MS
      cachedToken = { token, region, usableUntil }
      scheduleRefresh(usableUntil)
      return cachedToken
    })
    .finally(() => {
      tokenPromise = null
    })
  return tokenPromise
}

/** Keeps a valid token on hand while a mic-enabled page is open (only when the tab is visible). */
function scheduleRefresh(usableUntil: number) {
  if (refreshTimer) clearTimeout(refreshTimer)
  const delay = Math.max(30_000, usableUntil - Date.now() - 5_000)
  refreshTimer = setTimeout(() => {
    if (document.visibilityState === 'visible' && activeMicPages > 0) void fetchToken().catch(() => {})
  }, delay)
}

let activeMicPages = 0

/** Fetch the SDK and a token in the background so the first click starts listening at once. */
export function prewarmSpeech() {
  void loadSdk().catch(() => {})
  void fetchToken().catch(() => {}) // not set up / not deployed: the click will explain
}

/** Call from components that show a mic: prewarms on mount, keeps the token fresh while mounted. */
export function useSpeechPrewarm() {
  useEffect(() => {
    activeMicPages++
    const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 1200))
    const handle = idle(() => prewarmSpeech())
    return () => {
      activeMicPages--
      if (typeof handle === 'number') window.cancelIdleCallback?.(handle)
    }
  }, [])
}

/**
 * One-shot dictation via Azure Speech. Understands Indian English and Hindi (auto-detected),
 * so "Rohit ko 2000 diye" works.
 */
export function useSpeechInput() {
  const [state, setState] = useState<SpeechState>('idle')
  const [interim, setInterim] = useState('')
  const recognizerRef = useRef<Recognizer | null>(null)
  // Lets Stop finish the pending recognition with whatever has been heard so far.
  const finishRef = useRef<((text: string) => void) | null>(null)
  const interimRef = useRef('')

  useEffect(() => () => recognizerRef.current?.close(), [])

  const stop = useCallback(() => {
    finishRef.current?.(interimRef.current)
    finishRef.current = null
    recognizerRef.current?.close()
    recognizerRef.current = null
    setState('idle')
  }, [])

  const recognizeOnce = useCallback(async (sdk: SpeechSdk, token: string, region: string): Promise<{ text: string; authFailed: boolean }> => {
    const speechConfig = sdk.SpeechConfig.fromAuthorizationToken(token, region)
    // Ends the utterance after a short pause instead of the ~1.5s default, so answers come sooner.
    speechConfig.setProperty(sdk.PropertyId.Speech_SegmentationSilenceTimeoutMs, '800')
    const languages = sdk.AutoDetectSourceLanguageConfig.fromLanguages(['en-IN', 'hi-IN'])
    const recognizer = sdk.SpeechRecognizer.FromConfig(speechConfig, languages, sdk.AudioConfig.fromDefaultMicrophoneInput())
    recognizerRef.current = recognizer
    recognizer.recognizing = (_sender, event) => {
      interimRef.current = event.result.text
      setInterim(event.result.text)
    }
    recognizer.sessionStarted = () => setState('listening')

    return new Promise((resolve, reject) => {
      finishRef.current = (text) => resolve({ text: text.trim(), authFailed: false })
      recognizer.recognizeOnceAsync(
        (result) => {
          if (result.reason === sdk.ResultReason.RecognizedSpeech) return resolve({ text: result.text.trim(), authFailed: false })
          if (result.reason === sdk.ResultReason.NoMatch) return resolve({ text: '', authFailed: false })
          const details = sdk.CancellationDetails.fromResult(result)
          if (details.reason !== sdk.CancellationReason.Error) return resolve({ text: '', authFailed: false })
          if (details.ErrorCode === sdk.CancellationErrorCode.AuthenticationFailure) return resolve({ text: '', authFailed: true })
          reject(new Error(/1006|permission|denied/i.test(details.errorDetails ?? '') ? 'Microphone access was blocked.' : 'Voice input failed. Please try again.'))
        },
        (error) => reject(new Error(typeof error === 'string' && /permission|NotAllowed/i.test(error) ? 'Microphone access was blocked.' : 'Voice input failed. Please try again.')),
      )
    })
  }, [])

  /** Resolves with the recognized text, or '' when nothing was heard. Throws a user-facing Error on failure. */
  const listen = useCallback(async (): Promise<string> => {
    setState('starting')
    interimRef.current = ''
    setInterim('')
    try {
      const [sdk, { token, region }] = await Promise.all([loadSdk(), fetchToken()])
      let outcome = await recognizeOnce(sdk, token, region)
      if (outcome.authFailed) {
        // The token went stale — get a fresh one and try once more.
        cachedToken = null
        const fresh = await fetchToken()
        recognizerRef.current?.close()
        outcome = await recognizeOnce(sdk, fresh.token, fresh.region)
        if (outcome.authFailed) throw new Error('Voice input could not sign in. Check the Azure Speech key and region.')
      }
      return outcome.text
    } finally {
      finishRef.current = null
      recognizerRef.current?.close()
      recognizerRef.current = null
      setState('idle')
      setInterim('')
    }
  }, [recognizeOnce])

  return { state, interim, listen, stop }
}
