import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import {
  applyWrapperDragToClass,
  mergeAdditionalClassesWithPositions,
} from '../components/canvas/umlDiagramClassTransforms';
import { UML_CLASS_BOX_WIDTH } from '../components/canvas/umlDiagramClassMetrics';
import { getUmlClassBoxHeight } from '../components/canvas/umlDiagramLayoutGeometry';
import type { UmlDiagramClass } from '../components/canvas/umlDiagramTypes';
import { ecoreToUml, type UMLRelationship } from '../utils/ecoreToUml';
import {
  computeUmlModelGroups,
  type UmlModelGroupBounds,
  type UmlModelGroupInfo,
} from '../utils/umlModelGroups';

export interface UmlDiagramAdditionalModel {
  id: number;
  name: string;
  ecoreContent: string;
  color: string;
  fill: string;
}

export interface UseUmlDiagramModelGroupsOptions {
  primaryClasses: UmlDiagramClass[];
  primaryRelationships: UMLRelationship[];
  setPrimaryClasses: Dispatch<SetStateAction<UmlDiagramClass[]>>;
  primaryModelName: string;
  additionalModels: UmlDiagramAdditionalModel[];
}

export interface UseUmlDiagramModelGroupsResult {
  additionalClasses: UmlDiagramClass[];
  allClasses: UmlDiagramClass[];
  allRelationships: UMLRelationship[];
  classModelMap: ReadonlyMap<string, UmlModelGroupInfo>;
  modelGroups: UmlModelGroupBounds[];
  removableModelNames: ReadonlySet<string>;
  moveAdditionalClass: (classId: string, x: number, y: number) => void;
  areClassesInSameModel: (classIdA: string, classIdB: string) => boolean;
  beginGroupDrag: (groupName: string) => void;
  moveGroupDrag: (groupName: string, dx: number, dy: number) => void;
  endGroupDrag: () => void;
}

export function useUmlDiagramModelGroups(
  {
    primaryClasses,
    primaryRelationships,
    setPrimaryClasses,
    primaryModelName,
    additionalModels,
  }: UseUmlDiagramModelGroupsOptions,
): UseUmlDiagramModelGroupsResult {
  const additionalParsed = useMemo(() => (
    additionalModels.map((modelDescriptor, additionalModelIndex) => {
      try {
        const model = ecoreToUml(modelDescriptor.ecoreContent);
        return {
          ...modelDescriptor,
          classes: model.classes.map(classItem => ({
            ...classItem,
            operations: classItem.operations ?? [],
            id: `addl-${modelDescriptor.id}-${classItem.id}`,
            x: classItem.x + (additionalModelIndex + 1) * 450,
            y: classItem.y,
          })),
          relationships: model.relationships.map(relationship => ({
            ...relationship,
            id: `addl-${modelDescriptor.id}-${relationship.id}`,
            sourceId: `addl-${modelDescriptor.id}-${relationship.sourceId}`,
            targetId: `addl-${modelDescriptor.id}-${relationship.targetId}`,
          })),
        };
      } catch {
        return {
          ...modelDescriptor,
          classes: [] as UmlDiagramClass[],
          relationships: [] as UMLRelationship[],
        };
      }
    })
  ), [additionalModels]);

  const [additionalClasses, setAdditionalClasses] = useState<
    UmlDiagramClass[]
  >(() => additionalParsed.flatMap(model => model.classes));
  const [additionalRelationships, setAdditionalRelationships] = useState<
    UMLRelationship[]
  >(() => additionalParsed.flatMap(model => model.relationships));

  useEffect(() => {
    const nextClasses = additionalParsed.flatMap(model => model.classes);
    setAdditionalClasses(previousClasses => (
      mergeAdditionalClassesWithPositions(previousClasses, nextClasses)
    ));
    setAdditionalRelationships(
      additionalParsed.flatMap(model => model.relationships),
    );
  }, [additionalParsed]);

  const classModelMap = useMemo(() => {
    const map = new Map<string, UmlModelGroupInfo>();
    if (additionalModels.length > 0) {
      for (const classItem of primaryClasses) {
        map.set(classItem.id, {
          name: primaryModelName,
          color: '#2563eb',
          fill: 'rgba(37,99,235,0.06)',
        });
      }
    }
    for (const parsedModel of additionalParsed) {
      for (const classItem of parsedModel.classes) {
        map.set(classItem.id, {
          name: parsedModel.name,
          color: parsedModel.color,
          fill: parsedModel.fill,
        });
      }
    }
    return map;
  }, [
    additionalModels.length,
    additionalParsed,
    primaryClasses,
    primaryModelName,
  ]);

  const allClasses = useMemo(
    () => [...primaryClasses, ...additionalClasses],
    [primaryClasses, additionalClasses],
  );
  const allRelationships = useMemo(
    () => [...primaryRelationships, ...additionalRelationships],
    [primaryRelationships, additionalRelationships],
  );
  const modelGroups = useMemo(() => {
    if (additionalModels.length === 0) return [];
    return computeUmlModelGroups(
      allClasses,
      classModelMap,
      getUmlClassBoxHeight,
      UML_CLASS_BOX_WIDTH,
    );
  }, [additionalModels.length, allClasses, classModelMap]);
  const removableModelNames = useMemo(
    () => new Set(additionalModels.map(model => model.name)),
    [additionalModels],
  );

  const moveAdditionalClass = useCallback((
    classId: string,
    x: number,
    y: number,
  ) => {
    setAdditionalClasses(previousClasses => previousClasses.map(classItem => (
      classItem.id === classId ? { ...classItem, x, y } : classItem
    )));
  }, []);

  const areClassesInSameModel = useCallback((
    classIdA: string,
    classIdB: string,
  ): boolean => {
    const modelA = classModelMap.get(classIdA)?.name;
    const modelB = classModelMap.get(classIdB)?.name;
    if (!modelA || !modelB) return false;
    return modelA === modelB;
  }, [classModelMap]);

  const wrapperDragOrigins = useRef<
    Map<string, { x: number; y: number }>
  >(new Map());

  const beginGroupDrag = useCallback((groupName: string) => {
    const currentClasses = groupName === primaryModelName
      ? primaryClasses
      : additionalClasses;
    const origins = new Map<string, { x: number; y: number }>();
    for (const classItem of currentClasses) {
      if (classModelMap.get(classItem.id)?.name === groupName) {
        origins.set(classItem.id, { x: classItem.x, y: classItem.y });
      }
    }
    wrapperDragOrigins.current = origins;
  }, [
    additionalClasses,
    classModelMap,
    primaryClasses,
    primaryModelName,
  ]);

  const moveGroupDrag = useCallback((
    groupName: string,
    dx: number,
    dy: number,
  ) => {
    const origins = wrapperDragOrigins.current;
    const applyDrag = (classItem: UmlDiagramClass) => (
      applyWrapperDragToClass(classItem, origins, dx, dy)
    );
    if (groupName === primaryModelName) {
      setPrimaryClasses(previousClasses => previousClasses.map(applyDrag));
    } else {
      setAdditionalClasses(previousClasses => previousClasses.map(applyDrag));
    }
  }, [primaryModelName, setPrimaryClasses]);

  const endGroupDrag = useCallback(() => {
    wrapperDragOrigins.current.clear();
  }, []);

  return {
    additionalClasses,
    allClasses,
    allRelationships,
    classModelMap,
    modelGroups,
    removableModelNames,
    moveAdditionalClass,
    areClassesInSameModel,
    beginGroupDrag,
    moveGroupDrag,
    endGroupDrag,
  };
}
