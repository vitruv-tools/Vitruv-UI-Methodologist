import {
  buildFailureFromBuildResponse,
  buildFailureFromError,
  formatBuildFailureAsText,
  formatBuildProblemLocation,
  formatHiddenFollowUpErrors,
  getBuildFailureHeadline,
  getBuildFailureKind,
  groupBuildProblems,
  isNavigableBuildProblem,
  normalizeBuildProblems,
} from '../../utils/buildProblems';
import type { BuildFailure, BuildProblem, VsumBuildResponse } from '../../types/vsumBuild';

const reactionProblem: BuildProblem = {
  source: 'REACTIONS',
  file: 'my.reactions',
  fileId: 7,
  line: 51,
  column: 30,
  message: "Couldn't resolve reference to EClass 'Foo'.",
  excerpt: '    map Foo\n        ^',
  hint: 'Check the class name in the metamodel.',
  hiddenFollowUpErrors: 2,
};

const apiError = (data: unknown, message = 'Request failed') => {
  const err = new Error(message) as Error & { response?: { data: unknown } };
  err.response = { data };
  return err;
};

describe('normalizeBuildProblems', () => {
  it('keeps valid problems and drops malformed entries', () => {
    const problems = normalizeBuildProblems([
      reactionProblem,
      null,
      'text',
      { source: 'METAMODEL' },
      { source: 'UNKNOWN', message: 'odd source', line: 0, column: -1, fileId: 'x', hiddenFollowUpErrors: 0 },
    ]);

    expect(problems).toEqual([
      reactionProblem,
      { source: 'INTERNAL', message: 'odd source' },
    ]);
  });

  it('returns an empty list for anything but an array', () => {
    expect(normalizeBuildProblems(undefined)).toEqual([]);
    expect(normalizeBuildProblems({ message: 'x' })).toEqual([]);
  });
});

describe('buildFailureFromError', () => {
  it('reads errorCode, message and problems from the error body', () => {
    const failure = buildFailureFromError(apiError({
      message: 'The uploaded reactions do not match the uploaded metamodels',
      errorCode: 'VSUM_REACTIONS_ERROR',
      problems: [reactionProblem],
    }), 'Download failed.');

    expect(failure).toEqual({
      errorCode: 'VSUM_REACTIONS_ERROR',
      message: 'The uploaded reactions do not match the uploaded metamodels',
      problems: [reactionProblem],
    });
  });

  it('works with old error bodies without the new fields', () => {
    const failure = buildFailureFromError(apiError({ message: 'Build failed' }), 'Download failed.');
    expect(failure).toEqual({ errorCode: undefined, message: 'Build failed', problems: [] });
  });

  it('falls back to the given message for errors without a body', () => {
    expect(buildFailureFromError(null, 'Download failed.').message).toBe('Download failed.');
  });
});

describe('buildFailureFromBuildResponse', () => {
  const build: VsumBuildResponse = { id: 3, vsumId: 42, status: 'RUNNING' };

  it('is null while the build has not failed', () => {
    expect(buildFailureFromBuildResponse(build)).toBeNull();
    expect(buildFailureFromBuildResponse({ ...build, status: 'SUCCEEDED' })).toBeNull();
    expect(buildFailureFromBuildResponse(null)).toBeNull();
  });

  it('carries errorCode and problems of a failed build', () => {
    expect(buildFailureFromBuildResponse({
      ...build,
      status: 'FAILED',
      errorMessage: 'The uploads do not compile',
      errorCode: 'VSUM_BUILD_FAILED',
      problems: [reactionProblem],
    })).toEqual({
      errorCode: 'VSUM_BUILD_FAILED',
      message: 'The uploads do not compile',
      problems: [reactionProblem],
    });
  });

  it('uses a fallback message for failed builds without one', () => {
    expect(buildFailureFromBuildResponse({ ...build, status: 'FAILED', errorMessage: null })).toEqual({
      errorCode: undefined,
      message: 'The build failed.',
      problems: [],
    });
  });
});

