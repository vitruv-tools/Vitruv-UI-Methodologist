import { parseEcoreMetamodelMetrics, countXmiModelElements } from '../../utils/ecoreMetrics';
import { countOclConstraints, extractMentionedClassNames, parseOclConstraints, parseReactionFileMetrics } from '../../utils/reactionMetrics';
import {
  collectMetamodelInputs,
  collectReactionInputs,
  computeMethodologistMetrics,
} from '../../utils/methodologistMetrics';
import type { Edge, Node } from 'reactflow';
import type { ViewType } from '../../hooks/useViewTypes';

const wrap = (inner: string, name = 'library') => `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore"
                name="${name}">
  ${inner}
</ecore:EPackage>`;

const eClass = (name: string, body = '', extra = '') =>
  `<eClassifiers xsi:type="ecore:EClass" name="${name}" ${extra}>${body}</eClassifiers>`;

const eAttr = (name: string) =>
  `<eStructuralFeatures xsi:type="ecore:EAttribute" name="${name}" eType="ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//EString"/>`;

const eRef = (name: string, target: string, containment = false) =>
  `<eStructuralFeatures xsi:type="ecore:EReference" name="${name}" eType="#//${target}" containment="${containment}"/>`;

const eEnum = (name: string, literals: string[]) =>
  `<eClassifiers xsi:type="ecore:EEnum" name="${name}">${
    literals.map(l => `<eLiterals name="${l}"/>`).join('')
  }</eClassifiers>`;

const eOp = (name: string) =>
  `<eOperations name="${name}" eType="ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//EBoolean"/>`;

describe('parseEcoreMetamodelMetrics', () => {
  it('returns empty metrics for invalid XML', () => {
    const result = parseEcoreMetamodelMetrics('not xml', 'fallback');
    expect(result.name).toBe('fallback');
    expect(result.classCount).toBe(0);
  });

  it('counts classes, attributes, and containment vs association references', () => {
    const xml = wrap(
      eClass('Library', eAttr('name') + eRef('books', 'Book', true))
      + eClass('Book', eAttr('title') + eAttr('isbn') + eRef('author', 'Author', false))
      + eClass('Author', eAttr('name')),
    );
    const result = parseEcoreMetamodelMetrics(xml);
    expect(result.name).toBe('library');
    expect(result.classCount).toBe(3);
    expect(result.attributesTotal).toBe(4);
    expect(result.containmentReferences).toBe(1);
    expect(result.nonContainmentReferences).toBe(1);
    expect(result.referencesTotal).toBe(2);
    expect(result.associations).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'books', ownerClass: 'Library', containment: true }),
      expect.objectContaining({ name: 'author', ownerClass: 'Book', containment: false }),
    ]));
    expect(result.attributesPerClass.find(c => c.className === 'Book')?.count).toBe(2);
  });

  it('counts enumerations and literals', () => {
    const xml = wrap(eClass('Item') + eEnum('Kind', ['A', 'B', 'C']));
    const result = parseEcoreMetamodelMetrics(xml);
    expect(result.enumCount).toBe(1);
    expect(result.enumLiteralCount).toBe(3);
  });

  it('counts packages including subpackages', () => {
    const xml = wrap(
      eClass('Root')
      + `<eSubpackages name="nested">${eClass('Inner')}</eSubpackages>`,
    );
    const result = parseEcoreMetamodelMetrics(xml);
    expect(result.packageCount).toBe(2);
    expect(result.classCount).toBe(2);
  });

  it('splits abstract vs concrete classes and computes inheritance depth', () => {
    const xml = wrap(
      eClass('Named', eAttr('name'), 'abstract="true"')
      + eClass('Person', '', 'eSuperTypes="#//Named"')
      + eClass('Employee', '', 'eSuperTypes="#//Person"'),
    );
    const result = parseEcoreMetamodelMetrics(xml);
    expect(result.abstractClassCount).toBe(1);
    expect(result.concreteClassCount).toBe(2);
    expect(result.inheritanceDepthMax).toBe(2);
    expect(result.classes.find(c => c.name === 'Employee')?.inheritanceDepth).toBe(2);
    expect(result.classes.find(c => c.name === 'Named')?.inheritanceDepth).toBe(0);
    expect(result.inheritanceDepthAvg).toBeCloseTo((0 + 1 + 2) / 3);
    expect(result.classes.find(c => c.name === 'Named')?.childCount).toBe(1);
    expect(result.classes.find(c => c.name === 'Person')?.childCount).toBe(1);
    expect(result.classes.find(c => c.name === 'Employee')?.childCount).toBe(0);
    expect(result.nocMax).toBe(1);
  });

  it('counts operations, containment height, and cross-package references', () => {
    const xml = wrap(
      eClass('Library', eRef('books', 'Book', true) + eOp('open'))
      + eClass('Book', eRef('pages', 'Page', true) + eRef('kind', 'nested/Kind', false))
      + eClass('Page')
      + `<eSubpackages name="nested">${eClass('Kind')}</eSubpackages>`,
    );
    const result = parseEcoreMetamodelMetrics(xml);
    expect(result.operationsTotal).toBe(1);
    expect(result.classes.find(c => c.name === 'Library')?.operationCount).toBe(1);
    expect(result.classes.find(c => c.name === 'Page')?.containmentHeight).toBe(0);
    expect(result.classes.find(c => c.name === 'Book')?.containmentHeight).toBe(1);
    expect(result.classes.find(c => c.name === 'Library')?.containmentHeight).toBe(2);
    expect(result.containmentHeightMax).toBe(2);
    expect(result.crossPackageReferences).toBe(1);
  });

  it('treats interfaces as abstract', () => {
    const xml = wrap(eClass('Contract', '', 'interface="true"'));
    const result = parseEcoreMetamodelMetrics(xml);
    expect(result.abstractClassCount).toBe(1);
    expect(result.concreteClassCount).toBe(0);
  });
});

