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
    for (const service of ['Clerk', 'Convex', 'Cloudflare', 'Sentry', 'Google Fonts']) {
      expect(screen.getAllByText(new RegExp(service)).length).toBeGreaterThan(0);
    }
    expect(screen.getByText(/at least 13/)).toBeInTheDocument();
    expect(screen.getByText(/We do not sell your data/)).toBeInTheDocument();
  });

  it('offers email deletion and promises no in-app deletion or Clerk behaviour', () => {
    renderLegalPage('privacy');

    expect(screen.getAllByText(/To delete your Score Easy data/).length).toBeGreaterThan(0);
    const text = JSON.stringify(pages);
    expect(text).not.toMatch(/delete (your )?account in the app/i);
    expect(text).not.toMatch(/Delete account button/i);
    expect(text).not.toMatch(/no (in-app )?account deletion/i);
    expect(text).not.toMatch(/cannot yet delete/i);
  });

  it('describes sharing only as the code does it', () => {
    renderLegalPage('privacy');

    expect(screen.getByText(/Stop sharing needs a connection/)).toBeInTheDocument();
    expect(screen.getByText(/24 hours after our server receives the finished match/)).toBeInTheDocument();
    expect(screen.getByText(/Signed-in users can search usernames/)).toBeInTheDocument();
    const text = JSON.stringify(pages.privacy);
    expect(text).not.toMatch(/jersey/i);
    expect(text).not.toMatch(/notes you add/i);
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
