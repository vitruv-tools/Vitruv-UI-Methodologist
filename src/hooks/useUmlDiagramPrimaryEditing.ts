import {
  useCallback,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react';
import {
  nextUniqueClassName,
  removeAttributeFromClass,
  removeOperationFromClass,
  renameClassInList,
  renameClassInRelationships,
  updateClassAttribute,
  updateClassById,
  updateClassOperation,
} from '../components/canvas/umlDiagramClassTransforms';
import { UML_CLASS_BOX_EDIT_WIDTH } from '../components/canvas/umlDiagramClassMetrics';
import type {
  UmlDiagramClass,
  UmlDiagramEditState,
} from '../components/canvas/umlDiagramTypes';
import {
  type UMLAttribute,
  type UMLOperation,
  type UMLRelationship,
  type UMLVisibility,
  nextUniqueAttributeName,
  nextUniqueOperationName,
  normalizeAttributeTypeDisplay,
  normalizeOperationReturnType,
} from '../utils/ecoreToUml';
import {
  sanitizeUmlClassId,
  type UmlViewport,
} from '../utils/umlLayoutStorage';

export interface UseUmlDiagramPrimaryEditingOptions {
  classes: UmlDiagramClass[];
  relationships: UMLRelationship[];
  setClasses: Dispatch<SetStateAction<UmlDiagramClass[]>>;
  setRelationships: Dispatch<SetStateAction<UMLRelationship[]>>;
  setSelectedClassId: Dispatch<SetStateAction<string | null>>;
  setSelectedRelationshipId: Dispatch<SetStateAction<string | null>>;
  setConnectSourceId: Dispatch<SetStateAction<string | null>>;
  recordChange: () => void;
  containerRef: RefObject<HTMLElement | null>;
  getCurrentViewport: () => UmlViewport;
  getCurrentLayoutOffset: () => { offsetX: number; offsetY: number };
  scheduleDebouncedLayoutSave: () => void;
  scheduleLayoutSave: () => void;
}

export interface UseUmlDiagramPrimaryEditingResult {
  edit: UmlDiagramEditState | null;
  startNameEdit: (classId: string) => void;
  startAttributeEdit: (classId: string, attributeId: string) => void;
  startOperationEdit: (classId: string, operationId: string) => void;
  changeEdit: (edit: UmlDiagramEditState) => void;
  cancelEdit: () => void;
  flushPendingEdit: () => void;
  saveName: (classId: string, name: string) => void;
  saveAttribute: (
    classId: string,
    attributeId: string,
    name: string,
    type: string,
    visibility: UMLVisibility,
  ) => void;
  saveOperation: (
    classId: string,
    operationId: string,
    name: string,
    returnType: string,
    visibility: UMLVisibility,
  ) => void;
  addAttribute: (classId: string) => void;
  deleteAttribute: (classId: string, attributeId: string) => void;
  addOperation: (classId: string) => void;
  deleteOperation: (classId: string, operationId: string) => void;
  addClass: () => void;
  deleteClass: (classId: string) => void;
  updateClass: (
    classId: string,
    patch: Partial<Pick<
      UmlDiagramClass,
      'name' | 'isAbstract' | 'isInterface'
    >>,
  ) => void;
  getInheritanceParentId: (classId: string) => string | null;
  setInheritanceParent: (classId: string, parentId: string | null) => void;
  beginClassDrag: () => void;
  moveClass: (classId: string, x: number, y: number) => void;
  finishClassDrag: () => void;
  addRelationship: (sourceId: string, targetId: string) => boolean;
  deleteRelationship: (relationshipId: string) => void;
  updateRelationship: (
    relationshipId: string,
    patch: Partial<UMLRelationship>,
  ) => void;
}

export function useUmlDiagramPrimaryEditing(
  {
    classes,
    relationships,
    setClasses,
    setRelationships,
    setSelectedClassId,
    setSelectedRelationshipId,
    setConnectSourceId,
    recordChange,
    containerRef,
    getCurrentViewport,
    getCurrentLayoutOffset,
    scheduleDebouncedLayoutSave,
    scheduleLayoutSave,
  }: UseUmlDiagramPrimaryEditingOptions,
): UseUmlDiagramPrimaryEditingResult {
  const [edit, setEdit] = useState<UmlDiagramEditState | null>(null);
  const editRef = useRef<UmlDiagramEditState | null>(null);
  const classesRef = useRef(classes);
  const relationshipsRef = useRef(relationships);
  const dragHistorySavedRef = useRef(false);
  editRef.current = edit;
  classesRef.current = classes;
  relationshipsRef.current = relationships;

  const saveName = useCallback((classId: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      setEdit(null);
      return;
    }
    recordChange();
    const newId = sanitizeUmlClassId(trimmed);
    setClasses(previousClasses => renameClassInList(
      previousClasses,
      classId,
      newId,
      trimmed,
    ));
    setRelationships(previousRelationships => renameClassInRelationships(
      previousRelationships,
      classId,
      newId,
    ));
    setSelectedClassId(previousId => (
      previousId === classId ? newId : previousId
    ));
    setConnectSourceId(previousId => (
      previousId === classId ? newId : previousId
    ));
    setEdit(null);
  }, [
    recordChange,
    setClasses,
    setConnectSourceId,
    setRelationships,
    setSelectedClassId,
  ]);

  const saveAttribute = useCallback((
    classId: string,
    attributeId: string,
    name: string,
    type: string,
    visibility: UMLVisibility,
  ) => {
    recordChange();
    setClasses(previousClasses => updateClassAttribute(
      previousClasses,
      classId,
      attributeId,
      name,
      type,
      visibility,
    ));
    setEdit(null);
  }, [recordChange, setClasses]);

  const saveOperation = useCallback((
    classId: string,
    operationId: string,
    name: string,
    returnType: string,
    visibility: UMLVisibility,
  ) => {
    recordChange();
    setClasses(previousClasses => updateClassOperation(
      previousClasses,
      classId,
      operationId,
      name,
      returnType,
      visibility,
    ));
    setEdit(null);
  }, [recordChange, setClasses]);

  const flushPendingEdit = useCallback(() => {
    const pending = editRef.current;
    if (!pending) return;

    const active = document.activeElement as HTMLElement | null;
    if (
      active
      && (
        active.tagName === 'INPUT'
        || active.tagName === 'SELECT'
        || active.tagName === 'TEXTAREA'
      )
    ) {
      active.blur();
      return;
    }

    if (pending.kind === 'attr') {
      saveAttribute(
        pending.classId,
        pending.attrId,
        pending.name,
        pending.type,
        pending.visibility,
      );
    } else if (pending.kind === 'op') {
      saveOperation(
        pending.classId,
        pending.opId,
        pending.name,
        pending.returnType,
        pending.visibility,
      );
    } else if (pending.kind === 'name') {
      saveName(pending.classId, pending.val);
    }
  }, [saveAttribute, saveName, saveOperation]);

  const startNameEdit = useCallback((classId: string) => {
    flushPendingEdit();
    const classItem = classesRef.current.find(
      candidate => candidate.id === classId,
    )!;
    setEdit({
      classId,
      kind: 'name',
      val: classItem.name,
    });
  }, [flushPendingEdit]);

  const startAttributeEdit = useCallback((
    classId: string,
    attributeId: string,
  ) => {
    flushPendingEdit();
    const classItem = classesRef.current.find(
      candidate => candidate.id === classId,
    )!;
    const attribute = classItem.attributes.find(
      candidate => candidate.id === attributeId,
    )!;
    setEdit({
      classId,
      kind: 'attr',
      attrId: attributeId,
      name: attribute.name,
      type: normalizeAttributeTypeDisplay(attribute.type),
      visibility: attribute.visibility,
    });
  }, [flushPendingEdit]);

  const startOperationEdit = useCallback((
    classId: string,
    operationId: string,
  ) => {
    flushPendingEdit();
    const classItem = classesRef.current.find(
      candidate => candidate.id === classId,
    )!;
    const operation = classItem.operations.find(
      candidate => candidate.id === operationId,
    )!;
    setEdit({
      classId,
      kind: 'op',
      opId: operationId,
      name: operation.name,
      returnType: normalizeOperationReturnType(operation.returnType),
      visibility: operation.visibility,
    });
  }, [flushPendingEdit]);

  const changeEdit = useCallback((nextEdit: UmlDiagramEditState) => {
    setEdit(nextEdit);
  }, []);

  const cancelEdit = useCallback(() => {
    setEdit(null);
  }, []);

  const addAttribute = useCallback((classId: string) => {
    flushPendingEdit();
    recordChange();
    const classItem = classesRef.current.find(
      candidate => candidate.id === classId,
    );
    const uniqueName = nextUniqueAttributeName(
      classItem?.attributes.map(attribute => attribute.name) ?? [],
    );
    const newAttribute: UMLAttribute = {
      id: `${classId}-${Date.now()}`,
      name: uniqueName,
      type: 'String',
      visibility: '+',
    };
    setClasses(previousClasses => updateClassById(
      previousClasses,
      classId,
      previousClass => ({
        ...previousClass,
        attributes: [...previousClass.attributes, newAttribute],
      }),
    ));
    setEdit({
      classId,
      kind: 'attr',
      attrId: newAttribute.id,
      name: newAttribute.name,
      type: newAttribute.type,
      visibility: '+',
    });
  }, [flushPendingEdit, recordChange, setClasses]);

  const addOperation = useCallback((classId: string) => {
    flushPendingEdit();
    recordChange();
    const classItem = classesRef.current.find(
      candidate => candidate.id === classId,
    );
    const uniqueName = nextUniqueOperationName(
      classItem?.operations.map(operation => operation.name) ?? [],
    );
    const newOperation: UMLOperation = {
      id: `${classId}-op-${Date.now()}`,
      name: uniqueName,
      returnType: 'Void',
      visibility: '+',
    };
    setClasses(previousClasses => updateClassById(
      previousClasses,
      classId,
      previousClass => ({
        ...previousClass,
        operations: [...previousClass.operations, newOperation],
      }),
    ));
    setEdit({
      classId,
      kind: 'op',
      opId: newOperation.id,
      name: newOperation.name,
      returnType: newOperation.returnType,
      visibility: '+',
    });
  }, [flushPendingEdit, recordChange, setClasses]);

  const deleteAttribute = useCallback((
    classId: string,
    attributeId: string,
  ) => {
    recordChange();
    setClasses(previousClasses => updateClassById(
      previousClasses,
      classId,
      classItem => removeAttributeFromClass(classItem, attributeId),
    ));
  }, [recordChange, setClasses]);

  const deleteOperation = useCallback((
    classId: string,
    operationId: string,
  ) => {
    recordChange();
    setClasses(previousClasses => updateClassById(
      previousClasses,
      classId,
      classItem => removeOperationFromClass(classItem, operationId),
    ));
  }, [recordChange, setClasses]);

  const deleteClass = useCallback((classId: string) => {
    recordChange();
    setClasses(previousClasses => previousClasses.filter(
      classItem => classItem.id !== classId,
    ));
    setRelationships(previousRelationships => previousRelationships.filter(
      relationship => relationship.sourceId !== classId
        && relationship.targetId !== classId,
    ));
    setSelectedClassId(previousId => (
      previousId === classId ? null : previousId
    ));
    setConnectSourceId(previousId => (
      previousId === classId ? null : previousId
    ));
    setEdit(previousEdit => (
      previousEdit?.classId === classId ? null : previousEdit
    ));
  }, [
    recordChange,
    setClasses,
    setConnectSourceId,
    setRelationships,
    setSelectedClassId,
  ]);

  const addClass = useCallback(() => {
    recordChange();
    const element = containerRef.current;
    const { x: viewportX, y: viewportY, scale } = getCurrentViewport();
    const offset = getCurrentLayoutOffset();
    let x = 200;
    let y = 120;
    if (element) {
      x = (element.clientWidth / 2 - viewportX) / scale
        - offset.offsetX
        - UML_CLASS_BOX_EDIT_WIDTH / 2;
      y = (element.clientHeight / 2 - viewportY) / scale
        - offset.offsetY
        - 72;
    }

    const name = nextUniqueClassName(
      classesRef.current.map(classItem => classItem.name),
    );
    const id = sanitizeUmlClassId(name);
    const newClass: UmlDiagramClass = {
      id,
      name,
      isAbstract: false,
      isInterface: false,
      attributes: [],
      operations: [],
      x,
      y,
    };
    setClasses(previousClasses => [...previousClasses, newClass]);
    setSelectedClassId(id);
  }, [
    containerRef,
    getCurrentLayoutOffset,
    getCurrentViewport,
    recordChange,
    setClasses,
    setSelectedClassId,
  ]);

  const updateClass = useCallback((
    classId: string,
    patch: Partial<Pick<
      UmlDiagramClass,
      'name' | 'isAbstract' | 'isInterface'
    >>,
  ) => {
    recordChange();
    if (patch.name !== undefined) {
      const trimmed = patch.name.trim();
      if (!trimmed) return;
      const newId = sanitizeUmlClassId(trimmed);
      setClasses(previousClasses => renameClassInList(
        previousClasses,
        classId,
        newId,
        trimmed,
      ));
      setRelationships(previousRelationships => renameClassInRelationships(
        previousRelationships,
        classId,
        newId,
      ));
      setSelectedClassId(previousId => (
        previousId === classId ? newId : previousId
      ));
      setConnectSourceId(previousId => (
        previousId === classId ? newId : previousId
      ));
      return;
    }
    setClasses(previousClasses => updateClassById(
      previousClasses,
      classId,
      classItem => ({ ...classItem, ...patch }),
    ));
  }, [
    recordChange,
    setClasses,
    setConnectSourceId,
    setRelationships,
    setSelectedClassId,
  ]);

  const getInheritanceParentId = useCallback((classId: string) => (
    relationshipsRef.current.find(relationship => (
      relationship.type === 'inheritance'
        && relationship.sourceId === classId
    ))?.targetId ?? null
  ), []);

  const setInheritanceParent = useCallback((
    classId: string,
    parentId: string | null,
  ) => {
    recordChange();
    setRelationships(previousRelationships => {
      const filtered = previousRelationships.filter(relationship => !(
        relationship.type === 'inheritance'
          && relationship.sourceId === classId
      ));
      if (!parentId || parentId === classId) return filtered;
      return [...filtered, {
        id: `rel-${Date.now()}`,
        sourceId: classId,
        targetId: parentId,
        type: 'inheritance',
      }];
    });
  }, [recordChange, setRelationships]);

  const beginClassDrag = useCallback(() => {
    dragHistorySavedRef.current = false;
  }, []);

  const moveClass = useCallback((
    classId: string,
    x: number,
    y: number,
  ) => {
    if (!dragHistorySavedRef.current) {
      recordChange();
      dragHistorySavedRef.current = true;
    }
    setClasses(previousClasses => previousClasses.map(classItem => (
      classItem.id === classId ? { ...classItem, x, y } : classItem
    )));
    scheduleDebouncedLayoutSave();
  }, [recordChange, scheduleDebouncedLayoutSave, setClasses]);

  const finishClassDrag = useCallback(() => {
    dragHistorySavedRef.current = false;
    scheduleLayoutSave();
  }, [scheduleLayoutSave]);

  const addRelationship = useCallback((
    sourceId: string,
    targetId: string,
  ): boolean => {
    if (sourceId === targetId) return false;
    const exists = relationshipsRef.current.some(relationship => (
      relationship.sourceId === sourceId
        && relationship.targetId === targetId
        && relationship.type === 'association'
    ));
    if (exists) return false;
    recordChange();
    const relationshipId = `rel-${Date.now()}`;
    setRelationships(previousRelationships => [...previousRelationships, {
      id: relationshipId,
      sourceId,
      targetId,
      type: 'association',
      targetMultiplicity: '0..1',
      sourceMultiplicity: '1',
    }]);
    setSelectedRelationshipId(relationshipId);
    return true;
  }, [
    recordChange,
    setRelationships,
    setSelectedRelationshipId,
  ]);

  const deleteRelationship = useCallback((relationshipId: string) => {
    recordChange();
    setRelationships(previousRelationships => previousRelationships.filter(
      relationship => relationship.id !== relationshipId,
    ));
    setSelectedRelationshipId(previousId => (
      previousId === relationshipId ? null : previousId
    ));
  }, [recordChange, setRelationships, setSelectedRelationshipId]);

  const updateRelationship = useCallback((
    relationshipId: string,
    patch: Partial<UMLRelationship>,
  ) => {
    recordChange();
    setRelationships(previousRelationships => previousRelationships.map(
      relationship => (
        relationship.id === relationshipId
          ? { ...relationship, ...patch }
          : relationship
      ),
    ));
  }, [recordChange, setRelationships]);

  return {
    edit,
    startNameEdit,
    startAttributeEdit,
    startOperationEdit,
    changeEdit,
    cancelEdit,
    flushPendingEdit,
    saveName,
    saveAttribute,
    saveOperation,
    addAttribute,
    deleteAttribute,
    addOperation,
    deleteOperation,
    addClass,
    deleteClass,
    updateClass,
    getInheritanceParentId,
    setInheritanceParent,
    beginClassDrag,
    moveClass,
    finishClassDrag,
    addRelationship,
    deleteRelationship,
    updateRelationship,
  };
}
