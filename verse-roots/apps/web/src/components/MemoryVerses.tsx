import { MEMORY_VERSE_GROUPS } from '../study/memoryVerses';
import { normalizeRef } from '../normalizeRef';
import './MemoryVerses.css';

interface MemoryVersesProps {
  onOpen: (osisRef: string) => void;
  onClose: () => void;
}

// "Philippians 4:6-7" / "Psalm 119:9,11" → navigate to the first verse
function toFirstVerseRef(displayRef: string): string {
  const firstVerse = displayRef.replace(/[-,].*$/, '');
  return normalizeRef(firstVerse);
}

export function MemoryVerses({ onOpen, onClose }: MemoryVersesProps) {
  return (
    <div className="memverse-overlay" onClick={onClose}>
      <div className="memverse-panel" onClick={(e) => e.stopPropagation()}>
        <div className="memverse-header">
          <button className="memverse-back" onClick={onClose}>← Back</button>
          <h2 className="memverse-title">Memory Verses</h2>
        </div>

        <p className="memverse-intro">
          The Topical Memory System — key verses grouped by theme, curated by The Navigators.
          Tap any reference to open it.
        </p>

        <div className="memverse-list">
          {MEMORY_VERSE_GROUPS.map((group) => (
            <section key={group.series} className="memverse-series">
              <h3 className="memverse-series__name">{group.series}</h3>
              <div className="memverse-topics">
                {group.verses.map((v) => (
                  <div key={v.topic} className="memverse-topic">
                    <span className="memverse-topic__name">{v.topic}</span>
                    <div className="memverse-topic__refs">
                      {v.refs.map((ref) => (
                        <button
                          key={ref}
                          className="memverse-ref"
                          onClick={() => onOpen(toFirstVerseRef(ref))}
                        >
                          {ref}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <p className="memverse-attribution">
          Topical Memory System © The Navigators.{' '}
          <a href="https://www.navigators.org/resource/bible-study-tools/" target="_blank" rel="noopener noreferrer">
            Learn more ↗
          </a>
        </p>
      </div>
    </div>
  );
}
