/** Turns a thrown value into a user-facing sentence for toasts (API errors are already phrased for people). */
export function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}
