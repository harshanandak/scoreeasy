import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import LegalPage from './LegalPage';
import { CONTACT_EMAIL, OPERATOR, pages } from './legalContent';

function renderLegalPage(type) {
  return render(
    <MemoryRouter>
      <LegalPage type={type} />
    </MemoryRouter>,
  );
}

describe('LegalPage', () => {
  it('names the operator and contact on every page', () => {
    for (const type of ['privacy', 'terms', 'contact']) {
      const { unmount } = renderLegalPage(type);
      expect(screen.getAllByText(new RegExp(OPERATOR)).length).toBeGreaterThan(0);
      const mail = screen.getAllByRole('link', { name: new RegExp(CONTACT_EMAIL) });
      expect(mail[0]).toHaveAttribute('href', `mailto:${CONTACT_EMAIL}`);
      unmount();
    }
  });

  it('discloses what is collected, what is public, retention, deletion and age', () => {
    renderLegalPage('privacy');

    expect(screen.getByRole('heading', { level: 1, name: 'Privacy' })).toBeInTheDocument();
    for (const heading of [
      'What stays on your device',
      'What we collect when you sign in',
      'What is public',
      'Sharing a match live',
      'Crash reports',
      'Other services we use',
      'How long we keep data',
      'Deleting your data',
      'Children',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name: heading })).toBeInTheDocument();
    }
    for (const service of ['Clerk', 'Convex', 'Cloudflare', 'Sentry']) {
      expect(screen.getAllByText(new RegExp(service)).length).toBeGreaterThan(0);
    }
    expect(screen.getByText(/at least 13/)).toBeInTheDocument();
    expect(screen.getByText(/We do not sell your data/)).toBeInTheDocument();
  });

  it('does not promise an in-app account deletion that does not exist', () => {
    renderLegalPage('privacy');

    expect(screen.getByText(/cannot yet delete your account/)).toBeInTheDocument();
    const text = JSON.stringify(pages);
    expect(text).not.toMatch(/delete (your )?account in the app/i);
    expect(text).not.toMatch(/Delete account button/i);
  });

  it('sets expectations for unofficial scorekeeping and shared results', () => {
    renderLegalPage('terms');

    expect(screen.getByRole('heading', { level: 1, name: 'Terms' })).toBeInTheDocument();
    expect(screen.getByText(/not an official referee or tournament record/i)).toBeInTheDocument();
    expect(screen.getByText(/Check scores before you share them/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Sharing live' })).toBeInTheDocument();
  });

  it('links the other legal pages and the app brand', () => {
    renderLegalPage('terms');

    expect(screen.getByRole('link', { name: 'Score Easy' })).toHaveAttribute('href', '/app');
    const legal = within(screen.getByRole('navigation', { name: 'Legal' }));
    expect(legal.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
    expect(legal.getByRole('link', { name: 'Contact' })).toHaveAttribute('href', '/contact');
    expect(legal.queryByRole('link', { name: 'Terms' })).toBeNull();
  });
});
