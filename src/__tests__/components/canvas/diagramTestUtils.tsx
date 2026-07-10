import React, { Ref } from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { UMLDiagram, UMLDiagramHandle, UMLDiagramProps } from '../../../components/canvas/UMLDiagram';
import { SIMPLE_ECORE } from './diagramTestFixtures';

const STABLE_EMPTY_ADDITIONAL_MODELS: NonNullable<UMLDiagramProps['additionalModels']> = [];

type DiagramProps = Partial<UMLDiagramProps> & {
  ref?: Ref<UMLDiagramHandle>;
};

export function renderDiagram(
  props: DiagramProps = {},
  options?: RenderOptions,
): RenderResult {
  const { ref, additionalModels = STABLE_EMPTY_ADDITIONAL_MODELS, ...rest } = props;
  return render(
    <UMLDiagram
      ref={ref}
      ecoreContent={SIMPLE_ECORE}
      additionalModels={additionalModels}
      interactive
      {...rest}
    />,
    options,
  );
}
