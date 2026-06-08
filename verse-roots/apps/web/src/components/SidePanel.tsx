import { useState } from 'react';
import { OriginalWord, StrongsEntry } from '../types';
import './SidePanel.css';

interface SidePanelProps {
  word: OriginalWord;
  strongs: StrongsEntry | null;
  onClose: () => void;
}

type Tab = 'lexicon' | 'concordance' | 'study';

export function SidePanel({ word, strongs, onClose }: SidePanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('lexicon');

  return (
    <aside className="side-panel">
      <div className="side-panel__header">
        <div className="side-panel__word-info">
          <span className="side-panel__original">{word.originalText}</span>
          {word.strongs && (
            <span className="side-panel__strongs">{word.strongs}</span>
          )}
        </div>
        <button className="side-panel__close" onClick={onClose} aria-label="Close panel">
          ×
        </button>
      </div>

      <div className="side-panel__tabs">
        <button
          className={`tab-btn${activeTab === 'lexicon' ? ' tab-btn--active' : ''}`}
          onClick={() => setActiveTab('lexicon')}
        >
          Lexicon
        </button>
        <button
          className={`tab-btn${activeTab === 'concordance' ? ' tab-btn--active' : ''}`}
          onClick={() => setActiveTab('concordance')}
        >
          Concordance
        </button>
        <button
          className={`tab-btn${activeTab === 'study' ? ' tab-btn--active' : ''}`}
          onClick={() => setActiveTab('study')}
        >
          Study
        </button>
      </div>

      <div className="side-panel__body">
        {activeTab === 'lexicon' && (
          <LexiconTab word={word} strongs={strongs} />
        )}
        {activeTab === 'concordance' && (
          <div className="placeholder-tab">
            <p>Concordance — coming soon</p>
          </div>
        )}
        {activeTab === 'study' && (
          <div className="placeholder-tab">
            <p>Study notes — coming soon</p>
          </div>
        )}
      </div>
    </aside>
  );
}

function LexiconTab({ word, strongs }: { word: OriginalWord; strongs: StrongsEntry | null }) {
  if (!strongs) {
    return (
      <div className="lexicon-tab">
        {word.strongs ? (
          <p className="lexicon-no-entry">No lexicon entry found for {word.strongs}</p>
        ) : (
          <p className="lexicon-no-entry">This word has no Strong&apos;s number.</p>
        )}
      </div>
    );
  }

  return (
    <div className="lexicon-tab">
      <dl className="lexicon-fields">
        {strongs.lemma && (
          <>
            <dt>Lemma</dt>
            <dd className="lexicon-lemma">{strongs.lemma}</dd>
          </>
        )}
        {strongs.transliteration && (
          <>
            <dt>Transliteration</dt>
            <dd>{strongs.transliteration}</dd>
          </>
        )}
        <dt>Language</dt>
        <dd className="lexicon-language">{strongs.language === 'hebrew' ? 'Hebrew / Aramaic' : 'Greek'}</dd>
        {strongs.shortDef && (
          <>
            <dt>Short definition</dt>
            <dd className="lexicon-shortdef">{strongs.shortDef}</dd>
          </>
        )}
      </dl>
      {strongs.fullDef && (
        <div className="lexicon-fulldef">
          <h4>Full definition</h4>
          {/* STEPBible uses HTML tags in fullDef */}
          <div
            className="lexicon-fulldef__content"
            dangerouslySetInnerHTML={{ __html: strongs.fullDef }}
          />
        </div>
      )}
    </div>
  );
}
