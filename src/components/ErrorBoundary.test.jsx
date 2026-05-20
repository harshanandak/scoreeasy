import { createRef } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ErrorBoundary from './ErrorBoundary';

vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
}));

describe('ErrorBoundary', () => {
  it('lets users retry after a recoverable route crash', () => {
    const boundaryRef = createRef();
    render(
      <ErrorBoundary ref={boundaryRef}>
        <p>Recovered content</p>
      </ErrorBoundary>,
    );

    act(() => {
      boundaryRef.current.setState({ hasError: true, error: new Error('test crash') });
    });

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(screen.getByText('Recovered content')).toBeInTheDocument();
  });
});
