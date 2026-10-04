import type {
  BootstrapApiResponse,
  DriveFile,
  DriveFileDetails,
  DriveFolder,
  DriveTree,
  RawTask,
  RawUdhaar,
  CreateApiResponse,
  ListApiResponse,
  RawAccount,
  RawInvestment,
  RawLiability,
  RawNote,
  RawSip,
  RawTransaction,
  RawVaultItem,
  RawBill,
  RawBudget,
  RawRecharge,
  RawRechargeLog,
  RawImportantDate,
  RawMedicalBill,
  RawVehicle,
  RawVehicleLog,
  TransactionsApiResponse,
} from '@/types'
import type { VaultMeta } from '@/lib/vaultCrypto'
import type { FolderSpec } from '@/lib/familyFolders'
import { getAuthToken, reportAuthRequired } from '@/lib/auth'
import { normalizeSheetRows } from '@/lib/sheetValues'

export class GoogleSheetsApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GoogleSheetsApiError'
  }
}

function getApiUrl(): string {
  const url = import.meta.env.VITE_GOOGLE_SHEETS_API_URL
  if (!url) {
    throw new GoogleSheetsApiError(
      'VITE_GOOGLE_SHEETS_API_URL is not configured. Add it to .env (see .env.example) with your Google Apps Script Web App URL.',
    )
  }
  return url
}

function buildEndpoint(action: string): string {
  const url = new URL(getApiUrl())
  url.searchParams.set('action', action)
  // Apps Script can't read headers, so the signed session token rides as a query parameter.
  const token = getAuthToken()
  if (token) url.searchParams.set('t', token)
  return url.toString()
}

/** The script refused the request because there's no valid session — never retried. */
export class AuthRequiredError extends Error {
  constructor() {
    super('Please sign in to Luma again.')
    this.name = 'AuthRequiredError'
  }
}

function assertSignedIn(text: string) {
  if (text.includes('"authRequired":true')) {
    reportAuthRequired()
    throw new AuthRequiredError()
  }
}

/** Apps Script intermittently answers a healthy read with 404/429/5xx under load; those are worth retrying. */
const TRANSIENT_STATUS = new Set([404, 408, 429, 500, 502, 503, 504])
const READ_RETRY_DELAYS_MS = [700, 1800]

/**
 * Apps Script answers in two hops (302 → googleusercontent "echo"). Under parallel load Google
 * sometimes leaves the second hop hanging ~30s and then 404s, although the script already
 * finished. A healthy read lands in 2–6s, so an attempt that runs past its budget is abandoned
 * and retried instead of waited out.
 */
const READ_TIMEOUT_MS = 20_000
const SLOW_READ_TIMEOUT_MS: Record<string, number> = { bootstrap: 45_000, transactions: 35_000, drivetree: 45_000 }

class AttemptTimeout extends Error {}

/*
 * Google's second hop jams when several requests from one page are in flight at once, while
 * one or two at a time come back in seconds. So background re-syncs share 2 slots (counting
 * urgent work in flight too) and queue beyond that, while what the user is waiting on — saves,
 * AI answers — has its own lanes and never queues behind a hung background read.
 */
const MAX_BACKGROUND = 2
const MAX_URGENT = 3
let urgentInFlight = 0
let backgroundInFlight = 0
const urgentQueue: (() => void)[] = []
const backgroundQueue: (() => void)[] = []

function pump() {
  while (urgentQueue.length && urgentInFlight < MAX_URGENT) {
    urgentInFlight++
    urgentQueue.shift()!()
  }
  while (backgroundQueue.length && backgroundInFlight + urgentInFlight < MAX_BACKGROUND) {
    backgroundInFlight++
    backgroundQueue.shift()!()
  }
}

async function withSlot<T>(urgent: boolean, task: () => Promise<T>): Promise<T> {
  await new Promise<void>((run) => {
    ;(urgent ? urgentQueue : backgroundQueue).push(run)
    pump()
  })
  try {
    return await task()
  } finally {
    if (urgent) urgentInFlight--
    else backgroundInFlight--
    pump()
  }
}

/** fetch + full body read under one time budget; the caller's own abort still wins. */
function fetchTextWithin(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  outer?: AbortSignal,
  urgent = false,
): Promise<{ status: number; ok: boolean; text: string }> {
  // The time budget starts once a slot is free, not while queued.
  return withSlot(urgent, () => fetchTextNow(url, init, timeoutMs, outer))
}

async function fetchTextNow(url: string, init: RequestInit, timeoutMs: number, outer?: AbortSignal): Promise<{ status: number; ok: boolean; text: string }> {
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const forwardAbort = () => controller.abort()
  outer?.addEventListener('abort', forwardAbort)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    const text = await response.text()
    assertSignedIn(text)
    return { status: response.status, ok: response.ok, text }
  } catch (cause) {
    if (cause instanceof AuthRequiredError) throw cause
    if (timedOut) throw new AttemptTimeout()
    throw cause
  } finally {
    clearTimeout(timer)
    outer?.removeEventListener('abort', forwardAbort)
  }
}

// Reads only — writes (postEntity) are never retried, so nothing can be saved twice.
async function fetchJson<T>(action: string, signal?: AbortSignal): Promise<T> {
  const timeoutMs = SLOW_READ_TIMEOUT_MS[action] ?? READ_TIMEOUT_MS
  let result: { status: number; ok: boolean; text: string } | null = null
  for (let attempt = 0; ; attempt++) {
    const canRetry = attempt < READ_RETRY_DELAYS_MS.length
    try {
      result = await fetchTextWithin(buildEndpoint(action), { method: 'GET' }, timeoutMs, signal)
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError' && signal?.aborted) throw cause
      if (cause instanceof AuthRequiredError) throw cause
      if (canRetry) {
        await new Promise((resolve) => setTimeout(resolve, READ_RETRY_DELAYS_MS[attempt]))
        continue
      }
      throw new GoogleSheetsApiError(
        cause instanceof AttemptTimeout
          ? 'Google Sheets is taking too long to respond. Please try again in a moment.'
          : 'Could not reach the Google Sheets API. Check your network connection and try again.',
      )
    }
    if (result.ok || !TRANSIENT_STATUS.has(result.status) || !canRetry) break
    await new Promise((resolve) => setTimeout(resolve, READ_RETRY_DELAYS_MS[attempt]))
  }

  if (!result.ok) {
    throw new GoogleSheetsApiError(`Google Sheets API returned an unexpected status (${result.status}). Please try again in a moment.`)
  }

  try {
    return JSON.parse(result.text) as T
  } catch {
    throw new GoogleSheetsApiError('Google Sheets API returned a response that was not valid JSON.')
  }
}

/** Fetches every transaction row from the Apps Script Web App, normalized to a plain array. */
export async function getTransactions(signal?: AbortSignal): Promise<RawTransaction[]> {
  const payload = await fetchJson<TransactionsApiResponse>('transactions', signal)

  if (!payload.success) {
    throw new GoogleSheetsApiError(payload.error || 'Google Sheets API reported a failure fetching transactions.')
  }
  if (!Array.isArray(payload.transactions)) {
    throw new GoogleSheetsApiError('Google Sheets API response was missing the transactions list.')
  }
  return normalizeSheetRows(payload.transactions)
}

async function fetchList<T>(action: string, signal?: AbortSignal): Promise<T[]> {
  const payload = await fetchJson<ListApiResponse<T>>(action, signal)
  if (!payload.success) {
    throw new GoogleSheetsApiError(payload.error || `Google Sheets API reported a failure fetching ${action}.`)
  }
  if (!Array.isArray(payload.data)) {
    throw new GoogleSheetsApiError(`Google Sheets API response was missing the ${action} list.`)
  }
  return normalizeSheetRows(payload.data)
}

