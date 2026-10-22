/**
 * Pure-logic tests for the helper functions defined inside ConstraintsView.tsx.
 *
 * Because those functions are not exported, and importing the module directly
 * would require extensive mocking of Monaco / ReactFlow / LSP dependencies,
 * the implementations are copied verbatim from the source file here.
 * This is intentional: we test the logic, not the module graph.
 *
 * Source: src/components/constraints/ConstraintsView.tsx lines 54–143
 */

// ── Types ─────────────────────────────────────────────────────────────────────

type SeverityLevel = 'INFO' | 'WARNING' | 'MINOR' | 'MAJOR' | 'CRITICAL';

// ── Helper implementations (copied verbatim from ConstraintsView.tsx) ─────────

function oclGetName(ocl: string): string {
  return ocl.match(/\binv\s+(\w+)\s*:/m)?.[1] ?? '';
}

function oclGetSeverity(ocl: string): SeverityLevel {
  const v = ocl.match(/^\s*@severity\s+(\w+)/m)?.[1]?.toUpperCase();
  return (['INFO', 'WARNING', 'MINOR', 'MAJOR', 'CRITICAL'].includes(v ?? '') ? v : 'WARNING') as SeverityLevel;
}

function oclGetMessage(ocl: string): string {
  return ocl.match(/^\s*@message\s+"([^"]*)"/m)?.[1] ?? '';
}

function oclSetName(ocl: string, name: string): string {
  const id = name.replace(/\s+/g, '');
  if (!id) return ocl;
  return /\binv\s+\w+\s*:/m.test(ocl)
    ? ocl.replace(/\binv\s+\w+\s*:/m, `inv ${id}:`)
    : ocl;
}

function oclSetSeverity(ocl: string, severity: SeverityLevel): string {
  if (/^\s*@severity\s+\w+/m.test(ocl)) {
    return ocl.replace(/^(\s*)@severity\s+\w+/m, `$1@severity ${severity}`);
  }
  return ocl.replace(/(\binv\s+\w+\s*:\n?)/m, `$1  @severity ${severity}\n`);
}

function oclSetMessage(ocl: string, message: string): string {
  const escaped = message.replace(/"/g, '\\"');
  if (/^\s*@message\s+"[^"]*"/m.test(ocl)) {
    return ocl.replace(/^(\s*)@message\s+"[^"]*"/m, `$1@message "${escaped}"`);
  }
  if (/^\s*@severity\s+\w+/m.test(ocl)) {
    return ocl.replace(/(^\s*@severity\s+\w+)/m, `$1\n  @message "${escaped}"`);
  }
  return ocl.replace(/(\binv\s+\w+\s*:\n?)/m, `$1  @message "${escaped}"\n`);
}

function oclGetContextType(ocl: string): string {
  return ocl.match(/^\s*context\s+([\w:]+)/m)?.[1] ?? '';
}

function oclSetContextType(ocl: string, contextType: string): string {
  if (/^\s*context\s+[\w:]+/m.test(ocl)) {
    return ocl.replace(/^(\s*context\s+)[\w:]+/m, `$1${contextType}`);
  }
  return `context ${contextType} inv NewInvariant:\n` + ocl;
}

function parseEcoreClasses(
  fileName: string,
  xml: string,
): { metamodel: string; className: string }[] {
  const mmName = fileName.replace(/\.ecore$/i, '');
  const results: { metamodel: string; className: string }[] = [];
  const pkgMatch = xml.match(/<(?:\w+:)?EPackage[^>]+\bname\s*=\s*"([^"]+)"/);
  const pkg = pkgMatch?.[1] ?? mmName;
  const classRe = /xsi:type="ecore:EClass"[^>]+\bname\s*=\s*"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = classRe.exec(xml)) !== null) {
    results.push({ metamodel: pkg, className: m[1] });
  }
  if (results.length === 0) {
    const alt = /eClassifiers[^>]+\bname\s*=\s*"([^"]+)"/g;
    while ((m = alt.exec(xml)) !== null) {
      results.push({ metamodel: pkg, className: m[1] });
    }
  }
  return results;
}

function oclGetScope(ocl: string): string[] {
  const matches = [...ocl.matchAll(/\b([A-Za-z][A-Za-z0-9_]*)::([A-Za-z][A-Za-z0-9_]*)/g)];
  const seen = new Set<string>();
  matches.forEach(m => seen.add(m[1]));
  return [...seen].sort();
}

