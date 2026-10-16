/** Extract a human-readable message from axios/fetch-style errors. */
export function extractApiErrorMessage(error: unknown, fallback: string): string {
  const err = error as { response?: { data?: { message?: string; error?: string } | string }; message?: string };
  const data = err?.response?.data;
  if (typeof data === 'string' && data.trim()) return data;
  if (data && typeof data === 'object') {
    if (typeof data.message === 'string' && data.message.trim()) return data.message;
    if (typeof data.error === 'string' && data.error.trim()) return data.error;
  }
  if (typeof err?.message === 'string' && err.message.trim()) {
    return err.message;
  }
  return fallback;
}

/** Same payload the UI shows — never rewritten. */
export function extractRawApiErrorMessage(error: unknown, fallback: string): string {
  return extractApiErrorMessage(error, fallback);
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}
