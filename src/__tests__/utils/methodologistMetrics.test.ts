import { parseEcoreMetamodelMetrics } from '../../utils/ecoreMetrics';
import { countOclConstraints, extractReactionClassReferences, parseOclConstraints, parseReactionFileMetrics } from '../../utils/reactionMetrics';
import {
  canonicalMetamodelNodeIds,
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
    expect(result.inheritanceDepthAvg).toBeCloseTo((1 + 2) / 3);
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
    expect(result.correspondenceTypeCount).toBeGreaterThanOrEqual(0);
    expect(result.linesOfCode).toBeGreaterThan(result.reactionCount);
    expect(result.reactions[0].linesOfCode).toBeGreaterThan(0);
  });

  it('identifies correspondence types by actual type, not variable name', () => {
    const code = `
reaction A {
  after element Families::Member created
  call { val p = new Persons::Person
    add correspondence between newValue and p }
}
reaction B {
  after element Families::Member created
  call { val other = new Persons::Person
    add correspondence between newValue and other }
}`;
    const result = parseReactionFileMetrics(code);
    expect(result.correspondenceTypeCount).toBe(1);
    expect(result.correspondenceTypeKeys).toEqual(['Member<->Person']);
  });

  it('does not count a correspondence type for files without resolvable correspondences', () => {
    expect(parseReactionFileMetrics('reaction X {\n after element A created\n}').correspondenceTypeCount).toBe(0);
  });

  it('returns zeros for empty code', () => {
    expect(parseReactionFileMetrics('')).toEqual({
      reactionCount: 0,
      routineCount: 0,
      correspondenceTypeCount: 0,
      correspondenceTypeKeys: [],
      linesOfCode: 0,
      reactions: [],
    });
  });

  it('extracts only qualified metamodel class references', () => {
    const parsed = extractReactionClassReferences(familiesToPersons);
    expect(parsed.references).toEqual([]);
    expect(parsed.aliases.get('Families')).toBe('http://families');
    expect(parsed.sourceAlias).toBe('Families');
    expect(parsed.targetAlias).toBe('Persons');

    expect(extractReactionClassReferences('retrieve optional Families::Member corresponding to Persons::Person').references)
      .toEqual([
        { qualifier: 'Families', className: 'Member' },
        { qualifier: 'Persons', className: 'Person' },
      ]);
  });

  it('ignores Java/Xtend types, imports, strings and comments', () => {
    const code = `
import java.util.List
import static java.lang.Math.*
import "http://families" as Families

reaction CreatePerson {
  after element Families::Member created
  call {
    val String text = "Persons::Fake and Person"
    val List list = new ArrayList()
    // Families::Commented
    /* Families::Block */
    Utility::helper(text)
  }
}
`;
    const { references, aliases } = extractReactionClassReferences(code);
    expect(aliases.get('Families')).toBe('http://families');
    expect(references.map(r => `${r.qualifier}::${r.className}`)).toEqual([
      'Families::Member',
      'Utility::helper',
    ]);
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
    });

    expect(metrics.metamodels).toHaveLength(2);
    expect(metrics.classCount).toBe(3);
    expect(metrics.attributesTotal).toBe(3);
    expect(metrics.containmentReferences).toBe(1);
    expect(metrics.viewTypeCount).toBe(3);
    expect(metrics.viewpointCount).toBe(2);
    expect(metrics.singleViewTypeCount).toBe(2);
    expect(metrics.multiViewTypeCount).toBe(1);
    expect(metrics.correspondenceTypeCount).toBe(0);
    expect(metrics.reactionCount).toBe(1);
    expect(metrics.oclConstraintCount).toBe(1);
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
    expect(metrics.reactionsPerCorrespondenceType).toBe(0);
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