// ── Test fixtures ─────────────────────────────────────────────────────────────

const FULL_OCL = [
  'context pfand::Kasten inv MyInvariant:',
  '  @severity WARNING',
  '  @message "Must be positive"',
  '  self.anzahl > 0',
].join('\n');

const MINIMAL_OCL = 'context pfand::Kasten inv Check:\n  self.value > 0';

const NO_CONTEXT_OCL = 'inv Standalone:\n  @severity CRITICAL\n  true';

// ── oclGetName ────────────────────────────────────────────────────────────────

describe('oclGetName', () => {
  it('extracts the invariant name from a full OCL string', () => {
    expect(oclGetName(FULL_OCL)).toBe('MyInvariant');
  });

  it('extracts the invariant name from a minimal OCL string', () => {
    expect(oclGetName(MINIMAL_OCL)).toBe('Check');
  });

  it('returns empty string when there is no inv keyword', () => {
    expect(oclGetName('context pfand::Kasten\n  true')).toBe('');
  });

  it('returns empty string for an empty string', () => {
    expect(oclGetName('')).toBe('');
  });

  it('is not confused by the word "inv" inside a longer word', () => {
    expect(oclGetName('context A::B invocation:\n  true')).toBe('');
  });
});

// ── oclGetSeverity ────────────────────────────────────────────────────────────

describe('oclGetSeverity', () => {
  it('extracts WARNING', () => {
    expect(oclGetSeverity(FULL_OCL)).toBe('WARNING');
  });

  it('extracts CRITICAL', () => {
    expect(oclGetSeverity(NO_CONTEXT_OCL)).toBe('CRITICAL');
  });

  it('extracts INFO', () => {
    expect(oclGetSeverity('inv X:\n  @severity INFO\n  true')).toBe('INFO');
  });

  it('extracts MINOR', () => {
    expect(oclGetSeverity('inv X:\n  @severity MINOR\n  true')).toBe('MINOR');
  });

  it('extracts MAJOR', () => {
    expect(oclGetSeverity('inv X:\n  @severity MAJOR\n  true')).toBe('MAJOR');
  });

  it('returns WARNING as default when @severity is absent', () => {
    expect(oclGetSeverity(MINIMAL_OCL)).toBe('WARNING');
  });

  it('returns WARNING for an empty string', () => {
    expect(oclGetSeverity('')).toBe('WARNING');
  });

  it('returns WARNING for an unrecognised severity value', () => {
    expect(oclGetSeverity('inv X:\n  @severity UNKNOWN\n  true')).toBe('WARNING');
  });

  it('is case-insensitive for the severity keyword value', () => {
    expect(oclGetSeverity('inv X:\n  @severity critical\n  true')).toBe('CRITICAL');
  });
});

// ── oclGetMessage ─────────────────────────────────────────────────────────────

describe('oclGetMessage', () => {
  it('extracts the message string', () => {
    expect(oclGetMessage(FULL_OCL)).toBe('Must be positive');
  });

  it('returns empty string when @message is absent', () => {
    expect(oclGetMessage(MINIMAL_OCL)).toBe('');
  });

  it('returns empty string for an empty string', () => {
    expect(oclGetMessage('')).toBe('');
  });

  it('handles an empty @message value', () => {
    expect(oclGetMessage('inv X:\n  @message ""\n  true')).toBe('');
  });

  it('preserves internal spaces', () => {
    expect(oclGetMessage('inv X:\n  @message "hello world"\n  true')).toBe('hello world');
  });
});

// ── oclSetName ────────────────────────────────────────────────────────────────

describe('oclSetName', () => {
  it('replaces an existing invariant name', () => {
    const result = oclSetName(FULL_OCL, 'NewName');
    expect(result).toContain('inv NewName:');
    expect(result).not.toContain('inv MyInvariant:');
  });

  it('strips whitespace from the supplied name', () => {
    const result = oclSetName(FULL_OCL, 'New Name');
    expect(result).toContain('inv NewName:');
  });

  it('returns the original string unchanged when the name is empty', () => {
    const result = oclSetName(FULL_OCL, '');
    expect(result).toBe(FULL_OCL);
  });

  it('returns the original string unchanged when the name is only whitespace', () => {
    const result = oclSetName(FULL_OCL, '   ');
    expect(result).toBe(FULL_OCL);
  });

  it('returns the original string unchanged when there is no inv keyword', () => {
    const ocl = 'context A::B\n  true';
    expect(oclSetName(ocl, 'X')).toBe(ocl);
  });
});

