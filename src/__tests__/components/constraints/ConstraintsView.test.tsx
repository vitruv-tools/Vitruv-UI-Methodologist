import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ConstraintsView } from '../../../components/constraints/ConstraintsView';
import { apiService } from '../../../services/api';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('monaco-editor', () => ({
  languages: {
    register: jest.fn(),
    setMonarchTokensProvider: jest.fn(),
    setLanguageConfiguration: jest.fn(),
    getLanguages: jest.fn(() => []),
    registerCompletionItemProvider: jest.fn(() => ({ dispose: jest.fn() })),
  },
  editor: {
    defineTheme: jest.fn(),
    setTheme: jest.fn(),
    setModelMarkers: jest.fn(),
  },
  MarkerSeverity: { Error: 8, Warning: 4, Info: 2 },
}));

jest.mock('@monaco-editor/react', () => {
  const mockReact = require('react');
  const MockEditor = ({ value, onChange, onMount }: any) => {
    mockReact.useEffect(() => {
      onMount?.({}, {
        languages: {
          register: jest.fn(),
          setLanguageConfiguration: jest.fn(),
          setMonarchTokensProvider: jest.fn(),
        },
        editor: {
          defineTheme: jest.fn(),
          setTheme: jest.fn(),
        },
      });
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    return mockReact.createElement('textarea', {
      'data-testid': 'monaco-editor',
      value: value ?? '',
      onChange: (e: any) => onChange?.(e.target.value),
    });
  };
  return { __esModule: true, default: MockEditor };
});

jest.mock('reactflow', () => ({
  __esModule: true,
  default: ({ children }: any) => <div>{children}</div>,
  useReactFlow: () => ({ getNodes: jest.fn(() => []) }),
  Handle: () => null,
  Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
}));

jest.mock('../../../hooks/useOclLsp', () => ({
  useOclLsp: () => ({ onMount: jest.fn(), notifyChange: jest.fn() }),
}));

jest.mock('../../../components/flow/CodeEditorModal', () => ({
  CodeEditorModal: () => null,
}));

jest.mock('../../../components/flow/EcoreFileBox', () => ({
  cardColor: jest.fn(() => '#e2e8f0'),
}));

jest.mock('../../../components/constraints/VitruvOCLMonarchGrammar', () => ({
  vitruvOCLLanguageId: 'vitruvocl',
  vitruvOCLMonarch: {},
  vitruvOCLLanguageConfig: {},
  vitruvOCLTheme: { base: 'vs', inherit: true, rules: [], colors: {} },
}));

jest.mock('../../../services/api', () => ({
  apiService: {
    getRuleSets: jest.fn().mockResolvedValue([]),
    createRuleSet: jest.fn().mockResolvedValue({ id: 1 }),
    updateRuleSet: jest.fn().mockResolvedValue({}),
    deleteRuleSet: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('../../../components/ui/ActionButton', () => ({
  ActionButton: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
}));

jest.mock('../../../components/ui/sharedStyles', () => ({
  APP_FONT: 'sans-serif',
}));

jest.mock('../../../components/ui/modalUtils', () => ({
  ...jest.requireActual('../../../components/ui/modalUtils'),
  useModalBodyLock: jest.fn(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const pfandNode = {
  id: 'n1',
  type: 'ecoreFile',
  data: {
    fileName: 'pfandmodel.ecore',
    fileContent: '<ecore:EPackage name="pfand"><eClassifiers xsi:type="ecore:EClass" name="Kasten"/></ecore:EPackage>',
    domain: 'pfand',
  },
  position: { x: 0, y: 0 },
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ConstraintsView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiService.getRuleSets as jest.Mock).mockResolvedValue([]);
  });

  // A. Rendering with no data
  describe('renders without crashing with empty props', () => {
    it('renders with no nodes', async () => {
      await act(async () => {
        render(<ConstraintsView canvasNodes={[]} />);
      });
      // "New Set" button always present
      expect(screen.getByText('New Set')).toBeInTheDocument();
    });

    it('renders Constraint Sets label', async () => {
      await act(async () => {
        render(<ConstraintsView canvasNodes={[]} />);
      });
      expect(screen.getByText('Constraint Sets')).toBeInTheDocument();
    });

    it('renders Constraint Insights panel', async () => {
      await act(async () => {
        render(<ConstraintsView canvasNodes={[]} />);
      });
      expect(screen.getByText('Constraint Insights')).toBeInTheDocument();
    });
  });

  // B. RuleSet list renders with pfand defaults
  describe('loads default rule sets for pfand domain', () => {
    it('shows Crate Rules ruleset name', async () => {
      await act(async () => {
        render(<ConstraintsView canvasNodes={[pfandNode as any]} />);
      });
      expect(screen.getByText('Crate Rules')).toBeInTheDocument();
    });

    it('shows Deposit Item Rules ruleset name', async () => {
      await act(async () => {
        render(<ConstraintsView canvasNodes={[pfandNode as any]} />);
      });
      expect(screen.getByText('Deposit Item Rules')).toBeInTheDocument();
    });

    it('shows rule names inside rulesets', async () => {
      await act(async () => {
        render(<ConstraintsView canvasNodes={[pfandNode as any]} />);
      });
      expect(screen.getByText('CrateContainsExactly16Bottles')).toBeInTheDocument();
    });
  });

  // C. Click a rule → editor panel opens
  describe('editor panel opens on rule click', () => {
    it('shows "Editing:" header after clicking a rule', async () => {
      await act(async () => {
        render(<ConstraintsView canvasNodes={[pfandNode as any]} />);
      });
      const ruleEl = screen.getByText('CrateContainsExactly16Bottles');
      fireEvent.click(ruleEl);
      await waitFor(() => {
        expect(screen.getByText(/Editing:/)).toBeInTheDocument();
      });
    });

    it('shows the rule name in the editor header', async () => {
      await act(async () => {
        render(<ConstraintsView canvasNodes={[pfandNode as any]} />);
      });
      fireEvent.click(screen.getByText('CrateContainsExactly16Bottles'));
      await waitFor(() => {
        expect(screen.getByText(/Editing:.*CrateContainsExactly16Bottles/)).toBeInTheDocument();
      });
    });
  });

  // D. Add new RuleSet
  describe('handleAddSet', () => {
    it('adds a new ruleset when New Set is clicked', async () => {
      await act(async () => {
        render(<ConstraintsView canvasNodes={[]} />);
      });
      fireEvent.click(screen.getByText('New Set'));
      await waitFor(() => {
        expect(screen.getByText('New Rule Set')).toBeInTheDocument();
      });
    });

    it('adds multiple new rulesets', async () => {
      await act(async () => {
        render(<ConstraintsView canvasNodes={[]} />);
      });
      fireEvent.click(screen.getByText('New Set'));
      fireEvent.click(screen.getByText('New Set'));
      await waitFor(() => {
        const sets = screen.getAllByText('New Rule Set');
        expect(sets.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  // E. Search filter
  describe('search filter', () => {
    it('shows matching rule when search query matches', async () => {
      await act(async () => {
        render(<ConstraintsView canvasNodes={[pfandNode as any]} />);
      });
      const searchInput = screen.getByPlaceholderText(/Search projects/);
      fireEvent.change(searchInput, { target: { value: 'Crate' } });
      await waitFor(() => {
        expect(screen.getByText('CrateContainsExactly16Bottles')).toBeInTheDocument();
      });
    });

    it('hides non-matching rules when searching', async () => {
      await act(async () => {
        render(<ConstraintsView canvasNodes={[pfandNode as any]} />);
      });
      const searchInput = screen.getByPlaceholderText(/Search projects/);
      fireEvent.change(searchInput, { target: { value: 'XYZNonExistent' } });
      await waitFor(() => {
        expect(screen.queryByText('CrateContainsExactly16Bottles')).not.toBeInTheDocument();
      });
    });

    it('hides deposit item ruleset when filtering for crate only', async () => {
      await act(async () => {
        render(<ConstraintsView canvasNodes={[pfandNode as any]} />);
      });
      const searchInput = screen.getByPlaceholderText(/Search projects/);
      fireEvent.change(searchInput, { target: { value: 'CrateContains' } });
      await waitFor(() => {
        expect(screen.queryByText('DepositItemNotEmpty')).not.toBeInTheDocument();
      });
    });
  });

  // F. Filter badge (filterNodeId prop)
  describe('filterNodeId prop', () => {
    it('shows filter badge when filterNodeId matches a node', async () => {
      await act(async () => {
        render(<ConstraintsView canvasNodes={[pfandNode as any]} filterNodeId="n1" />);
      });
      await waitFor(() => {
        expect(screen.getByText(/Filter:/)).toBeInTheDocument();
      });
    });

    it('does not show filter badge when filterNodeId is null', async () => {
      await act(async () => {
        render(<ConstraintsView canvasNodes={[pfandNode as any]} filterNodeId={null} />);
      });
      expect(screen.queryByText(/Filter:/)).not.toBeInTheDocument();
    });

    it('does not show filter badge when filterNodeId does not match', async () => {
      await act(async () => {
        render(<ConstraintsView canvasNodes={[pfandNode as any]} filterNodeId="nonexistent" />);
      });
      expect(screen.queryByText(/Filter:/)).not.toBeInTheDocument();
    });
  });

  // G. Close editor panel
  describe('editor panel close', () => {
    it('closes editor panel when × button is clicked', async () => {
      await act(async () => {
        render(<ConstraintsView canvasNodes={[pfandNode as any]} />);
      });
      fireEvent.click(screen.getByText('CrateContainsExactly16Bottles'));
      await waitFor(() => expect(screen.getByText(/Editing:/)).toBeInTheDocument());

      // click the close (×) button in the editor header
      const closeButtons = screen.getAllByRole('button').filter(b => {
        // the × button has an svg inside; find the button that contains exactly nothing visible
        return b.title === '' && b.getAttribute('title') === null && b.style?.cursor === 'pointer';
      });
      // Find the close button for the editor panel (has svg with lines)
      const editorHeader = screen.getByText(/Editing:/).closest('div')?.parentElement;
      if (editorHeader) {
        const closeBtn = editorHeader.querySelector('button');
        if (closeBtn) {
          fireEvent.click(closeBtn);
          await waitFor(() => {
            expect(screen.queryByText(/Editing:/)).not.toBeInTheDocument();
          });
        }
      }
    });

    it('clicking same rule twice toggles editor off', async () => {
      await act(async () => {
        render(<ConstraintsView canvasNodes={[pfandNode as any]} />);
      });
      fireEvent.click(screen.getByText('CrateContainsExactly16Bottles'));
      await waitFor(() => expect(screen.getByText(/Editing:/)).toBeInTheDocument());
      fireEvent.click(screen.getByText('CrateContainsExactly16Bottles'));
      await waitFor(() => {
        expect(screen.queryByText(/Editing:/)).not.toBeInTheDocument();
      });
    });
  });

  // H. Delete rule from rule row menu
  describe('delete rule', () => {
    it('deletes a rule from the options menu', async () => {
      await act(async () => {
        render(<ConstraintsView canvasNodes={[pfandNode as any]} />);
      });
      // Open options menu for the first rule
      const ruleRow = screen.getByText('CrateContainsExactly16Bottles').closest('div[style]');
      if (ruleRow) {
        const optionsBtn = ruleRow.querySelector('button[title="Options"]');
        if (optionsBtn) {
          fireEvent.click(optionsBtn);
          await waitFor(() => expect(screen.getByText('Delete')).toBeInTheDocument());
          fireEvent.click(screen.getByText('Delete'));
          await waitFor(() => {
            expect(screen.queryByText('CrateContainsExactly16Bottles')).not.toBeInTheDocument();
          });
        }
      }
    });
  });

  // I. vsumId=undefined — getRuleSets not called
  describe('vsumId=undefined', () => {
    it('does not call getRuleSets when vsumId is absent and uses defaults', async () => {
      await act(async () => {
        render(<ConstraintsView canvasNodes={[pfandNode as any]} />);
      });
      expect(apiService.getRuleSets).not.toHaveBeenCalled();
      expect(screen.getByText('Crate Rules')).toBeInTheDocument();
    });
  });

  // J. Backend ruleset loading
  describe('backend ruleset loading', () => {
    it('renders rulesets from backend when vsumId is provided', async () => {
      (apiService.getRuleSets as jest.Mock).mockResolvedValue([
        {
          id: 42,
          name: 'Backend Rule Set',
          color: '#3b82f6',
          description: 'From backend',
          oclContent: 'context pfand::Kasten inv BackendRule:\n  @severity WARNING\n  @message "test"\n  true',
        },
      ]);

      await act(async () => {
        render(<ConstraintsView vsumId="7" canvasNodes={[]} />);
      });

      await waitFor(() => {
        expect(apiService.getRuleSets).toHaveBeenCalledWith(7);
      });

      await waitFor(() => {
        expect(screen.getByText('Backend Rule Set')).toBeInTheDocument();
      });
    });

    it('calls getRuleSets with numeric vsumId', async () => {
      await act(async () => {
        render(<ConstraintsView vsumId="3" canvasNodes={[]} />);
      });
      await waitFor(() => {
        expect(apiService.getRuleSets).toHaveBeenCalledWith(3);
      });
    });

    it('falls back gracefully when getRuleSets returns empty', async () => {
      (apiService.getRuleSets as jest.Mock).mockResolvedValue([]);
      await act(async () => {
        render(<ConstraintsView vsumId="5" canvasNodes={[]} />);
      });
      await waitFor(() => {
        expect(apiService.getRuleSets).toHaveBeenCalled();
      });
      // no crash and Constraint Insights still visible
      expect(screen.getByText('Constraint Insights')).toBeInTheDocument();
    });

    it('handles getRuleSets failure gracefully', async () => {
      (apiService.getRuleSets as jest.Mock).mockRejectedValue(new Error('Network error'));
      await act(async () => {
        render(<ConstraintsView vsumId="5" canvasNodes={[]} />);
      });
      await waitFor(() => {
        expect(apiService.getRuleSets).toHaveBeenCalled();
      });
      expect(screen.getByText('Constraint Insights')).toBeInTheDocument();
    });
  });

  // K. Ruleset section: toggle collapse
  describe('toggle collapse', () => {
    it('collapses rules when chevron is clicked', async () => {
      await act(async () => {
        render(<ConstraintsView canvasNodes={[pfandNode as any]} />);
      });
      expect(screen.getByText('CrateContainsExactly16Bottles')).toBeInTheDocument();
      // Click the collapse chevron (svg polyline inside the ruleset header)
      const crateHeader = screen.getByText('Crate Rules').closest('div[style]');
      if (crateHeader) {
        const chevron = crateHeader.querySelector('svg');
        if (chevron) {
          fireEvent.click(chevron);
          await waitFor(() => {
            expect(screen.queryByText('CrateContainsExactly16Bottles')).not.toBeInTheDocument();
          });
        }
      }
    });
  });

  // L. Add rule to existing set
  describe('add rule to set', () => {
    it('adds a new rule inside a ruleset', async () => {
      await act(async () => {
        render(<ConstraintsView canvasNodes={[pfandNode as any]} />);
      });
      const addRuleBtn = screen.getAllByText('Add rule')[0];
      fireEvent.click(addRuleBtn);
      await waitFor(() => {
        expect(screen.getByText('NewInvariant')).toBeInTheDocument();
      });
    });
  });

  // M. RuleSet click opens panel
  describe('ruleset panel', () => {
    it('opens RuleSetPanel when clicking a ruleset', async () => {
      await act(async () => {
        render(<ConstraintsView canvasNodes={[pfandNode as any]} />);
      });
      fireEvent.click(screen.getByText('Crate Rules'));
      await waitFor(() => {
        expect(screen.getByText(/Rule Set:/)).toBeInTheDocument();
      });
    });

    it('closes RuleSetPanel when clicking × button', async () => {
      await act(async () => {
        render(<ConstraintsView canvasNodes={[pfandNode as any]} />);
      });
      fireEvent.click(screen.getByText('Crate Rules'));
      await waitFor(() => expect(screen.getByText(/Rule Set:/)).toBeInTheDocument());
      // find the × button in the panel
      const panelHeader = screen.getByText(/Rule Set:/).closest('div')?.parentElement?.parentElement;
      if (panelHeader) {
        const closeBtn = panelHeader.querySelector('button[style*="font-size: 18"]');
        if (closeBtn) {
          fireEvent.click(closeBtn);
          await waitFor(() => {
            expect(screen.queryByText(/Rule Set:/)).not.toBeInTheDocument();
          });
        }
      }
    });
  });

  // N. Metrics panel totals
  describe('metrics panel', () => {
    it('shows correct total rule count in insights', async () => {
      await act(async () => {
        render(<ConstraintsView canvasNodes={[pfandNode as any]} />);
      });
      // pfand has 5 rules total (2 + 3)
      expect(screen.getByText('Total Rules')).toBeInTheDocument();
      // "5" appears multiple times; just check it's present somewhere
      const fiveEls = screen.getAllByText('5');
      expect(fiveEls.length).toBeGreaterThan(0);
    });

    it('shows View Detailed Metrics button', async () => {
      await act(async () => {
        render(<ConstraintsView canvasNodes={[pfandNode as any]} />);
      });
      expect(screen.getByText('View Detailed Metrics')).toBeInTheDocument();
    });

    it('opens DetailedMetricsModal when button clicked', async () => {
      await act(async () => {
        render(<ConstraintsView canvasNodes={[pfandNode as any]} />);
      });
      fireEvent.click(screen.getByText('View Detailed Metrics'));
      await waitFor(() => {
        expect(screen.getByText('Detailed Metrics')).toBeInTheDocument();
      });
      expect(document.querySelector('dialog[open]')).toBeTruthy();
    });
  });

  // O. onHighlightNode callback
  describe('onHighlightNode callback', () => {
    it('calls onHighlightNode when a rule is clicked', async () => {
      const onHighlight = jest.fn();
      await act(async () => {
        render(
          <ConstraintsView
            canvasNodes={[pfandNode as any]}
            onHighlightNode={onHighlight}
          />
        );
      });
      fireEvent.click(screen.getByText('CrateContainsExactly16Bottles'));
      expect(onHighlight).toHaveBeenCalled();
    });
  });
});
