import { describe, expect, it } from 'vitest';
import { describeBuildFailure, describeBuildSuccess } from '../../utils/buildCheckMessages';

describe('describeBuildSuccess', () => {
  it('lists the rule sets built into the VSUM', () => {
    expect(describeBuildSuccess(['Komponenten', 'Preise & Regeln'])).toBe(
      'This VSUM can be built. It includes 2 constraint rule sets: Komponenten, Preise & Regeln.',
    );
  });

  it('uses the singular for one rule set', () => {
    expect(describeBuildSuccess(['Komponenten'])).toBe(
      'This VSUM can be built. It includes 1 constraint rule set: Komponenten.',
    );
  });

  it('mentions that there are no constraints', () => {
    expect(describeBuildSuccess([])).toBe(
      'This VSUM can be built. It has no constraint rule sets.',
    );
  });

  it('falls back to the plain message when the rule sets are not known', () => {
    expect(describeBuildSuccess(undefined)).toBe('This VSUM can be built.');
    expect(describeBuildSuccess(null)).toBe('This VSUM can be built.');
  });
});

describe('describeBuildFailure', () => {
  it('explains failures caused by constraints and keeps the details', () => {
    const detail =
      'Setup-service request failed (400): Constraint file Preise.ocl refers to unknown metamodel(s) [shop]';

    expect(describeBuildFailure(detail)).toEqual({
      message:
        'The constraints could not be built. Fix the rule set in Constraints mode and check the build again.'
        + '\n\nSetup-service request failed (400): Rule set "Preise" refers to unknown metamodel(s) [shop]',
      details: detail,
      constraintRelated: true,
    });
  });

  it('shows only the reason of a setup-service error and names the rule set', () => {
    const detail =
      "Setup-service request to '/api/vsum/jar' failed with status 400 BAD_REQUEST: "
      + '{"errorCode":"VSUM_INPUT_ERROR","message":"Constraint file New Rule Set.ocl declares context(s)'
      + ' [ClassName] without metamodel; use <metamodel>::<class>","path":"/api/vsum/jar","status":400}';

    expect(describeBuildFailure(detail)).toEqual({
      message:
        'The constraints could not be built. Fix the rule set in Constraints mode and check the build again.'
        + '\n\nRule set "New Rule Set" declares context(s) [ClassName] without metamodel;'
        + ' use <metamodel>::<class>',
      details: detail,
      constraintRelated: true,
    });
  });

  it('drops the request of a setup-service error without JSON body', () => {
    const detail =
      "Setup-service request to '/api/vsum/jar' failed with status 500: could not load constraints/Preise.ocl";

    expect(describeBuildFailure(detail).message).toBe(
      'The constraints could not be built. Fix the rule set in Constraints mode and check the build again.'
      + '\n\ncould not load constraints/Preise.ocl',
    );
  });

  it('recognises unqualified context declarations', () => {
    expect(
      describeBuildFailure('Constraint file a.ocl declares context(s) [Item] without metamodel')
        .constraintRelated,
    ).toBe(true);
  });

  it('recognises OCL file names at the end of a message', () => {
    expect(describeBuildFailure('could not load constraints/Preise.ocl').constraintRelated).toBe(
      true,
    );
  });

  it('does not mistake dependencies named like OCL for constraint files', () => {
    expect(
      describeBuildFailure('Could not resolve org.eclipse.ocl:org.eclipse.ocl.pivot:jar')
        .constraintRelated,
    ).toBe(false);
  });

  it('keeps other failures unchanged', () => {
    expect(describeBuildFailure('Maven build failed with exit code 1')).toEqual({
      message: 'Maven build failed with exit code 1',
      constraintRelated: false,
    });
  });
});
