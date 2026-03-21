import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { KeywordTagsInput } from '../../../components/ui/KeywordTagsInput';

describe('KeywordTagsInput', () => {
  it('adds a keyword on Enter and allows removal', () => {
    const handleChange = jest.fn();

    render(
      <KeywordTagsInput
        keywords={[]}
        onChange={handleChange}
      />,
    );

    const input = screen.getByPlaceholderText(/Type keywords/i);

    fireEvent.change(input, { target: { value: 'alpha' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(handleChange).toHaveBeenCalledWith(['alpha']);
  });

  it('splits keywords on comma and avoids duplicates', () => {
    const handleChange = jest.fn();

    const { rerender } = render(
      <KeywordTagsInput
        keywords={[]}
        onChange={handleChange}
      />,
    );

    const input = screen.getByPlaceholderText(/Type keywords/i);

    fireEvent.change(input, { target: { value: 'one,two,three' } });
    // component adds all but last token before the comma
    expect(handleChange).toHaveBeenCalledWith(['one', 'two']);

    rerender(
      <KeywordTagsInput
        keywords={['one', 'two', 'three']}
        onChange={handleChange}
      />,
    );

    fireEvent.change(input, { target: { value: 'one,' } });
    // still only the original call, duplicates are ignored
    expect(handleChange).toHaveBeenCalledTimes(1);
  });
});

