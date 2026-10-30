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

## Scenario families

The suite has 17 scenarios in 5 families. Scores are averaged within each family and then over the
families, so a family with many scenarios does not dominate the average.

| Family | Scenarios | Files | In CI |
|---|---|---|---|
| `fig1` | Fig. 1 excerpt | committed | runs |
| `model-exchange` | Ecore → UML 2.0, UML 1.4 → UML 2.0, Ecore → UML 1.4, ER → UML 2.0, WebML → UML 2.0, ER → Ecore, WebML → Ecore | downloaded metamodels, committed references | skipped |
| `brake-bom` | Brake → BOM, BOM → Brake | local brake model | skipped |
| `wimmer` | Wimmer 1 – 6 | committed, hand-made | runs |
| `tree2graph` | Tree → Graph | committed, hand-made | runs |

### Wimmer heterogeneities (`wimmer/example-<k>/`)

Wimmer et al. (2010), *Towards an Expressivity Benchmark for Mappings based on a Systematic
Classification of Heterogeneities* (MDI@MODELS), Benchmark Examples 1–6 (Figs. 5–10). Each case
isolates one kind of heterogeneity: renamed elements and attribute settings, n:1 concepts,
attribute ↔ class (A2C), reference ↔ class (R2C), inheritance breadth and depth, and attribute ↔
inheritance (A2I). The `source.ecore` / `target.ecore` files are hand-made structural
reproductions of the left-hand and right-hand metamodels of the figures; `expected.json` is
derived from each example's list of challenges. In Example 6 the String attribute `kind` is
reproduced as an enumeration of the values the paper's example instances use, because the A2I
heterogeneity is defined over that closed set of values.

### Tree2Graph (`tree2graph/`)

Hand-made after the Epsilon Tree2Graph example, as used by Fang (2022): a tree whose `parent`
reference corresponds to the navigation `Node.incoming.source` in a graph.

### Further model-exchange pairs (`model-exchange/`)

Besides Ecore → UML 2.0, the suite has every pair of the five ModelCVS metamodels that has UML 2.0
or Ecore on one side (6 pairs). The pair list of Kessentini et al. (2014) is not available, so
this rule defines the list. The references are class-level and hand-made, like
`ecore-uml20.expected.json`; the metamodels are downloaded as described above.

### Reference kinds

Besides `same` and `instance`, entries may have the kind `path` (a feature corresponds to a
navigation `<owner>.<reference>.<feature>`), `split` / `merge` (one class to several unrelated
classes, or the reverse), or `conditional` (with `condition: { attribute, value }`). Split and
merge entries count once per source × target pair. A pair appears in at most one entry. Entries
the engine cannot express go to `unmatched` with a note and are not counted.

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

## Sentence-embedding model (not committed)

The `embeddings` improvement of the improved approach compares short element descriptions with a
small sentence-embedding model. The app serves the model itself from `public/models/`, so there
is no third-party request at runtime. The files are git-ignored and fetched at build time:

```bash
node scripts/fetch-embedding-model.mjs                      # all-MiniLM-L6-v2 (default)
node scripts/fetch-embedding-model.mjs --model bge-small    # bge-small-en-v1.5 (comparison only)
```

| Id | Repository | Pinned revision | Licence | Size |
|---|---|---|---|---|
| `minilm` | `Xenova/all-MiniLM-L6-v2`, `onnx/model_quantized.onnx` | `751bff37182d3f1213fa05d7196b954e230abad9` | Apache-2.0 | 23 MB |
| `bge-small` | `Xenova/bge-small-en-v1.5`, `onnx/model_quantized.onnx` | `ea104dacec62c0de699686887e3f920caeb4f3e3` | MIT | 34 MB |

Revisions and SHA-256 checksums are pinned in
`src/utils/semanticOverlap/improved/embeddings/models.json`; the script fails on a mismatch. Both
licences permit redistribution with the application.

`npm run build` works without the model. The improvement is then reported as unavailable, and the
settings panel disables its switch. Tests never download it: unit tests use a fake embedding
source, and the model contract test and the embedding benchmark skip when the files are missing.
The Docker image fetches the model unless it is built with `--build-arg EMBEDDING_MODEL=none`.
