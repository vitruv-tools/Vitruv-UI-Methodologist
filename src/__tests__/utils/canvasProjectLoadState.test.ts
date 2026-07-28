import { getCanvasProjectLoadFailureState } from '../../utils/canvasProjectLoadState';

describe('getCanvasProjectLoadFailureState', () => {
  it('maps a direct 403 status to forbidden state', () => {
    expect(getCanvasProjectLoadFailureState({ status: 403 })).toEqual({
      status: 'forbidden',
      message: 'You do not have access to this project.',
    });
  });

  it('maps a direct 404 status to not-found state', () => {
    expect(getCanvasProjectLoadFailureState({ status: 404 })).toEqual({
      status: 'notFound',
      message: 'This project does not exist or may have been deleted.',
    });
  });

  it('extracts status from the response', () => {
    expect(getCanvasProjectLoadFailureState({
      response: { status: 403 },
    })).toEqual({
      status: 'forbidden',
      message: 'You do not have access to this project.',
    });
  });

  it('extracts status from response data', () => {
    expect(getCanvasProjectLoadFailureState({
      response: {
        data: { status: 404 },
      },
    })).toEqual({
      status: 'notFound',
      message: 'This project does not exist or may have been deleted.',
    });
  });

  it('extracts statusCode from response data', () => {
    expect(getCanvasProjectLoadFailureState({
      response: {
        data: { statusCode: 403 },
      },
    })).toEqual({
      status: 'forbidden',
      message: 'You do not have access to this project.',
    });
  });

  it('handles numeric-string statuses', () => {
    expect(getCanvasProjectLoadFailureState({ status: '404' })).toEqual({
      status: 'notFound',
      message: 'This project does not exist or may have been deleted.',
    });
  });

  it('uses a generic Error message', () => {
    expect(getCanvasProjectLoadFailureState(
      new Error('Service unavailable.'),
    )).toEqual({
      status: 'error',
      message: 'Service unavailable.',
    });
  });

  it('uses the fallback message for an unknown failure', () => {
    expect(getCanvasProjectLoadFailureState({})).toEqual({
      status: 'error',
      message: 'Unable to load this project.',
    });
  });

  it.each([
    Number.NaN,
    Number.POSITIVE_INFINITY,
    'invalid-status',
  ])('uses generic error state for invalid status %p', status => {
    expect(getCanvasProjectLoadFailureState({ status })).toEqual({
      status: 'error',
      message: 'Unable to load this project.',
    });
  });
});
