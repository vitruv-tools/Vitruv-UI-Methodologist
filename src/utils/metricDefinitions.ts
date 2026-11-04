export interface MetricDefinition {
  /** Label shown on the Metrics page and in exported CSV files. */
  label: string;
  /** What the metric represents in the V-SUM. */
  represents: string;
  /** What exactly is counted or compared. */
  measures: string;
  /** How the value is calculated. */
  calculation: string;
  /** How to read the resulting value. */
  interpretation: string;
}

/**
 * Single source of truth for metric names and explanations. Metric values are
 * computed statically from the canvas (metamodel files, reactions files, view
 * types, and OCL rule sets), not from a deployed V-SUM.
 */
export const METRIC_DEFINITIONS = {
  // ---- Size: overview ----
  metamodels: {
    label: 'Metamodels',
    represents: 'The metamodels (Ecore files) that make up the V-SUM.',
    measures: 'Distinct metamodels placed on the Modeling canvas.',
    calculation: 'Count of metamodel nodes. The same metamodel placed twice is counted once.',
    interpretation: 'More metamodels means more models that must be kept consistent with each other.',
  },
  classes: {
    label: 'Classes',
    represents: 'The classes (EClasses) defined across all metamodels.',
    measures: 'Every EClass, including abstract classes and interfaces. Enumerations and data types are not classes.',
    calculation: 'Sum of classes over all metamodels. Abstract = marked abstract or interface; concrete = all others.',
    interpretation: 'Overall size of the V-SUM. Concrete classes can be instantiated and are what reactions usually have to keep consistent.',
  },
  abstractClasses: {
    label: 'Abstract',
    represents: 'Classes that cannot be instantiated directly.',
    measures: 'EClasses with abstract="true" or interface="true".',
    calculation: 'Count of abstract classes and interfaces in the metamodel.',
    interpretation: 'A high share of abstract classes points to a deep or heavily generalized type hierarchy.',
  },
  concreteClasses: {
    label: 'Concrete',
    represents: 'Classes that can be instantiated as model elements.',
    measures: 'EClasses that are neither abstract nor interfaces.',
    calculation: 'Classes − abstract classes.',
    interpretation: 'Concrete classes are the basis for reaction coverage: each one is a potential source of inconsistency.',
  },
  references: {
    label: 'References',
    represents: 'Links between classes (EReferences) within the metamodels.',
    measures: 'All EReferences, split into containment references (parent owns child) and non-containment references (plain associations).',
    calculation: 'Count of EReferences; containment = containment="true", non-containment = all others.',
    interpretation: 'More references means a more interconnected metamodel. Containment references define the model tree; non-containment references cross-link it.',
  },
  enumerations: {
    label: 'Enumerations / literals',
    represents: 'Enumeration types (EEnums) and their possible values.',
    measures: 'Number of EEnums, and the total number of literals they declare.',
    calculation: 'Count of EEnums / sum of their eLiterals.',
    interpretation: 'Enumerations add vocabulary but little structure. Many literals can indicate values that might be better modeled as classes.',
  },
  packages: {
    label: 'Packages',
    represents: 'Namespaces (EPackages) that group classes.',
    measures: 'Root packages plus all nested subpackages.',
    calculation: 'Count of EPackage and eSubpackages elements in all metamodels.',
    interpretation: 'Together with classes per package (modularization ratio), shows how finely the metamodels are split.',
  },
  crossPackageReferences: {
    label: 'Cross-package references',
    represents: 'Dependencies between packages of the same metamodel.',
    measures: 'References whose target class lives in a different package than the owning class.',
    calculation: 'Count of EReferences where package(owner) ≠ package(target).',
    interpretation: 'High values mean packages are tightly coupled; 0 means packages are independent of each other.',
  },
  viewTypes: {
    label: 'View types',
    represents: 'View types defined on the Views canvas.',
    measures: 'All view types. Single = based on one metamodel; multi = combines several metamodels.',
    calculation: 'Count of view types, split by their scope.',
    interpretation: 'Each view type is a projection users work with. Multi-metamodel view types depend on correspondences between their metamodels.',
  },
  viewpoints: {
    label: 'Viewpoints',
    represents: 'The distinct perspectives offered by the view types.',
    measures: 'Distinct view type names.',
    calculation: 'Count of unique, non-empty view type labels.',
    interpretation: 'Lower than the number of view types when several view types share a name (the same perspective on different metamodels).',
  },

  // ---- Size: class detail ----
  attributes: {
    label: 'Attributes',
    represents: 'Data held directly by a class.',
    measures: 'EAttributes declared on the class itself (inherited attributes are not counted).',
    calculation: 'Count of structural features that are not references.',
    interpretation: 'Large values suggest a class that carries a lot of data and may be worth splitting.',
  },
  operations: {
    label: 'Operations',
    represents: 'Behavior declared by a class.',
    measures: 'EOperations declared on the class itself.',
    calculation: 'Count of eOperations elements of the class.',
    interpretation: 'Most metamodels are purely structural, so 0 is normal.',
  },
  subclasses: {
    label: 'Subclasses (NOC)',
    represents: 'Number of Children (NOC): how many classes specialize this class.',
    measures: 'Classes in the same metamodel that list this class as a direct supertype.',
    calculation: 'Count of classes whose eSuperTypes include this class.',
    interpretation: 'High values mean many classes depend on this one, so changes to it ripple widely.',
  },
  inheritanceDepth: {
    label: 'Inheritance depth (DIT)',
    represents: 'Depth of Inheritance Tree (DIT): how far down the type hierarchy a class sits.',
    measures: 'The longest chain of supertypes above the class.',
    calculation: 'Longest path along eSuperTypes from the class to a root. Classes without supertypes are 0.',
    interpretation: 'Deeper classes inherit more and are harder to understand in isolation.',
  },
  containmentHeight: {
    label: 'Containment height',
    represents: 'How deep the containment tree is below a class.',
    measures: 'The longest chain of containment references starting at the class.',
    calculation: 'Longest path along containment references to classes of the same metamodel. Classes that contain nothing are 0; cycles are cut.',
    interpretation: 'High values mean deeply nested models, which make navigation and reactions more complex.',
  },

  // ---- Reactions ----
  reactions: {
    label: 'Reactions',
    represents: 'Consistency rules that respond to model changes.',
    measures: 'Reaction blocks across all reactions files.',
    calculation: 'Count of "reaction Name { … }" blocks, ignoring comments.',
    interpretation: 'More reactions means more change scenarios are handled automatically.',
  },
  routines: {
    label: 'Routines',
    represents: 'Reusable actions called by reactions.',
    measures: 'Routine blocks in the reactions file.',
    calculation: 'Count of "routine Name { … }" blocks, ignoring comments.',
    interpretation: 'Routines carry the actual update logic; a file with many reactions but few routines reuses logic heavily.',
  },
  correspondenceTypes: {
    label: 'Coextensions',
    represents: 'Kinds of links between elements of two metamodels that reactions maintain.',
    measures: 'Distinct coextensions declared in reactions files.',
    calculation: 'Distinct unordered pairs of resolved element types (e.g. Member<->Person) declared in reactions files, counted once across the whole VSUM. Variable names are ignored; coextensions whose types cannot be resolved and files without coextensions are not counted.',
    interpretation: 'Shows how many different element mappings exist between metamodels.',
  },
  oneWayPairs: {
    label: 'One-way metamodel pairs',
    represents: 'Metamodel pairs kept consistent in one direction only.',
    measures: 'Pairs of metamodels connected by a reactions edge in exactly one direction.',
    calculation: 'Count of unordered metamodel pairs with a reactions edge A → B but none B → A.',
    interpretation: 'Changes in the target metamodel will not be propagated back to the source.',
  },
  twoWayPairs: {
    label: 'Two-way metamodel pairs',
    represents: 'Metamodel pairs kept consistent in both directions.',
    measures: 'Pairs of metamodels connected by reactions edges in both directions.',
    calculation: 'Count of unordered metamodel pairs with reactions edges A → B and B → A.',
    interpretation: 'Changes on either side are propagated to the other.',
  },
  linesOfCode: {
    label: 'Lines of code',
    represents: 'Size of the reactions code.',
    measures: 'Non-empty lines of code (LOC) in reactions files, excluding comments.',
    calculation: 'Sum of non-empty, non-comment lines over all reactions files. The average is taken over individual reaction blocks.',
    interpretation: 'A rough indicator of implementation and maintenance effort.',
  },
  reactionsFile: {
    label: 'Reactions file',
    represents: 'One coextension specification between a source and a target metamodel.',
    measures: 'One reactions edge on the canvas and the code attached to it.',
    calculation: 'One row per reactions edge, named source metamodel → target metamodel.',
    interpretation: 'Each row describes how changes in the source metamodel are propagated to the target metamodel.',
  },
  direction: {
    label: 'Direction',
    represents: 'Whether consistency is maintained one-way or in both directions.',
    measures: 'Whether a reactions edge in the opposite direction exists.',
    calculation: 'Two-way if another reactions edge goes from target to source; otherwise one-way.',
    interpretation: 'One-way files only propagate changes from source to target.',
  },
  locPerReaction: {
    label: 'LOC per reaction',
    represents: 'Size of each individual reaction.',
    measures: 'Non-empty, non-comment lines inside each reaction block.',
    calculation: 'Lines between the braces of the reaction (minimum 1).',
    interpretation: 'Unusually long reactions are candidates for extracting routines.',
  },

  // ---- Coverage ----
  reactionCoverage: {
    label: 'Reaction coverage',
    represents: 'How much of the V-SUM is handled by reactions.',
    measures: 'Concrete classes whose name appears in a reactions file connected to their metamodel.',
    calculation: 'Covered concrete classes / all concrete classes × 100, rounded. A class is covered when its name appears in the code of a reactions edge that starts or ends at its metamodel.',
    interpretation: '100% means every concrete class is referenced by some reaction. Uncovered classes can change without other models being updated.',
  },
  orphanMetamodels: {
    label: 'Orphan metamodels',
    represents: 'Metamodels that are not connected to any other metamodel.',
    measures: 'Metamodels with no incoming or outgoing reactions edge.',
    calculation: 'Count of metamodels where fan-in + fan-out = 0. Linked = all other metamodels.',
    interpretation: 'Ideally 0: an orphan metamodel is never kept consistent with the rest of the V-SUM.',
  },
  oclConstraints: {
    label: 'OCL constraints',
    represents: 'Consistency checks written in OCL.',
    measures: 'Invariants (inv) in the project\'s OCL rule sets.',
    calculation: 'Count of "inv Name:" declarations.',
    interpretation: 'OCL constraints detect inconsistencies; reactions repair them. Both are needed for full protection.',
  },
  linkStatus: {
    label: 'Status',
    represents: 'Whether the metamodel takes part in consistency preservation.',
    measures: 'Whether any reactions edge touches the metamodel.',
    calculation: 'Orphan if fan-in + fan-out = 0; otherwise linked.',
    interpretation: 'Orphan metamodels are never kept consistent with the rest of the V-SUM.',
  },
  fanIn: {
    label: 'Fan-in',
    represents: 'How many metamodels propagate changes into this one.',
    measures: 'Reactions edges that end at this metamodel.',
    calculation: 'Count of reactions edges with this metamodel as target.',
    interpretation: 'High fan-in means this metamodel is updated from many places.',
  },
  fanOut: {
    label: 'Fan-out',
    represents: 'How many metamodels this one propagates changes to.',
    measures: 'Reactions edges that start at this metamodel.',
    calculation: 'Count of reactions edges with this metamodel as source.',
    interpretation: 'High fan-out means a change here triggers updates in many other metamodels.',
  },
  coveredClasses: {
    label: 'Covered classes',
    represents: 'Reaction coverage of a single metamodel.',
    measures: 'Concrete classes of this metamodel mentioned in a connected reactions file.',
    calculation: 'Covered concrete classes / concrete classes of the metamodel.',
    interpretation: 'Equal numbers mean every concrete class of this metamodel is handled by a reaction.',
  },
  uncoveredClasses: {
    label: 'Uncovered concrete classes',
    represents: 'Concrete classes of this metamodel not handled by any reaction.',
    measures: 'Concrete classes whose name does not appear in any connected reactions file.',
    calculation: 'Concrete classes − covered classes, listed by name.',
    interpretation: 'Candidates for new reactions, or classes intentionally outside consistency preservation.',
  },
  detectOnly: {
    label: 'Detect only',
    represents: 'Classes where inconsistencies are found but not fixed.',
    measures: 'Concrete classes used as an OCL context but not mentioned in any reactions file.',
    calculation: 'Concrete classes in (OCL contexts) and not in (names in reactions files), matched by class name.',
    interpretation: 'An OCL constraint can report a violation here, but no reaction repairs it automatically.',
  },
  repairOnly: {
    label: 'Repair only',
    represents: 'Classes that are fixed but never checked.',
    measures: 'Concrete classes mentioned in a reactions file but not used as an OCL context.',
    calculation: 'Concrete classes in (names in reactions files) and not in (OCL contexts), matched by class name.',
    interpretation: 'A reaction keeps these consistent, but no OCL constraint verifies the result.',
  },
  detectAndRepair: {
    label: 'Detect and repair',
    represents: 'Classes that are both checked and fixed.',
    measures: 'Concrete classes used as an OCL context and mentioned in a reactions file.',
    calculation: 'Concrete classes in both sets, matched by class name.',
    interpretation: 'The best-protected classes: violations are detected and reactions exist to repair them.',
  },
  oclConstraintsWithoutReaction: {
    label: 'OCL constraints without reaction',
    represents: 'Checks whose violations have no automatic repair.',
    measures: 'OCL invariants whose context class is not mentioned in any reactions file.',
    calculation: 'Listed as constraint name (context class).',
    interpretation: 'Each entry is a check that may fail with no reaction to restore consistency.',
  },
  unprotectedClasses: {
    label: 'Unprotected classes',
    represents: 'Classes that are neither checked nor kept consistent.',
    measures: 'Concrete classes that are not an OCL context and not mentioned in any reactions file.',
    calculation: 'Concrete classes − (detect only + repair only + detect and repair).',
    interpretation: 'Ideally empty. Changes to these classes go unnoticed by both OCL and reactions.',
  },
  unprotectedReferences: {
    label: 'Unprotected references',
    represents: 'References that are neither checked nor kept consistent.',
    measures: 'References owned by an unprotected class whose name does not appear in any OCL constraint.',
    calculation: 'Listed as OwnerClass.reference.',
    interpretation: 'Ideally empty. Changes to these links go unnoticed by both OCL and reactions.',
  },

  // ---- Hotspots ----
  hotspotOclConstraints: {
    label: 'OCL constraints',
    represents: 'How heavily a class is checked by OCL.',
    measures: 'OCL invariants that use this class as their context.',
    calculation: 'Count of "inv" declarations whose context is this class.',
    interpretation: 'Higher means changes to this class are more likely to break a constraint.',
  },
  hotspotReactionsFiles: {
    label: 'Reactions files',
    represents: 'How many consistency specifications depend on a class.',
    measures: 'Reactions files whose code mentions this class.',
    calculation: 'Count of reactions files containing the class name.',
    interpretation: 'Higher means changes to this class affect more reactions files.',
  },
  hotspotScore: {
    label: 'Hotspot score',
    represents: 'How risky a class is to change.',
    measures: 'The combined number of OCL constraints and reactions files that depend on the class.',
    calculation: 'OCL constraints + reactions files. The 10 highest-scoring classes are shown.',
    interpretation: 'High scores are the riskiest places to change: edits there affect the most checks and reactions.',
  },

  // ---- Derived ----
  attributesPerClass: {
    label: 'Attributes per class',
    represents: 'Average amount of data per class.',
    measures: 'Attributes relative to classes across all metamodels.',
    calculation: 'Attributes / classes.',
    interpretation: 'High values point to data-heavy classes; low values to mostly structural classes.',
  },
  referencesPerClass: {
    label: 'References per class',
    represents: 'Average connectivity of a class.',
    measures: 'References (containment and non-containment) relative to classes.',
    calculation: 'References / classes.',
    interpretation: 'High values mean a densely connected metamodel that is harder to keep consistent.',
  },
  containmentRatio: {
    label: 'Containment ratio',
    represents: 'How tree-like the metamodels are.',
    measures: 'Share of references that are containment references.',
    calculation: 'Containment references / references × 100.',
    interpretation: 'High values mean mostly tree-shaped models; low values mean many cross-links between elements.',
  },
  classesCoveredByViews: {
    label: 'Classes covered by views',
    represents: 'How much of the V-SUM is visible through view types.',
    measures: 'Classes whose metamodel is linked to at least one view type.',
    calculation: 'Distinct classes in metamodels linked to a view type / classes × 100.',
    interpretation: 'Below 100% means some classes cannot be seen or edited through any view type.',
  },
  reactionsPerCorrespondenceType: {
    label: 'Reactions per coextension',
    represents: 'How much reaction logic each coextension needs.',
    measures: 'Reactions relative to coextensions.',
    calculation: 'Reactions / coextensions.',
    interpretation: 'High values mean each coextension is maintained by many reactions (many change scenarios per mapping).',
  },
  reactionComplexityRatio: {
    label: 'Reaction complexity ratio',
    represents: 'Average size of a single reaction.',
    measures: 'Lines of code per reaction block.',
    calculation: 'Average of the non-empty, non-comment lines in each reaction block.',
    interpretation: 'High values point to long, complex reactions that may benefit from extracting routines.',
  },
  constraintDensity: {
    label: 'Constraint density',
    represents: 'How strongly the metamodels are checked by OCL.',
    measures: 'OCL constraints relative to classes.',
    calculation: 'OCL constraints / classes.',
    interpretation: '0 means no OCL checks; around 1 or more means on average every class has at least one constraint.',
  },
  metamodelToViewRatio: {
    label: 'Metamodel-to-view ratio',
    represents: 'How the metamodel classes relate to what the view types show.',
    measures: 'Classes compared to the classes summed over all view types.',
    calculation: 'Classes / Σ (classes of the metamodels linked to each view type). A class shown in two view types is counted twice in the denominator.',
    interpretation: 'Above 1: some classes are in no view type. Below 1: classes are shown in several view types (overlapping views).',
  },
  correspondenceTypesPerViewTypePair: {
    label: 'Coextensions per view-type pair',
    represents: 'How many coextensions exist relative to the possible combinations of view types.',
    measures: 'Coextensions relative to unordered pairs of view types.',
    calculation: 'Coextensions / (n × (n − 1) / 2), where n is the number of view types.',
    interpretation: 'Higher values mean view types are more tightly connected by coextensions. 0 if there are fewer than 2 view types.',
  },
  modularizationRatio: {
    label: 'Modularization ratio',
    represents: 'Average package size.',
    measures: 'Classes relative to packages.',
    calculation: 'Classes / packages.',
    interpretation: 'High values mean large, coarse packages; low values mean many small packages.',
  },
} satisfies Record<string, MetricDefinition>;

export type MetricId = keyof typeof METRIC_DEFINITIONS;

export function metricLabel(id: MetricId): string {
  return METRIC_DEFINITIONS[id].label;
}
