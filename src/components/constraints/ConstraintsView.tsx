import React, { useState, useCallback, useRef, useMemo, useEffect, MouseEvent as ReactMouseEvent } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { Node } from 'reactflow';
import { cardColor } from '../flow/EcoreFileBox';
import { APP_FONT } from '../ui/sharedStyles';
import { apiService } from '../../services/api';
import { CodeEditorModal } from '../flow/CodeEditorModal';
import { useOclLsp } from '../../hooks/useOclLsp';
import {
  vitruvOCLLanguageId,
  vitruvOCLMonarch,
  vitruvOCLLanguageConfig,
  vitruvOCLTheme,
} from './VitruvOCLMonarchGrammar';

const handleVitruvOCLMount: OnMount = (_editor, monacoInstance) => {
  monacoInstance.languages.register({ id: vitruvOCLLanguageId, extensions: ['.ocl'], aliases: ['VitruvOCL'] });
  monacoInstance.languages.setLanguageConfiguration(vitruvOCLLanguageId, vitruvOCLLanguageConfig);
  monacoInstance.languages.setMonarchTokensProvider(vitruvOCLLanguageId, vitruvOCLMonarch);
  monacoInstance.editor.defineTheme('vitruvocl-theme', vitruvOCLTheme);
  monacoInstance.editor.setTheme('vitruvocl-theme');
};


// ── Types ────────────────────────────────────────────────────────────────────

export type RuleType = 'Cross-Metamodel' | 'Single-Metamodel';
export type ComplexityLevel = 'Low' | 'Medium' | 'High';
export type SeverityLevel = 'INFO' | 'WARNING' | 'MINOR' | 'MAJOR' | 'CRITICAL';

export interface ConstraintRule {
  id: string;
  name: string;
  description: string;
  severity: SeverityLevel;
  ruleSetId: string;
  oclDefinition: string;
  scope: string[];
  type: RuleType;
  createdAt: string;
  modifiedAt: string;
  invariantCount?: number;
  contextCount?: number;
  linesOfCode?: number;
  linkedReactions?: number;
}

// ── OCL sync helpers ──────────────────────────────────────────────────────────

// Extracts the inv identifier (no spaces) from OCL text.
function oclGetName(ocl: string): string {
  return /\binv[ \t]+(\w+)[ \t]*:/m.exec(ocl)?.[1] ?? '';
}

// Extracts @severity value; falls back to WARNING.
function oclGetSeverity(ocl: string): SeverityLevel {
  const v = /^[ \t]*@severity[ \t]+(\w+)/m.exec(ocl)?.[1]?.toUpperCase();
  return (['INFO', 'WARNING', 'MINOR', 'MAJOR', 'CRITICAL'].includes(v ?? '') ? v : 'WARNING') as SeverityLevel;
}

// Extracts the @message string.
function oclGetMessage(ocl: string): string {
  return /^[ \t]*@message[ \t]+"([^"]*)"/m.exec(ocl)?.[1] ?? '';
}

// Replaces the inv identifier in-place.
function oclSetName(ocl: string, name: string): string {
  const id = name.replace(/[ \t]+/g, '');
  if (!id) return ocl;
  return /\binv[ \t]+\w+[ \t]*:/m.test(ocl)
    ? ocl.replace(/\binv[ \t]+\w+[ \t]*:/m, `inv ${id}:`)
    : ocl;
}

// Replaces or inserts @severity.
function oclSetSeverity(ocl: string, severity: SeverityLevel): string {
  if (/^[ \t]*@severity[ \t]+\w+/m.test(ocl)) {
    return ocl.replace(/^([ \t]*)@severity[ \t]+\w+/m, `$1@severity ${severity}`);
  }
  // insert right after `inv X:` line
  return ocl.replace(/(\binv[ \t]+\w+[ \t]*:\n?)/m, `$1  @severity ${severity}\n`);
}

// Replaces or inserts @message.
function oclSetMessage(ocl: string, message: string): string {
  const escaped = message.replaceAll('"', String.raw`\"`);
  if (/^[ \t]*@message[ \t]+"[^"]*"/m.test(ocl)) {
    return ocl.replace(/^([ \t]*)@message[ \t]+"[^"]*"/m, `$1@message "${escaped}"`);
  }
  // insert after @severity or after inv line
  if (/^[ \t]*@severity[ \t]+\w+/m.test(ocl)) {
    return ocl.replace(/(^[ \t]*@severity[ \t]+\w+)/m, `$1\n  @message "${escaped}"`);
  }
  return ocl.replace(/(\binv[ \t]+\w+[ \t]*:\n?)/m, `$1  @message "${escaped}"\n`);
}

// Extracts the context type (e.g. "MM::ClassName") from the first context line.
function oclGetContextType(ocl: string): string {
  return /^[ \t]*context[ \t]+([\w:]+)/m.exec(ocl)?.[1] ?? '';
}

// Replaces the context type in the first context line.
function oclSetContextType(ocl: string, contextType: string): string {
  if (/^[ \t]*context[ \t]+[\w:]+/m.test(ocl)) {
    return ocl.replace(/^([ \t]*context[ \t]+)[\w:]+/m, `$1${contextType}`);
  }
  return `context ${contextType} inv NewInvariant:\n` + ocl;
}

// Parses EClass entries from an ecore XML string.
// Returns [{ metamodel: string, className: string }]
function parseEcoreClasses(fileName: string, xml: string): { metamodel: string; className: string }[] {
  const mmName = fileName.replace(/\.ecore$/i, '');
  const results: { metamodel: string; className: string }[] = [];
  // Package name from nsPrefix or name attribute on root EPackage
  const pkgMatch = /<(?:\w+:)?EPackage[^>]+\bname[ \t]*=[ \t]*"([^"]+)"/.exec(xml);
  const pkg = pkgMatch?.[1] ?? mmName;
  // All EClass entries (may be nested sub-packages)
  const classRe = /xsi:type="ecore:EClass"[^>]+\bname[ \t]*=[ \t]*"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = classRe.exec(xml)) !== null) {
    results.push({ metamodel: pkg, className: m[1] });
  }
  // Fallback: <eClassifiers ... name="X" (without xsi:type attr visible before name)
  if (results.length === 0) {
    const alt = /eClassifiers[^>]+\bname[ \t]*=[ \t]*"([^"]+)"/g;
    while ((m = alt.exec(xml)) !== null) {
      results.push({ metamodel: pkg, className: m[1] });
    }
  }
  return results;
}

// Extracts unique metamodel names from all MM::Class patterns in the OCL.
function oclGetScope(ocl: string): string[] {
  const matches = [...ocl.matchAll(/\b([A-Za-z]\w*)::([A-Za-z]\w*)/g)];
  const seen = new Set<string>();
  matches.forEach(m => seen.add(m[1]));
  return [...seen].sort((a, b) => a.localeCompare(b));
}

// ── McCabe's Cyclomatic Complexity ────────────────────────────────────────────
// CC = decision points + 1.  Decision points in OCL: boolean connectives
// (and, or, implies, xor), if-expressions, and collection iterators that
// introduce a predicate (forAll, exists, select, reject, any, one).
// Thresholds: McCabe (1976) — 1–10 simple, 11–20 moderate, 21–50 high, >50 untestable.

