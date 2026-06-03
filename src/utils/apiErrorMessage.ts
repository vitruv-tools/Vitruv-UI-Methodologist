/** Extract a human-readable message from axios/fetch-style errors. */
export function extractApiErrorMessage(error: unknown, fallback: string): string {
  const err = error as { response?: { data?: { message?: string } }; message?: string };
  const data = err?.response?.data;
  if (data && typeof data === 'object' && typeof data.message === 'string' && data.message.trim()) {
    return data.message;
  }
  if (typeof err?.message === 'string' && err.message.trim()) {
    return err.message;
  }
  return fallback;
}
