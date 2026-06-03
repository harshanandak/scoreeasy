import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import LegalPage from './LegalPage';

function renderLegalPage(type) {
  return render(
    <MemoryRouter>
      <LegalPage type={type} />
    </MemoryRouter>,
  );
}

describe('LegalPage', () => {
  it('discloses local, cloud, and third-party privacy behavior', () => {
    renderLegalPage('privacy');

    expect(screen.getByRole('heading', { level: 1, name: 'Privacy' })).toBeInTheDocument();
    expect(screen.getByText(/localStorage/i)).toBeInTheDocument();
    expect(screen.getByText(/Convex/i)).toBeInTheDocument();
    expect(screen.getByText(/Clerk/i)).toBeInTheDocument();
    expect(screen.getByText(/Sentry/i)).toBeInTheDocument();
  });

  it('sets expectations for unofficial scorekeeping and shared results', () => {
    renderLegalPage('terms');

    expect(screen.getByRole('heading', { level: 1, name: 'Terms' })).toBeInTheDocument();
    expect(screen.getByText(/not an official referee record/i)).toBeInTheDocument();
    expect(screen.getByText(/Review scores before sharing/i)).toBeInTheDocument();
  });
});
