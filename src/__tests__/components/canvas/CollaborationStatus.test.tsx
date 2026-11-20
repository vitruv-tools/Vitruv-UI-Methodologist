import { render, screen } from '@testing-library/react';
import { CollaborationStatus, collaborationStatusProps } from '../../../components/canvas/CollaborationStatus';

const live = { status: 'connected' as const, synced: true, writebackError: null, failure: null, unavailable: false };

describe('CollaborationStatus', () => {
  it('shows nothing while all is well', () => {
    const { container } = render(<CollaborationStatus {...live} />);

    expect(container).toBeEmptyDOMElement();
  });

  it.each(['connecting', 'disconnected'] as const)('says the connection is lost, and that changes are kept, when it is %s', (status) => {
    render(<CollaborationStatus {...live} status={status} synced={false} />);

    const message = screen.getByRole('status');
    expect(message).toHaveTextContent('Connection lost');
    expect(message).toHaveTextContent('changes are kept');
  });

  it('shows why the last changes could not be saved', () => {
    render(<CollaborationStatus {...live} writebackError="The changes could not be saved: View name is not unique" />);

    expect(screen.getByRole('status')).toHaveTextContent('The changes could not be saved: View name is not unique');
  });

  it('asks to reload the page if the project cannot be kept in sync any more', () => {
    render(<CollaborationStatus {...live} status="disconnected" synced={false} failure="outdated" />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Reload the page');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('says the project can be looked at but not changed if it could not be joined', () => {
    render(<CollaborationStatus {...live} status="connecting" synced={false} unavailable />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('collaboration server');
    expect(alert).toHaveTextContent('can not be changed');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('puts the loss of the connection before a failed writeback, since that explains it', () => {
    render(<CollaborationStatus {...live} status="disconnected" synced={false} writebackError="The changes could not be saved" />);

    expect(screen.getByRole('status')).toHaveTextContent('Connection lost');
    expect(screen.getByRole('status')).not.toHaveTextContent('could not be saved');
  });
});

describe('collaborationStatusProps', () => {
  const connection = { status: 'connected', synced: true, writebackError: null, failure: null } as never;
  const state = (overrides: object) => ({ enabled: true, connection, sync: {}, holding: false, unavailable: false, ...overrides }) as never;

  it('has nothing to show without collaboration, before there is a connection, or while joining', () => {
    expect(collaborationStatusProps(state({ enabled: false }))).toBeNull();
    expect(collaborationStatusProps(state({ connection: null }))).toBeNull();
    expect(collaborationStatusProps(state({ sync: null }))).toBeNull();
  });

  it('describes the connection once the project is shown, or can not be joined', () => {
    expect(collaborationStatusProps(state({}))).toEqual({ ...live, unavailable: false });
    expect(collaborationStatusProps(state({ sync: null, unavailable: true }))).toEqual({ ...live, unavailable: true });
  });
});
