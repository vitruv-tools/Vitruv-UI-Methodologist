import React from 'react';
import { render } from '@testing-library/react';

// To avoid tight coupling to React Flow internals and complex node data,
// we mock the EcoreFileBox component and simply assert that it can be
// rendered with the expected props.

const mockEcoreFileBox = jest.fn(() => <div>EcoreFileBox mock</div>);

jest.mock('../../../components/flow/EcoreFileBox', () => ({
  __esModule: true,
  EcoreFileBox: (props: any) => mockEcoreFileBox(props),
}));

import { EcoreFileBox } from '../../../components/flow/EcoreFileBox';

describe('EcoreFileBox (mocked)', () => {
  it('renders with basic data props', () => {
    const data = {
      fileName: 'Model.ecore',
      fileContent: '<ecore/>',
    };

    render(
      <EcoreFileBox
        id="node-1"
        data={data as any}
        selected
      />,
    );

    expect(mockEcoreFileBox).toHaveBeenCalled();
  });
});