describe('countXmiModelElements', () => {
  it('counts element nodes in an instance model', () => {
    const xmi = `<?xml version="1.0"?>
      <library:Library xmlns:library="http://example/library">
        <books title="One"/>
        <books title="Two"/>
      </library:Library>`;
    expect(countXmiModelElements(xmi)).toBe(3);
  });

  it('returns 0 for empty or invalid content', () => {
    expect(countXmiModelElements('')).toBe(0);
    expect(countXmiModelElements('<')).toBe(0);
  });
});

describe('parseReactionFileMetrics', () => {
  const familiesToPersons = `
import "http://families" as Families
import "http://persons" as Persons

reactions: FamiliesToPersons
in reaction to changes in Families
execute actions in Persons

reaction CreatePerson {
  after element familiesMember created
  call {
    add correspondence between familiesMember and person
  }
}

reaction DeletePerson {
  after element familiesMember deleted
  call {
    delete person corresponding to familiesMember
  }
}

routine CreatePersonRoutine {
  match {
    val person = retrieve optional corresponding to familiesMember
  }
  action {
    create person
  }
}
`;

  it('does not treat the reactions header as a reaction block', () => {
    const result = parseReactionFileMetrics(familiesToPersons);
    expect(result.reactionCount).toBe(2);
    expect(result.routineCount).toBe(1);
    expect(result.reactions.map(r => r.name)).toEqual(['CreatePerson', 'DeletePerson']);
  });

  it('counts correspondence types and non-empty lines of code', () => {
    const result = parseReactionFileMetrics(familiesToPersons);
    expect(result.correspondenceTypeCount).toBeGreaterThanOrEqual(2);
    expect(result.linesOfCode).toBeGreaterThan(result.reactionCount);
    expect(result.reactions[0].linesOfCode).toBeGreaterThan(0);
  });

  it('returns zeros for empty code', () => {
    expect(parseReactionFileMetrics('')).toEqual({
      reactionCount: 0,
      routineCount: 0,
      correspondenceTypeCount: 0,
      linesOfCode: 0,
      reactions: [],
    });
  });

  it('extracts mentioned class names from qualified and PascalCase tokens', () => {
    expect(extractMentionedClassNames(familiesToPersons)).toEqual(
      expect.arrayContaining(['CreatePerson', 'DeletePerson']),
    );
    expect(extractMentionedClassNames('retrieve optional Families::Member corresponding to Persons::Person')).toEqual(
      expect.arrayContaining(['Member', 'Person', 'Families', 'Persons']),
    );
  });
});

