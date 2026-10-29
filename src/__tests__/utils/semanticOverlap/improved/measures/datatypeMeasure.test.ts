import {
  categoryCandidates, classDatatypeMeasure, dataTypeCategory, dataTypeCategoryOfClassName, dataTypeHistograms,
  fineDataTypeCategory, fineDataTypeCategoryOfClassName, histogramSimilarity,
} from '../../../../../utils/semanticOverlap/improved/measures/datatypeMeasure';
import { computeMatrices } from '../../../../../utils/semanticOverlap/improved/measures/similarityMatrices';
import { createDefaultMeasureRegistry } from '../../../../../utils/semanticOverlap/improved/measures/registry';
import { improvementsOf, resolveImprovedSettings } from '../../../../../utils/semanticOverlap/improved/settings';
import { readMetamodelGraph } from '../../../../../utils/semanticOverlap/ecore/readMetamodelGraph';
import { profile } from '../../helpers';
import { refFor } from '../../fixtures';

const primitive = (typeName: string) => dataTypeCategory({ typeName, typeCategory: 'primitive' });

describe('attribute data types', () => {
  it.each([
    ['EString', 'text'], ['EChar', 'text'], ['ECharacterObject', 'text'], ['String', 'text'],
    ['EInt', 'number'], ['ELong', 'number'], ['EShort', 'number'], ['EByte', 'number'], ['EFloat', 'number'],
    ['EDouble', 'number'], ['EBigInteger', 'number'], ['EBigDecimal', 'number'], ['EIntegerObject', 'number'],
    ['EDoubleObject', 'number'], ['Integer', 'number'], ['Long', 'number'], ['Double', 'number'], ['Float', 'number'],
    ['EBoolean', 'boolean'], ['EBooleanObject', 'boolean'],
    ['MyStringType', 'text'], ['UnsignedInt', 'number'], ['BoolFlag', 'boolean'], ['EDate', 'other'],
  ])('maps %s to %s', (typeName, category) => {
    expect(primitive(typeName)).toBe(category);
  });

  it('maps enum-typed attributes to enum', () => {
    expect(dataTypeCategory({ typeName: 'Color', typeCategory: 'enum' })).toBe('enum');
  });

  it('derives the category of definition and value classes from their names', () => {
    expect(dataTypeCategoryOfClassName('NumberParameterDefinition')).toBe('number');
    expect(dataTypeCategoryOfClassName('BoolParameterValue')).toBe('boolean');
    expect(dataTypeCategoryOfClassName('StringParameterDefinition')).toBe('text');
    expect(dataTypeCategoryOfClassName('ParameterDefinition')).toBe('other');
  });

  it('builds histograms over own and inherited attributes', () => {
    const graph = readMetamodelGraph(`<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmi:version="2.0" xmlns:xmi="http://www.omg.org/XMI" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore" name="p" nsURI="http://example.org/p">
  <eClassifiers xsi:type="ecore:EClass" name="Base">
    <eStructuralFeatures xsi:type="ecore:EAttribute" name="name" eType="ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//EString"/>
  </eClassifiers>
  <eClassifiers xsi:type="ecore:EClass" name="Disk" eSuperTypes="#//Base">
    <eStructuralFeatures xsi:type="ecore:EAttribute" name="diameter" eType="ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//EInt"/>
  </eClassifiers>
  <eClassifiers xsi:type="ecore:EClass" name="Empty"/>
</ecore:EPackage>`, refFor('p'));
    const histograms = dataTypeHistograms(graph);
    expect(histograms.get('p.Disk')).toEqual([0.5, 0.5, 0, 0, 0]);
    expect(histograms.get('p.Empty')).toBeNull();
  });

  it('compares histograms by intersection', () => {
    expect(histogramSimilarity([0.5, 0.5, 0, 0, 0], [0.5, 0.5, 0, 0, 0])).toBe(1);
    expect(histogramSimilarity([1, 0, 0, 0, 0], [0, 1, 0, 0, 0])).toBe(0);
    expect(histogramSimilarity([0.5, 0.5, 0, 0, 0], [0, 1, 0, 0, 0])).toBe(0.5);
  });

  it('is not applicable without attributes and then does not lower the combined score', () => {
    const withAttributes = { ...profile('A', 'source'), datatypeHistogram: [1, 0, 0, 0, 0] };
    const without = { ...profile('B', 'target'), datatypeHistogram: null };
    const ctx = { settings: resolveImprovedSettings() };
    expect(classDatatypeMeasure.applicable?.(withAttributes, without, ctx)).toBe(false);
    const registry = createDefaultMeasureRegistry();
    const settings = resolveImprovedSettings({ improvements: improvementsOf(['datatypes']) });
    const withMeasure = computeMatrices('class', [withAttributes], [without], registry,
      { ...settings, measures: [...settings.measures, { id: 'datatypes', weight: 0.5 }] });
    const plain = computeMatrices('class', [withAttributes], [without], registry, settings);
    expect(Number.isNaN(withMeasure.perMeasure.datatypes[0])).toBe(true);
    expect(withMeasure.combined[0]).toBeCloseTo(plain.combined[0]);
  });

  it.each([
    ['EInt', 'integer'], ['ELong', 'integer'], ['EBigInteger', 'integer'], ['Integer', 'integer'], ['UnsignedInt', 'integer'],
    ['EDouble', 'decimal'], ['EFloat', 'decimal'], ['EBigDecimal', 'decimal'], ['Double', 'decimal'],
    ['EString', 'text'], ['EBoolean', 'boolean'], ['EDate', 'other'],
  ])('tells whole and decimal numbers apart: %s is %s', (typeName, category) => {
    expect(fineDataTypeCategory({ typeName, typeCategory: 'primitive' })).toBe(category);
  });

  it('derives fine categories from class names', () => {
    expect(fineDataTypeCategoryOfClassName('IntegerParameterValue')).toBe('integer');
    expect(fineDataTypeCategoryOfClassName('DoubleParameterValue')).toBe('decimal');
    expect(fineDataTypeCategoryOfClassName('NumericParameterValue')).toBe('number');
    expect(fineDataTypeCategoryOfClassName('NumberParameterDefinition')).toBe('number');
    expect(dataTypeCategoryOfClassName('IntegerParameterValue')).toBe('number');
  });

  it('tries related number categories in a fixed order', () => {
    expect(categoryCandidates('integer')).toEqual(['integer', 'number', 'decimal']);
    expect(categoryCandidates('decimal')).toEqual(['decimal', 'number']);
    expect(categoryCandidates('number')).toEqual(['number', 'decimal', 'integer']);
    expect(categoryCandidates('text')).toEqual(['text']);
  });
});

