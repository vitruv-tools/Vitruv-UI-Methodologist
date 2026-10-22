export class NoActiveVsumError extends Error {
  constructor() {
    super('No active VSUM — call useProjectStore.setActiveId() first');
    this.name = 'NoActiveVsumError';
  }
}
