import { EditableFineGranularMetaModelRelation } from "./EditableVsumDetails";

export type FineGranularMetaModelRelation = Omit<EditableFineGranularMetaModelRelation, 'action'> & Required<Pick<EditableFineGranularMetaModelRelation, 'id'>>;