function computeCC(ocl: string): number {
  const body = ocl.split('\n')
    .filter(l => { const t = l.trim(); return t !== '' && !t.startsWith('context ') && !t.startsWith('inv ') && !t.startsWith('@'); })
    .join('\n');
  const s = body.replace(/"[^"]*"/g, '""'); // strip string literals
  let decisions = 0;
  decisions += (s.match(/\b(?:and|or|implies|xor)\b/g)?.length ?? 0);
  decisions += (s.match(/\bif\b/g)?.length ?? 0);
  decisions += (s.match(/->(?:forAll|exists|select|reject|any|one)\s*\(/g)?.length ?? 0);
  return decisions + 1;
}

function ccLabel(val: number): string {
  if (val <= 10) return 'Low';
  if (val <= 20) return 'Moderate';
  if (val <= 50) return 'High';
  return 'Very High';
}


export interface RuleSet {
  id: string;
  backendId?: number;       // backend DB id, present after first save
  name: string;
  color: string;
  description: string;
  rules: ConstraintRule[];
  collapsed: boolean;
}

// ── Default data ─────────────────────────────────────────────────────────────

function defaultRule(
  id: string,
  name: string,
  severity: ConstraintRule['severity'],
  description: string,
  ruleSetId: string,
  oclDefinition: string,
  linesOfCode: number,
): ConstraintRule {
  return {
    id, name, severity, description, ruleSetId, oclDefinition,
    scope: [], type: 'Single-Metamodel',
    createdAt: 'Jun 12, 2026', modifiedAt: 'Jun 12, 2026',
    invariantCount: 1, contextCount: 1, linesOfCode, linkedReactions: 0,
  };
}

const PFAND_RULE_SETS: RuleSet[] = [
  {
    id: 'crate-rules', name: 'Crate Rules', color: '#3b82f6', description: '', collapsed: false,
    rules: [
      defaultRule('p1', 'CrateContainsExactly16Bottles', 'CRITICAL',
        'A crate must always contain exactly 16 bottles.', 'crate-rules',
        'context pfand::Kasten inv CrateContainsExactly16Bottles:\n  @severity CRITICAL\n  @message "A crate must contain exactly 16 bottles."\n  self.enthält->size() = 16', 5),
      defaultRule('p2', 'CrateBottlesAreUnique', 'MAJOR',
        'All bottles inside a crate must be distinct — no duplicates allowed.', 'crate-rules',
        'context pfand::Kasten inv CrateBottlesAreUnique:\n  @severity MAJOR\n  @message "All bottles in a crate must be unique."\n  self.enthält->isUnique(f | f)', 5),
    ],
  },
  {
    id: 'deposit-item-rules', name: 'Deposit Item Rules', color: '#10b981', description: '', collapsed: false,
    rules: [
      defaultRule('p3', 'DepositItemNotEmpty', 'WARNING',
        'A deposit item must reference at least one element (can, crate, or bottle).', 'deposit-item-rules',
        'context pfand::Pfandelement inv DepositItemNotEmpty:\n  @severity WARNING\n  @message "A deposit item must contain at least one element (can, crate, or bottle)."\n  self.isPfandelement1 != null or self.isPfandelement2 != null or self.isPfandelement3 != null', 5),
      defaultRule('p4', 'DepositItemHasExactlyOneType', 'MAJOR',
        'A deposit item must reference exactly one type — can, crate, or bottle, never multiple at once.', 'deposit-item-rules',
        'context pfand::Pfandelement inv DepositItemHasExactlyOneType:\n  @severity MAJOR\n  @message "A deposit item must contain exactly one type (can, crate, or bottle)."\n  let count =\n    (if self.isPfandelement1 != null then 1 else 0 endif)\n    + (if self.isPfandelement2 != null then 1 else 0 endif)\n    + (if self.isPfandelement3 != null then 1 else 0 endif)\n  in count = 1', 9),
      defaultRule('p5', 'DepositItemCrateIsFull', 'MAJOR',
        'When a deposit item contains a crate, that crate must hold exactly 16 bottles.', 'deposit-item-rules',
        'context pfand::Pfandelement inv DepositItemCrateIsFull:\n  @severity MAJOR\n  @message "A deposit item\'s crate must contain exactly 16 bottles."\n  self.isPfandelement2 != null implies self.isPfandelement2.enthält->size() = 16', 5),
    ],
  },
];

const KIT_RULE_SETS: RuleSet[] = [
  {
    id: 'professor-rules', name: 'Professor Rules', color: '#3b82f6', description: '', collapsed: false,
    rules: [
      defaultRule('k1', 'ProfessorHoldsAtLeastOneLecture', 'MAJOR',
        'A professor must hold at least one lecture.', 'professor-rules',
        'context kit::professor inv ProfessorHoldsAtLeastOneLecture:\n  @severity MAJOR\n  @message "A professor must hold at least one lecture."\n  self.holds->size() >= 1', 4),
      defaultRule('k2', 'ProfessorCreatesAtLeastOneExam', 'MAJOR',
        'A professor must create at least one exam.', 'professor-rules',
        'context kit::professor inv ProfessorCreatesAtLeastOneExam:\n  @severity MAJOR\n  @message "A professor must create at least one exam."\n  self.creates->size() >= 1', 4),
    ],
  },
  {
    id: 'student-lecture-rules', name: 'Student & Lecture Rules', color: '#f59e0b', description: '', collapsed: false,
    rules: [
      defaultRule('k3', 'StudentAttendsAtLeastOneLecture', 'WARNING',
        'A student must attend at least one lecture.', 'student-lecture-rules',
        'context kit::student inv StudentAttendsAtLeastOneLecture:\n  @severity WARNING\n  @message "A student must attend at least one lecture."\n  self.attends->size() >= 1', 4),
      defaultRule('k4', 'StudentAttendsAtMostSixLectures', 'WARNING',
        'A student may not attend more than six lectures.', 'student-lecture-rules',
        'context kit::student inv StudentAttendsAtMostSixLectures:\n  @severity WARNING\n  @message "A student may not attend more than six lectures."\n  self.attends->size() <= 6', 4),
      defaultRule('k5', 'LectureHasExam', 'CRITICAL',
        'Every lecture must have an associated exam.', 'student-lecture-rules',
        'context kit::lecture inv LectureHasExam:\n  @severity CRITICAL\n  @message "Every lecture must have an associated exam."\n  self.asAN != null', 4),
    ],
  },
];

/** Splits combined OCL file content into individual ConstraintRule objects. */
function parseRulesFromOcl(oclContent: string, ruleSetId: string): ConstraintRule[] {
  const blocks = oclContent.split(/^(?=context[ \t])/m).map(b => b.trim()).filter(Boolean);
  return blocks.map((ocl, i) => ({
    id: `r_${ruleSetId}_${i}_${Date.now()}`,
    ruleSetId,
    name: oclGetName(ocl) || `Rule${i + 1}`,
    severity: oclGetSeverity(ocl),
    description: oclGetMessage(ocl) || '',
    oclDefinition: ocl,
    scope: oclGetScope(ocl),
    type: oclGetScope(ocl).length >= 2 ? 'Cross-Metamodel' : 'Single-Metamodel',
    createdAt: '', modifiedAt: '',
    invariantCount: 1, contextCount: 1,
    linesOfCode: ocl.split('\n').length,
    linkedReactions: 0,
  }));
}

/** Serializes all rules in a RuleSet to a single .ocl file string. */
function ruleSetToOcl(ruleSet: RuleSet): string {
  return ruleSet.rules.map(r => r.oclDefinition).join('\n\n');
}

/** Returns project-specific default rule sets based on which metamodels are present on the canvas. */
function getDefaultRuleSets(canvasNodes: Node[]): RuleSet[] {
  const domains = new Set(canvasNodes.map(n => (n.data?.domain ?? '').toLowerCase()));
  const files = new Set(canvasNodes.map(n => (n.data?.fileName ?? '').toLowerCase()));
  if (domains.has('pfand') || files.has('pfandmodel.ecore')) return PFAND_RULE_SETS;
  if (domains.has('kit') || files.has('kit.ecore')) return KIT_RULE_SETS;
  return [];
}


// ── Color helpers ─────────────────────────────────────────────────────────────

const removeExt = (name: string) => name.replace(/\.ecore$/i, '');

/** Builds metamodel-name → box-background-color from the live canvas nodes. */
function buildMetamodelColorMap(canvasNodes: Node[]): Record<string, string> {
  const map: Record<string, string> = {};
  canvasNodes.forEach(n => {
    if (n.type !== 'ecoreFile') return;
    const name = removeExt(n.data?.fileName ?? '').toLowerCase();
    if (name) map[name] = cardColor(n.data?.domain);
  });
  return map;
}

/** Builds sorted list of MetaClass entries from ecoreFile canvas nodes. */
function buildMetaClasses(canvasNodes: Node[]): MetaClass[] {
  const list: MetaClass[] = [];
  canvasNodes.forEach(n => {
    if (n.type !== 'ecoreFile') return;
    const fileName: string = n.data?.fileName ?? '';
    const xml: string = n.data?.fileContent ?? '';
    if (!xml) return;
    parseEcoreClasses(fileName, xml).forEach(({ metamodel, className }) => {
      list.push({ metamodel, className, label: `${metamodel}::${className}` });
    });
  });
  list.sort((a, b) => a.metamodel.localeCompare(b.metamodel) || a.className.localeCompare(b.className));
  return list;
}

/** Returns the box color for a scope entry, falling back to a hash-based color. */
function scopeBg(name: string, colorMap: Record<string, string>): string {
  return colorMap[name.toLowerCase()] ?? cardColor(name);
}

/** Lightens a hex color for use as chip text (darken the bg, use it as border/text accent). */
function darkenHex(hex: string, amt = 60): string {
  try {
    const r = Math.max(0, Number.parseInt(hex.slice(1, 3), 16) - amt);
    const g = Math.max(0, Number.parseInt(hex.slice(3, 5), 16) - amt);
    const b = Math.max(0, Number.parseInt(hex.slice(5, 7), 16) - amt);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  } catch { return '#334155'; }
}

// ── Resizable panel hook ──────────────────────────────────────────────────────

const EDITOR_PANEL_MIN_H = 140;
const EDITOR_PANEL_MAX_H = 600;
const EDITOR_PANEL_DEFAULT_H = 280;
const EDITOR_PANEL_STORAGE_KEY = 'constraintEditorPanelHeight';

function useResizablePanel() {
  const stored = Number.parseInt(localStorage.getItem(EDITOR_PANEL_STORAGE_KEY) ?? '', 10);
  const [height, setHeight] = useState<number>(
    Number.isNaN(stored) ? EDITOR_PANEL_DEFAULT_H : Math.min(Math.max(stored, EDITOR_PANEL_MIN_H), EDITOR_PANEL_MAX_H)
  );
  const dragging = useRef(false);
  const startY = useRef(0);
  const startH = useRef(0);

  const onHandleMouseDown = useCallback((e: ReactMouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startY.current = e.clientY;
    startH.current = height;

    const onMove = (ev: globalThis.MouseEvent) => {
      if (!dragging.current) return;
      const delta = startY.current - ev.clientY; // drag up → positive → bigger panel
      const next = Math.min(Math.max(startH.current + delta, EDITOR_PANEL_MIN_H), EDITOR_PANEL_MAX_H);
      setHeight(next);
    };

    const onUp = (ev: globalThis.MouseEvent) => {
      dragging.current = false;
      const delta = startY.current - ev.clientY;
      const next = Math.min(Math.max(startH.current + delta, EDITOR_PANEL_MIN_H), EDITOR_PANEL_MAX_H);
      localStorage.setItem(EDITOR_PANEL_STORAGE_KEY, String(next));
      (globalThis as unknown as Window).removeEventListener('mousemove', onMove);
      (globalThis as unknown as Window).removeEventListener('mouseup', onUp);
    };

    (globalThis as unknown as Window).addEventListener('mousemove', onMove);
    (globalThis as unknown as Window).addEventListener('mouseup', onUp);
  }, [height]);

  return { height, onHandleMouseDown };
}

// ── Resizable editor columns ──────────────────────────────────────────────────

const EDITOR_LEFT_DEFAULT_W = 280;
const EDITOR_RIGHT_DEFAULT_W = 220;
const EDITOR_LEFT_MIN_W = 180;
const EDITOR_LEFT_MAX_W = 520;
const EDITOR_RIGHT_MIN_W = 160;
const EDITOR_RIGHT_MAX_W = 420;
const EDITOR_CENTER_MIN_W = 200;
const EDITOR_COLS_STORAGE_KEY = 'constraintEditorPanelColumns';

function clampWidth(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function readStoredColumnWidths(): { left: number; right: number } {
  try {
    const raw = localStorage.getItem(EDITOR_COLS_STORAGE_KEY);
    if (!raw) return { left: EDITOR_LEFT_DEFAULT_W, right: EDITOR_RIGHT_DEFAULT_W };
    const parsed = JSON.parse(raw) as { left?: unknown; right?: unknown };
    const left = typeof parsed.left === 'number' ? parsed.left : EDITOR_LEFT_DEFAULT_W;
    const right = typeof parsed.right === 'number' ? parsed.right : EDITOR_RIGHT_DEFAULT_W;
    return {
      left: clampWidth(left, EDITOR_LEFT_MIN_W, EDITOR_LEFT_MAX_W),
      right: clampWidth(right, EDITOR_RIGHT_MIN_W, EDITOR_RIGHT_MAX_W),
    };
  } catch {
    return { left: EDITOR_LEFT_DEFAULT_W, right: EDITOR_RIGHT_DEFAULT_W };
  }
}

function useResizableColumns() {
  const initial = readStoredColumnWidths();
  const [leftWidth, setLeftWidth] = useState(initial.left);
  const [rightWidth, setRightWidth] = useState(initial.right);
  const bodyRef = useRef<HTMLDivElement>(null);
  const leftWidthRef = useRef(leftWidth);
  const rightWidthRef = useRef(rightWidth);
  leftWidthRef.current = leftWidth;
  rightWidthRef.current = rightWidth;

  const persist = useCallback((left: number, right: number) => {
    localStorage.setItem(EDITOR_COLS_STORAGE_KEY, JSON.stringify({ left, right }));
  }, []);

  const makeColumnHandle = useCallback((side: 'left' | 'right') => (e: ReactMouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = side === 'left' ? leftWidthRef.current : rightWidthRef.current;
    let latestLeft = leftWidthRef.current;
    let latestRight = rightWidthRef.current;

    const onMove = (ev: globalThis.MouseEvent) => {
      const containerW = bodyRef.current?.clientWidth ?? Number.POSITIVE_INFINITY;
      if (side === 'left') {
        const delta = ev.clientX - startX;
        const maxForCenter = containerW - rightWidthRef.current - EDITOR_CENTER_MIN_W;
        const next = clampWidth(startW + delta, EDITOR_LEFT_MIN_W, Math.min(EDITOR_LEFT_MAX_W, maxForCenter));
        latestLeft = next;
        setLeftWidth(next);
      } else {
        const delta = startX - ev.clientX; // drag left → wider right panel
        const maxForCenter = containerW - leftWidthRef.current - EDITOR_CENTER_MIN_W;
        const next = clampWidth(startW + delta, EDITOR_RIGHT_MIN_W, Math.min(EDITOR_RIGHT_MAX_W, maxForCenter));
        latestRight = next;
        setRightWidth(next);
      }
    };

    const onUp = () => {
      persist(latestLeft, latestRight);
      (globalThis as unknown as Window).removeEventListener('mousemove', onMove);
      (globalThis as unknown as Window).removeEventListener('mouseup', onUp);
    };

    (globalThis as unknown as Window).addEventListener('mousemove', onMove);
    (globalThis as unknown as Window).addEventListener('mouseup', onUp);
  }, [persist]);

  const onLeftHandleMouseDown = useMemo(() => makeColumnHandle('left'), [makeColumnHandle]);
  const onRightHandleMouseDown = useMemo(() => makeColumnHandle('right'), [makeColumnHandle]);

  return { leftWidth, rightWidth, bodyRef, onLeftHandleMouseDown, onRightHandleMouseDown };
}

const ColumnResizeHandle: React.FC<{
  ariaLabel: string;
  ariaValueNow: number;
  ariaValueMin: number;
  ariaValueMax: number;
  onMouseDown: (e: ReactMouseEvent) => void;
}> = ({ ariaLabel, ariaValueNow, ariaValueMin, ariaValueMax, onMouseDown }) => (
  <div
    role="slider"
    aria-label={ariaLabel}
    aria-orientation="horizontal"
    aria-valuenow={ariaValueNow}
    aria-valuemin={ariaValueMin}
    aria-valuemax={ariaValueMax}
    tabIndex={0}
    onMouseDown={onMouseDown}
    onKeyDown={() => { /* keyboard resize not implemented */ }}
    style={{
      width: 6, flexShrink: 0, cursor: 'ew-resize', zIndex: 5,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f1f5f9', transition: 'background 0.15s',
    }}
    onMouseEnter={e => {
      e.currentTarget.style.background = '#ccfbf1';
      const grip = e.currentTarget.querySelector('[data-grip]') as HTMLElement | null;
      if (grip) grip.style.background = '#049484';
    }}
    onMouseLeave={e => {
      e.currentTarget.style.background = '#f1f5f9';
      const grip = e.currentTarget.querySelector('[data-grip]') as HTMLElement | null;
      if (grip) grip.style.background = '#cbd5e1';
    }}
  >
    <div
      data-grip
      style={{ width: 3, height: 28, borderRadius: 2, background: '#cbd5e1', transition: 'background 0.15s' }}
    />
  </div>
);

// ── RuleSet update helpers ────────────────────────────────────────────────────

function replaceRule(ruleSets: RuleSet[], updated: ConstraintRule): RuleSet[] {
  return ruleSets.map(rs => ({ ...rs, rules: rs.rules.map(r => r.id === updated.id ? updated : r) }));
}

function deleteRuleFromSets(ruleSets: RuleSet[], ruleId: string): RuleSet[] {
  return ruleSets.map(rs => ({ ...rs, rules: rs.rules.filter(r => r.id !== ruleId) }));
}

function findSetContainingRule(ruleSets: RuleSet[], ruleId: string): RuleSet | undefined {
  return ruleSets.find(rs => rs.rules.some(r => r.id === ruleId));
}

function updateBackendId(prev: RuleSet[], rsId: string, backendId: number): RuleSet[] {
  return prev.map(r => r.id === rsId ? { ...r, backendId } : r);
}

// ── Sub-components ────────────────────────────────────────────────────────────

const RuleRow: React.FC<{ rule: ConstraintRule; selected: boolean; onClick: () => void; onDelete: () => void }> = ({ rule, selected, onClick, onDelete }) => {
  const [hov, setHov] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as globalThis.Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  let rowBackground: string;
  if (selected) { rowBackground = '#f0fdf9'; }
  else if (hov) { rowBackground = '#f8fafc'; }
  else { rowBackground = 'transparent'; }

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: 'relative',
        background: rowBackground,
        borderLeft: selected ? '2px solid #049484' : '2px solid transparent',
        transition: 'background 0.1s',
      }}
    >
      <button type="button"
        onClick={onClick}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: '7px 40px 7px 28px',
          background: 'transparent', border: 'none', cursor: 'pointer',
          textAlign: 'left', borderRadius: 0,
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={selected ? '#049484' : '#94a3b8'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/>
        </svg>
        <span style={{ fontSize: 12.5, color: selected ? '#049484' : '#334155', fontWeight: selected ? 600 : 400, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {rule.name}
        </span>
      </button>
      <div ref={menuRef} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
        <button type="button"
          onClick={e => { e.stopPropagation(); setMenuOpen(o => !o); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#94a3b8', borderRadius: 4, display: 'flex', alignItems: 'center' }}
          title="Options"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
        </button>
        {menuOpen && (
          <div
            tabIndex={-1}
            onClick={e => e.stopPropagation()}
            onKeyDown={e => e.stopPropagation()}
            style={{
              position: 'absolute', right: 0, top: '100%', zIndex: 50,
              background: '#ffffff', border: '1px solid #e2e8f0',
              borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              minWidth: 140, padding: '4px 0',
            }}
          >
            <button type="button"
              onClick={() => { setMenuOpen(false); onDelete(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '8px 14px', background: 'none', border: 'none',
                cursor: 'pointer', fontSize: 13, color: '#dc2626', textAlign: 'left',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6"/><path d="M10,11v6"/><path d="M14,11v6"/><path d="M9,6V4a1,1,0,0,1,1-1h4a1,1,0,0,1,1,1v2"/>
              </svg>
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

interface RuleSetSectionProps {
  ruleSet: RuleSet;
  selectedRuleId: string | null;
  selectedRuleSetId: string | null;
  onRuleClick: (rule: ConstraintRule) => void;
  onRuleSetClick: (ruleSet: RuleSet) => void;
  onToggleCollapse: (id: string) => void;
  onAddRule: (ruleSetId: string) => void;
  onDeleteRule: (ruleId: string) => void;
}

const RuleSetSection: React.FC<RuleSetSectionProps> = ({ ruleSet, selectedRuleId, selectedRuleSetId, onRuleClick, onRuleSetClick, onToggleCollapse, onAddRule, onDeleteRule }) => {
  const [hov, setHov] = useState(false);
  const isSelected = selectedRuleSetId === ruleSet.id;
  let headerBackground: string;
  if (isSelected) { headerBackground = '#f0fdf9'; }
  else if (hov) { headerBackground = '#f8fafc'; }
  else { headerBackground = 'transparent'; }
  return (
    <div>
      <div
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          display: 'flex', alignItems: 'center',
          background: headerBackground,
          borderLeft: isSelected ? `2px solid ${ruleSet.color}` : '2px solid transparent',
          borderBottom: '1px solid #f1f5f9',
        }}
      >
        <button type="button"
          onClick={() => onRuleSetClick(ruleSet)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, flex: 1,
            padding: '8px 4px 8px 12px', background: 'none', border: 'none',
            cursor: 'pointer', userSelect: 'none', textAlign: 'left',
          }}
        >
          <div style={{ width: 10, height: 10, borderRadius: 2, background: ruleSet.color, flexShrink: 0 }} />
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#1e293b', flex: 1 }}>{ruleSet.name}</span>
          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>{ruleSet.rules.length} rules</span>
        </button>
        <button type="button"
          onClick={() => onToggleCollapse(ruleSet.id)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px 12px 8px 4px', display: 'flex', alignItems: 'center' }}
        >
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"
            style={{ transform: ruleSet.collapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', flexShrink: 0 }}
          >
            <polyline points="6,9 12,15 18,9"/>
          </svg>
        </button>
      </div>
      {!ruleSet.collapsed && (
        <div>
          {ruleSet.rules.map(rule => (
            <RuleRow key={rule.id} rule={rule} selected={selectedRuleId === rule.id} onClick={() => onRuleClick(rule)} onDelete={() => onDeleteRule(rule.id)} />
          ))}
          <button type="button"
            onClick={() => onAddRule(ruleSet.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px 6px 28px', cursor: 'pointer', color: '#94a3b8', fontSize: 12, background: 'none', border: 'none', width: '100%', textAlign: 'left' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#049484')}
            onMouseLeave={e => (e.currentTarget.style.color = '#94a3b8')}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add rule
          </button>
        </div>
      )}
    </div>
  );
};

// ── MetamodelBar ──────────────────────────────────────────────────────────────

const MetamodelBar: React.FC<{ label: string; count: number; max: number; colorMap: Record<string, string> }> = ({ label, count, max, colorMap }) => {
  const bg = scopeBg(label, colorMap);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <span style={{ fontSize: 11.5, color: '#64748b', width: 90, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(count / max) * 100}%`, background: bg, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 11, color: '#94a3b8', width: 18, textAlign: 'right' }}>{count}</span>
    </div>
  );
};

// ── InsightCard ───────────────────────────────────────────────────────────────

const InsightCard: React.FC<{ label: string; value: string | number; sub?: React.ReactNode; wide?: boolean }> = ({ label, value, sub, wide }) => (
  <div style={{
    background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9',
    padding: '12px 14px',
    gridColumn: wide ? 'span 2' : undefined,
    minWidth: 0,
  }}>
    <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: typeof value === 'number' ? 26 : 18, fontWeight: 700, color: '#0f172a', lineHeight: 1.1 }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{sub}</div>}
  </div>
);

// ── Bottom editor panel ───────────────────────────────────────────────────────

const SEVERITY_OPTIONS: { value: SeverityLevel; label: string; color: string; bg: string }[] = [
  { value: 'INFO',     label: 'INFO',     color: '#3b82f6', bg: '#eff6ff' },
  { value: 'WARNING',  label: 'WARNING',  color: '#ca8a04', bg: '#fefce8' },
  { value: 'MINOR',    label: 'MINOR',    color: '#d97706', bg: '#fffbeb' },
  { value: 'MAJOR',    label: 'MAJOR',    color: '#ea580c', bg: '#fff7ed' },
  { value: 'CRITICAL', label: 'CRITICAL', color: '#dc2626', bg: '#fef2f2' },
];

const severityStyle = (s: SeverityLevel) =>
  SEVERITY_OPTIONS.find(o => o.value === s) ?? SEVERITY_OPTIONS[1];

interface EditorPanelProps {
  rule: ConstraintRule;
  ruleSets: RuleSet[];
  colorMap: Record<string, string>;
  metaClasses: MetaClass[];
  onClose: () => void;
  onSave: (rule: ConstraintRule) => void;
  vsumId?: number;
  onHighlightNode?: (nodeId: string | null) => void;
  canvasNodes: Node[];
}


// ── Context Class Picker ──────────────────────────────────────────────────────

interface MetaClass { metamodel: string; className: string; label: string; }

const ContextClassPicker: React.FC<{
  value: string;
  options: MetaClass[];
  onChange: (contextType: string) => void;
}> = ({ value, options, onChange }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as globalThis.Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  // Group by metamodel
  const groups: Record<string, MetaClass[]> = {};
  filtered.forEach(o => {
    const key = o.metamodel;
    if (!groups[key]) groups[key] = [];
    groups[key].push(o);
  });

  const inputBase: React.CSSProperties = {
    width: '100%', padding: '6px 10px', border: '1.5px solid #e2e8f0', borderRadius: 7,
    fontSize: 12.5, background: '#f8fafc', color: '#0f172a', boxSizing: 'border-box',
    outline: 'none', fontFamily: APP_FONT, cursor: 'pointer',
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button type="button"
        style={{ ...inputBase, display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}
        onClick={() => { setOpen(o => !o); setQuery(''); }}
      >
        <span style={{ color: value ? '#0f172a' : '#94a3b8' }}>{value || 'Select context class…'}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }}>
          <polyline points="6,9 12,15 18,9" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
          background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', marginTop: 4, overflow: 'hidden',
        }}>
          {/* Search input */}
          <div style={{ padding: '8px 10px', borderBottom: '1px solid #f1f5f9' }}>
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Filter classes…"
              style={{ ...inputBase, cursor: 'text', background: '#fff', border: '1px solid #e2e8f0' }}
              onKeyDown={e => e.stopPropagation()}
            />
          </div>

          {/* Options */}
          <ul role="menu" style={{ maxHeight: 220, overflowY: 'auto', listStyle: 'none', margin: 0, padding: 0 }}>
            {Object.keys(groups).length === 0 && (
              <li style={{ padding: '10px 12px', fontSize: 12, color: '#94a3b8', fontFamily: APP_FONT }}>No classes found</li>
            )}
            {Object.entries(groups).map(([mm, classes]) => (
              <li key={mm}>
                <div style={{ padding: '5px 12px 3px', fontSize: 10.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                  {mm}
                </div>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {classes.map(c => (
                    <li
                      key={c.label}
                      role="menuitemradio"
                      tabIndex={0}
                      aria-checked={c.label === value}
                      onClick={() => { onChange(c.label); setOpen(false); setQuery(''); }}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { onChange(c.label); setOpen(false); setQuery(''); } }}
                      style={{
                        padding: '7px 12px 7px 20px', fontSize: 12.5, cursor: 'pointer',
                        color: c.label === value ? '#049484' : '#0f172a',
                        fontWeight: c.label === value ? 600 : 400,
                        background: c.label === value ? '#f0fdf9' : 'transparent',
                        fontFamily: 'monospace',
                      }}
                      onMouseEnter={e => { if (c.label !== value) e.currentTarget.style.background = '#f8fafc'; }}
                      onMouseLeave={e => { if (c.label !== value) e.currentTarget.style.background = 'transparent'; }}
                    >
                      {c.className}
                      <span style={{ marginLeft: 6, fontSize: 11, color: '#94a3b8', fontFamily: APP_FONT }}>{c.metamodel}::</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

// ── Shared save-feedback components ──────────────────────────────────────────

const SpinnerIcon: React.FC = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.75s linear infinite' }}>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    <path d="M12 2a10 10 0 0 1 10 10" />
  </svg>
);

const SaveChangesButton: React.FC<{ onSave: () => void }> = ({ onSave }) => {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const handleClick = () => {
    setSaving(true);
    setSaved(false);
    setTimeout(() => {
      onSave();
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 650);
  };
  let btnBackground: string;
  if (saving) { btnBackground = '#7fc4bc'; }
  else if (saved) { btnBackground = '#15803d'; }
  else { btnBackground = '#049484'; }

  let btnLabel: string;
  if (saving) { btnLabel = 'Saving…'; }
  else if (saved) { btnLabel = 'Saved ✓'; }
  else { btnLabel = 'Save Changes'; }

  return (
    <button type="button"
      onClick={handleClick}
      disabled={saving}
      style={{
        width: '100%', marginTop: 12, padding: '8px 0',
        background: btnBackground,
        color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600,
        cursor: saving ? 'default' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
        transition: 'background 0.2s',
      }}
    >
      {saving && <SpinnerIcon />}
      {btnLabel}
    </button>
  );
};

// ── Inline Editor Panel ───────────────────────────────────────────────────────

const EditorPanel: React.FC<EditorPanelProps> = ({ rule, ruleSets, colorMap, metaClasses, onClose, onSave, vsumId, onHighlightNode, canvasNodes }) => {
  const { height, onHandleMouseDown } = useResizablePanel();
  const { leftWidth, rightWidth, bodyRef, onLeftHandleMouseDown, onRightHandleMouseDown } = useResizableColumns();
  const [draft, setDraft] = useState<ConstraintRule>({ ...rule });
  const [fullEditorOpen, setFullEditorOpen] = useState(false);
  const updatingFromRef = useRef<'form' | 'code' | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const { onMount: lspOnMount, notifyChange } = useOclLsp({
    vsumId,
    documentId: rule.id,
    languageId: vitruvOCLLanguageId,
    getCode: () => draftRef.current.oclDefinition,
  });

  // Reset draft whenever the selected rule changes (intentionally only on id, not every field).
  useEffect(() => {
    setDraft({ ...rule }); // eslint-disable-line react-hooks/exhaustive-deps
  }, [rule.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── form field → OCL ────────────────────────────────────────────────────────

  const handleNameChange = (raw: string) => {
    const name = raw.replace(/\s/g, '');
    updatingFromRef.current = 'form';
    const newOcl = oclSetName(draftRef.current.oclDefinition, name);
    setDraft(d => ({ ...d, name, oclDefinition: newOcl }));
    notifyChange(newOcl);
    updatingFromRef.current = null;
  };

  const handleSeverityChange = (severity: SeverityLevel) => {
    updatingFromRef.current = 'form';
    const newOcl = oclSetSeverity(draftRef.current.oclDefinition, severity);
    setDraft(d => ({ ...d, severity, oclDefinition: newOcl }));
    notifyChange(newOcl);
    updatingFromRef.current = null;
  };

  const handleDescriptionChange = (description: string) => {
    updatingFromRef.current = 'form';
    const newOcl = oclSetMessage(draftRef.current.oclDefinition, description);
    setDraft(d => ({ ...d, description, oclDefinition: newOcl }));
    notifyChange(newOcl);
    updatingFromRef.current = null;
  };

  const handleContextTypeChange = (contextType: string) => {
    updatingFromRef.current = 'form';
    const newOcl = oclSetContextType(draftRef.current.oclDefinition, contextType);
    const newScope = oclGetScope(newOcl);
    const newType: RuleType = newScope.length >= 2 ? 'Cross-Metamodel' : 'Single-Metamodel';
    setDraft(d => ({ ...d, oclDefinition: newOcl, scope: newScope, type: newType }));
    notifyChange(newOcl);
    updatingFromRef.current = null;
    const metamodel = contextType.split('::')[0];
    onHighlightNode?.(findNodeIdForMetamodel(canvasNodes, metamodel));
  };

  // ── OCL → form fields ───────────────────────────────────────────────────────

  const handleOclChange = (v: string = '') => {
    const ocl = v;
    notifyChange(ocl);
    if (updatingFromRef.current === 'form') return;
    updatingFromRef.current = 'code';
    const derivedScope = oclGetScope(ocl);
    const derivedType: RuleType = derivedScope.length >= 2 ? 'Cross-Metamodel' : 'Single-Metamodel';
    setDraft(d => ({
      ...d,
      oclDefinition: ocl,
      name:        oclGetName(ocl)    || d.name,
      severity:    oclGetSeverity(ocl),
      description: oclGetMessage(ocl) || d.description,
      scope:       derivedScope.length > 0 ? derivedScope : d.scope,
      type:        derivedType,
    }));
    updatingFromRef.current = null;
  };

  const sev = severityStyle(draft.severity);

  return (
    <>
      <CodeEditorModal
        isOpen={fullEditorOpen}
        onClose={() => setFullEditorOpen(false)}
        onSave={ocl => { handleOclChange(ocl); }}
        initialCode={draft.oclDefinition}
        edgeId={draft.id}
        vsumId={vsumId === null || vsumId === undefined ? undefined : String(vsumId)}
        lspEndpoint="/ocl-lsp"
        languageId={vitruvOCLLanguageId}
        fileExtension=".ocl"
        monarchGrammar={vitruvOCLMonarch}
        languageConfig={vitruvOCLLanguageConfig}
        theme={vitruvOCLTheme}
        title={draft.name}
      />

      <div style={{
        background: '#ffffff', borderTop: '1px solid #e2e8f0',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.10)',
        zIndex: 50, display: 'flex', flexDirection: 'column',
        height, overflow: 'hidden', position: 'relative',
      }}>
        {/* Resize handle */}
        <div
          role="slider"
          aria-label="Resize panel"
          aria-orientation="vertical"
          aria-valuenow={height}
          aria-valuemin={EDITOR_PANEL_MIN_H}
          aria-valuemax={EDITOR_PANEL_MAX_H}
          tabIndex={0}
          onMouseDown={onHandleMouseDown}
          onKeyDown={() => { /* keyboard resize not implemented */ }}
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 6,
            cursor: 'ns-resize', zIndex: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div style={{ width: 36, height: 3, borderRadius: 2, background: '#cbd5e1', transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#049484')}
            onMouseLeave={e => (e.currentTarget.style.background = '#cbd5e1')}
          />
        </div>
        {/* Header — top-padding accounts for the 6px resize handle */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px 10px 16px', paddingTop: 12, borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', flex: 1 }}>
            Editing: {draft.name}
          </span>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Body */}
        <div ref={bodyRef} style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left: meta */}
          <div style={{ width: leftWidth, flexShrink: 0, padding: '12px 16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* Context class */}
            <div>
              <label htmlFor="ep-context-class" style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Context Class</label>
              <div id="ep-context-class">
                <ContextClassPicker
                  value={oclGetContextType(draft.oclDefinition)}
                  options={metaClasses}
                  onChange={handleContextTypeChange}
                />
              </div>
            </div>

            {/* Name — no spaces */}
            <div>
              <label htmlFor="ep-inv-name" style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>
                Name <span style={{ fontWeight: 400, color: '#94a3b8' }}>(no spaces)</span>
              </label>
              <input
                id="ep-inv-name"
                value={draft.name}
                onChange={e => handleNameChange(e.target.value)}
                placeholder="InvariantName"
                style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 8px', fontSize: 12.5, outline: 'none', boxSizing: 'border-box', color: '#0f172a', fontFamily: 'monospace' }}
              />
            </div>

            {/* Severity */}
            <div>
              <label htmlFor="ep-severity" style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>Severity</label>
              <div id="ep-severity" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {SEVERITY_OPTIONS.map(opt => {
                  const active = draft.severity === opt.value;
                  return (
                    <button type="button" key={opt.value} onClick={() => handleSeverityChange(opt.value)} style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${active ? opt.color : '#e2e8f0'}`, background: active ? opt.bg : '#fff', color: active ? opt.color : '#94a3b8', transition: 'all 0.12s' }}>
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 10, background: sev.bg, border: `1px solid ${sev.color}20` }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: sev.color }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: sev.color }}>{draft.severity}</span>
              </div>
            </div>

            {/* Message */}
            <div>
              <label htmlFor="ep-message" style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Message</label>
              <textarea id="ep-message" value={draft.description} onChange={e => handleDescriptionChange(e.target.value)} rows={3} style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 8px', fontSize: 12, resize: 'none', outline: 'none', boxSizing: 'border-box', color: '#334155', lineHeight: 1.5 }} />
            </div>

            {/* Rule Set */}
            <div>
              <label htmlFor="ep-rule-set" style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Rule Set</label>
              <select id="ep-rule-set" value={draft.ruleSetId} onChange={e => setDraft(d => ({ ...d, ruleSetId: e.target.value }))} style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 8px', fontSize: 12.5, background: '#fff', color: '#0f172a', outline: 'none', boxSizing: 'border-box' }}>
                {ruleSets.map(rs => <option key={rs.id} value={rs.id}>{rs.name}</option>)}
              </select>
            </div>

            {/* Metamodels */}
            <div>
              <label htmlFor="ep-metamodels" style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 2 }}>
                Metamodels <span style={{ fontWeight: 400, color: '#94a3b8', marginLeft: 4 }}>auto</span>
              </label>
              <p style={{ fontSize: 10.5, color: '#94a3b8', margin: '0 0 6px' }}>
                Derived from <code style={{ fontSize: 10 }}>MM::Class</code> patterns in the OCL
              </p>
              <div id="ep-metamodels" style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {draft.scope.length > 0 ? draft.scope.map(s => {
                  const bg = scopeBg(s, colorMap);
                  const text = darkenHex(bg, 70);
                  return <span key={s} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: bg, color: text, fontWeight: 600 }}>{s}</span>;
                }) : <span style={{ fontSize: 11, color: '#cbd5e1', fontStyle: 'italic' }}>No MM::Class patterns found</span>}
              </div>
            </div>

          </div>

          <ColumnResizeHandle
            ariaLabel="Resize form panel"
            ariaValueNow={leftWidth}
            ariaValueMin={EDITOR_LEFT_MIN_W}
            ariaValueMax={EDITOR_LEFT_MAX_W}
            onMouseDown={onLeftHandleMouseDown}
          />

          {/* Center: OCL editor */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: EDITOR_CENTER_MIN_W }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '6px 12px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9', gap: 6, flexShrink: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', flex: 1 }}>OCL Definition</span>
              <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#f1f5f9', color: '#64748b' }}>OCL</span>
            </div>
            <div style={{ flex: 1 }}>
              <Editor
                value={draft.oclDefinition}
                onChange={handleOclChange}
                onMount={(ed, m) => { handleVitruvOCLMount(ed, m); lspOnMount(ed, m); }}
                language={vitruvOCLLanguageId}
                theme="vitruvocl-theme"
                options={{ minimap: { enabled: false }, fontSize: 13, lineNumbers: 'on', scrollBeyondLastLine: false, wordWrap: 'on', automaticLayout: true, padding: { top: 8, bottom: 8 }, folding: false, lineDecorationsWidth: 0, renderLineHighlight: 'line', overviewRulerLanes: 0 }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', padding: '6px 12px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', flexShrink: 0, gap: 8 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#22c55e" stroke="none"><circle cx="12" cy="12" r="10"/><polyline points="9,12 11,14 15,10" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span style={{ fontSize: 11, color: '#64748b', flex: 1 }}>No syntax errors</span>
              <span style={{ fontSize: 10.5, color: '#94a3b8' }}>Spaces: 2</span>
              <span style={{ fontSize: 10.5, color: '#94a3b8' }}>OCL</span>
            </div>
          </div>

          <ColumnResizeHandle
            ariaLabel="Resize overview panel"
            ariaValueNow={rightWidth}
            ariaValueMin={EDITOR_RIGHT_MIN_W}
            ariaValueMax={EDITOR_RIGHT_MAX_W}
            onMouseDown={onRightHandleMouseDown}
          />

          {/* Right: overview */}
          <div style={{ width: rightWidth, flexShrink: 0, padding: '12px 16px', overflowY: 'auto' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>Rule Overview</div>
            {([
              ['Type', draft.type],
              ['Severity', draft.severity],
              ['Metamodels', draft.scope.join(', ')],
              ['Context Count', String(draft.contextCount ?? 0)],
              ['Invariant Count', String(draft.invariantCount ?? 0)],
              ['Lines of Code', String(draft.linesOfCode ?? 0)],
              ['Created', draft.createdAt],
              ['Last Modified', draft.modifiedAt],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 6 }}>
                <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0 }}>{k}</span>
                {k === 'Severity'
                  ? <span style={{ fontSize: 11, fontWeight: 600, color: sev.color }}>{v}</span>
                  : <span style={{ fontSize: 11, color: '#334155', textAlign: 'right', fontWeight: k === 'Type' ? 500 : 400 }}>{v || '—'}</span>
                }
              </div>
            ))}
            <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderTop: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>Linked Reactions</span>
              <span style={{ fontSize: 11, color: '#334155', fontWeight: 500 }}>{draft.linkedReactions ?? 0}</span>
            </div>
            <SaveChangesButton onSave={() => onSave(draft)} />
            <button type="button" onClick={() => setFullEditorOpen(true)} style={{ width: '100%', marginTop: 6, padding: '7px 0', background: 'transparent', color: '#049484', border: '1px solid #049484', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              Open in Full Editor
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

// ── Right panel: metrics ──────────────────────────────────────────────────────

interface MetricsPanelProps {
  ruleSets: RuleSet[];
  colorMap: Record<string, string>;
}

const MetricsPanel: React.FC<MetricsPanelProps> = ({ ruleSets, colorMap }) => {
  const [detailOpen, setDetailOpen] = useState(false);
  const allRules = ruleSets.flatMap(rs => rs.rules);
  const total = allRules.length;
  const crossMeta = allRules.filter(r => r.type === 'Cross-Metamodel').length;
  const singleMeta = allRules.filter(r => r.type === 'Single-Metamodel').length;

  // metamodel involvement
  const metaCount: Record<string, number> = {};
  allRules.forEach(r => r.scope.forEach(s => { metaCount[s] = (metaCount[s] ?? 0) + 1; }));
  const sortedMeta = Object.entries(metaCount).sort((a, b) => b[1] - a[1]);
  const maxMeta = sortedMeta[0]?.[1] ?? 1;


  const totalLines = allRules.reduce((s, r) => s + (r.linesOfCode ?? 0), 0);
  const avgLines = total > 0 ? (totalLines / total).toFixed(1) : '0';
  const maxLines = Math.max(0, ...allRules.map(r => r.linesOfCode ?? 0));

  // McCabe's Cyclomatic Complexity average
  const ccValues = allRules.map(r => computeCC(r.oclDefinition));
  const avgCC = total > 0 ? ccValues.reduce((a, b) => a + b, 0) / total : 0;
  const avgCCStr = avgCC > 0 ? avgCC.toFixed(1) : '—';
  const avgCCLabelStr = ccLabel(avgCC);

  return (
    <div style={{
      width: 300, flexShrink: 0, height: '100%',
      background: '#ffffff', borderLeft: '1px solid #e2e8f0',
      borderTopLeftRadius: 10, borderTopRightRadius: 10,
      overflowY: 'auto', display: 'flex', flexDirection: 'column',
    }}>
      {/* Insight cards */}
      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>Constraint Insights</div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 14 }}>Static metrics about your consistency definitions</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          <InsightCard label="Total Rules" value={total} sub={`Across ${ruleSets.length} Sets`} />
          <InsightCard label="Cross-Metamodel Rules" value={crossMeta} sub={`${total > 0 ? Math.round((crossMeta / total) * 100) : 0}%`} />
          <InsightCard label="Single-Metamodel Rules" value={singleMeta} sub={`${total > 0 ? Math.round((singleMeta / total) * 100) : 0}%`} />
          <InsightCard
            label="Avg. Complexity"
            value={avgCCLabelStr}
            sub={
              <span>
                Ø {avgCCStr}{' '}
                <span
                  title="McCabe's Cyclomatic Complexity — McCabe (1976), IEEE Trans. Softw. Eng."
                  style={{ cursor: 'help', color: '#94a3b8', fontSize: 10, fontWeight: 400 }}
                >
                  CC ⓘ
                </span>
              </span>
            }
          />
        </div>
      </div>

      {/* Metamodel involvement */}
      <div style={{ padding: '0 16px 16px', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>Metamodel Involvement</div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 12 }}>How many rules reference each metamodel</div>
        {sortedMeta.map(([name, count], i) => (
          <MetamodelBar key={name} label={name} count={count} max={maxMeta} colorMap={colorMap} />
        ))}
      </div>

      {/* Rule characteristics */}
      <div style={{ padding: '14px 16px' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>Rule Characteristics</div>
        {([
          ['Total OCL Lines', String(totalLines)],
          ['Avg. Lines per Rule', avgLines],
          ['Max Lines in a Rule', String(maxLines)],
        ] as [string, string][]).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11.5, color: '#64748b' }}>{k}</span>
            <span style={{ fontSize: 12, color: '#0f172a', fontWeight: 500 }}>{v}</span>
          </div>
        ))}

        <button type="button"
          onClick={() => setDetailOpen(true)}
          style={{ width: '100%', marginTop: 14, padding: '9px 0', background: 'transparent', color: '#049484', border: '1px solid #049484', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          View Detailed Metrics
        </button>
        {detailOpen && <DetailedMetricsModal ruleSets={ruleSets} colorMap={colorMap} onClose={() => setDetailOpen(false)} />}
      </div>
    </div>
  );
};

// ── Detailed Metrics Modal ────────────────────────────────────────────────────

const DetailedMetricsModal: React.FC<{ ruleSets: RuleSet[]; colorMap: Record<string, string>; onClose: () => void }> = ({ ruleSets, colorMap, onClose }) => {
  const sev = SEVERITY_OPTIONS.reduce<Record<string, { color: string; bg: string }>>((m, o) => { m[o.value] = { color: o.color, bg: o.bg }; return m; }, {});

  return (
    <dialog
      open
      style={{
        position: 'fixed', inset: 0, width: '100%', height: '100%',
        maxWidth: '100vw', maxHeight: '100vh',
        background: 'none', border: 'none', padding: 0, margin: 0,
        zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', boxSizing: 'border-box',
      }}
    >
      <button type="button" onClick={onClose} aria-label="Close" style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.35)', border: 'none', cursor: 'default', padding: 0 }} />
      <div style={{
        position: 'relative', zIndex: 1,
        background: '#fff', borderRadius: 14,
        width: 'min(1040px, calc(100vw - 48px))',
        maxHeight: 'calc(100vh - 48px)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.20)',
        border: '1px solid #e2e8f0', fontFamily: APP_FONT,
        overflow: 'hidden', boxSizing: 'border-box',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Detailed Metrics</span>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        {/* Body — grows with content, scrolls when it would exceed the viewport */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {ruleSets.length === 0 && (
            <div style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', marginTop: 40 }}>No rule sets yet.</div>
          )}
          {ruleSets.map(rs => {
            const rules = rs.rules;
            const total = rules.length;
            const ccVals = rules.map(r => computeCC(r.oclDefinition));
            const avgCC = total > 0 ? ccVals.reduce((a, b) => a + b, 0) / total : 0;
            const maxCC = total > 0 ? Math.max(...ccVals) : 0;
            const totalLines = rules.reduce((s, r) => s + (r.linesOfCode ?? 0), 0);
            const cross = rules.filter(r => r.type === 'Cross-Metamodel').length;
            const sevCounts = rules.reduce<Record<string, number>>((m, r) => { m[r.severity] = (m[r.severity] ?? 0) + 1; return m; }, {});

            return (
              <div key={rs.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
                {/* Card header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ width: 11, height: 11, borderRadius: 3, background: rs.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', flex: 1 }}>{rs.name}</span>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>{total} rule{total === 1 ? '' : 's'}</span>
                </div>

                {/* Card body */}
                <div style={{ padding: '16px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                  {/* Avg CC */}
                  <div style={{ background: '#f8fafc', borderRadius: 8, padding: '14px 16px', border: '1px solid #f1f5f9' }}>
                    <div style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg. Complexity</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>{total > 0 ? avgCC.toFixed(1) : '—'}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{total > 0 ? ccLabel(avgCC) : ''}</div>
                  </div>
                  {/* Max CC */}
                  <div style={{ background: '#f8fafc', borderRadius: 8, padding: '14px 16px', border: '1px solid #f1f5f9' }}>
                    <div style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Max Complexity</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>{total > 0 ? maxCC : '—'}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{total > 0 ? ccLabel(maxCC) : ''}</div>
                  </div>
                  {/* OCL Lines */}
                  <div style={{ background: '#f8fafc', borderRadius: 8, padding: '14px 16px', border: '1px solid #f1f5f9' }}>
                    <div style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total OCL Lines</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>{totalLines}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{total > 0 ? `Ø ${(totalLines / total).toFixed(1)} per rule` : ''}</div>
                  </div>
                  {/* Cross-metamodel */}
                  <div style={{ background: '#f8fafc', borderRadius: 8, padding: '14px 16px', border: '1px solid #f1f5f9' }}>
                    <div style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cross-Metamodel</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a' }}>{cross}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{total > 0 ? `${Math.round((cross / total) * 100)}% of rules` : ''}</div>
                  </div>
                </div>

                {/* Severity breakdown */}
                {total > 0 && (
                  <div style={{ padding: '0 16px 14px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(['INFO','WARNING','MINOR','MAJOR','CRITICAL'] as SeverityLevel[]).map(s => {
                      const count = sevCounts[s] ?? 0;
                      if (count === 0) return null;
                      const { color, bg } = sev[s];
                      return (
                        <span key={s} style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 10, background: bg, color, border: `1px solid ${color}` }}>
                          {count}× {s}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Per-rule list */}
                {total > 0 && (
                  <div style={{ borderTop: '1px solid #f1f5f9' }}>
                    {rules.map((r, i) => {
                      const cc = computeCC(r.oclDefinition);
                      const { color, bg } = sev[r.severity];
                      return (
                        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', borderBottom: i < rules.length - 1 ? '1px solid #f8fafc' : 'none', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                          <span style={{ fontSize: 12.5, color: '#334155', flex: 1, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 8, background: bg, color, border: `1px solid ${color}`, flexShrink: 0 }}>{r.severity}</span>
                          <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0, width: 60, textAlign: 'right' }}>CC {cc} · {ccLabel(cc)}</span>
                          <span style={{ fontSize: 11, color: '#94a3b8', flexShrink: 0, width: 50, textAlign: 'right' }}>{r.linesOfCode} lines</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </dialog>
  );
};

// ── Rule Set Panel ────────────────────────────────────────────────────────────

const PRESET_COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#ec4899','#6366f1','#84cc16','#f97316'];

const RuleSetPanel: React.FC<{
  ruleSet: RuleSet;
  onClose: () => void;
  onSave: (updated: RuleSet) => void;
  onDelete?: () => void;
}> = ({ ruleSet, onClose, onSave, onDelete }) => {
  const [draft, setDraft] = useState({ name: ruleSet.name, color: ruleSet.color, description: ruleSet.description });

  useEffect(() => {
    setDraft({ name: ruleSet.name, color: ruleSet.color, description: ruleSet.description }); // eslint-disable-line react-hooks/exhaustive-deps
  }, [ruleSet.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const [saving, setSaving] = useState(false);
  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      onSave({ ...ruleSet, ...draft });
      onClose();
    }, 650);
  };

  const inputBase: React.CSSProperties = {
    width: '100%', padding: '6px 10px', border: '1.5px solid #e2e8f0', borderRadius: 7,
    fontSize: 12.5, background: '#f8fafc', color: '#0f172a', boxSizing: 'border-box',
    outline: 'none', fontFamily: APP_FONT,
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 600, color: '#64748b',
    marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em',
  };

  return (
    <div style={{
      background: '#ffffff', borderTop: '1px solid #e2e8f0',
      boxShadow: '0 -4px 24px rgba(0,0,0,0.10)',
      display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: draft.color, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>Rule Set: {draft.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {onDelete && (
            <button type="button"
              onClick={() => { onDelete(); onClose(); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 11.5, fontWeight: 600, padding: '3px 8px', borderRadius: 5, fontFamily: APP_FONT }}
              onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              title="Delete Rule Set"
            >Delete</button>
          )}
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
      </div>

      {/* Scrollable fields */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Name */}
        <div>
          <label htmlFor="rsp-name" style={labelStyle}>Name</label>
          <input id="rsp-name" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} style={inputBase} />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="rsp-description" style={labelStyle}>Description</label>
          <textarea
            id="rsp-description"
            value={draft.description}
            onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
            rows={2}
            style={{ ...inputBase, resize: 'none', lineHeight: 1.5 }}
            placeholder="Optional description…"
          />
        </div>

        {/* Color */}
        <div>
          <label htmlFor="rsp-color" style={labelStyle}>Color</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            {PRESET_COLORS.map(c => (
              <button type="button"
                key={c}
                onClick={() => setDraft(d => ({ ...d, color: c }))}
                style={{
                  width: 22, height: 22, borderRadius: 5, background: c, border: 'none', cursor: 'pointer',
                  outline: draft.color === c ? `2.5px solid ${c}` : 'none',
                  outlineOffset: 2,
                  boxShadow: draft.color === c ? '0 0 0 1.5px #fff inset' : 'none',
                  transition: 'transform 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.15)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
              />
            ))}
            <input id="rsp-color" type="color" value={draft.color} onChange={e => setDraft(d => ({ ...d, color: e.target.value }))} title="Custom color"
              style={{ width: 22, height: 22, borderRadius: 5, border: '1.5px solid #e2e8f0', cursor: 'pointer', padding: 1, background: 'none' }} />
          </div>
        </div>
      </div>

      {/* Footer with Save */}
      <div style={{ padding: '10px 16px', borderTop: '1px solid #f1f5f9', flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '7px 20px', background: saving ? '#7fc4bc' : '#049484', color: '#fff',
            border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600,
            cursor: saving ? 'default' : 'pointer', fontFamily: APP_FONT,
            display: 'flex', alignItems: 'center', gap: 7, transition: 'background 0.2s',
          }}
          onMouseEnter={e => { if (!saving) e.currentTarget.style.background = '#037368'; }}
          onMouseLeave={e => { if (!saving) e.currentTarget.style.background = '#049484'; }}
        >
          {saving && <SpinnerIcon />}
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
};

// ── Left panel ────────────────────────────────────────────────────────────────

interface LeftPanelProps {
  ruleSets: RuleSet[];
  selectedRuleId: string | null;
  selectedRuleSetId: string | null;
  onRuleClick: (rule: ConstraintRule) => void;
  onRuleSetClick: (ruleSet: RuleSet) => void;
  onToggleCollapse: (id: string) => void;
  onAddRule: (ruleSetId: string) => void;
  onDeleteRule: (ruleId: string) => void;
  onAddSet: () => void;
  searchQuery: string;
  onSearch: (q: string) => void;
  filterMetamodel?: string | null;
}

const LeftPanel: React.FC<LeftPanelProps> = ({
  ruleSets, selectedRuleId, selectedRuleSetId, onRuleClick, onRuleSetClick, onToggleCollapse, onAddRule, onDeleteRule, onAddSet, searchQuery, onSearch, filterMetamodel
}) => {
  const filtered = (() => {
    let result = ruleSets;
    if (searchQuery) {
      result = result
        .map(rs => ({ ...rs, collapsed: false, rules: rs.rules.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase())) }))
        .filter(rs => rs.rules.length > 0);
    }
    if (filterMetamodel) {
      result = result
        .map(rs => ({
          ...rs,
          collapsed: false,
          rules: rs.rules.filter(r => {
            const ctx = oclGetContextType(r.oclDefinition).split('::')[0].toLowerCase();
            return ctx === filterMetamodel.toLowerCase();
          }),
        }))
        .filter(rs => rs.rules.length > 0);
    }
    return result;
  })();

  return (
    <div style={{
      width: 260, flexShrink: 0, height: '100%',
      background: '#ffffff', borderRight: '1px solid #e2e8f0',
      borderTopLeftRadius: 10, borderTopRightRadius: 10,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Constraint Sets</span>
          <button type="button"
            onClick={onAddSet}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: '#049484', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, padding: '3px 6px', borderRadius: 5 }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f0fdf9')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Set
          </button>
        </div>
        <div style={{ position: 'relative' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            value={searchQuery}
            onChange={e => onSearch(e.target.value)}
            placeholder="Search projects… (Ctrl+K)"
            style={{ width: '100%', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 8px 6px 28px', fontSize: 12, outline: 'none', boxSizing: 'border-box', color: '#334155' }}
          />
        </div>
      </div>

      {/* Active metamodel filter badge */}
      {filterMetamodel && (
        <div style={{ padding: '6px 12px', background: '#f0fdf9', borderBottom: '1px solid #d1fae5', display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#049484" strokeWidth="2.5" strokeLinecap="round">
            <polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46"/>
          </svg>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#049484', flex: 1 }}>Filter: {filterMetamodel}</span>
          <span style={{ fontSize: 10, color: '#64748b' }}>Click node to clear</span>
        </div>
      )}

      {/* Rule sets */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.map(rs => (
          <RuleSetSection
            key={rs.id}
            ruleSet={rs}
            selectedRuleId={selectedRuleId}
            selectedRuleSetId={selectedRuleSetId}
            onRuleClick={onRuleClick}
            onRuleSetClick={onRuleSetClick}
            onToggleCollapse={onToggleCollapse}
            onAddRule={onAddRule}
            onDeleteRule={onDeleteRule}
          />
        ))}
      </div>

    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

export interface ConstraintsViewProps {
  vsumId?: string;
  canvasNodes: Node[];
  onHighlightNode?: (nodeId: string | null) => void;
  filterNodeId?: string | null;
}

/** Finds the canvas node ID whose Ecore metamodel matches the given context prefix (e.g. "pfand"). */
function findNodeIdForMetamodel(canvasNodes: Node[], metamodel: string): string | null {
  if (!metamodel) return null;
  for (const n of canvasNodes) {
    if (n.type !== 'ecoreFile') continue;
    const classes = parseEcoreClasses(n.data?.fileName ?? '', n.data?.fileContent ?? '');
    if (classes.some(c => c.metamodel.toLowerCase() === metamodel.toLowerCase())) return n.id;
  }
  return null;
}

export const ConstraintsView: React.FC<ConstraintsViewProps> = ({ vsumId: _vsumId, canvasNodes, onHighlightNode, filterNodeId }) => {
  const vsumId = _vsumId ? Number(_vsumId) : null;
  const colorMap = useMemo(() => buildMetamodelColorMap(canvasNodes), [canvasNodes]);
  const metaClasses = useMemo(() => buildMetaClasses(canvasNodes), [canvasNodes]);

  // Derive the metamodel name for the active filter node, if any.
  const filterMetamodel = useMemo((): string | null => {
    if (!filterNodeId) return null;
    const node = canvasNodes.find(n => n.id === filterNodeId);
    if (!node) return null;
    const classes = parseEcoreClasses(node.data?.fileName ?? '', node.data?.fileContent ?? '');
    return classes[0]?.metamodel ?? null;
  }, [filterNodeId, canvasNodes]);

  const [ruleSets, setRuleSets] = useState<RuleSet[]>([]);
  const defaultsAppliedRef = useRef(false);

  // Load rule sets from backend on mount; fall back to canvas-derived defaults.
  useEffect(() => {
    if (defaultsAppliedRef.current) return;

    if (vsumId != null) {
      apiService.getRuleSets(vsumId).then(responses => {
        if (responses.length === 0) return; // will fall through to defaults below
        defaultsAppliedRef.current = true;
        setRuleSets(responses.map(r => ({
          id: `rs_${r.id}`,
          backendId: r.id,
          name: r.name,
          color: r.color,
          description: r.description ?? '',
          collapsed: false,
          rules: parseRulesFromOcl(r.oclContent, `rs_${r.id}`),
        })));
      }).catch(err => {
        console.warn('Failed to load rule sets from backend, falling back to defaults:', err);
      });
      return;
    }

    // No vsumId — use canvas-derived defaults once nodes are available
    if (canvasNodes.length === 0) return;
    const defaults = getDefaultRuleSets(canvasNodes);
    if (defaults.length === 0) return;
    defaultsAppliedRef.current = true;
    setRuleSets(defaults.map(rs => ({
      ...rs,
      rules: rs.rules.map(r => ({ ...r, scope: oclGetScope(r.oclDefinition) })),
    })));
  }, [vsumId, canvasNodes]);

  /** Sync a single ruleset to the backend (fire-and-forget). */
  const syncRuleSet = useCallback((rs: RuleSet) => {
    if (vsumId == null) return;
    const body = { name: rs.name, color: rs.color, description: rs.description, oclContent: ruleSetToOcl(rs) };
    if (rs.backendId === null || rs.backendId === undefined) {
      apiService.createRuleSet(vsumId, body).then(created => {
        setRuleSets(prev => updateBackendId(prev, rs.id, created.id));
      }).catch(err => console.error('Failed to create RuleSet:', err));
    } else {
      apiService.updateRuleSet(vsumId, rs.backendId, body).catch(err =>
        console.error('Failed to sync RuleSet:', err));
    }
  }, [vsumId]);

  const [selectedRule, setSelectedRule] = useState<ConstraintRule | null>(null);
  const [selectedRuleSet, setSelectedRuleSet] = useState<RuleSet | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleRuleSetClick = useCallback((rs: RuleSet) => {
    setSelectedRuleSet(prev => prev?.id === rs.id ? null : rs);
    setSelectedRule(null);
    onHighlightNode?.(null);
  }, [onHighlightNode]);

  const handleSaveRuleSet = useCallback((updated: RuleSet) => {
    setRuleSets(prev => prev.map(rs => rs.id === updated.id ? updated : rs));
    setSelectedRuleSet(updated);
    syncRuleSet(updated);
  }, [syncRuleSet]);

  const handleRuleClick = useCallback((rule: ConstraintRule) => {
    const next: ConstraintRule | null = selectedRule?.id === rule.id ? null : rule;
    const metamodel = next ? oclGetContextType(next.oclDefinition).split('::')[0] : null;
    const nodeId = metamodel ? findNodeIdForMetamodel(canvasNodes, metamodel) : null;
    setSelectedRuleSet(null);
    setSelectedRule(next);
    onHighlightNode?.(nodeId);
  }, [selectedRule, canvasNodes, onHighlightNode]);

  const handleToggleCollapse = useCallback((id: string) => {
    setRuleSets(prev => prev.map(rs => rs.id === id ? { ...rs, collapsed: !rs.collapsed } : rs));
  }, []);

  const handleDeleteRule = useCallback((ruleId: string) => {
    setRuleSets(prev => {
      const next = deleteRuleFromSets(prev, ruleId);
      const affected = findSetContainingRule(prev, ruleId);
      const syncTarget = next.find(rs => rs.id === affected?.id);
      if (syncTarget) syncRuleSet(syncTarget);
      return next;
    });
    setSelectedRule(prev => prev?.id === ruleId ? null : prev);
  }, [syncRuleSet]);

  const handleAddRule = useCallback((ruleSetId: string) => {
    const newRule: ConstraintRule = {
      id: `r_${Date.now()}`, name: 'NewInvariant', severity: 'WARNING', description: '',
      ruleSetId, oclDefinition: 'context ClassName inv NewInvariant:\n  @severity WARNING\n  @message ""\n  true',
      scope: [], type: 'Single-Metamodel',
      createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      modifiedAt: 'Just now',
      invariantCount: 1, contextCount: 1, linesOfCode: 5, linkedReactions: 0,
    };
    setRuleSets(prev => {
      const next = prev.map(rs => rs.id === ruleSetId ? { ...rs, rules: [...rs.rules, newRule] } : rs);
      const affected = next.find(rs => rs.id === ruleSetId);
      if (affected) syncRuleSet(affected);
      return next;
    });
    setSelectedRule(newRule);
  }, [syncRuleSet]);

  const handleAddSet = useCallback(() => {
    const newSet: RuleSet = {
      id: `rs_${Date.now()}`, name: 'New Rule Set',
      color: '#6366f1', description: '', rules: [], collapsed: false,
    };
    setRuleSets(prev => [...prev, newSet]);
    syncRuleSet(newSet);
  }, [syncRuleSet]);

  const handleDeleteRuleSet = useCallback((ruleSetId: string) => {
    setRuleSets(prev => {
      const rs = prev.find(r => r.id === ruleSetId);
      if (rs?.backendId !== null && rs?.backendId !== undefined && vsumId !== null && vsumId !== undefined) {
        apiService.deleteRuleSet(vsumId, rs.backendId).catch(err => console.error('Failed to delete RuleSet:', err));
      }
      return prev.filter(r => r.id !== ruleSetId);
    });
    setSelectedRuleSet(prev => prev?.id === ruleSetId ? null : prev);
  }, [vsumId]);

  const handleSaveRule = useCallback((updated: ConstraintRule) => {
    setRuleSets(prev => {
      const next = replaceRule(prev, updated);
      const affected = findSetContainingRule(next, updated.id);
      if (affected) syncRuleSet(affected);
      return next;
    });
    setSelectedRule(updated);
  }, [syncRuleSet]);

  return (
    // pointer-events: none on container — individual panels re-enable it so the
    // transparent center gap passes clicks through to the FlowCanvas beneath.
    <div style={{ display: 'flex', width: '100%', height: '100%', position: 'relative', pointerEvents: 'none' }}>
      {/* Left panel — re-enables pointer events */}
      <div style={{ pointerEvents: 'auto' }}>
        <LeftPanel
          ruleSets={ruleSets}
          selectedRuleId={selectedRule?.id ?? null}
          selectedRuleSetId={selectedRuleSet?.id ?? null}
          onRuleClick={handleRuleClick}
          onRuleSetClick={handleRuleSetClick}
          onToggleCollapse={handleToggleCollapse}
          onAddRule={handleAddRule}
          onDeleteRule={handleDeleteRule}
          onAddSet={handleAddSet}
          searchQuery={searchQuery}
          onSearch={setSearchQuery}
          filterMetamodel={filterMetamodel}
        />
      </div>

      {/* Center: transparent — FlowCanvas shows through */}
      <div style={{ flex: 1 }} />

      {/* Right panel — re-enables pointer events */}
      <div style={{ pointerEvents: 'auto', display: 'flex', alignSelf: 'stretch' }}>
        <MetricsPanel ruleSets={ruleSets} colorMap={colorMap} />
      </div>

      {/* Bottom editor — floats over the center canvas, re-enables pointer events */}
      {selectedRule && (
        <section aria-label="Rule editor" tabIndex={-1} style={{ position: 'absolute', bottom: 0, left: 260, right: 300, pointerEvents: 'auto', display: 'flex', flexDirection: 'column' }} onKeyDown={e => e.stopPropagation()}>
          <EditorPanel
            rule={selectedRule}
            ruleSets={ruleSets}
            colorMap={colorMap}
            metaClasses={metaClasses}
            onClose={() => { setSelectedRule(null); onHighlightNode?.(null); }}
            onSave={handleSaveRule}
            vsumId={vsumId ?? undefined}
            onHighlightNode={onHighlightNode}
            canvasNodes={canvasNodes}
          />
        </section>
      )}
      {selectedRuleSet && !selectedRule && (
        <div style={{ position: 'absolute', bottom: 0, left: 260, right: 300, pointerEvents: 'auto', maxHeight: '42%', display: 'flex', flexDirection: 'column' }}>
          <RuleSetPanel
            ruleSet={selectedRuleSet}
            onClose={() => setSelectedRuleSet(null)}
            onSave={handleSaveRuleSet}
            onDelete={() => handleDeleteRuleSet(selectedRuleSet.id)}
          />
        </div>
      )}
    </div>
  );
};
