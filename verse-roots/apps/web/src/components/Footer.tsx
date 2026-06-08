import './Footer.css';

export function Footer() {
  return (
    <footer className="app-footer">
      <span>
        Lexicon and tagged-text data &copy;{' '}
        <a href="https://www.stepbible.org" target="_blank" rel="noopener noreferrer">
          STEPBible.org
        </a>
        ,{' '}
        <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">
          CC BY 4.0
        </a>
      </span>
      <span className="footer-sep">&middot;</span>
      <span>
        Original-language texts:{' '}
        <a href="https://github.com/STEPBible/STEPBible-Data" target="_blank" rel="noopener noreferrer">
          TAHOT
        </a>{' '}
        (Hebrew OT) &amp;{' '}
        <a href="https://github.com/STEPBible/STEPBible-Data" target="_blank" rel="noopener noreferrer">
          TAGNT
        </a>{' '}
        (Greek NT)
      </span>
      <span className="footer-sep">&middot;</span>
      <span>KJV translation: public domain</span>
      <span className="footer-sep">&middot;</span>
      <span>Made with ♥ for Bible study</span>
    </footer>
  );
}
