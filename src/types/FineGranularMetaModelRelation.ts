import { EditableFineGranularMetaModelRelation } from "./EditableVsumDetails";

/**
 * Persisted fine-granular relation with a required backend identifier.
 */
export type FineGranularMetaModelRelation = Omit<EditableFineGranularMetaModelRelation, 'action'> & Required<Pick<EditableFineGranularMetaModelRelation, 'id'>>;