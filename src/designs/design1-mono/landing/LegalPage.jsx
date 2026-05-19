import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import finalTheme, { MONO } from './landingTheme';

const pages = {
  privacy: {
    title: 'Privacy',
    eyebrow: 'Privacy notes',
    sections: [
      ['Local scoring first', 'Guest matches and history can be stored locally on your device so scoring does not require an account.'],
      ['Cloud features', 'Sign-in, profile search, backup, and sync may use connected cloud services when you choose to use them.'],
      ['Control', 'You can keep using Score Easy without signing in, and you can clear local match history from the app.'],
    ],
  },
  terms: {
    title: 'Terms',
    eyebrow: 'Use notes',
    sections: [
      ['Scorekeeping tool', 'Score Easy helps organize games, tournaments, and match history. Review scores before sharing or relying on them.'],
      ['Fair use', 'Do not use the app to publish abusive, unlawful, or misleading content.'],
      ['Availability', 'Local scoring is designed to keep working without cloud services, while sync and account features depend on connectivity.'],
    ],
  },
  contact: {
    title: 'Contact',
    eyebrow: 'Support',
    sections: [
      ['Support email', 'For privacy, support, or store review questions, contact support@scoreeasy.app.'],
      ['Useful details', 'Include your sport, device, browser or app version, and the route where the issue happened.'],
      ['Fast path', 'For scoring bugs, include the match format and the last action before the issue.'],
    ],
  },
};

export default function LegalPage({ type }) {
  const t = finalTheme;
  const page = pages[type] || pages.privacy;

  return (
    <div style={{ minHeight: '100vh', background: t.bg, color: t.text }}>
      <main style={{ maxWidth: 860, margin: '0 auto', padding: '48px 24px 72px' }}>
        <Link to="/" style={{ fontFamily: MONO, fontSize: '0.75rem', color: t.textMuted, textDecoration: 'none' }}>
          SCORE EASY
        </Link>
        <p style={{ fontFamily: MONO, fontSize: '0.75rem', letterSpacing: '0.12em', color: t.textFaint, margin: '48px 0 12px' }}>
          {page.eyebrow.toUpperCase()}
        </p>
        <h1 style={{ fontSize: 'clamp(2.5rem, 8vw, 5rem)', lineHeight: 0.95, margin: '0 0 28px', fontWeight: 900 }}>
          {page.title}
        </h1>
        <div style={{ display: 'grid', gap: 2, borderTop: `2px solid ${t.borderStrong}` }}>
          {page.sections.map(([heading, body]) => (
            <section key={heading} style={{ padding: '22px 0', borderBottom: `1px solid ${t.border}` }}>
              <h2 style={{ fontFamily: MONO, fontSize: '0.875rem', letterSpacing: '0.08em', margin: '0 0 8px' }}>
                {heading.toUpperCase()}
              </h2>
              <p style={{ margin: 0, color: t.textSoft, lineHeight: 1.65 }}>
                {body}
              </p>
            </section>
          ))}
        </div>
        <Link to="/play" style={{
          display: 'inline-block',
          marginTop: 28,
          fontFamily: MONO,
          fontSize: '0.8125rem',
          fontWeight: 700,
          padding: '12px 22px',
          letterSpacing: '0.05em',
          textDecoration: 'none',
          background: t.text,
          color: t.bg,
          border: `2px solid ${t.text}`,
        }}>
          PLAY NOW
        </Link>
      </main>
    </div>
  );
}

LegalPage.propTypes = {
  type: PropTypes.oneOf(['privacy', 'terms', 'contact']).isRequired,
};