/**
 * POSTs a new record. Apps Script Web App POST responses redirect through a chain that
 * browsers can't reliably follow back to parseable JSON, even though the write itself
 * lands in the sheet — confirmed by re-fetching after a POST whose response looked like
 * a failure. So a response here that isn't valid `{success:true}` JSON is NOT treated as
 * a definite failure; only an explicit `{success:false}` is. Everything else resolves and
 * the caller re-fetches the list afterward to get the real, persisted state.
 */
/** What a save returns: confirmed = the script answered success, so the list needn't be re-read before moving on. */
export interface SaveReceipt {
  confirmed: boolean
}

export const isConfirmedSave = (value: unknown): boolean =>
  !!value && typeof value === 'object' && (value as Partial<SaveReceipt>).confirmed !== false

function postEntity(action: string, payload: Record<string, unknown>): Promise<SaveReceipt> {
  // Saves the user is waiting on jump ahead of background reads. Never retried, never timed out.
  return withSlot(true, () => postEntityNow(action, payload))
}

async function postEntityNow(action: string, payload: Record<string, unknown>): Promise<SaveReceipt> {
  let response: Response
  try {
    response = await fetch(buildEndpoint(action), {
      method: 'POST',
      // text/plain avoids a CORS preflight against Apps Script, which doesn't handle OPTIONS.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    })
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
    throw new GoogleSheetsApiError('Could not reach the Google Sheets API. Check your network connection and try again.')
  }

  try {
    const text = await response.text()
    assertSignedIn(text)
    const body = JSON.parse(text) as CreateApiResponse<unknown>
    if (body.success === false) {
      throw new GoogleSheetsApiError(body.error || 'Google Sheets API reported a failure saving this record.')
    }
    return { confirmed: body.success === true }
  } catch (err) {
    if (err instanceof GoogleSheetsApiError || err instanceof AuthRequiredError) throw err
    // Response wasn't parseable JSON — expected for POST (see comment above). Not an error,
    // but not a confirmation either: the caller re-reads the list to be sure.
    return { confirmed: false }
  }
}

export async function getAccounts(signal?: AbortSignal): Promise<RawAccount[]> {
  return fetchList<RawAccount>('accounts', signal)
}

export async function getInvestments(signal?: AbortSignal): Promise<RawInvestment[]> {
  return fetchList<RawInvestment>('investments', signal)
}

export async function getSips(signal?: AbortSignal): Promise<RawSip[]> {
  return fetchList<RawSip>('sips', signal)
}

export async function getLiabilities(signal?: AbortSignal): Promise<RawLiability[]> {
  return fetchList<RawLiability>('liabilities', signal)
}

export async function getNotes(signal?: AbortSignal): Promise<RawNote[]> {
  return fetchList<RawNote>('notes', signal)
}

export function createAccount(payload: Record<string, unknown>): Promise<SaveReceipt> {
  return postEntity('account', payload)
}

export function createInvestment(payload: Record<string, unknown>): Promise<SaveReceipt> {
  return postEntity('investment', payload)
}

export function createSip(payload: Record<string, unknown>): Promise<SaveReceipt> {
  return postEntity('sip', payload)
}

export function createLiability(payload: Record<string, unknown>): Promise<SaveReceipt> {
  return postEntity('liability', payload)
}

export function createNote(payload: Record<string, unknown>): Promise<SaveReceipt> {
  return postEntity('note', payload)
}

/**
 * Update and archive/deactivate/close/void calls all share the same `postEntity`
 * re-fetch-to-confirm behavior as create — see the comment on postEntity above.
 * `operation` + `id` travel inside the JSON body; `action` (the query param) stays
 * the entity's singular name, exactly as create already uses it.
 */
export function updateAccount(id: string, payload: Record<string, unknown>): Promise<SaveReceipt> {
  return postEntity('account', { operation: 'update', id, ...payload })
}

export function archiveAccount(id: string): Promise<SaveReceipt> {
  return postEntity('account', { operation: 'archive', id })
}

export function updateInvestment(id: string, payload: Record<string, unknown>): Promise<SaveReceipt> {
  return postEntity('investment', { operation: 'update', id, ...payload })
}

export function archiveInvestment(id: string): Promise<SaveReceipt> {
  return postEntity('investment', { operation: 'archive', id })
}

export function updateSip(id: string, payload: Record<string, unknown>): Promise<SaveReceipt> {
  return postEntity('sip', { operation: 'update', id, ...payload })
}

export function deactivateSip(id: string): Promise<SaveReceipt> {
  return postEntity('sip', { operation: 'deactivate', id })
}

export function updateLiability(id: string, payload: Record<string, unknown>): Promise<SaveReceipt> {
  return postEntity('liability', { operation: 'update', id, ...payload })
}

export function closeLiability(id: string): Promise<SaveReceipt> {
  return postEntity('liability', { operation: 'close', id })
}

export function voidTransaction(id: string): Promise<SaveReceipt> {
  return postEntity('transaction', { operation: 'void', id })
}

export function updateNote(id: string, payload: Record<string, unknown>): Promise<SaveReceipt> {
  return postEntity('note', { operation: 'update', id, ...payload })
}

export function archiveNote(id: string): Promise<SaveReceipt> {
  return postEntity('note', { operation: 'archive', id })
}

/**
 * One request for accounts/investments/SIPs/liabilities/transactions. Throws on a deployment
 * that predates the route (it answers `Unknown action: bootstrap`), so callers can fall back
 * to the per-collection routes.
 */
export async function getBootstrap(signal?: AbortSignal): Promise<NonNullable<BootstrapApiResponse['data']>> {
  const payload = await fetchJson<BootstrapApiResponse>('bootstrap', signal)
  if (!payload.success || !payload.data) {
    throw new GoogleSheetsApiError(payload.error || 'Google Sheets API reported a failure fetching the bootstrap bundle.')
  }
  if (import.meta.env.DEV && payload.errors && Object.keys(payload.errors).length > 0) {
    console.warn('[getBootstrap] Some collections failed server-side:', payload.errors)
  }
  primeCapabilities(payload.capabilities, payload.data as Record<string, unknown>)
  // Same cleanup as the per-collection routes (dates stored as numbers, etc.).
  const data = payload.data as Record<string, unknown>
  Object.keys(data).forEach((key) => {
    if (Array.isArray(data[key])) data[key] = normalizeSheetRows(data[key] as unknown[])
  })
  return payload.data
}

/* Permanent delete — removes the sheet row. The backend first copies it to its
 * "Deleted Records" sheet, and refuses to delete an account other records still use. */

export function deleteAccount(id: string): Promise<SaveReceipt> {
  return postEntity('account', { operation: 'delete', id })
}

export function deleteInvestment(id: string): Promise<SaveReceipt> {
  return postEntity('investment', { operation: 'delete', id })
}

export function deleteSip(id: string): Promise<SaveReceipt> {
  return postEntity('sip', { operation: 'delete', id })
}

export function deleteLiability(id: string): Promise<SaveReceipt> {
  return postEntity('liability', { operation: 'delete', id })
}

export function deleteNote(id: string): Promise<SaveReceipt> {
  return postEntity('note', { operation: 'delete', id })
}

export function deleteTransaction(id: string): Promise<SaveReceipt> {
  return postEntity('transaction', { operation: 'delete', id })
}

/** Partial update of a transaction's editable fields (date, amount, type, category, subcategory, paymentMethod, merchant, note). */
export function updateTransaction(id: string, payload: Record<string, unknown>): Promise<SaveReceipt> {
  return postEntity('transaction', { operation: 'update', id, ...payload })
}

/* Udhaar — a ledger: each row is one "Given" or "Repayment". Creates go through Udhaar.gs
 * (routed by `recordType`), edits/deletes through the lifecycle router like everything else. */

export async function getUdhaar(signal?: AbortSignal): Promise<RawUdhaar[]> {
  return fetchList<RawUdhaar>('udhaar', signal)
}

export function createUdhaarEntry(payload: Record<string, unknown>): Promise<SaveReceipt> {
  return postEntity('udhaar', payload)
}

export function updateUdhaarEntry(id: string, payload: Record<string, unknown>): Promise<SaveReceipt> {
  return postEntity('udhaar', { operation: 'update', id, ...payload })
}

export function deleteUdhaarEntry(id: string): Promise<SaveReceipt> {
  return postEntity('udhaar', { operation: 'delete', id })
}

/* Tasks */

export async function getTasks(signal?: AbortSignal): Promise<RawTask[]> {
  return fetchList<RawTask>('tasks', signal)
}

export function createTask(payload: Record<string, unknown>): Promise<SaveReceipt> {
  return postEntity('task', payload)
}

export function updateTask(id: string, payload: Record<string, unknown>): Promise<SaveReceipt> {
  return postEntity('task', { operation: 'update', id, ...payload })
}

export function archiveTask(id: string): Promise<SaveReceipt> {
  return postEntity('task', { operation: 'archive', id })
}

export function deleteTask(id: string): Promise<SaveReceipt> {
  return postEntity('task', { operation: 'delete', id })
}

/**
 * New transaction. Deliberately sent with no action/operation in the body so it takes the
 * exact same path as the iPhone Shortcut (which also assigns the new Transaction ID).
 */
export function createTransaction(payload: Record<string, unknown>): Promise<SaveReceipt> {
  return postEntity('transaction', payload)
}

/**
 * POST whose response body IS the result (AI answers), unlike postEntity's fire-and-refetch
 * writes. Verified in the browser: Apps Script's redirect is followed and the JSON is readable.
 */
async function postForResult<T extends { success: boolean; error?: string }>(action: string, payload: Record<string, unknown>): Promise<T> {
  // Only used for AI requests, which read data and never write — so, unlike postEntity, it's
  // safe to send the same request twice. A healthy answer takes 3–5s, but Google's second hop
  // randomly hangs for 20–30s. So if the first attempt is still out after HEDGE_AFTER_MS, a
  // second identical request goes out in parallel and whichever answers first wins.
  const HEDGE_AFTER_MS = 9_000
  const ATTEMPT_TIMEOUT_MS = 40_000
  const init: RequestInit = { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) }

  const attempt = async (): Promise<T> => {
    const result = await fetchTextWithin(buildEndpoint(action), init, ATTEMPT_TIMEOUT_MS, undefined, true)
    // When the hop jams, Google can fall back to re-running the URL as a GET, which answers
    // "Unknown action" — proof this attempt was never processed.
    if (/Unknown action/.test(result.text)) throw new GoogleSheetsApiError("Google didn't pass the question through. Please try again.")
    if (!result.ok) throw new GoogleSheetsApiError(`The assistant didn't return a readable answer (${result.status}). Please try again.`)
    let body: T
    try {
      body = JSON.parse(result.text) as T
    } catch {
      throw new GoogleSheetsApiError(`The assistant didn't return a readable answer (${result.status}). Please try again.`)
    }
    // An error the script itself reports (not configured, rate limit…) is final, not retryable.
    if (!body.success) throw Object.assign(new GoogleSheetsApiError(body.error || 'The assistant reported an error.'), { final: true })
    return body
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false
    let failures = 0
    let started = 0

    const launch = () => {
      started++
      attempt().then(
        (body) => {
          if (settled) return
          settled = true
          clearTimeout(hedgeTimer)
          resolve(body)
        },
        (err: unknown) => {
          if (settled) return
          failures++
          const final = err instanceof AuthRequiredError || (typeof err === 'object' && err !== null && 'final' in err)
          if (final || failures >= 2) {
            settled = true
            clearTimeout(hedgeTimer)
            reject(err instanceof GoogleSheetsApiError || err instanceof AuthRequiredError ? err : new GoogleSheetsApiError('Could not reach the assistant. Please try again.'))
            return
          }
          // First attempt failed outright: send the backup now instead of waiting for the hedge.
          if (started < 2) {
            clearTimeout(hedgeTimer)
            launch()
          }
        },
      )
    }

    const hedgeTimer = setTimeout(() => {
      if (!settled && started < 2) launch()
    }, HEDGE_AFTER_MS)
    launch()
  })
}

