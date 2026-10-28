import { createRng } from '../../../utils/semanticOverlap/search/rng';
import type { ClassNode, FeatureNode, MetamodelGraph } from '../../../utils/semanticOverlap/types';

const WORDS = [
  'person', 'address', 'order', 'invoice', 'customer', 'product', 'account', 'payment', 'item', 'model',
  'element', 'package', 'type', 'feature', 'attribute', 'reference', 'operation', 'parameter', 'property',
  'relation', 'node', 'edge', 'graph', 'view', 'state', 'event', 'action', 'rule', 'constraint', 'value',
  'name', 'owner', 'member', 'group', 'role', 'task', 'project', 'document', 'section', 'version',
];

/**
 * Seeded synthetic metamodel for performance checks (SC-002): `classCount` classes with
 * camel-case names from a small vocabulary, 0–6 features each and a shallow inheritance forest.
 */
export function syntheticMetamodel(classCount: number, seed: number, name = `synthetic${classCount}`): MetamodelGraph {
  const rng = createRng(seed);
  const word = () => rng.pick(WORDS);
  const cap = (w: string) => w[0].toUpperCase() + w.slice(1);
  const classes: ClassNode[] = [];
  for (let i = 0; i < classCount; i++) {
    const className = `${cap(word())}${cap(word())}${i}`;
    const qualifiedName = `${name}.${className}`;
    const features: FeatureNode[] = Array.from({ length: rng.int(7) }, (_, k) => {
      const reference = rng.next() < 0.4;
      const featureName = `${word()}${cap(word())}${k}`;
      return {
        kind: reference ? 'reference' : 'attribute',
        name: featureName,
        qualifiedName: `${qualifiedName}.${featureName}`,
        owner: qualifiedName,
        typeName: reference ? 'Ref' : 'EString',
        typeCategory: reference ? 'class' : 'primitive',
        lower: 0,
        upper: reference && rng.next() < 0.5 ? -1 : 1,
        containment: reference && rng.next() < 0.3,
        opposite: null,
      };
    });
    classes.push({
      qualifiedName,
      name: className,
      isAbstract: rng.next() < 0.15,
      isInterface: false,
      superTypes: i > 0 && rng.next() < 0.5 ? [classes[rng.int(i)].qualifiedName] : [],
      attributes: features.filter(f => f.kind === 'attribute'),
      references: features.filter(f => f.kind === 'reference'),
      operations: rng.next() < 0.2 ? [{ name: `compute${cap(word())}`, parameterNames: [] }] : [],
    });
  }
  return {
    ref: { libraryId: seed, name, ecoreFileId: seed, contentHash: name },
    rootPackage: name, nsUri: null, classes, enums: [], unresolvedSupertypes: [],
  };
}