describe('class matching across metamodels', () => {
  const node = (id: string, fileName: string, content: string, extra: Record<string, unknown> = {}): Node => ({
    id,
    type: 'ecoreFile',
    position: { x: 0, y: 0 },
    data: { fileName, fileContent: content, ...extra },
  });
  const edge = (id: string, source: string, target: string, code: string): Edge => ({
    id, source, target, type: 'reactions', data: { code },
  });
  const run = (nodes: Node[], edges: Edge[], oclContent = '') => computeMethodologistMetrics({
    metamodels: collectMetamodelInputs(nodes),
    reactions: collectReactionInputs(nodes, edges),
    viewTypes: [],
    oclContent,
  });

  const uriEcore = (name: string, uri: string, body: string) => `<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore"
                name="${name}" nsURI="${uri}" nsPrefix="${name}">${body}</ecore:EPackage>`;

  const left = node('a', 'left.ecore', uriEcore('left', 'http://left', eClass('Person') + eClass('Left')));
  const right = node('b', 'right.ecore', uriEcore('right', 'http://right', eClass('Person') + eClass('Right')));

  it('does not count Java types, strings or imports as class references', () => {
    const code = `
import java.util.List
import "http://left" as Left
import "http://right" as Right
reactions: LeftToRight
in reaction to changes in Left
execute actions in Right
reaction R {
  after element Left::Left created
  call { val String s = "Person Right::Right" }
}
`;
    const metrics = run([left, right], [edge('e', 'a', 'b', code)]);
    const byName = Object.fromEntries(metrics.metamodelLinks.map(l => [l.name, l]));
    expect(byName.left.uncoveredClassNames).toEqual(['Person']);
    expect(byName.right.uncoveredClassNames).toEqual(['Person', 'Right']);
  });

  it('keeps classes with identical names in different metamodels independent', () => {
    const code = `
import "http://left" as Left
import "http://right" as Right
reactions: LeftToRight
in reaction to changes in Left
execute actions in Right
reaction R { after element Left::Person created }
`;
    const metrics = run([left, right], [edge('e', 'a', 'b', code)]);
    const byName = Object.fromEntries(metrics.metamodelLinks.map(l => [l.name, l]));
    expect(byName.left.uncoveredClassNames).toEqual(['Left']);
    expect(byName.right.uncoveredClassNames).toEqual(['Person', 'Right']);
    expect(metrics.repairOnlyClassNames).toEqual(['left::Person']);
    expect(metrics.unprotectedClassNames).toEqual(['Left', 'right::Person', 'Right']);
    expect(metrics.hotspotClasses).toEqual([
      expect.objectContaining({ className: 'Person', metamodel: 'left', reactionFileCount: 1 }),
    ]);
  });

  it('settles identically named packages via the header and credits only that metamodel', () => {
    const same = (id: string, file: string) => node(id, file, uriEcore('model', 'http://m', eClass('Item') + eClass(`Only${id}`)));
    const code = `
import "http://m" as Src
import "http://m" as Dst
reactions: X
in reaction to changes in Src
execute actions in Dst
reaction R { after element Dst::Item created }
`;
    const metrics = run([same('a', 'one.ecore'), same('b', 'two.ecore')], [edge('e', 'a', 'b', code)]);
    const byName = Object.fromEntries(metrics.metamodelLinks.map(l => [l.name, l]));
    expect(byName.one.uncoveredClassNames).toEqual(['Item', 'Onlya']);
    expect(byName.two.uncoveredClassNames).toEqual(['Onlyb']);
  });

  it('matches OCL contexts by package qualifier', () => {
    const code = 'import "http://left" as Left\nreaction R { after element Left::Person created }';
    const ocl = 'context right::Person inv Named: true';
    const metrics = run([left, right], [edge('e', 'a', 'b', code)], ocl);
    expect(metrics.detectOnlyClassNames).toEqual(['right::Person']);
    expect(metrics.repairOnlyClassNames).toEqual(['left::Person']);
    expect(metrics.oclRulesWithoutReaction).toHaveLength(1);
  });

  it('credits cross-package references to the right subpackage', () => {
    const nested = node('n', 'nested.ecore', uriEcore(
      'root',
      'http://root',
      eClass('Thing') + `<eSubpackages name="sub" nsURI="http://sub" nsPrefix="sub">${eClass('Thing')}${eClass('Deep')}</eSubpackages>`,
    ));
    const other = node('o', 'other.ecore', wrap(eClass('X'), 'other'));
    const code = 'import "http://sub" as Sub\nreaction R { after element Sub::Thing created }';
    const metrics = run([nested, other], [edge('e', 'n', 'o', code)]);
    const link = metrics.metamodelLinks.find(l => l.name === 'nested');
    expect(link?.concreteClassCount).toBe(3);
    expect(link?.coveredConcreteClassCount).toBe(1);
    expect(link?.uncoveredClassNames).toEqual(['Thing', 'Deep']);
    expect(link?.uncoveredClassNames).not.toContain('sub/Thing');
  });

  it('tells same-named classes of one metamodel apart by subpackage', () => {
    const nested = node('n', 'nested.ecore', uriEcore(
      'root',
      'http://root',
      eClass('Thing') + `<eSubpackages name="sub" nsURI="http://sub" nsPrefix="sub">${eClass('Thing')}</eSubpackages>`,
    ));
    const other = node('o', 'other.ecore', wrap(eClass('X'), 'other'));
    const code = 'import "http://root" as Root\nreaction R { after element Root::Thing created }';
    const metrics = run([nested, other], [edge('e', 'n', 'o', code)]);
    expect(metrics.metamodelLinks.find(l => l.name === 'nested')?.uncoveredClassNames).toEqual(['sub/Thing']);
    expect(metrics.repairOnlyClassNames).toEqual(['nested::Thing']);
    expect(metrics.unprotectedClassNames).toEqual(['nested::sub/Thing', 'X']);
  });

  it('does not treat a duplicated reaction-linked metamodel as an orphan', () => {
    const original = node('n1', 'library.ecore', wrap(eClass('Book')), { metaModelId: 7 });
    const copy = node('n1-copy', 'library.ecore', wrap(eClass('Book')), { metaModelId: 7 });
    const persons = node('n2', 'persons.ecore', wrap(eClass('Person'), 'persons'));
    const nodes = [original, copy, persons];
    const edges = [edge('e', 'n1-copy', 'n2', 'reaction R { after element library::Book created }')];
    expect(canonicalMetamodelNodeIds(nodes).get('n1-copy')).toBe('n1');
    expect(collectReactionInputs(nodes, edges)[0]).toMatchObject({ sourceId: 'n1', targetId: 'n2' });
    const metrics = run(nodes, edges);
    expect(metrics.orphanMetamodelCount).toBe(0);
    expect(metrics.metamodelLinks.find(l => l.name === 'library')).toMatchObject({ fanOut: 1, isOrphan: false });
  });

  it('ignores reaction edges that point at unknown nodes', () => {
    const metrics = run([left], [edge('e', 'ghost-a', 'ghost-b', '')]);
    expect(metrics.orphanMetamodelCount).toBe(1);
  });
});