/* AI (Azure OpenAI via Apps Script — the key never reaches the browser) */

export interface AiChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export async function askAssistant(messages: AiChatTurn[], context: string): Promise<string> {
  await requireAiChat()
  const body = await postForResult<{ success: boolean; error?: string; reply: string }>('ai', { aiTask: 'chat', messages, context })
  return body.reply
}

export interface QuickAddDraft {
  kind: 'expense' | 'income' | 'transfer' | 'udhaar_given' | 'udhaar_repayment' | 'task' | 'unknown'
  amount: number | null
  date: string | null
  category: string | null
  subcategory: string | null
  merchant: string | null
  paymentMethod: string | null
  /** Account name the AI recognised ("from HDFC"); older script deployments omit it. */
  account?: string | null
  toAccount?: string | null
  note: string | null
  person: string | null
  dueDate: string | null
  title: string | null
  priority: 'low' | 'medium' | 'high' | 'urgent' | null
  confidence: number
}

export async function parseQuickAdd(
  text: string,
  today: string,
  hints: { categories: string[]; paymentMethods: string[]; people: string[]; accounts: string[] },
): Promise<QuickAddDraft> {
  await requireAiChat()
  const body = await postForResult<{ success: boolean; error?: string; draft: QuickAddDraft }>('ai', { aiTask: 'parse', text, today, hints })
  return body.draft
}

/** Short-lived (10 min) Azure Speech token + region; the Speech key itself stays in Apps Script. */
export async function getSpeechToken(): Promise<{ token: string; region: string; expiresAt?: number }> {
  const status = await getAiStatus()
  if (!status.speech) throw new GoogleSheetsApiError("Azure Speech isn't set up yet. Add AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in Apps Script.")
  const body = await fetchJson<{ success: boolean; error?: string; token?: string; region?: string; expiresAt?: number }>('speechtoken')
  if (!body.success || !body.token || !body.region) throw new GoogleSheetsApiError(body.error || 'Voice input is not available right now.')
  return { token: body.token, region: body.region, expiresAt: typeof body.expiresAt === 'number' ? body.expiresAt : undefined }
}

/*
 * Safety gate: an older script deployment doesn't know aiTask and would treat an AI POST
 * as an iPhone-Shortcut transaction (appending a ₹0 row). So before the first AI POST we
 * ask, read-only, whether the deployed script supports AI at all — once per session.
 */
let aiStatusPromise: Promise<{ chat: boolean; speech: boolean }> | null = null

// A confirmed "available" is remembered for a while, so each chat doesn't pay for another
// round trip. Only a positive answer is cached; "not deployed"/"not configured" re-checks.
const AI_STATUS_KEY = 'luma:ai-status'
const AI_STATUS_TTL_MS = 6 * 60 * 60 * 1000

