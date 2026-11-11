import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { BrandMark, GoArrow, KitSection } from '../kit/KitParts';
import '../kit/history.css';
import './landing.css';
import './legal.css';
import { CONTACT_EMAIL, LAST_UPDATED, pages } from './legalContent';

/* Privacy, Terms and Contact, in the Kit look of the guest landing. The words live in
   legalContent.js; this file only lays them out. The contact address is turned into a mailto link
   wherever it appears in a sentence. */

const NAV = [
  { type: 'privacy', label: 'Privacy', to: '/privacy' },
  { type: 'terms', label: 'Terms', to: '/terms' },
  { type: 'contact', label: 'Contact', to: '/contact' },
];

function Text({ children }) {
  const parts = children.split(CONTACT_EMAIL);
  return parts.flatMap((part, i) => (i === 0
    ? [part]
    : [<a key={`mail-${i}`} className="kit-legal-mail" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>, part]));
}

Text.propTypes = { children: PropTypes.string.isRequired };

function headingId(type, index) {
  return `legal-${type}-${index}`;
}

export default function LegalPage({ type }) {
  const page = pages[type] || pages.privacy;
  const current = pages[type] ? type : 'privacy';

  return (
    <div className="kit-screen kit-legal" data-screen={`legal-${current}`}>
      <div className="kit-top">
        <Link className="kit-brand kit-legal-brand" to="/app">
          <BrandMark />
          <span>Score Easy</span>
        </Link>
      </div>

      <header className="kit-legal-head">
        <h1 className="kit-title">{page.title}</h1>
        <p className="kit-sub">{page.lead}</p>
        {current !== 'contact' && <p className="kit-legal-date">Last updated {LAST_UPDATED}</p>}
      </header>

      {page.blocks.map((block, index) => (
        <section key={block.heading} aria-labelledby={headingId(current, index)}>
          <KitSection id={headingId(current, index)} title={block.heading} />
          <div className="kit-card kit-legal-card">
            {block.paragraphs?.map((text) => <p key={text}><Text>{text}</Text></p>)}
            {block.items && (
              <ul>
                {block.items.map((item) => <li key={item}><Text>{item}</Text></li>)}
              </ul>
            )}
            {block.after?.map((text) => <p key={text}><Text>{text}</Text></p>)}
          </div>
        </section>
      ))}

      {current === 'contact' && (
        <div className="kit-landing-actions kit-legal-actions">
          <a className="se-go" href={`mailto:${CONTACT_EMAIL}`}>Email us <GoArrow /></a>
        </div>
      )}

      <footer className="kit-landing-foot">
        <nav aria-label="Legal">
          {NAV.filter((item) => item.type !== current).map(({ label, to }) => (
            <Link key={label} to={to}>{label}</Link>
          ))}
        </nav>
        <Link to="/play">Start scoring</Link>
      </footer>
    </div>
  );
}

LegalPage.propTypes = {
  type: PropTypes.oneOf(['privacy', 'terms', 'contact']).isRequired,
};
