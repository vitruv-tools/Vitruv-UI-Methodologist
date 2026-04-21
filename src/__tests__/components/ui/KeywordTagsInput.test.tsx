import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { KeywordTagsInput } from '../../../components/ui/KeywordTagsInput';
import userEvent from '@testing-library/user-event';

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


describe('KeywordTagsInput – additional tests', () => {
  it('renders existing keywords as tags', () => {
    render(
      <KeywordTagsInput keywords={['react', 'typescript']} onChange={jest.fn()} />,
    );
    expect(screen.getByText('react')).toBeInTheDocument();
    expect(screen.getByText('typescript')).toBeInTheDocument();
  });

  it('calls onChange with new keyword when Enter is pressed', async () => {
    const onChange = jest.fn();
    render(<KeywordTagsInput keywords={[]} onChange={onChange} />);

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'modeling{Enter}');

    expect(onChange).toHaveBeenCalledWith(['modeling']);
  });

  it('calls onChange with multiple keywords when comma-separated input is given', async () => {
    const onChange = jest.fn();
    render(<KeywordTagsInput keywords={[]} onChange={onChange} />);

    const input = screen.getByRole('textbox');
    // Type "ecore,uml," — the comma triggers splitting
    await userEvent.type(input, 'ecore,uml,');

    // First comma triggers adding 'ecore', second triggers 'uml'
    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCall).toContain('uml');
  });

  it('removes keyword when × button is clicked', () => {
    const onChange = jest.fn();
    render(
      <KeywordTagsInput keywords={['react', 'ecore']} onChange={onChange} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Remove react/i }));
    expect(onChange).toHaveBeenCalledWith(['ecore']);
  });

  it('does not add duplicate keywords', async () => {
    const onChange = jest.fn();
    render(<KeywordTagsInput keywords={['react']} onChange={onChange} />);

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'react{Enter}');

    // onChange should not be called since 'react' already exists
    expect(onChange).not.toHaveBeenCalled();
  });

  it('adds keyword on blur when input has text', async () => {
    const onChange = jest.fn();
    render(<KeywordTagsInput keywords={[]} onChange={onChange} />);

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'vitruvius');
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith(['vitruvius']);
  });

  it('does not add empty keyword on Enter', async () => {
    const onChange = jest.fn();
    render(<KeywordTagsInput keywords={[]} onChange={onChange} />);

    const input = screen.getByRole('textbox');
    await userEvent.type(input, '   {Enter}');

    expect(onChange).not.toHaveBeenCalled();
  });

  it('renders custom id on input element', () => {
    render(
      <KeywordTagsInput
        keywords={[]}
        onChange={jest.fn()}
        id="keywords-field"
      />,
    );
    expect(document.getElementById('keywords-field')).not.toBeNull();
  });
});