function readCachedAiStatus(): { chat: boolean; speech: boolean } | null {
  try {
    const cached = JSON.parse(localStorage.getItem(AI_STATUS_KEY) ?? 'null') as { at: number; chat: boolean; speech: boolean } | null
    return cached && cached.chat && Date.now() - cached.at < AI_STATUS_TTL_MS ? { chat: cached.chat, speech: cached.speech } : null
  } catch {
    return null
  }
}

export function getAiStatus(): Promise<{ chat: boolean; speech: boolean }> {
  const cached = readCachedAiStatus()
  if (cached) return Promise.resolve(cached)
  aiStatusPromise ??= fetchJson<{ success: boolean; error?: string; chat?: boolean; speech?: boolean }>('aistatus')
    .then((body) => {
      if (!body.success) throw new GoogleSheetsApiError('AI features need the latest Apps Script deployment. Deploy it, then reload.')
      const status = { chat: !!body.chat, speech: !!body.speech }
      if (status.chat) {
        try {
          localStorage.setItem(AI_STATUS_KEY, JSON.stringify({ at: Date.now(), ...status }))
        } catch {
          // Storage blocked — we'll simply check again next time.
        }
      }
      return status
    })
    .catch((err: unknown) => {
      aiStatusPromise = null // let a later attempt re-check (e.g. after deploying)
      throw err
    })
  return aiStatusPromise
}

async function requireAiChat() {
  const status = await getAiStatus()
  if (!status.chat) throw new GoogleSheetsApiError('Azure OpenAI isn\'t set up yet. Add the AZURE_OPENAI_* Script Properties in Apps Script.')
}

/* Luma Documents (Google Drive via Apps Script). Writes go through the same kind of gate as AI:
 * an older deployment would otherwise treat a driveOp POST as an iPhone-Shortcut transaction. */

let driveStatusPromise: Promise<void> | null = null

function requireDrive(): Promise<void> {
  driveStatusPromise ??= fetchJson<{ success: boolean; error?: string; drive?: boolean }>('drivestatus')
    .then((body) => {
      if (!body.success || !body.drive) throw new GoogleSheetsApiError('Documents need the latest Apps Script deployment. Deploy it, then reload.')
    })
    .catch((err: unknown) => {
      driveStatusPromise = null
      throw err
    })
  return driveStatusPromise
}

export async function getDriveTree(): Promise<DriveTree> {
  await requireDrive()
  const body = await fetchJson<{ success: boolean; error?: string } & Partial<DriveTree>>('drivetree')
  if (!body.success || !body.rootId) throw new GoogleSheetsApiError(body.error || "Couldn't load your documents.")
  return { rootId: body.rootId, rootUrl: body.rootUrl ?? '', folders: body.folders ?? [], files: body.files ?? [] }
}

/**
 * One document operation. Read back (the result matters) but never retried — a second upload
 * would create a duplicate file. Uploads get a longer budget since the bytes travel in the body.
 */
async function driveOp<T = Record<string, unknown>>(payload: Record<string, unknown>, timeoutMs = 60_000): Promise<T> {
  await requireDrive()
  let result: { status: number; ok: boolean; text: string }
  try {
    result = await fetchTextWithin(
      buildEndpoint('drive'),
      { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) },
      timeoutMs,
      undefined,
      true,
    )
  } catch (cause) {
    if (cause instanceof AuthRequiredError) throw cause
    throw new GoogleSheetsApiError(
      cause instanceof AttemptTimeout
        ? "Google is taking too long to confirm. Refresh in a moment to see whether it went through."
        : 'Could not reach Google. Check your connection and try again.',
    )
  }
  let body: { success?: boolean; error?: string } & T
  try {
    body = JSON.parse(result.text)
  } catch {
    throw new GoogleSheetsApiError("Google didn't confirm the change. Refresh in a moment to see whether it went through.")
  }
  if (!body.success) throw new GoogleSheetsApiError(body.error || 'The change could not be saved.')
  return body
}

export const driveApi = {
  createFolder: (parentId: string, name: string) => driveOp<{ folder: DriveFolder }>({ driveOp: 'createFolder', parentId, name }),
  /** A whole nested structure in one request; existing folders are reused. Up to ~4 minutes for big trees. */
  createTree: (parentId: string, tree: FolderSpec[]) =>
    driveOp<{ created: number; existing: number; incomplete: boolean; folders: DriveFolder[] }>({ driveOp: 'createTree', parentId, tree }, 300_000),
  renameFolder: (folderId: string, name: string) => driveOp({ driveOp: 'renameFolder', folderId, name }),
  moveFolder: (folderId: string, targetId: string) => driveOp({ driveOp: 'moveFolder', folderId, targetId }),
  trashFolder: (folderId: string) => driveOp<{ trashedFiles: number }>({ driveOp: 'trashFolder', folderId }),
  upload: (folderId: string, file: { name: string; mimeType: string; dataBase64: string }, details?: Partial<DriveFileDetails>) =>
    driveOp<{ file: DriveFile }>({ driveOp: 'upload', folderId, ...file, ...details }, 120_000),
  updateFile: (fileId: string, details: Partial<DriveFileDetails>) => driveOp({ driveOp: 'updateFile', fileId, ...details }),
  moveFile: (fileId: string, folderId: string) => driveOp({ driveOp: 'moveFile', fileId, folderId }),
  trashFile: (fileId: string) => driveOp({ driveOp: 'trashFile', fileId }),
}

/* Passcode sign-in (Luma_Auth in Apps Script) */

export interface AuthStatus {
  /** A passcode is set in Script Properties. */
  configured: boolean
  /** Requests without a valid session are refused. */
  enforced: boolean
  /** Session length the script grants (older deployments omit it). */
  sessionMinutes?: number
  /** Face ID / fingerprint sign-in is available. */
  devices?: boolean
}

let authStatusPromise: Promise<AuthStatus> | null = null

/**
 * Read-only; open even without a session. An older deployment answers "Unknown action", which
 * reads as "not configured" — and the sign-in POST is only ever sent after this says configured,
 * so an old script never receives it (it would treat it as a Shortcut transaction).
 * Shared per page load: the sign-in screen fires it on open, which also wakes the script up
 * so the passcode check that follows answers faster.
 */
export function getAuthStatus(): Promise<AuthStatus> {
  authStatusPromise ??= fetchJson<{ success: boolean; auth?: AuthStatus }>('authstatus')
    .then((body) => (body.success && body.auth ? body.auth : { configured: false, enforced: false }))
    .catch((err: unknown) => {
      authStatusPromise = null
      if (err instanceof AuthRequiredError) return { configured: true, enforced: true }
      throw err
    })
  return authStatusPromise
}

/**
 * Exchanges the passcode for a signed session token.
 *
 * Google's redirect hop sometimes stalls for 20–30s even though the script answered in under a
 * second. So if the first attempt is still out after a few seconds, an identical second one goes
 * out and whichever answers first wins. Both carry the same attemptId, so a wrong passcode is
 * still counted only once towards the lockout.
 */
