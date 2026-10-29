import { readMetamodelGraph } from '../../../../../utils/semanticOverlap/ecore/readMetamodelGraph';
import type { MetamodelGraph } from '../../../../../utils/semanticOverlap/types';
import { refFor } from '../../fixtures';

const T = (name: string) => `ecore:EDataType http://www.eclipse.org/emf/2002/Ecore#//${name}`;
const pkg = (name: string, body: string, id: number): MetamodelGraph => readMetamodelGraph(`<?xml version="1.0" encoding="UTF-8"?>
<ecore:EPackage xmi:version="2.0" xmlns:xmi="http://www.omg.org/XMI" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore" name="${name}" nsURI="http://example.org/${name}">${body}</ecore:EPackage>`, refFor(name, id));

/** Type-object pattern: Product → ProductKind (type) with Features (definitions) and FeatureValues. */
export const shopBody = (withValueReference = true) => `
  <eClassifiers xsi:type="ecore:EClass" name="Shop">
    <eStructuralFeatures xsi:type="ecore:EReference" name="products" upperBound="-1" containment="true" eType="#//Product"/>
    <eStructuralFeatures xsi:type="ecore:EReference" name="kinds" upperBound="-1" containment="true" eType="#//ProductKind"/>
  </eClassifiers>
  <eClassifiers xsi:type="ecore:EClass" name="Product">
    <eStructuralFeatures xsi:type="ecore:EAttribute" name="id" eType="${T('EString')}"/>
    <eStructuralFeatures xsi:type="ecore:EReference" name="kind" lowerBound="1" eType="#//ProductKind"/>
    <eStructuralFeatures xsi:type="ecore:EReference" name="values" upperBound="-1" containment="true" eType="#//FeatureValue"/>
  </eClassifiers>
  <eClassifiers xsi:type="ecore:EClass" name="ProductKind">
    <eStructuralFeatures xsi:type="ecore:EAttribute" name="name" eType="${T('EString')}"/>
    <eStructuralFeatures xsi:type="ecore:EReference" name="features" upperBound="-1" containment="true" eType="#//Feature"/>
  </eClassifiers>
  <eClassifiers xsi:type="ecore:EClass" name="Feature" abstract="true">
    <eStructuralFeatures xsi:type="ecore:EAttribute" name="name" eType="${T('EString')}"/>
  </eClassifiers>
  <eClassifiers xsi:type="ecore:EClass" name="TextFeature" eSuperTypes="#//Feature"/>
  <eClassifiers xsi:type="ecore:EClass" name="NumberFeature" eSuperTypes="#//Feature"/>
  <eClassifiers xsi:type="ecore:EClass" name="FeatureValue" abstract="true">
    ${withValueReference ? '<eStructuralFeatures xsi:type="ecore:EReference" name="feature" lowerBound="1" eType="#//Feature"/>' : ''}
  </eClassifiers>
  <eClassifiers xsi:type="ecore:EClass" name="TextFeatureValue" eSuperTypes="#//FeatureValue">
    <eStructuralFeatures xsi:type="ecore:EAttribute" name="value" eType="${T('EString')}"/>
  </eClassifiers>
  <eClassifiers xsi:type="ecore:EClass" name="NumberFeatureValue" eSuperTypes="#//FeatureValue">
    <eStructuralFeatures xsi:type="ecore:EAttribute" name="value" eType="${T('EInt')}"/>
  </eClassifiers>`;

export const shop = (withValueReference = true, id = 2) => pkg('shop', shopBody(withValueReference), id);

