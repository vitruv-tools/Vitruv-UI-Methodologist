import React from 'react';
import type { BuildFailure, BuildProblem } from '../../types/vsumBuild';
import { BuildProblemsDialog } from './BuildProblemsDialog';

interface ValidationProblemsDialogProps {
  readonly open: boolean;
  /** The current validation problems; the dialog stays closed while there are none. */
  readonly failure: BuildFailure | null;
  readonly onClose: () => void;
  readonly onOpenProblem: (problem: BuildProblem) => boolean;
}

/** The validation problems of the open project, shown in the build problems dialog. */
export const ValidationProblemsDialog: React.FC<ValidationProblemsDialogProps> = ({
  open,
  failure,
  onClose,
  onOpenProblem,
}) => (
  <BuildProblemsDialog
    failure={open ? failure : null}
    title="Problems in this project"
    onClose={onClose}
    onOpenProblem={onOpenProblem}
  />
);