export async function signIn(passcode: string): Promise<{ token: string; expiresAt: number }> {
  const status = await getAuthStatus()
  if (!status.configured) throw new GoogleSheetsApiError('No passcode is set up yet — see Settings → Security.')

  const attemptId = crypto.randomUUID()
  const init: RequestInit = { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ authLogin: passcode, attemptId }) }
  type Answer = { success?: boolean; error?: string; token?: string; expiresAt?: number; locked?: boolean }

  const attempt = async (): Promise<Answer> => {
    // Straight to fetch (no queue, no auth-required side effects): nothing else may delay this.
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 30_000)
    try {
      const response = await fetch(getApiUrl() + (getApiUrl().includes('?') ? '&' : '?') + 'action=auth', { ...init, signal: controller.signal })
      const text = await response.text()
      const body = JSON.parse(text) as Answer & { authRequired?: boolean }
      // A stalled hop can make Google replay the URL as a GET, which never reached the check.
      if (body.authRequired || /Unknown action/.test(body.error ?? '')) throw new Error('replayed')
      return body
    } finally {
      clearTimeout(timer)
    }
  }

  const body = await new Promise<Answer>((resolve, reject) => {
    let done = false
    let failures = 0
    let launched = 0
    const launch = () => {
      launched++
      attempt().then(
        (answer) => {
          if (done) return
          done = true
          clearTimeout(hedge)
          resolve(answer)
        },
        () => {
          if (done) return
          failures++
          if (failures >= 2 || launched >= 2) {
            if (failures >= launched) {
              done = true
              clearTimeout(hedge)
              reject(new GoogleSheetsApiError('Could not reach Luma. Check your connection and try again.'))
            }
            return
          }
          clearTimeout(hedge)
          launch()
        },
      )
    }
    const hedge = setTimeout(() => {
      if (!done && launched < 2) launch()
    }, 5_000)
    launch()
  })

  if (!body.success || !body.token || !body.expiresAt) throw new GoogleSheetsApiError(body.error || "That passcode isn't right.")
  return { token: body.token, expiresAt: body.expiresAt }
}

/** Invalidates every session on every device (including this one). */
export async function signOutEverywhere(): Promise<void> {
  const result = await withSlot(true, () =>
    fetchTextNow(buildEndpoint('auth'), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ authLogoutAll: true }) }, 45_000),
  )
  const body = JSON.parse(result.text) as { success?: boolean; error?: string }
  if (!body.success) throw new GoogleSheetsApiError(body.error || "Couldn't sign out other devices.")
}

/* Vault (Luma_Vault in Apps Script). Only ciphertext crosses the wire — see lib/vaultCrypto.
 * Same gate as Drive/AI: a vaultOp POST to an older deployment would otherwise be appended as an
 * iPhone-Shortcut transaction, so every write first confirms the script knows about the vault. */

export interface VaultStatus {
  available: boolean
  ready: boolean
  /** The deployment accepts Argon2id vaults and app-chosen item ids. */
  v2?: boolean
}

export async function getVaultStatus(): Promise<VaultStatus> {
  const body = await fetchJson<{ success: boolean; error?: string; vault?: VaultStatus }>('vaultstatus')
  if (/Unknown action/i.test(body.error ?? '') || !body.vault) return { available: false, ready: false }
  if (!body.success) throw new GoogleSheetsApiError(body.error || "Couldn't reach your vault.")
  if (body.vault.available) vaultCapability = Promise.resolve()
  return body.vault
}

let vaultCapability: Promise<void> | null = null

function requireVault(): Promise<void> {
  vaultCapability ??= getVaultStatus()
    .then((status) => {
      if (!status.available) throw new GoogleSheetsApiError('The vault needs the latest Apps Script deployment. Deploy it, then reload.')
    })
    .catch((err: unknown) => {
      vaultCapability = null
      throw err
    })
  return vaultCapability
}

export async function getVault(): Promise<{ meta: VaultMeta | null; items: RawVaultItem[] }> {
  await requireVault()
  const body = await fetchJson<{ success: boolean; error?: string; meta?: VaultMeta | null; items?: RawVaultItem[] }>('vault')
  if (!body.success) throw new GoogleSheetsApiError(body.error || "Couldn't load your vault.")
  return { meta: body.meta ?? null, items: body.items ?? [] }
}

/** One vault write. Read back, never retried (a retried create would duplicate the item). */
async function vaultOp<T = Record<string, unknown>>(payload: Record<string, unknown>): Promise<T> {
  await requireVault()
  let result: { status: number; ok: boolean; text: string }
  try {
    result = await fetchTextWithin(
      buildEndpoint('vault'),
      { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) },
      60_000,
      undefined,
      true,
    )
  } catch (cause) {
    if (cause instanceof AuthRequiredError) throw cause
    throw new GoogleSheetsApiError(
      cause instanceof AttemptTimeout ? 'Google is taking too long to confirm. Reload the vault in a moment to check.' : 'Could not reach Google. Check your connection and try again.',
    )
  }
  let body: { success?: boolean; error?: string } & T
  try {
    body = JSON.parse(result.text)
  } catch {
    throw new GoogleSheetsApiError("Google didn't confirm the change. Reload the vault in a moment to check.")
  }
  if (!body.success) throw new GoogleSheetsApiError(body.error || 'The vault could not be updated.')
  return body
}

export const vaultApi = {
  setup: (meta: VaultMeta) => vaultOp<{ meta: VaultMeta }>({ vaultOp: 'setup', meta }),
  /** Updates `id`, or creates an item — with `newId` when the app chose (and sealed in) the id. */
  save: (data: string, id?: string, newId?: string) => vaultOp<{ item: RawVaultItem }>({ vaultOp: 'save', data, ...(id ? { id } : {}), ...(!id && newId ? { newId } : {}) }),
  remove: (id: string) => vaultOp({ vaultOp: 'delete', id }),
  rekey: (meta: VaultMeta, items: { id: string; data: string }[]) => vaultOp<{ meta: VaultMeta }>({ vaultOp: 'rekey', meta, items }),
  reset: () => vaultOp({ vaultOp: 'reset', confirm: 'ERASE VAULT' }),
}

/* Bills & budgets (Luma_Planning in Apps Script). Same rule as Drive/AI/Vault: every write first
 * confirms the script knows these routes — an older deployment would otherwise append a
 * `{ action: 'bill' }` POST to Transactions as an iPhone-Shortcut expense. */

let planningCapability: Promise<void> | null = null

function requirePlanning(): Promise<void> {
  planningCapability ??= fetchJson<{ success: boolean; error?: string }>('bills')
    .then((body) => {
      if (!body.success) throw new GoogleSheetsApiError(/Unknown action/i.test(body.error ?? '') ? PLANNING_NEEDS_DEPLOY : body.error || "Couldn't reach your bills.")
    })
    .catch((err: unknown) => {
      planningCapability = null
      throw err
    })
  return planningCapability
}

export const PLANNING_NEEDS_DEPLOY = 'Bills and budgets need the latest Apps Script deployment (clasp push → Deploy → New version).'

async function fetchPlanningList<T>(action: 'bills' | 'budgets', signal?: AbortSignal): Promise<T[]> {
  try {
    const rows = await fetchList<T>(action, signal)
    planningCapability ??= Promise.resolve()
    return rows
  } catch (err) {
    if (err instanceof GoogleSheetsApiError && /Unknown action/i.test(err.message)) throw new GoogleSheetsApiError(PLANNING_NEEDS_DEPLOY)
    throw err
  }
}

export const getBills = (signal?: AbortSignal) => fetchPlanningList<RawBill>('bills', signal)
export const getBudgets = (signal?: AbortSignal) => fetchPlanningList<RawBudget>('budgets', signal)

const planningWrite = async (action: 'bill' | 'budget', payload: Record<string, unknown>) => {
  await requirePlanning()
  return postEntity(action, payload)
}