/** Counterpart: abstract Part with concrete Bolt and Nut, contained by Assembly. */
export const assembly = (id = 1, withDate = false, withWeight = false) => pkg('asm', `
  <eClassifiers xsi:type="ecore:EClass" name="Assembly">
    <eStructuralFeatures xsi:type="ecore:EReference" name="parts" upperBound="-1" containment="true" eType="#//Part"/>
  </eClassifiers>
  <eClassifiers xsi:type="ecore:EClass" name="Part" abstract="true">
    <eStructuralFeatures xsi:type="ecore:EAttribute" name="id" eType="${T('EString')}"/>
    <eStructuralFeatures xsi:type="ecore:EAttribute" name="label" eType="${T('EString')}"/>
  </eClassifiers>
  <eClassifiers xsi:type="ecore:EClass" name="Bolt" eSuperTypes="#//Part">
    <eStructuralFeatures xsi:type="ecore:EAttribute" name="length" eType="${T('EInt')}"/>
    ${withDate ? `<eStructuralFeatures xsi:type="ecore:EAttribute" name="produced" eType="${T('EDate')}"/>` : ''}
  </eClassifiers>
  <eClassifiers xsi:type="ecore:EClass" name="Nut" eSuperTypes="#//Part">
    <eStructuralFeatures xsi:type="ecore:EAttribute" name="size" eType="${T('EInt')}"/>
    ${withWeight ? `<eStructuralFeatures xsi:type="ecore:EAttribute" name="weight" eType="${T('EDouble')}"/>` : ''}
  </eClassifiers>`, id);

/**
 * Like the BOM in the Model Library: untyped definitions, values split into text, boolean, an
 * abstract numeric value and integer and decimal values.
 */
export const shopWithNumericValues = (id = 2) => pkg('shop', `
  <eClassifiers xsi:type="ecore:EClass" name="Shop">
    <eStructuralFeatures xsi:type="ecore:EReference" name="products" upperBound="-1" containment="true" eType="#//Product"/>
  </eClassifiers>
  <eClassifiers xsi:type="ecore:EClass" name="Product">
    <eStructuralFeatures xsi:type="ecore:EReference" name="kind" lowerBound="1" eType="#//ProductKind"/>
    <eStructuralFeatures xsi:type="ecore:EReference" name="values" upperBound="-1" containment="true" eType="#//FeatureValue"/>
  </eClassifiers>
  <eClassifiers xsi:type="ecore:EClass" name="ProductKind">
    <eStructuralFeatures xsi:type="ecore:EReference" name="features" upperBound="-1" containment="true" eType="#//Feature"/>
  </eClassifiers>
  <eClassifiers xsi:type="ecore:EClass" name="Feature">
    <eStructuralFeatures xsi:type="ecore:EAttribute" name="name" eType="${T('EString')}"/>
  </eClassifiers>
  <eClassifiers xsi:type="ecore:EClass" name="FeatureValue" abstract="true">
    <eStructuralFeatures xsi:type="ecore:EReference" name="feature" lowerBound="1" eType="#//Feature"/>
  </eClassifiers>
  <eClassifiers xsi:type="ecore:EClass" name="StringFeatureValue" eSuperTypes="#//FeatureValue"/>
  <eClassifiers xsi:type="ecore:EClass" name="NumericFeatureValue" abstract="true" eSuperTypes="#//FeatureValue"/>
  <eClassifiers xsi:type="ecore:EClass" name="DoubleFeatureValue" eSuperTypes="#//NumericFeatureValue"/>
  <eClassifiers xsi:type="ecore:EClass" name="IntegerFeatureValue" eSuperTypes="#//NumericFeatureValue"/>`, id);

/** Like {@link assembly} but with a single concrete subclass. */
export const smallAssembly = () => pkg('asm', `
  <eClassifiers xsi:type="ecore:EClass" name="Assembly">
    <eStructuralFeatures xsi:type="ecore:EReference" name="parts" upperBound="-1" containment="true" eType="#//Part"/>
  </eClassifiers>
  <eClassifiers xsi:type="ecore:EClass" name="Part" abstract="true"/>
  <eClassifiers xsi:type="ecore:EClass" name="Bolt" eSuperTypes="#//Part">
    <eStructuralFeatures xsi:type="ecore:EAttribute" name="length" eType="${T('EInt')}"/>
  </eClassifiers>`, 1);
