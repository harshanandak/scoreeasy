import GuestLanding from './GuestLanding';

export default function PublicHome() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--se-color-canvas)' }}>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <main id="main-content"><GuestLanding /></main>
    </div>
  );
}