export const createBill = (payload: Record<string, unknown>) => planningWrite('bill', payload)
export const updateBill = (id: string, payload: Record<string, unknown>) => planningWrite('bill', { operation: 'update', id, ...payload })
export const deleteBill = (id: string) => planningWrite('bill', { operation: 'delete', id })
export const createBudget = (payload: Record<string, unknown>) => planningWrite('budget', payload)
export const updateBudget = (id: string, payload: Record<string, unknown>) => planningWrite('budget', { operation: 'update', id, ...payload })
export const deleteBudget = (id: string) => planningWrite('budget', { operation: 'delete', id })

/**
 * Marks a bill paid: the script records the expense (moving the linked account's balance) and
 * rolls the due date forward. `dueDate` is the one on screen, so a second tap — or another
 * device — can't record the same payment twice. Never retried.
 */
export async function payBill(id: string, details: { dueDate: string; amount: number; date: string; accountId?: string; paymentMethod?: string }) {
  await requirePlanning()
  let result: { status: number; ok: boolean; text: string }
  try {
    result = await fetchTextWithin(
      buildEndpoint('bill'),
      { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ operation: 'pay', id, ...details }) },
      60_000,
      undefined,
      true,
    )
  } catch (cause) {
    if (cause instanceof AuthRequiredError) throw cause
    throw new GoogleSheetsApiError("Google didn't confirm the payment. Refresh in a moment to see whether it was recorded.")
  }
  let body: { success?: boolean; error?: string; nextDueDate?: string | null; alreadyPaid?: boolean }
  try {
    body = JSON.parse(result.text)
  } catch {
    throw new GoogleSheetsApiError("Google didn't confirm the payment. Refresh in a moment to see whether it was recorded.")
  }
  if (!body.success) throw Object.assign(new GoogleSheetsApiError(body.error || "Couldn't mark the bill paid."), { alreadyPaid: !!body.alreadyPaid })
  return { nextDueDate: body.nextDueDate ?? null }
}

/* Backups & Excel export (Luma_Backup). Writes are gated on ?action=backupstatus like the other
 * newer features, so an older deployment can never receive a backupOp POST. */

export interface BackupStatus {
  enabled: boolean
  lastBackupAt: string | null
  count: number
  keep: number
  folderUrl: string
  recent: { id: string; name: string; createdAt: string; url: string }[]
}

export const BACKUP_NEEDS_DEPLOY = 'Backups need the latest Apps Script deployment (clasp push → Deploy → New version).'

export async function getBackupStatus(): Promise<BackupStatus> {
  const body = await fetchJson<{ success: boolean; error?: string; backup?: BackupStatus }>('backupstatus')
  if (!body.success || !body.backup) throw new GoogleSheetsApiError(/Unknown action/i.test(body.error ?? '') ? BACKUP_NEEDS_DEPLOY : body.error || "Couldn't check your backups.")
  return body.backup
}

async function backupOp<T>(op: 'now' | 'enable' | 'disable' | 'export'): Promise<T> {
  await getBackupStatus() // capability check (and a fresh status for the caller's toast)
  let result: { status: number; ok: boolean; text: string }
  try {
    result = await fetchTextWithin(
      buildEndpoint('backup'),
      { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ backupOp: op }) },
      180_000,
      undefined,
      true,
    )
  } catch (cause) {
    if (cause instanceof AuthRequiredError) throw cause
    throw new GoogleSheetsApiError('Google is taking long to answer. Check the backups list again in a minute.')
  }
  let body: { success?: boolean; error?: string } & T
  try {
    body = JSON.parse(result.text)
  } catch {
    throw new GoogleSheetsApiError("Google didn't confirm. Check the backups list again in a minute.")
  }
  if (!body.success) throw new GoogleSheetsApiError(body.error || "That didn't work.")
  return body
}

export const backupApi = {
  now: () => backupOp<{ backup: { name: string; url: string; at: string }; status: BackupStatus }>('now'),
  enable: () => backupOp<{ status: BackupStatus }>('enable'),
  disable: () => backupOp<{ status: BackupStatus }>('disable'),
  exportXlsx: () => backupOp<{ fileName: string; size: number; dataBase64: string }>('export'),
}

/* Face ID / fingerprint devices (Luma_Auth). Only offered when ?action=authstatus says devices. */

export interface RegisteredDevice {
  id: string
  name: string
  createdAt: string
  lastUsedAt: string
}

async function authPost<T>(payload: Record<string, unknown>, withSession: boolean): Promise<{ success?: boolean; error?: string } & T> {
  const url = withSession ? buildEndpoint('auth') : getApiUrl() + (getApiUrl().includes('?') ? '&' : '?') + 'action=auth'
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 40_000)
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload), signal: controller.signal })
    const text = await response.text()
    if (withSession) assertSignedIn(text)
    return JSON.parse(text)
  } catch (err) {
    if (err instanceof AuthRequiredError) throw err
    throw new GoogleSheetsApiError('Could not reach Luma. Check your connection and try again.')
  } finally {
    clearTimeout(timer)
  }
}

export async function devicesSupported(): Promise<boolean> {
  try {
    const status = await getAuthStatus()
    return !!status.devices
  } catch {
    return false
  }
}

export async function enrollDevice(deviceName: string): Promise<{ deviceId: string; secret: string }> {
  const body = await authPost<{ deviceId?: string; secret?: string }>({ deviceOp: 'enroll', deviceName }, true)
  if (!body.success || !body.deviceId || !body.secret) throw new GoogleSheetsApiError(body.error || "Couldn't register this device.")
  return { deviceId: body.deviceId, secret: body.secret }
}

export async function listDevices(): Promise<RegisteredDevice[]> {
  const body = await authPost<{ devices?: RegisteredDevice[] }>({ deviceOp: 'list' }, true)
  if (!body.success) throw new GoogleSheetsApiError(body.error || "Couldn't load your devices.")
  return body.devices ?? []
}

export async function revokeDevice(deviceId: string): Promise<void> {
  const body = await authPost({ deviceOp: 'revoke', deviceId }, true)
  if (!body.success) throw new GoogleSheetsApiError(body.error || "Couldn't remove the device.")
}

/** Exchanges this device's secret (unlocked by Face ID) for a normal 2-hour session. */
export async function signInWithDevice(deviceId: string, secret: string): Promise<{ token: string; expiresAt: number }> {
  const status = await getAuthStatus()
  if (!status.devices) throw new GoogleSheetsApiError('Face ID sign-in needs the latest Apps Script deployment.')
  const body = await authPost<{ token?: string; expiresAt?: number; revoked?: boolean }>({ deviceLogin: secret, deviceId }, false)
  if (!body.success || !body.token || !body.expiresAt) throw Object.assign(new GoogleSheetsApiError(body.error || "Couldn't sign in."), { revoked: !!body.revoked })
  return { token: body.token, expiresAt: body.expiresAt }
}

/* Family: recharges and important dates (Luma_Family). Gated like bills — an older deployment
 * never receives a recharge/importantdate POST (it would become a Shortcut transaction). */

export const FAMILY_NEEDS_DEPLOY = 'Family features need the latest Apps Script deployment (clasp push → Deploy → New version).'
let familyCapability: Promise<void> | null = null

async function fetchFamilyList<T>(action: 'recharges' | 'rechargehistory' | 'importantdates', signal?: AbortSignal): Promise<T[]> {
  try {
    const rows = await fetchList<T>(action, signal)
    familyCapability ??= Promise.resolve()
    return rows
  } catch (err) {
    if (err instanceof GoogleSheetsApiError && /Unknown action/i.test(err.message)) throw new GoogleSheetsApiError(FAMILY_NEEDS_DEPLOY)
    throw err
  }
}