describe('getBuildFailureKind', () => {
  const failure = (errorCode: string | undefined, sources: BuildProblem['source'][]): BuildFailure => ({
    errorCode,
    message: 'x',
    problems: sources.map(source => ({ source, message: `${source} problem` })),
  });

  it.each([
    ['VSUM_BUILD_UNAVAILABLE', ['INFRASTRUCTURE'], 'unavailable'],
    ['VSUM_INTERNAL_ERROR', ['INTERNAL'], 'internal'],
    ['VSUM_REACTIONS_ERROR', ['REACTIONS'], 'models'],
    ['VSUM_METAMODEL_ERROR', ['METAMODEL'], 'models'],
    ['VSUM_BUILD_FAILED', ['REACTIONS', 'INFRASTRUCTURE'], 'models'],
    ['VSUM_BUILD_TIMEOUT', ['INFRASTRUCTURE'], 'unavailable'],
    [undefined, ['INFRASTRUCTURE'], 'unavailable'],
    [undefined, ['INTERNAL', 'INFRASTRUCTURE'], 'internal'],
    [undefined, [], 'models'],
  ] as const)('%s with %j is %s', (code, sources, kind) => {
    expect(getBuildFailureKind(failure(code, [...sources]))).toBe(kind);
  });

  it('words each kind for the user', () => {
    expect(getBuildFailureHeadline('models')).toBe('Your models need changes');
    expect(getBuildFailureHeadline('unavailable'))
      .toBe('The build environment is temporarily unavailable, please try again later');
    expect(getBuildFailureHeadline('internal'))
      .toBe('The setup service failed; this is not caused by your models');
  });
});

describe('groupBuildProblems', () => {
  it('groups by file and by source label without a file, in order of appearance', () => {
    const groups = groupBuildProblems([
      reactionProblem,
      { source: 'INFRASTRUCTURE', message: 'Maven repository not reachable' },
      { source: 'METAMODEL', file: 'families.ecore', message: 'Missing nsURI' },
      { ...reactionProblem, line: 60, message: 'Another one' },
      { source: 'INTERNAL', message: 'Unexpected failure' },
    ]);

    expect(groups.map(g => [g.label, g.isFile, g.entries.length])).toEqual([
      ['my.reactions', true, 2],
      ['Build environment', false, 1],
      ['families.ecore', true, 1],
      ['Setup service', false, 1],
    ]);
  });

  it('gives identical problems distinct keys', () => {
    const [group] = groupBuildProblems([reactionProblem, reactionProblem]);
    const keys = group.entries.map(e => e.key);
    expect(new Set(keys).size).toBe(2);
  });
});

describe('formatting', () => {
  it('formats the location', () => {
    expect(formatBuildProblemLocation(reactionProblem)).toBe('Line 51, column 30');
    expect(formatBuildProblemLocation({ source: 'METAMODEL', message: 'x', line: 3 })).toBe('Line 3');
    expect(formatBuildProblemLocation({ source: 'METAMODEL', message: 'x' })).toBe('');
  });

  it('formats the hidden follow-up count', () => {
    expect(formatHiddenFollowUpErrors(1)).toBe('1 follow-up error hidden');
    expect(formatHiddenFollowUpErrors(4)).toBe('4 follow-up errors hidden');
  });

  it('renders all problems as plain text', () => {
    const text = formatBuildFailureAsText({
      errorCode: 'VSUM_REACTIONS_ERROR',
      message: 'm',
      problems: [reactionProblem, { source: 'INFRASTRUCTURE', message: 'Offline' }],
    });

    expect(text).toBe([
      'Your models need changes',
      '',
      'my.reactions:',
      "- Line 51, column 30: Couldn't resolve reference to EClass 'Foo'.",
      '    map Foo\n        ^',
      '  Hint: Check the class name in the metamodel.',
      '  (2 follow-up errors hidden)',
      '',
      'Build environment:',
      '- Offline',
    ].join('\n'));
  });

  it('uses the message as text without problems', () => {
    expect(formatBuildFailureAsText({ message: 'Build failed', problems: [] })).toBe('Build failed');
  });
});

describe('isNavigableBuildProblem', () => {
  it('needs a file id and a reaction or metamodel file', () => {
    expect(isNavigableBuildProblem(reactionProblem)).toBe(true);
    expect(isNavigableBuildProblem({ source: 'METAMODEL', fileId: 3, message: 'x' })).toBe(true);
    expect(isNavigableBuildProblem({ source: 'VIEWS', file: 'a.genmodel', fileId: 3, message: 'x' })).toBe(true);
    expect(isNavigableBuildProblem({ ...reactionProblem, fileId: undefined })).toBe(false);
    expect(isNavigableBuildProblem({ source: 'CONSTRAINTS', file: 'c.ocl', fileId: 3, message: 'x' })).toBe(false);
  });
});