describe('number of children per class identity', () => {
  it('keeps same-named classes in different subpackages apart', () => {
    const xml = wrap(
      eClass('Base', '', 'abstract="true"')
      + eClass('Item', '', 'eSuperTypes="#//Base"')
      + `<eSubpackages name="sub">${eClass('Item')}${eClass('Base', '', 'abstract="true"')}</eSubpackages>`,
    );
    const result = parseEcoreMetamodelMetrics(xml);
    const children = Object.fromEntries(result.classes.map(c => [c.id, c.childCount]));
    expect(children).toEqual({ Base: 1, Item: 0, 'sub/Item': 0, 'sub/Base': 0 });
  });

  it('counts subclasses that live in another package of the same metamodel', () => {
    const xml = wrap(
      eClass('Base', '', 'abstract="true"')
      + `<eSubpackages name="sub">${eClass('Child', '', 'eSuperTypes="#//Base"')}${eClass('Other', '', 'eSuperTypes="#//Base"')}</eSubpackages>`,
    );
    const result = parseEcoreMetamodelMetrics(xml);
    expect(result.classes.find(c => c.id === 'Base')?.childCount).toBe(2);
    expect(result.classes.find(c => c.id === 'sub/Child')?.inheritanceDepth).toBe(1);
  });

  it('does not count parents in other resources', () => {
    const xml = wrap(eClass('Base') + eClass('Child', '', 'eSuperTypes="other.ecore#//Base"'));
    const result = parseEcoreMetamodelMetrics(xml);
    expect(result.classes.find(c => c.name === 'Base')?.childCount).toBe(0);
  });
});