function requireFamily(): Promise<void> {
  familyCapability ??= fetchJson<{ success: boolean; error?: string }>('recharges')
    .then((body) => {
      if (!body.success) throw new GoogleSheetsApiError(/Unknown action/i.test(body.error ?? '') ? FAMILY_NEEDS_DEPLOY : body.error || "Couldn't reach Luma.")
    })
    .catch((err: unknown) => {
      familyCapability = null
      throw err
    })
  return familyCapability
}

export const getRecharges = (signal?: AbortSignal) => fetchFamilyList<RawRecharge>('recharges', signal)
export const getRechargeHistory = (signal?: AbortSignal) => fetchFamilyList<RawRechargeLog>('rechargehistory', signal)
export const getImportantDates = (signal?: AbortSignal) => fetchFamilyList<RawImportantDate>('importantdates', signal)

const familyWrite = async (action: 'recharge' | 'importantdate', payload: Record<string, unknown>) => {
  await requireFamily()
  return postEntity(action, payload)
}

export const createRecharge = (payload: Record<string, unknown>) => familyWrite('recharge', payload)
export const updateRecharge = (id: string, payload: Record<string, unknown>) => familyWrite('recharge', { operation: 'update', id, ...payload })
export const deleteRecharge = (id: string) => familyWrite('recharge', { operation: 'delete', id })
export const createImportantDate = (payload: Record<string, unknown>) => familyWrite('importantdate', payload)
export const updateImportantDate = (id: string, payload: Record<string, unknown>) => familyWrite('importantdate', { operation: 'update', id, ...payload })
export const deleteImportantDate = (id: string) => familyWrite('importantdate', { operation: 'delete', id })

/** Records a recharge done. Never retried; `expectedExpiry` stops a double tap from logging it twice. */
export async function markRecharged(
  id: string,
  details: { expectedExpiry: string; date: string; amount: number; plan?: string; validityDays: number; recordExpense: boolean; accountId?: string; paymentMethod?: string },
): Promise<{ validUntil: string; expenseRecorded: boolean }> {
  await requireFamily()
  let result: { status: number; ok: boolean; text: string }
  try {
    result = await fetchTextWithin(
      buildEndpoint('recharge'),
      { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ operation: 'recharged', id, ...details }) },
      60_000,
      undefined,
      true,
    )
  } catch (cause) {
    if (cause instanceof AuthRequiredError) throw cause
    throw new GoogleSheetsApiError("Google didn't confirm. Refresh in a moment to see whether it was recorded.")
  }
  let body: { success?: boolean; error?: string; validUntil?: string; expenseRecorded?: boolean; alreadyDone?: boolean }
  try {
    body = JSON.parse(result.text)
  } catch {
    throw new GoogleSheetsApiError("Google didn't confirm. Refresh in a moment to see whether it was recorded.")
  }
  if (!body.success || !body.validUntil) throw Object.assign(new GoogleSheetsApiError(body.error || "Couldn't record the recharge."), { alreadyDone: !!body.alreadyDone })
  return { validUntil: body.validUntil, expenseRecorded: !!body.expenseRecorded }
}

/* Statement import (Luma_Import). Gated: an older deployment never receives an importOp POST. */

export const IMPORT_NEEDS_DEPLOY = 'Statement import needs the latest Apps Script deployment (clasp push → Deploy → New version).'
let importCapability: Promise<void> | null = null

function requireImport(): Promise<void> {
  importCapability ??= fetchJson<{ success: boolean; error?: string; import?: { gpay?: boolean } }>('importstatus')
    .then((body) => {
      if (!body.success || !body.import?.gpay) throw new GoogleSheetsApiError(/Unknown action/i.test(body.error ?? '') || body.success ? IMPORT_NEEDS_DEPLOY : body.error || "Couldn't reach Luma.")
    })
    .catch((err: unknown) => {
      importCapability = null
      throw err
    })
  return importCapability
}

export interface ImportRowInput {
  date: string
  time: string
  amount: number
  type: 'Expense' | 'Income'
  category: string
  subcategory: string
  paymentMethod: string
  merchant: string
  note: string
  accountId: string
  reference: string
}

export interface ImportResult {
  imported: number
  skipped: number
  failed: number
}

const IMPORT_CHUNK = 40

/**
 * Sends confirmed rows in small batches (each batch is one quick script run). Never retried;
 * it's still safe to import the same statement again — rows whose UPI reference is already
 * in the sheet are skipped by the script.
 */
export async function importTransactions(rows: ImportRowInput[], source: string, onProgress?: (done: number, total: number) => void): Promise<ImportResult> {
  await requireImport()
  const total: ImportResult = { imported: 0, skipped: 0, failed: 0 }
  for (let i = 0; i < rows.length; i += IMPORT_CHUNK) {
    const chunk = rows.slice(i, i + IMPORT_CHUNK)
    let result: { status: number; ok: boolean; text: string }
    const unconfirmed = () =>
      new GoogleSheetsApiError(
        `Google didn't confirm after ${total.imported} imported. Refresh to check — importing the same statement again is safe, already-saved payments are skipped.`,
      )
    try {
      result = await fetchTextWithin(
        buildEndpoint('import'),
        { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ importOp: 'transactions', source, rows: chunk }) },
        120_000,
        undefined,
        true,
      )
    } catch (cause) {
      if (cause instanceof AuthRequiredError) throw cause
      throw unconfirmed()
    }
    let body: { success?: boolean; error?: string; imported?: number; skipped?: number; failed?: unknown[] }
    try {
      body = JSON.parse(result.text)
    } catch {
      throw unconfirmed()
    }
    if (!body.success) throw new GoogleSheetsApiError(body.error || "Couldn't import the payments.")
    total.imported += body.imported ?? 0
    total.skipped += body.skipped ?? 0
    total.failed += body.failed?.length ?? 0
    onProgress?.(Math.min(i + IMPORT_CHUNK, rows.length), rows.length)
  }
  return total
}

/* Vehicles and medical bills (Luma_Life). Gated like Family: an older deployment never
 * receives a vehicle/medicalbill POST (it would become a Shortcut transaction). */

export const LIFE_NEEDS_DEPLOY = 'Vehicles and Health need the latest Apps Script deployment (clasp push → Deploy → New version).'
let lifeCapability: Promise<void> | null = null

async function fetchLifeList<T>(action: 'vehicles' | 'vehiclelogs' | 'medicalbills', signal?: AbortSignal): Promise<T[]> {
  try {
    const rows = await fetchList<T>(action, signal)
    lifeCapability ??= Promise.resolve()
    return rows
  } catch (err) {
    if (err instanceof GoogleSheetsApiError && /Unknown action/i.test(err.message)) throw new GoogleSheetsApiError(LIFE_NEEDS_DEPLOY)
    throw err
  }
}

function requireLife(): Promise<void> {
  lifeCapability ??= fetchJson<{ success: boolean; error?: string }>('vehicles')
    .then((body) => {
      if (!body.success) throw new GoogleSheetsApiError(/Unknown action/i.test(body.error ?? '') ? LIFE_NEEDS_DEPLOY : body.error || "Couldn't reach Luma.")
    })
    .catch((err: unknown) => {
      lifeCapability = null
      throw err
    })
  return lifeCapability
}

export const getVehicles = (signal?: AbortSignal) => fetchLifeList<RawVehicle>('vehicles', signal)
export const getVehicleLogs = (signal?: AbortSignal) => fetchLifeList<RawVehicleLog>('vehiclelogs', signal)
export const getMedicalBills = (signal?: AbortSignal) => fetchLifeList<RawMedicalBill>('medicalbills', signal)