describe('countOclConstraints', () => {
  it('counts inv declarations', () => {
    const ocl = `
context library::Book inv HasTitle:
  self.title <> ''
context library::Library inv UniqueIsbn:
  self.books->isUnique(b | b.isbn)
`;
    expect(countOclConstraints(ocl)).toBe(2);
  });

  it('returns 0 when there are no invariants', () => {
    expect(countOclConstraints('')).toBe(0);
    expect(countOclConstraints('package library')).toBe(0);
  });
});

describe('computeMethodologistMetrics', () => {
  const libraryNode: Node = {
    id: 'n1',
    type: 'ecoreFile',
    position: { x: 0, y: 0 },
    data: {
      fileName: 'library.ecore',
      fileContent: wrap(
        eClass('Library', eAttr('name') + eRef('books', 'Book', true))
        + eClass('Book', eAttr('title')),
      ),
    },
  };

  const personsNode: Node = {
    id: 'n2',
    type: 'ecoreFile',
    position: { x: 100, y: 0 },
    data: {
      fileName: 'persons.ecore',
      fileContent: wrap(eClass('Person', eAttr('name')), 'persons'),
    },
  };

  const reactionEdge: Edge = {
    id: 'e1',
    source: 'n1',
    target: 'n2',
    type: 'reactions',
    data: {
      code: 'reactions: libraryTopersons\nin reaction to changes in library\n\nreaction Sync {\n  after element created\n}\n',
    },
  };

  const viewTypes: ViewType[] = [
    { id: 'vt1', label: 'Architecture', scope: 'multi', angle: 0, linkedNodeIds: ['n1', 'n2'], editable: false },
    { id: 'vt2', label: 'Architecture', scope: 'single', angle: 1, linkedNodeIds: ['n1'], editable: true },
    { id: 'vt3', label: 'Catalogue', scope: 'single', angle: 2, linkedNodeIds: ['n1'], editable: false },
  ];

  it('collects metamodel and reaction inputs from the canvas', () => {
    expect(collectMetamodelInputs([libraryNode, personsNode])).toHaveLength(2);
    expect(collectReactionInputs([libraryNode, personsNode], [reactionEdge])[0]).toMatchObject({
      sourceName: 'library',
      targetName: 'persons',
    });
  });

  it('aggregates VSUM-wide methodologist metrics', () => {
    const metrics = computeMethodologistMetrics({
      metamodels: collectMetamodelInputs([libraryNode, personsNode]),
      reactions: collectReactionInputs([libraryNode, personsNode], [reactionEdge]),
      viewTypes,
      oclContent: 'context library::Book inv HasTitle:\n  true',
      instanceModels: [{
        name: 'sample.xmi',
        content: '<?xml version="1.0"?><library:Library xmlns:library="http://example/library"><books/></library:Library>',
      }],
    });

    expect(metrics.metamodels).toHaveLength(2);
    expect(metrics.classCount).toBe(3);
    expect(metrics.attributesTotal).toBe(3);
    expect(metrics.containmentReferences).toBe(1);
    expect(metrics.viewTypeCount).toBe(3);
    expect(metrics.viewpointCount).toBe(2);
    expect(metrics.singleViewTypeCount).toBe(2);
    expect(metrics.multiViewTypeCount).toBe(1);
    expect(metrics.correspondenceTypeCount).toBeGreaterThanOrEqual(1);
    expect(metrics.reactionCount).toBe(1);
    expect(metrics.oclConstraintCount).toBe(1);
    expect(metrics.instanceElementTotal).toBe(2);
    expect(metrics.correspondenceTypes[0].reactions[0].name).toBe('Sync');
    expect(metrics.orphanMetamodelCount).toBe(0);
    expect(metrics.linkedMetamodelCount).toBe(2);
    expect(metrics.metamodelLinks.find(l => l.name === 'library')).toMatchObject({
      fanOut: 1,
      fanIn: 0,
      isOrphan: false,
    });
    expect(metrics.metamodelLinks.find(l => l.name === 'persons')).toMatchObject({
      fanOut: 0,
      fanIn: 1,
      isOrphan: false,
    });
    expect(metrics.avgLocPerReaction).toBeGreaterThan(0);
    expect(metrics.attributesPerClass).toBe(1);
    expect(metrics.referencesPerClass).toBeCloseTo(1 / 3);
    expect(metrics.containmentRatio).toBe(1);
    expect(metrics.classesCoveredByViews).toBe(3);
    expect(metrics.classesCoveredByViewsRatio).toBe(1);
    expect(metrics.viewClassesAggregated).toBe(7);
    expect(metrics.viewElementDensity).toBeCloseTo(2 / 3);
    expect(metrics.reactionsPerCorrespondenceType).toBe(1);
    expect(metrics.reactionComplexityRatio).toBe(metrics.avgLocPerReaction);
    expect(metrics.constraintDensity).toBeCloseTo(1 / 3);
    expect(metrics.metamodelToViewRatio).toBeCloseTo(3 / 7);
    expect(metrics.viewTypePairCount).toBe(3);
    expect(metrics.correspondenceToViewPairRatio).toBeCloseTo(metrics.correspondenceTypeCount / 3);
    expect(metrics.modularizationRatio).toBeCloseTo(1.5);
    expect(metrics.correspondenceTypes[0].direction).toBe('one-way');
    expect(metrics.oneWayReactionPairCount).toBe(1);
    expect(metrics.bidirectionalReactionPairCount).toBe(0);
    expect(metrics.detectOnlyClassNames).toEqual(['Book']);
    expect(metrics.unprotectedClassNames).toEqual(expect.arrayContaining(['Library', 'Person']));
  });

  it('marks isolated metamodels as orphans and computes class coverage', () => {
    const orphan: Node = {
      id: 'n3',
      type: 'ecoreFile',
      position: { x: 200, y: 0 },
      data: {
        fileName: 'inventory.ecore',
        fileContent: wrap(eClass('Item', eAttr('sku')), 'inventory'),
      },
    };
    const linkedCode = `
reaction SyncBook {
  after element of type library::Book created
  call { create Persons::Person }
}
`;
    const metrics = computeMethodologistMetrics({
      metamodels: collectMetamodelInputs([libraryNode, personsNode, orphan]),
      reactions: collectReactionInputs([libraryNode, personsNode, orphan], [{
        ...reactionEdge,
        data: { code: linkedCode },
      }]),
      viewTypes: [],
      oclContent: '',
    });

    expect(metrics.orphanMetamodelCount).toBe(1);
    expect(metrics.metamodelLinks.find(l => l.name === 'inventory')?.isOrphan).toBe(true);
    expect(metrics.metamodelLinks.find(l => l.name === 'library')?.uncoveredClassNames).toEqual(['Library']);
    expect(metrics.metamodelLinks.find(l => l.name === 'library')?.coveredConcreteClassCount).toBe(1);
    expect(metrics.metamodelLinks.find(l => l.name === 'persons')?.coveredConcreteClassCount).toBe(1);
    expect(metrics.correspondenceCoveragePercent).toBe(50);
  });

  it('returns zero derived ratios when denominators are empty', () => {
    const metrics = computeMethodologistMetrics({
      metamodels: [],
      reactions: [],
      viewTypes: [],
      oclContent: '',
    });
    expect(metrics.attributesPerClass).toBe(0);
    expect(metrics.containmentRatio).toBe(0);
    expect(metrics.viewElementDensity).toBe(0);
    expect(metrics.correspondenceToViewPairRatio).toBe(0);
    expect(metrics.modularizationRatio).toBe(0);
    expect(metrics.metamodelToViewRatio).toBe(0);
  });

  it('drops duplicate canvas copies of the same metamodel id', () => {
    const copy: Node = {
      ...libraryNode,
      id: 'n1-copy',
      data: { ...libraryNode.data, metaModelId: 12 },
    };
    const original: Node = {
      ...libraryNode,
      data: { ...libraryNode.data, metaModelId: 12 },
    };
    expect(collectMetamodelInputs([original, copy])).toHaveLength(1);
  });

  it('uses canvas file names instead of EPackage names', () => {
    const stringNode: Node = {
      id: 'n-string',
      type: 'ecoreFile',
      position: { x: 0, y: 0 },
      data: {
        fileName: 'string.ecore',
        fileContent: wrap(eClass('Root'), 'model2'),
      },
    };
    const namedNode: Node = {
      id: 'n-named',
      type: 'ecoreFile',
      position: { x: 80, y: 0 },
      data: {
        fileName: 'test new meta model.ecore',
        fileContent: wrap(eClass('Entity'), 'model'),
      },
    };
    const metrics = computeMethodologistMetrics({
      metamodels: collectMetamodelInputs([stringNode, namedNode]),
      reactions: collectReactionInputs([stringNode, namedNode], [{
        id: 'e-link',
        source: 'n-string',
        target: 'n-named',
        type: 'reactions',
        data: { code: '' },
      }]),
      viewTypes: [],
      oclContent: '',
    });
    expect(metrics.metamodels.map(m => m.name)).toEqual(['string', 'test new meta model']);
    expect(metrics.correspondenceTypes[0]).toMatchObject({
      sourceName: 'string',
      targetName: 'test new meta model',
    });
  });

  it('parses OCL contexts and classifies detect vs repair vs unprotected hotspots', () => {
    const ocl = `
context library::Book inv HasTitle:
  self.title <> ''
context library::Book inv UniqueIsbn:
  true
`;
    const linkedCode = `
reaction SyncBook {
  after element of type library::Book created
  call { create Persons::Person }
}
`;
    const reverseEdge: Edge = {
      id: 'e2',
      source: 'n2',
      target: 'n1',
      type: 'reactions',
      data: { code: 'reaction Back { after element Persons::Person created }' },
    };
    const metrics = computeMethodologistMetrics({
      metamodels: collectMetamodelInputs([libraryNode, personsNode]),
      reactions: collectReactionInputs([libraryNode, personsNode], [
        { ...reactionEdge, data: { code: linkedCode } },
        reverseEdge,
      ]),
      viewTypes: [],
      oclContent: ocl,
    });

    expect(parseOclConstraints(ocl).map(c => c.contextClass)).toEqual(['Book', 'Book']);
    expect(metrics.detectAndRepairClassNames).toEqual(['Book']);
    expect(metrics.repairOnlyClassNames).toEqual(['Person']);
    expect(metrics.detectOnlyClassNames).toEqual([]);
    expect(metrics.unprotectedClassNames).toEqual(['Library']);
    expect(metrics.oclRulesWithoutReaction).toHaveLength(0);
    expect(metrics.bidirectionalReactionPairCount).toBe(1);
    expect(metrics.correspondenceTypes.every(ct => ct.direction === 'both-ways')).toBe(true);
    expect(metrics.hotspotClasses[0]).toMatchObject({
      className: 'Book',
      oclRuleCount: 2,
      reactionFileCount: 1,
      score: 3,
    });
  });
});