// ── oclSetSeverity ────────────────────────────────────────────────────────────

describe('oclSetSeverity', () => {
  it('replaces an existing @severity annotation', () => {
    const result = oclSetSeverity(FULL_OCL, 'CRITICAL');
    expect(result).toContain('@severity CRITICAL');
    expect(result).not.toContain('@severity WARNING');
  });

  it('inserts @severity after the inv line when annotation is absent', () => {
    const result = oclSetSeverity(MINIMAL_OCL, 'MAJOR');
    expect(result).toContain('@severity MAJOR');
  });

  it('keeps the rest of the OCL intact when replacing', () => {
    const result = oclSetSeverity(FULL_OCL, 'INFO');
    expect(result).toContain('@message "Must be positive"');
    expect(result).toContain('self.anzahl > 0');
  });

  it('preserves leading whitespace of the @severity line', () => {
    const ocl = 'inv X:\n  @severity WARNING\n  true';
    const result = oclSetSeverity(ocl, 'MINOR');
    expect(result).toContain('  @severity MINOR');
  });
});

// ── oclSetMessage ─────────────────────────────────────────────────────────────

describe('oclSetMessage', () => {
  it('replaces an existing @message annotation', () => {
    const result = oclSetMessage(FULL_OCL, 'New message');
    expect(result).toContain('@message "New message"');
    expect(result).not.toContain('@message "Must be positive"');
  });

  it('inserts @message after @severity when @message is absent but @severity exists', () => {
    const ocl = 'context A::B inv X:\n  @severity WARNING\n  true';
    const result = oclSetMessage(ocl, 'hello');
    expect(result).toContain('@message "hello"');
    const severityIdx = result.indexOf('@severity');
    const messageIdx = result.indexOf('@message');
    expect(messageIdx).toBeGreaterThan(severityIdx);
  });

  it('inserts @message after inv line when neither @severity nor @message exists', () => {
    const result = oclSetMessage(MINIMAL_OCL, 'inserted');
    expect(result).toContain('@message "inserted"');
  });

  it('escapes double-quotes in the message', () => {
    const result = oclSetMessage(FULL_OCL, 'say "hi"');
    expect(result).toContain('@message "say \\"hi\\""');
  });

  it('preserves leading whitespace of the @message line', () => {
    const ocl = 'inv X:\n  @message "old"\n  true';
    const result = oclSetMessage(ocl, 'new');
    expect(result).toContain('  @message "new"');
  });
});

// ── oclGetContextType ─────────────────────────────────────────────────────────

describe('oclGetContextType', () => {
  it('extracts a qualified context type', () => {
    expect(oclGetContextType(FULL_OCL)).toBe('pfand::Kasten');
  });

  it('extracts a simple (unqualified) context type', () => {
    expect(oclGetContextType('context Kasten inv X:\n  true')).toBe('Kasten');
  });

  it('returns empty string when context line is absent', () => {
    expect(oclGetContextType(NO_CONTEXT_OCL)).toBe('');
  });

  it('returns empty string for an empty string', () => {
    expect(oclGetContextType('')).toBe('');
  });
});

// ── oclSetContextType ─────────────────────────────────────────────────────────

describe('oclSetContextType', () => {
  it('replaces an existing context type', () => {
    const result = oclSetContextType(FULL_OCL, 'kit::Student');
    expect(result).toContain('context kit::Student');
    expect(result).not.toContain('context pfand::Kasten');
  });

  it('keeps the inv clause intact after replacement', () => {
    const result = oclSetContextType(FULL_OCL, 'kit::Student');
    expect(result).toContain('inv MyInvariant:');
  });

  it('prepends a new context line when no context is present', () => {
    const result = oclSetContextType(NO_CONTEXT_OCL, 'pfand::Flasche');
    expect(result.startsWith('context pfand::Flasche')).toBe(true);
  });

  it('still contains the original body when prepending', () => {
    const result = oclSetContextType(NO_CONTEXT_OCL, 'pfand::Flasche');
    expect(result).toContain('inv Standalone:');
  });
});

