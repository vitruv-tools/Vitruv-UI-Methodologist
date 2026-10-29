import { readFileSync } from 'node:fs';
import path from 'node:path';
import { readMetamodelGraph } from '../../../utils/semanticOverlap/ecore/readMetamodelGraph';
import type { MetamodelGraph, MetamodelRef } from '../../../utils/semanticOverlap/types';

const FIXTURES = path.resolve(__dirname, '../../fixtures/semanticOverlap');

export const readFixture = (name: string) => readFileSync(path.join(FIXTURES, name), 'utf8');

export const refFor = (name: string, libraryId = 1): MetamodelRef => ({
  libraryId, name, version: '1.0', ecoreFileId: libraryId * 10, nsUri: null, contentHash: `hash-${name}`,
});

export const ecoreExcerpt = (): MetamodelGraph =>
  readMetamodelGraph(readFixture('ecore-excerpt.ecore'), refFor('Ecore excerpt', 1));
export const umlExcerpt = (): MetamodelGraph =>
  readMetamodelGraph(readFixture('uml-excerpt.ecore'), refFor('UML excerpt', 2));

export const fig1Expected = (): { sources: string[]; targets: string[] }[] =>
  JSON.parse(readFixture('fig1-expected.json')).correspondences;

/** Local-only Brake Specification Model (never committed); tests skip when it is missing. */
export const BRAKE_FILE = path.join(FIXTURES, 'benchmark/brake-bom/brakesystem.ecore');
export const BOM_FILE = path.join(FIXTURES, 'benchmark/brake-bom/bom.ecore');
/** Downloaded ModelCVS metamodels (`node scripts/fetch-overlap-benchmark.mjs`). */
export const METAMODEL_DIR = path.join(FIXTURES, 'benchmark/metamodels');

export const loadEcore = (file: string, libraryId: number): MetamodelGraph =>
  readMetamodelGraph(readFileSync(file, 'utf8'), refFor(path.basename(file), libraryId));
