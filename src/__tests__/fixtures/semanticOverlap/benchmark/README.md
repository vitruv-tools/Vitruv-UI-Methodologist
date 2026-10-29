# Semantic overlap benchmark (model exchange case)

Reference data for the opt-in benchmark `src/__tests__/utils/semanticOverlap/benchmark/`, which
reproduces the model exchange experiment of Kessentini et al. (2014), *Search-based metamodel
matching with structural and syntactic measures*, JSS 97, §5.1.1.

## Metamodels (not committed)

The five metamodels of the experiment (UML 2.0 CD, UML 1.4.2 CD, Ecore, ER, WebML) come from the
ModelCVS matching framework (Kappel et al. 2007). Its site is offline; the files are retrieved from
the Web Archive copy of `http://www.modelcvs.org/matching/ecore/` (archived April 2016). They carry
no licence statement, so they are **not** stored in this repository. Download them with

```bash
node scripts/fetch-overlap-benchmark.mjs
```

which writes them to `metamodels/` next to this file (git-ignored).

## Brake ↔ BOM (local brake model)

The Brake ↔ BOM scenario compares the Brake Specification Model (one class per brake component
kind) with a bill-of-materials metamodel that uses the type-object pattern (`ItemType`, `Item`,
`ParameterDefinition`, `ParameterValue`).

- `brake-bom/bom.ecore` and `brake-bom/brake-bom.expected.json` are committed.
- `brake-bom/brakesystem.ecore` comes from the KIT-internal brake case study and is **never
  committed** (git-ignored). Copy it from a local checkout:

  ```bash
  node scripts/fetch-overlap-benchmark.mjs --brake <brake-case-study>/model/src/main/ecore/brakesystem.ecore
  ```

- Without it, every Brake ↔ BOM test is skipped (as in CI).

The reference distinguishes two correspondence kinds: `same` (equivalent elements, the default)
and `instance` (a class or attribute corresponds to an *instance* of a class on the other side,
e.g. `BrakeDisk` ↔ an `ItemType` object). `instanceSide` names the side whose class is
instantiated, `role` is `type`, `definition` or `value`.

## Reference correspondences

The original reference alignments (`manualMappings.rar`, INRIA alignment format) and the paper's
data site are lost, so the expected correspondences are recreated by hand:

| File | Scenario | Level |
|---|---|---|
| `ecore-uml20.expected.json` | Ecore → UML 2.0 CD | classes |
| `brake-bom/brake-bom.expected.json` | Brake Specification Model → BOM (and the reverse, derived in code) | classes and attributes, with correspondence kinds |

Each entry lists source and target classes by qualified name; groups (e.g. `EAttribute,
EReference → Property`) count as one expected pair per source/target combination. Pairs that are
debatable are listed under `uncertain` and still count as expected.

## Measures

Precision, recall and F-measure are computed on class pairs (source class, target class), as in
§5.2 of the paper, and averaged over 10 fixed seeds per scenario.
