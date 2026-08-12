export class EditableVsumMetaModelRefConversionError extends Error {
  constructor(message: string) {
    super(`EditableVsumMetaModelRef conversion failed: ${message}`);
    this.name = 'EditableVsumMetaModelRefConversionError';
  }
}