// ── parseEcoreClasses ─────────────────────────────────────────────────────────

const ECORE_XML = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<ecore:EPackage xmi:version="2.0"',
  '    xmlns:xmi="http://www.omg.org/XMI"',
  '    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
  '    xmlns:ecore="http://www.eclipse.org/emf/2002/Ecore"',
  '    name="pfand"',
  '    nsURI="http://example.com/pfand"',
  '    nsPrefix="pfand">',
  '  <eClassifiers xsi:type="ecore:EClass" name="Kasten">',
  '    <eStructuralFeatures xsi:type="ecore:EAttribute" name="anzahl"/>',
  '  </eClassifiers>',
  '  <eClassifiers xsi:type="ecore:EClass" name="Flasche">',
  '  </eClassifiers>',
  '</ecore:EPackage>',
].join('\n');

const ECORE_XML_NO_PACKAGE_NAME = [
  '<ecore:EPackage>',
  '  <eClassifiers xsi:type="ecore:EClass" name="Thing">',
  '  </eClassifiers>',
  '</ecore:EPackage>',
].join('\n');

describe('parseEcoreClasses', () => {
  it('returns one entry per EClass', () => {
    const result = parseEcoreClasses('pfand.ecore', ECORE_XML);
    expect(result).toHaveLength(2);
  });

  it('uses the package name attribute as metamodel', () => {
    const result = parseEcoreClasses('pfand.ecore', ECORE_XML);
    expect(result.every(r => r.metamodel === 'pfand')).toBe(true);
  });

  it('extracts correct class names', () => {
    const result = parseEcoreClasses('pfand.ecore', ECORE_XML);
    const names = result.map(r => r.className);
    expect(names).toContain('Kasten');
    expect(names).toContain('Flasche');
  });

  it('falls back to file name (without .ecore) when EPackage has no name attr', () => {
    const result = parseEcoreClasses('fallback.ecore', ECORE_XML_NO_PACKAGE_NAME);
    expect(result[0].metamodel).toBe('fallback');
  });

  it('strips .ecore extension case-insensitively', () => {
    const result = parseEcoreClasses('MyModel.ECORE', ECORE_XML_NO_PACKAGE_NAME);
    expect(result[0].metamodel).toBe('MyModel');
  });

  it('returns an empty array for XML without any EClass', () => {
    const xml = '<ecore:EPackage name="empty"></ecore:EPackage>';
    expect(parseEcoreClasses('empty.ecore', xml)).toHaveLength(0);
  });

  it('uses fallback eClassifiers regex when xsi:type attr appears after name', () => {
    // Attribute order: name before xsi:type — primary regex won't match
    const xml = [
      '<ecore:EPackage name="alt">',
      '  <eClassifiers name="Widget" xsi:type="ecore:EClass">',
      '  </eClassifiers>',
      '</ecore:EPackage>',
    ].join('\n');
    const result = parseEcoreClasses('alt.ecore', xml);
    expect(result).toHaveLength(1);
    expect(result[0].className).toBe('Widget');
  });
});

// ── oclGetScope ───────────────────────────────────────────────────────────────

describe('oclGetScope', () => {
  it('extracts the metamodel name from a context line', () => {
    expect(oclGetScope(FULL_OCL)).toContain('pfand');
  });

  it('returns a single-element array for a single MM::Class pattern', () => {
    expect(oclGetScope('context pfand::Kasten inv X:\n  true')).toEqual(['pfand']);
  });

  it('returns deduplicated metamodel names', () => {
    const ocl = 'context pfand::Kasten inv X:\n  pfand::Flasche.allInstances()';
    expect(oclGetScope(ocl)).toEqual(['pfand']);
  });

  it('returns multiple metamodel names sorted alphabetically', () => {
    const ocl = 'context pfand::Kasten inv X:\n  kit::Student.allInstances()';
    expect(oclGetScope(ocl)).toEqual(['kit', 'pfand']);
  });

  it('returns an empty array when no MM::Class pattern is present', () => {
    expect(oclGetScope('inv X:\n  self.value > 0')).toEqual([]);
  });

  it('returns an empty array for an empty string', () => {
    expect(oclGetScope('')).toEqual([]);
  });

  it('does not include class names, only metamodel names', () => {
    const result = oclGetScope('context pfand::Kasten inv X:\n  true');
    expect(result).not.toContain('Kasten');
  });
});
