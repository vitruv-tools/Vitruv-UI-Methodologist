export class NoVsumDetailsStoreError extends Error {
  constructor(vsumId: number) {
    super(
      `No VsumDetails store for VSUM ${vsumId} — call createVsumDetailsStore() first`,
    );
    this.name = 'NoVsumDetailsStoreError';
  }
}
