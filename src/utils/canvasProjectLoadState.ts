export type CanvasProjectLoadStatus =
  | 'loading'
  | 'hydrating'
  | 'ready'
  | 'forbidden'
  | 'notFound'
  | 'error';

export interface CanvasProjectLoadState {
  status: CanvasProjectLoadStatus;
  message?: string;
}

interface CanvasProjectLoadApiError {
  status?: unknown;
  response?: {
    status?: unknown;
    data?: {
      status?: unknown;
      statusCode?: unknown;
    };
  };
}

function getErrorStatus(error: unknown): number | undefined {
  const apiError = error as CanvasProjectLoadApiError;
  const rawStatus =
    apiError?.status ??
    apiError?.response?.status ??
    apiError?.response?.data?.status ??
    apiError?.response?.data?.statusCode;
  const status = typeof rawStatus === 'number' ? rawStatus : Number(rawStatus);
  return Number.isFinite(status) ? status : undefined;
}

export function getCanvasProjectLoadFailureState(error: unknown): CanvasProjectLoadState {
  const status = getErrorStatus(error);
  if (status === 403) {
    return {
      status: 'forbidden',
      message: 'You do not have access to this project.',
    };
  }
  if (status === 404) {
    return {
      status: 'notFound',
      message: 'This project does not exist or may have been deleted.',
    };
  }
  return {
    status: 'error',
    message: error instanceof Error && error.message ? error.message : 'Unable to load this project.',
  };
}
