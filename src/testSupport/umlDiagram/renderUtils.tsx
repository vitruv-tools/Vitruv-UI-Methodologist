import React, { ComponentProps, Ref } from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { UMLDiagram, UMLDiagramHandle } from '../../components/canvas/UMLDiagram';
import { SIMPLE_ECORE } from './fixtures';

type UMLDiagramProps = ComponentProps<typeof UMLDiagram>;

type DiagramProps = Partial<UMLDiagramProps> & {
  ref?: Ref<UMLDiagramHandle>;
};

export function renderDiagram(
  props: DiagramProps = {},
  options?: RenderOptions,
): RenderResult {
  const { ref, ...rest } = props;
  return render(
    <UMLDiagram
      ref={ref}
      ecoreContent={SIMPLE_ECORE}
      interactive
      {...rest}
    />,
    options,
  );
}