type LifeAction = 'vehicle' | 'vehiclelog' | 'medicalbill'
const lifeWrite = async (action: LifeAction, payload: Record<string, unknown>) => {
  await requireLife()
  return postEntity(action, payload)
}

export const createVehicle = (payload: Record<string, unknown>) => lifeWrite('vehicle', payload)
export const updateVehicle = (id: string, payload: Record<string, unknown>) => lifeWrite('vehicle', { operation: 'update', id, ...payload })
export const deleteVehicle = (id: string) => lifeWrite('vehicle', { operation: 'delete', id })
export const createVehicleLog = (payload: Record<string, unknown>) => lifeWrite('vehiclelog', payload)
export const updateVehicleLog = (id: string, payload: Record<string, unknown>) => lifeWrite('vehiclelog', { operation: 'update', id, ...payload })
export const deleteVehicleLog = (id: string) => lifeWrite('vehiclelog', { operation: 'delete', id })
export const createMedicalBill = (payload: Record<string, unknown>) => lifeWrite('medicalbill', payload)
export const updateMedicalBill = (id: string, payload: Record<string, unknown>) => lifeWrite('medicalbill', { operation: 'update', id, ...payload })
export const deleteMedicalBill = (id: string) => lifeWrite('medicalbill', { operation: 'delete', id })

/** Many logs/bills in one request. Never retried: a timeout asks the user to refresh and check. */
export async function createLifeBulk(action: 'vehiclelog' | 'medicalbill', rows: Record<string, unknown>[]): Promise<{ created: number; failed: number }> {
  await requireLife()
  let result: { status: number; ok: boolean; text: string }
  const unconfirmed = () => new GoogleSheetsApiError("Google didn't confirm. Refresh in a moment to see what was saved.")
  try {
    result = await fetchTextWithin(
      buildEndpoint(action),
      { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ operation: 'bulk', rows }) },
      90_000,
      undefined,
      true,
    )
  } catch (cause) {
    if (cause instanceof AuthRequiredError) throw cause
    throw unconfirmed()
  }
  let body: { success?: boolean; error?: string; created?: number; failed?: unknown[] }
  try {
    body = JSON.parse(result.text)
  } catch {
    throw unconfirmed()
  }
  if (!body.success) throw new GoogleSheetsApiError(body.error || "Couldn't save.")
  return { created: body.created ?? 0, failed: body.failed?.length ?? 0 }
}

/* Snap & file: the AI reads one photo and says what it is (Luma_AI "snap"). Gated on aistatus.snap,
 * so an older deployment never receives the request. Read-only on the script side. */

let snapCapability: Promise<void> | null = null

function requireSnap(): Promise<void> {
  snapCapability ??= fetchJson<{ success: boolean; snap?: boolean; chat?: boolean }>('aistatus')
    .then((body) => {
      if (!body.success || body.snap === undefined) throw new GoogleSheetsApiError('Snap & file needs the latest Apps Script deployment (clasp push → Deploy → New version).')
      if (!body.snap) throw new GoogleSheetsApiError("Azure OpenAI isn't set up yet. Add the AZURE_OPENAI_* Script Properties in Apps Script.")
    })
    .catch((err: unknown) => {
      snapCapability = null
      throw err
    })
  return snapCapability
}

/** One attempt, no hedged duplicate: a photo read takes several seconds and costs more than a chat turn. */
export async function readSnap<T>(image: string, today: string, hints: { people: string[]; categories: string[] }): Promise<T> {
  await requireSnap()
  let result: { status: number; ok: boolean; text: string }
  try {
    result = await fetchTextWithin(
      buildEndpoint('ai'),
      { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ aiTask: 'snap', image, today, hints }) },
      75_000,
      undefined,
      true,
    )
  } catch (cause) {
    if (cause instanceof AuthRequiredError) throw cause
    throw new GoogleSheetsApiError(cause instanceof AttemptTimeout ? 'Reading the photo took too long. Please try again.' : 'Could not reach Google. Check your connection and try again.')
  }
  let body: { success?: boolean; error?: string; result?: T }
  try {
    body = JSON.parse(result.text)
  } catch {
    throw new GoogleSheetsApiError("Luma couldn't read that photo. Please try again.")
  }
  if (!body.success || !body.result) throw new GoogleSheetsApiError(body.error || "Luma couldn't read that photo.")
  return body.result
}

/* File tools: Office conversions through the user's Drive (Luma_Convert). Gated on convertstatus,
 * so an older deployment never receives a convertOp POST. Never retried. */

export const CONVERT_NEEDS_DEPLOY = 'Word, Excel and PowerPoint conversions need the latest Apps Script deployment (clasp push → Deploy → New version).'
let convertCapability: Promise<{ sources: Record<string, string>; targets: Record<string, string[]> }> | null = null

export function getConvertCapability() {
  convertCapability ??= fetchJson<{ success: boolean; error?: string; convert?: { sources: Record<string, string>; targets: Record<string, string[]> } }>('convertstatus')
    .then((body) => {
      if (!body.success || !body.convert) throw new GoogleSheetsApiError(/Unknown action/i.test(body.error ?? '') || body.success ? CONVERT_NEEDS_DEPLOY : body.error || "Couldn't reach Luma.")
      return body.convert
    })
    .catch((err: unknown) => {
      convertCapability = null
      throw err
    })
  return convertCapability
}

export async function convertOfficeFile(fileName: string, dataBase64: string, to: string, ocrLanguage?: string): Promise<{ fileName: string; mimeType: string; dataBase64: string }> {
  await getConvertCapability()
  let result: { status: number; ok: boolean; text: string }
  try {
    result = await fetchTextWithin(
      buildEndpoint('convert'),
      { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ convertOp: 'convert', fileName, dataBase64, to, ocrLanguage }) },
      150_000,
      undefined,
      true,
    )
  } catch (cause) {
    if (cause instanceof AuthRequiredError) throw cause
    throw new GoogleSheetsApiError(cause instanceof AttemptTimeout ? 'Google took too long to convert this file. Try a smaller file.' : 'Could not reach Google. Check your connection and try again.')
  }
  let body: { success?: boolean; error?: string; fileName?: string; mimeType?: string; dataBase64?: string }
  try {
    body = JSON.parse(result.text)
  } catch {
    throw new GoogleSheetsApiError("Google didn't send the converted file back. Please try again.")
  }
  if (!body.success || !body.dataBase64 || !body.fileName) throw new GoogleSheetsApiError(body.error || "Couldn't convert the file.")
  return { fileName: body.fileName, mimeType: body.mimeType || 'application/octet-stream', dataBase64: body.dataBase64 }
}

/* The bootstrap bundle says what the deployment supports, so each feature's "do you support X?"
 * check is answered without its own round trip. Lists that arrived in the bundle prove their
 * feature too (older deployments that don't send `capabilities` still benefit). A missing or
 * false flag leaves the normal check in place. */
function primeCapabilities(caps: Partial<Record<string, boolean>> | undefined, data: Record<string, unknown>) {
  const has = (flag: string, list?: string) => caps?.[flag] === true || (!!list && Array.isArray(data[list]))
  if (has('planning', 'bills')) planningCapability ??= Promise.resolve()
  if (has('family', 'recharges')) familyCapability ??= Promise.resolve()
  if (has('life', 'vehicles')) lifeCapability ??= Promise.resolve()
  if (has('import')) importCapability ??= Promise.resolve()
  if (has('drive')) driveStatusPromise ??= Promise.resolve()
  if (has('snap')) snapCapability ??= Promise.resolve()
  if (has('convert')) convertCapability ??= Promise.resolve({ sources: {}, targets: {} })
}
