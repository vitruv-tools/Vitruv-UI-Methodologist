import { FlowEcoreEdge, UMLNode } from "../types/flow";
import { EObject, EReference, EAttribute, ResourceSet, XMI, EPackage, EClass, EString, EOperation, EAnnotation } from "ecore-ts";
import { UMLRelationshipTypes } from "../components/flow/UMLRelationship";
import { applyIntelligentLayout } from "./umlGenerator";

export const ecoreIdentifierSeparators = ["::", ".", "/"] as const;

export function splitByEcoreIdentifierSeparators(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  const escapedSeparators = [...ecoreIdentifierSeparators]
    .sort((a, b) => b.length - a.length)
    .map((separator) => separator.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  const separatorPattern = new RegExp(escapedSeparators.join("|"), "g");
  return value.split(separatorPattern).filter((part) => part.length > 0);
}

/**
 * Recursively collects all EObject contents while generating stable, unique identifiers.
 */
function getAllContents(
  eObject: EObject,
  prefix: string,
  weakMap: Map<EObject, string>
): EObject[] {
  // Prefer nsURI if available for unique identification, otherwise use name-based path
  let currentPath = eObject.get<string>("nsURI");
  if (currentPath == null) {
    if (eObject.eClass.get("name") === EClass.get<string>("name")) {
      currentPath = `${prefix}::${eObject.get("name")}`;
    }
    else if ([EAttribute.get<string>("name"), EReference.get<string>("name")].includes(eObject.eClass.get("name"))) {
      currentPath = `${prefix}.${eObject.get("name")}`;
    }
    else {
      // Fallback to generic separator for non-class elements
      // Make sure to update ecoreIdentifierSeparators if you add new separators
      currentPath = `${prefix}/${eObject.get("name")}`;
    }
  }
  weakMap.set(eObject, currentPath);
  const contents = eObject.eContents();
  const result = [...contents];
  for (const content of contents) {
    if (weakMap.has(content)) {
      continue;
    }
    if (content instanceof EObject) {
      result.push(...getAllContents(content, currentPath, weakMap));
    }
  }
  return result;
}

/**
 * Parses Ecore XML into a resource and extracts all contained EObjects with unique identifiers.
 */
function parseEcoreXML(
  ecoreName: string,
  ecoreContent: string
): {
  resource: EObject;
  allContents: EObject[];
  eObjectUniqueIdentifiers: Map<EObject, string>;
} {
  //@ts-ignore
  const resourceSet = ResourceSet.create();
  if (!resourceSet) {
    throw new Error("Failed to create ResourceSet for Ecore parsing");
  }
  const resource = resourceSet.create({ uri: ecoreName });
  if (!resource) {
    throw new Error("Failed to create Resource for Ecore parsing");
  }
  resource.parse(ecoreContent, XMI);
  const eObjectUniqueIdentifiers = new Map<EObject, string>();
  const allContents = getAllContents(
    resource,
    ecoreName,
    eObjectUniqueIdentifiers
  );
  return { resource, allContents, eObjectUniqueIdentifiers };
}

type HandleSelection = {
  sourceHandle: string | undefined;
  targetHandle: string | undefined;
};

type ClassBuildResult = {
  nodes: UMLNode[];
  classNameToNodeId: Map<string, string>;
  classNameToEObject: Map<string, EObject>;
  nextNodeId: number;
};

/**
 * Normalizes Ecore type references by removing path/hash prefixes.
 */
function sanitizeTypeReference(value: string): string {
  return (value.split("#").pop() || value).replace(/^\/\//, "");
}

/**
 * Builds a UML attribute signature from an EAttribute EObject.
 */
export function buildAttributeSignature(attr: EObject, index: number): string {
  const attrName = attr.get<string>("name") || `attr${index + 1}`;
  const eType =
    (attr.get<EObject>("eType") as EObject)?.get<string>("name") ||
    attr.get<string>("type") ||
    EString.get<string>("name")!;
  const typeName = sanitizeTypeReference(eType);
  const lower = attr.get<string>("lowerBound");
  const upper = attr.get<string>("upperBound");

  let multiplicity = "";
  if (lower !== null && upper !== null) {
    multiplicity = ` [${lower}..${upper}]`;
  } else if (lower !== null || upper !== null) {
    multiplicity = ` [${lower || "1"}..${upper || "*"}]`;
  }

  return `+ ${attrName}: ${typeName}${multiplicity}`;
}

export function buildMethodSignature(op: EObject, index: number): string {
  throw new Error("Method signature generation not implemented yet");
}

function getEAttributes(cls: EObject): EObject[] {
  return cls
    .eContents()
    .filter((e: EObject) =>
      e.eClass.get("name") === EAttribute.get<string>("name")
    ) as EObject[];
}

function getEReferences(cls: EObject): EObject[] {
  return cls
    .eContents()
    .filter((e: EObject) =>
      e.eClass.get("name") === EReference.get<string>("name")
    ) as EObject[];
}

function getEOperations(cls: EObject): EObject[] {
 return cls
    .eContents()
    .filter((e: EObject) =>
      e.eClass.get("name") === EOperation.get<string>("name")
    ) as EObject[];
}

function getEAnnotations(cls: EObject): EObject[] {
 return cls
    .eContents()
    .filter((e: EObject) =>
      e.eClass.get("name") === EAnnotation.get<string>("name")
    ) as EObject[];
}

function getESuperTypes(cls: EObject): EObject[] {
  return cls.get<EObject[]>("eSuperTypes") ?? [];
}

/**
 * Extracts UML-formatted attributes from an EClass EObject.
 */
function getClassAttributes(cls: EObject): string[] {
  const attributes: string[] = [];
  getEAttributes(cls).forEach((feature, index) => {
    attributes.push(buildAttributeSignature(feature, index));
  });
  return attributes;
}

/**
 * Resolves UI tool type for class rendering based on Ecore class flags.
 */
function resolveToolName(cls: EObject): string {
  const isAbstract = (cls.get<boolean>("abstract") || false) === true;
  const isInterface = (cls.get<boolean>("interface") || false) === true;

  if (isInterface) {
    return "interface";
  }
  if (isAbstract) {
    return "abstract-class";
  }
  return "class";
}

/**
 * Creates UML class nodes and lookup maps in a first pass.
 */
function buildClassNodes(
  rootPackage: EObject,
  classElems: EObject[],
  ecoreName: string,
  eObjectUniqueIdentifiers: Map<EObject, string>,
  startNodeId: number,
  backendMetaModelId: number,
): ClassBuildResult {
  const nodes: UMLNode[] = [];
  const classNameToNodeId = new Map<string, string>();
  const classNameToEObject = new Map<string, EObject>();
  let nodeId = startNodeId;

  classElems.forEach((cls, idx) => {
    const className = cls.get<string>("name") || `Class${idx + 1}`;
    const node: UMLNode = {
      id: eObjectUniqueIdentifiers.get(cls)!,
      type: "editable",
      position: { x: 0, y: 0 },
      data: {
        ecore: {
          model: eObjectUniqueIdentifiers.get(rootPackage)!,
          eObjectId: eObjectUniqueIdentifiers.get(cls!),
          eAttributeIds: getEAttributes(cls).map((attr) => eObjectUniqueIdentifiers.get(attr)!),
          eReferenceIds: getEReferences(cls).map((ref) => eObjectUniqueIdentifiers.get(ref)!),
          eOperationIds: getEOperations(cls).map((op) => eObjectUniqueIdentifiers.get(op)!),
          eAnnotationIds: getEAnnotations(cls).map((ann) => eObjectUniqueIdentifiers.get(ann)!),
          eSuperTypeIds: getESuperTypes(cls).map((superType) => eObjectUniqueIdentifiers.get(superType)!),
        },
        label: className,
        toolType: "element",
        toolName: resolveToolName(cls),
        diagramType: "uml",
        className,
        attributes: getClassAttributes(cls),
        backendMetaModelId,
      },
    } as UMLNode;

    nodes.push(node);
    classNameToNodeId.set(className, node.id);
    classNameToEObject.set(className, cls);
  });

  return { nodes, classNameToNodeId, classNameToEObject, nextNodeId: nodeId };
}

/**
 * Chooses source and target handles based on relative node angle.
 */
function chooseHandlesForNodes(
  nodes: UMLNode[],
  sourceId: string,
  targetId: string
): HandleSelection {
  const sourceNode = nodes.find((n) => n.id === sourceId);
  const targetNode = nodes.find((n) => n.id === targetId);
  if (!sourceNode || !targetNode) {
    return { sourceHandle: undefined, targetHandle: undefined };
  }

  const dx = (targetNode.position?.x ?? 0) - (sourceNode.position?.x ?? 0);
  const dy = (targetNode.position?.y ?? 0) - (sourceNode.position?.y ?? 0);
  const angle = Math.atan2(dy, dx);
  const angleDeg = ((angle * 180) / Math.PI + 360) % 360;

  if (angleDeg >= 315 || angleDeg < 45) {
    return { sourceHandle: "right-source", targetHandle: "left-target" };
  }
  if (angleDeg >= 45 && angleDeg < 135) {
    return { sourceHandle: "bottom-source", targetHandle: "top-target" };
  }
  if (angleDeg >= 135 && angleDeg < 225) {
    return { sourceHandle: "left-source", targetHandle: "right-target" };
  }
  return { sourceHandle: "top-source", targetHandle: "bottom-target" };
}

/**
 * Converts Ecore lower/upper bounds into a normalized UML multiplicity string.
 */
function resolveTargetMultiplicity(
  lower: string | null,
  upper: string | null
): string | undefined {
  const normalizeUpper = (value: string | null) => {
    if (value === null) {
      return undefined;
    }
    if (value === "*" || value === "-1") {
      return "*";
    }
    return value;
  };

  const normLower = lower ?? undefined;
  const normUpper = normalizeUpper(upper?.toString() ?? null);
  if (normLower === undefined && normUpper === undefined) {
    return undefined;
  }

  const lo = normLower ?? "1";
  const hi = normUpper ?? "1";
  return lo === hi ? lo : `${lo}..${hi}`;
}

/**
 * Creates UML association/composition edges from EReferences.
 */
function createAssociationEdges(
  rootPackage: EObject,
  classElems: EObject[],
  nodes: UMLNode[],
  ecoreName: string,
  classNameToNodeId: Map<string, string>,
  classNameToEObject: Map<string, EObject>,
  eObjectUniqueIdentifiers: Map<EObject, string>,
  startNodeId: number
): { edges: FlowEcoreEdge[]; nextNodeId: number } {
  const edges: FlowEcoreEdge[] = [];
  let nodeId = startNodeId;

  classElems.forEach((cls) => {
    const sourceName = cls.get<string>("name") || "";
    const sourceId = classNameToNodeId.get(sourceName);
    if (!sourceId) {
      return;
    }

    getEReferences(cls).forEach((ref) => {
      const eType = ref.get<EObject>("eType")?.get<string>("name") || "";
      const targetType = sanitizeTypeReference(eType);
      const targetId = classNameToNodeId.get(targetType || "");
      if (!targetId) {
        return;
      }

      const lower = ref.get<string>("lowerBound");
      const upper = ref.get<string>("upperBound");
      const containment = (ref.get<boolean>("containment") || false) === true;
      const relationshipType = containment
        ? UMLRelationshipTypes.COMPOSITION
        : UMLRelationshipTypes.ASSOCIATION;
      const handles = chooseHandlesForNodes(nodes, sourceId, targetId);

      edges.push({
        id: eObjectUniqueIdentifiers.get(ref)!,
        source: sourceId,
        target: targetId,
        type: "uml",
        data: {
          relationshipType,
          targetMultiplicity: resolveTargetMultiplicity(lower, upper),
          ecore: {
            eReferenceId: eObjectUniqueIdentifiers.get(ref)!,
            eObjectSourceId: eObjectUniqueIdentifiers.get(
              classNameToEObject.get(sourceName)!
            )!,
            eObjectTargetId: eObjectUniqueIdentifiers.get(
              classNameToEObject.get(targetType)!
            )!,
            fromModel: eObjectUniqueIdentifiers.get(rootPackage)!,
            toModel: eObjectUniqueIdentifiers.get(rootPackage)!,
          },
        },
        sourceHandle: handles.sourceHandle,
        targetHandle: handles.targetHandle,
      });
    });
  });

  return { edges, nextNodeId: nodeId };
}

/**
 * Creates UML inheritance edges from eSuperTypes.
 */
function createGeneralizationEdges(
  rootPackage: EObject,
  classElems: EObject[],
  nodes: UMLNode[],
  ecoreName: string,
  classNameToNodeId: Map<string, string>,
  eObjectUniqueIdentifiers: Map<EObject, string>,
  startNodeId: number,
): { edges: FlowEcoreEdge[]; nextNodeId: number } {
  const edges: FlowEcoreEdge[] = [];
  let nodeId = startNodeId;

  classElems.forEach((cls) => {
    const subName = cls.get<string>("name") || "";
    const subId = classNameToNodeId.get(subName);
    if (!subId) {
      return;
    }

    const superTypes = cls.get<EObject[]>("eSuperTypes") ?? [];
    superTypes.forEach((sup) => {
      const supType = sanitizeTypeReference(
        sup.get<string>("name")?.split("#").pop() || ""
      );
      const supId = classNameToNodeId.get(supType);
      if (!supId) {
        return;
      }

      const handles = chooseHandlesForNodes(nodes, subId, supId);
      edges.push({
        id: `${ecoreName}-uml-gen-${nodeId++}`, //This doesnt have a proper ecore element backing it, so we generate an id based on the ecore name and a counter
        source: subId,
        target: supId,
        type: "uml",
        data: {
          relationshipType: UMLRelationshipTypes.INHERITANCE,
          ecore: {
            eObjectSourceId: eObjectUniqueIdentifiers.get(cls)!,
            eObjectTargetId: eObjectUniqueIdentifiers.get(sup)!,
            fromModel: eObjectUniqueIdentifiers.get(rootPackage)!,
            toModel: eObjectUniqueIdentifiers.get(rootPackage)!,
          },
        },
        sourceHandle: handles.sourceHandle,
        targetHandle: handles.targetHandle,
      });
    });
  });

  return { edges, nextNodeId: nodeId };
}

/**
 * Prepends an optional package node to the UML node list.
 */
function addPackageNode(
  nodes: UMLNode[],
  ecoreName: string,
  packageName: string,
  rootPackage: EObject,
  eObjectUniqueIdentifiers: Map<EObject, string>,
  startNodeId: number,
  backendMetaModelId: number,
): number {
  if (nodes.length === 0) {
    return startNodeId;
  }

  const pkgNode: UMLNode = {
    id: eObjectUniqueIdentifiers.get(rootPackage!),
    type: "editable",
    position: { x: 80, y: 40 },
    data: {
      ecore: {
        model: eObjectUniqueIdentifiers.get(rootPackage!),
        eObjectId: eObjectUniqueIdentifiers.get(rootPackage!),
        eAttributeIds: getEAttributes(rootPackage!).map((attr) => eObjectUniqueIdentifiers.get(attr)!),
        eReferenceIds: getEReferences(rootPackage!).map((ref) => eObjectUniqueIdentifiers.get(ref)!),
        eOperationIds: getEOperations(rootPackage!).map((op) => eObjectUniqueIdentifiers.get(op)!),
        eAnnotationIds: getEAnnotations(rootPackage!).map((ann) => eObjectUniqueIdentifiers.get(ann)!),
        eSuperTypeIds: getESuperTypes(rootPackage!).map((superType) => eObjectUniqueIdentifiers.get(superType)!),
      },
      label: packageName,
      toolType: "element",
      toolName: "package",
      packageName,
      diagramType: "uml",
      backendMetaModelId,
    },
  } as UMLNode;

  nodes.unshift(pkgNode);
  return startNodeId + 1;
}

/**
 * Recomputes all edge handles after layout updates node positions.
 */
function recalculateEdgeHandles(nodes: UMLNode[], edges: FlowEcoreEdge[]) {
  edges.forEach((edge) => {
    const handles = chooseHandlesForNodes(nodes, edge.source, edge.target);
    edge.sourceHandle = handles.sourceHandle;
    edge.targetHandle = handles.targetHandle;
  });
}

/**
 * Inverts the EObject->identifier map into identifier->EObject and validates uniqueness.
 */
function buildIdentifierToEObjectMap(
  eObjectUniqueIdentifiers: Map<EObject, string>
): Map<string, EObject> {
  const identifiersToEObject = new Map<string, EObject>();
  for (const [eObject, identifier] of Array.from(
    eObjectUniqueIdentifiers.entries()
  )) {
    if (identifiersToEObject.has(identifier)) {
      throw new Error(`Duplicate EObject identifier found: ${identifier}`);
    }
    identifiersToEObject.set(identifier, eObject);
  }
  return identifiersToEObject;
}

/**
 * Generates UML nodes/edges and EObject identifier mappings from Ecore XML content.
 */
export function generateUMLFromEcoreTsParser(
  ecoreName: string,
  ecoreContent: string,
  backendMetaModelId: number,
): {
  nodes: UMLNode[];
  edges: FlowEcoreEdge[];
  identifiersToEObject: Map<string, EObject>;
  eObjectIdentifierOfMetaModel: string;
} {
  try {
    const { resource, allContents, eObjectUniqueIdentifiers } = parseEcoreXML(
      ecoreName,
      ecoreContent
    );

    const edges: FlowEcoreEdge[] = [];
    let nodeId = 1;

    const rootPackage = resource
      .eContents()
      .find((e: EObject) => e.eClass.get("name") === EPackage.get<string>("name")) as EObject |
      undefined;
    if (rootPackage == null) {
      throw new Error("No root EPackage found in Ecore resource, UML diagram will be generated without package context");
    }
    const packageName = rootPackage.get<string>("name") || "Package";
    const classElems = allContents.filter(
      (e) => e.eClass.get("name") === EClass.get<string>("name")
    );

    const {
      nodes,
      classNameToNodeId,
      classNameToEObject,
      nextNodeId,
    } = buildClassNodes(rootPackage, classElems, ecoreName, eObjectUniqueIdentifiers, nodeId, backendMetaModelId);
    nodeId = nextNodeId;

    const associations = createAssociationEdges(
      rootPackage,
      classElems,
      nodes,
      ecoreName,
      classNameToNodeId,
      classNameToEObject,
      eObjectUniqueIdentifiers,
      nodeId
    );
    edges.push(...associations.edges);
    nodeId = associations.nextNodeId;

    const generalizations = createGeneralizationEdges(
      rootPackage,
      classElems,
      nodes,
      ecoreName,
      classNameToNodeId,
      eObjectUniqueIdentifiers,
      nodeId
    );
    edges.push(...generalizations.edges);
    nodeId = generalizations.nextNodeId;

    // Apply intelligent layout algorithm
    applyIntelligentLayout(nodes, edges);
    recalculateEdgeHandles(nodes, edges);
    nodeId = addPackageNode(
      nodes,
      ecoreName,
      packageName,
      rootPackage,
      eObjectUniqueIdentifiers,
      nodeId,
      backendMetaModelId
    );

    const identifiersToEObject = buildIdentifierToEObjectMap(
      eObjectUniqueIdentifiers
    );

    return { nodes, edges, identifiersToEObject, eObjectIdentifierOfMetaModel: eObjectUniqueIdentifiers.get(rootPackage)! };
  } catch (error) {
    console.error("Error generating UML from Ecore:", error);
    return {
      nodes: [],
      edges: [],
      identifiersToEObject: new Map<string, EObject>(),
      eObjectIdentifierOfMetaModel: "",
    };
  }
}
