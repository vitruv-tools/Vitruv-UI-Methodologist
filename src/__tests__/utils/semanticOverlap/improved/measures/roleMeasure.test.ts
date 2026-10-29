import { existsSync } from 'node:fs';
import { roleSimilarity, roleVectors } from '../../../../../utils/semanticOverlap/improved/measures/roleMeasure';
import { readMetamodelGraph } from '../../../../../utils/semanticOverlap/ecore/readMetamodelGraph';
import { BOM_FILE, BRAKE_FILE, loadEcore, refFor } from '../../fixtures';

const ecore = (body: string) => readMetamodelGraph(`<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmi:version="2.0" xmlns:xmi="http://www.omg.org/XMI" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore" name="p" nsURI="http://example.org/p">${body}</ecore:EPackage>`, refFor('p'));
const STRING = 'ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//EString';

const graph = ecore(`
  <eClassifiers xsi:type="ecore:EClass" name="Assembly">
    <eStructuralFeatures xsi:type="ecore:EReference" name="parts" upperBound="-1" containment="true" eType="#//Part"/>
  </eClassifiers>
  <eClassifiers xsi:type="ecore:EClass" name="Part" abstract="true">
    <eStructuralFeatures xsi:type="ecore:EAttribute" name="id" eType="${STRING}"/>
  </eClassifiers>
  <eClassifiers xsi:type="ecore:EClass" name="Bolt" eSuperTypes="#//Part">
    <eStructuralFeatures xsi:type="ecore:EAttribute" name="length" eType="${STRING}"/>
  </eClassifiers>
  <eClassifiers xsi:type="ecore:EClass" name="Nut" eSuperTypes="#//Part"/>
  <eClassifiers xsi:type="ecore:EClass" name="Tag">
    <eStructuralFeatures xsi:type="ecore:EAttribute" name="code" iD="true" eType="${STRING}"/>
  </eClassifiers>`);

describe('class roles', () => {
  const roles = roleVectors(graph);

  it('describes root containers, abstract contained parts and their subclasses', () => {
    // abstract, root, contained, subclasses, identifier, attributes, references, owned containments
    expect(roles.get('p.Assembly')).toEqual([0, 1, 0, 0, 0, 0, 1, 1]);
    expect(roles.get('p.Part')).toEqual([1, 0, 1, 2, 1, 1, 0, 0]);
    // Contained through its supertype, inherits the identifier.
    expect(roles.get('p.Bolt')).toEqual([0, 0, 1, 0, 1, 2, 0, 0]);
    // The iD flag marks an identifier even under another name.
    expect(roles.get('p.Tag')?.[4]).toBe(1);
  });

  it('compares booleans by equality and counts relatively', () => {
    expect(roleSimilarity([1, 0, 1, 2, 1, 4, 0, 0], [1, 0, 1, 2, 1, 4, 0, 0])).toBe(1);
    // Different abstract flag (0) and 2 vs 4 attributes (0.5) out of 8 components.
    expect(roleSimilarity([1, 0, 1, 2, 1, 2, 0, 0], [0, 0, 1, 2, 1, 4, 0, 0])).toBeCloseTo(6.5 / 8);
    expect(roleSimilarity([], [])).toBe(0);
  });

  it.skipIf(!existsSync(BRAKE_FILE))('finds Brakesystem closer to BOM than to ItemType', () => {
    const brake = roleVectors(loadEcore(BRAKE_FILE, 1));
    const bom = roleVectors(loadEcore(BOM_FILE, 2));
    const system = brake.get('brakesystem.Brakesystem')!;
    expect(roleSimilarity(system, bom.get('bom.BOM')!)).toBeGreaterThan(roleSimilarity(system, bom.get('bom.ItemType')!));
    const component = brake.get('brakesystem.BrakeComponent')!;
    expect(roleSimilarity(component, bom.get('bom.Item')!)).toBeGreaterThan(roleSimilarity(component, bom.get('bom.ItemType')!));
  });
});
