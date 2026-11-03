import { UTILITY_CLASS_IMPORT, ensureUtilityImport, hasUtilityImport } from '../../utils/reactionImports';

const IMPORT = `import ${UTILITY_CLASS_IMPORT}`;

describe('ensureUtilityImport', () => {
  it('adds the import after the existing Java imports', () => {
    const code = 'import java.io.File;\n\nimport "u1" as a\n\nreactions: x\n';

    expect(ensureUtilityImport(code)).toBe(`import java.io.File;\n${IMPORT}\n\nimport "u1" as a\n\nreactions: x\n`);
  });

  it('adds the import before the first metamodel import when there are no Java imports', () => {
    expect(ensureUtilityImport('\nimport "u1" as a\nimport "u2" as b\n'))
      .toBe(`\n${IMPORT}\n\nimport "u1" as a\nimport "u2" as b\n`);
  });

  it('keeps leading comments above the import', () => {
    expect(ensureUtilityImport('// header\n/* more\n   header */\nreactions: x\n'))
      .toBe(`// header\n/* more\n   header */\n${IMPORT}\n\nreactions: x\n`);
  });

  it('adds the import at the top when the file has no header end', () => {
    expect(ensureUtilityImport('// only a comment\n')).toBe(`${IMPORT}\n\n// only a comment\n`);
  });

  it('leaves an empty file alone', () => {
    expect(ensureUtilityImport('')).toBe('');
  });

  it.each([
    IMPORT,
    `${IMPORT};`,
    'import tools.vitruv.methodologisttemplate.consistency.utils.*',
    `import static ${UTILITY_CLASS_IMPORT}.*`,
    `import static ${UTILITY_CLASS_IMPORT}.getAllSubSystems;`,
  ])('returns the same string when the file already has %s', existing => {
    const code = `import java.util.List\n${existing}\n\nimport "u1" as a\n`;

    expect(ensureUtilityImport(code)).toBe(code);
    expect(hasUtilityImport(code)).toBe(true);
  });

  it('does not count an import inside a comment', () => {
    const code = `/*\n${IMPORT}\n*/\nimport "u1" as a\n`;

    expect(hasUtilityImport(code)).toBe(false);
    expect(ensureUtilityImport(code)).toBe(`/*\n${IMPORT}\n*/\n${IMPORT}\n\nimport "u1" as a\n`);
  });

  it('does not count an import of another Utility class', () => {
    expect(hasUtilityImport('import other.Utility\nreactions: x')).toBe(false);
    expect(hasUtilityImport(`import static ${UTILITY_CLASS_IMPORT}Other.*\nreactions: x`)).toBe(false);
  });

  it('ignores imports after the header', () => {
    const code = `reactions: x\n${IMPORT}\n`;

    expect(ensureUtilityImport(code)).toBe(`${IMPORT}\n\nreactions: x\n${IMPORT}\n`);
  });

  it('keeps Windows line endings', () => {
    expect(ensureUtilityImport('import "u1" as a\r\nreactions: x\r\n'))
      .toBe(`${IMPORT}\r\n\r\nimport "u1" as a\r\nreactions: x\r\n`);
  });

  it('changes nothing but the inserted line', () => {
    const code = 'import java.io.File;\n\n\timport "u1" as a   \n\nreactions: x\nin reaction to changes in a\n';

    const result = ensureUtilityImport(code);

    expect(result.replace(`${IMPORT}\n`, '')).toBe(code);
  });
});
