import type { FeatureNode, MetamodelGraph } from '../../types';
import type { ElementProfile } from '../measures/types';
import { describeClass, describeFeature } from './describe';
import { cosine, medianBaseline, sampleIndices } from './relativeCosine';
import type { EmbeddingTable } from './types';

/**
 * Connects the embedding table to the synchronous analysis: profiles get the vectors of their
 * descriptions, and each level gets the median cosine its similarities are rescaled against.
 */

/** Class profiles (in the graph's class order) with the embeddings of their descriptions. */
export function withClassEmbeddings(profiles: ElementProfile[], graph: MetamodelGraph, table: EmbeddingTable | null): ElementProfile[] {
  if (!table) return profiles;
  return profiles.map((profile, k) => ({ ...profile, embedding: table.vectors.get(describeClass(graph.classes[k], graph)) }));
}

/** Feature profiles (in the order of `features`) with the embeddings of their descriptions. */
export function withFeatureEmbeddings(profiles: ElementProfile[], features: readonly FeatureNode[], table: EmbeddingTable | null): ElementProfile[] {
  if (!table) return profiles;
  return profiles.map((profile, k) => ({ ...profile, embedding: table.vectors.get(describeFeature(features[k])) }));
}

/** Median cosine over all source × target pairs that both have a vector. */
export function pairBaseline(sources: readonly (Float32Array | undefined)[], targets: readonly (Float32Array | undefined)[]): number {
  const values: number[] = [];
  for (const a of sources) {
    if (!a) continue;
    for (const b of targets) if (b) values.push(cosine(a, b));
  }
  return medianBaseline(values);
}

const declaredFeatures = (graph: MetamodelGraph) => graph.classes.flatMap(c => [...c.attributes, ...c.references])
  .sort((a, b) => a.qualifiedName.localeCompare(b.qualifiedName));

/**
 * Feature-level baseline over all features of the two metamodels; for large products over a
 * deterministic sample of at most 200 × 200, evenly spaced over the sorted qualified names.
 */
export function featureBaseline(source: MetamodelGraph, target: MetamodelGraph, table: EmbeddingTable): number {
  const vectors = (graph: MetamodelGraph) => {
    const features = declaredFeatures(graph);
    return sampleIndices(features.length).map(k => table.vectors.get(describeFeature(features[k])));
  };
  return pairBaseline(vectors(source), vectors(target));
}
