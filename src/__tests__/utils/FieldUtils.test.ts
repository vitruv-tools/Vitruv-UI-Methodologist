import type { LowCodeReactionFieldMetadata } from '../../types/LowCodeReactionFieldMetadata';
import type { LowCodeReactionFieldVariables } from '../../types/LowCodeReactionFieldVariables';
import {
  buildInitialFieldValues,
  buildLowCodeFieldVariables,
  evaluateTemplate,
  evaluateTemplateWithExpressionSupport,
  getFieldDefaultValue,
  isBooleanField,
  isEnumField,
  isHidden,
  isIntegerField,
  isStringField,
  overlayConnectionFieldValues,
  validateFieldValue,
} from '../../utils/FieldUtils';

const field = (
  overrides: Partial<LowCodeReactionFieldMetadata> &
    Pick<LowCodeReactionFieldMetadata, 'name' | 'type'>,
): LowCodeReactionFieldMetadata => ({
  required: false,
  array: false,
  map: false,
  mapKeyType: null,
  mapValueType: null,
  allowableValues: null,
  sizeMin: null,
  sizeMax: null,
  lengthMin: null,
  lengthMax: null,
  min: null,
  max: null,
  decimalMin: null,
  decimalMinInclusive: null,
  decimalMax: null,
  decimalMaxInclusive: null,
  pattern: null,
  patternFlags: null,
  displayName: overrides.name,
  displayDescription: null,
  displayHide: false,
  displayDefaultStringValue: null,
  displayDefaultIntValue: null,
  displayDefaultBooleanValue: null,
  displayDefaultDoubleValue: null,
  ...overrides,
});

const variables: LowCodeReactionFieldVariables = buildLowCodeFieldVariables({
  sourceModelUri: 'http://families',
  sourceModelAlias: 'families',
  sourceUri: 'http://families#Member',
  sourceAlias: 'Member',
  targetModelUri: 'http://persons',
  targetModelAlias: 'persons',
  targetUri: 'http://persons#Person',
  targetAlias: 'Person',
});

describe('FieldUtils type predicates', () => {
  it('classifies string, boolean, integer, enum, and hidden fields', () => {
    expect(isStringField(field({ name: 'a', type: 'String' }))).toBe(true);
    expect(isBooleanField(field({ name: 'b', type: 'Boolean' }))).toBe(true);
    expect(isIntegerField(field({ name: 'c', type: 'Long' }))).toBe(true);
    expect(isEnumField(field({ name: 'd', type: 'String', allowableValues: ['x'] }))).toBe(true);
    expect(isHidden(field({ name: 'e', type: 'String', displayHide: true }))).toBe(true);
  });
});

describe('evaluateTemplate', () => {
  it('replaces {{placeholders}} from the variables object', () => {
    expect(evaluateTemplate('sync {{sourceAlias}} to {{targetAlias}}', variables)).toBe(
      'sync Member to Person',
    );
  });

  it('leaves unknown placeholders unchanged', () => {
    expect(evaluateTemplate('keep {{missing}}', variables)).toBe('keep {{missing}}');
  });
});

describe('evaluateTemplateWithExpressionSupport', () => {
  it('evaluates ${var}, toLowerCase, toUpperCase, and capitalizeFirst', () => {
    expect(
      evaluateTemplateWithExpressionSupport(
        '${sourceAlias}-${sourceAlias.toLowerCase()}-${targetAlias.toUpperCase()}-${capitalizeFirst(targetAlias)}',
        variables,
      ),
    ).toBe('Member-member-PERSON-Person');
  });

  it('still supports {{var}} placeholders', () => {
    expect(evaluateTemplateWithExpressionSupport('{{model1Alias}}', variables)).toBe('families');
  });
});

describe('getFieldDefaultValue / buildInitialFieldValues', () => {
  it('evaluates string defaults against connection variables', () => {
    expect(
      getFieldDefaultValue(
        field({
          name: 'reactionName',
          type: 'String',
          displayDefaultStringValue: 'create${capitalizeFirst(sourceAlias)}',
        }),
        variables,
      ),
    ).toBe('createMember');
  });

  it('skips hidden fields and overlays connection identity fields', () => {
    const values = buildInitialFieldValues(
      [
        field({ name: 'secret', type: 'String', displayHide: true, displayDefaultStringValue: 'nope' }),
        field({ name: 'model1Uri', type: 'String', displayDefaultStringValue: 'http://example/model2' }),
        field({ name: 'reactionName', type: 'String', displayDefaultStringValue: '{{sourceAlias}}' }),
      ],
      variables,
    );
    expect(values).toEqual({
      model1Uri: 'http://families',
      reactionName: 'Member',
    });
  });
});

describe('overlayConnectionFieldValues', () => {
  it('does not invent fields that are absent from the form', () => {
    expect(overlayConnectionFieldValues({ reactionName: 'x' }, variables)).toEqual({
      reactionName: 'x',
    });
  });
});

describe('validateFieldValue', () => {
  it('rejects empty required fields', () => {
    expect(
      validateFieldValue(field({ name: 'reactionName', type: 'String', required: true }), ''),
    ).toBe('reactionName is required');
  });

  it('enforces numeric min/max', () => {
    const numeric = field({ name: 'n', type: 'Integer', min: 1, max: 3 });
    expect(validateFieldValue(numeric, 0)).toBe('Value must be at least 1');
    expect(validateFieldValue(numeric, 4)).toBe('Value must be at most 3');
    expect(validateFieldValue(numeric, 2)).toBeNull();
  });

  it('enforces string length', () => {
    const str = field({ name: 's', type: 'String', lengthMin: 2, lengthMax: 4 });
    expect(validateFieldValue(str, 'a')).toBe('Minimum length is 2');
    expect(validateFieldValue(str, 'abcde')).toBe('Maximum length is 4');
    expect(validateFieldValue(str, 'ab')).toBeNull();
  });
});
