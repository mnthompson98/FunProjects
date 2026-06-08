import { useState, useCallback } from 'react';
import { Header } from './components/Header';
import { ReferenceInput } from './components/ReferenceInput';
import { VerseDisplay } from './components/VerseDisplay';
import { SidePanel } from './components/SidePanel';
import { normalizeRef } from './normalizeRef';
import { OriginalWord, VerseWithWords, StrongsEntry } from './types';
import './App.css';

function App() {
  const [verse, setVerse] = useState<VerseWithWords | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedWord, setSelectedWord] = useState<OriginalWord | null>(null);
  const [selectedStrongs, setSelectedStrongs] = useState<StrongsEntry | null>(null);
  const [strongsLoading, setStrongsLoading] = useState(false);

  const handleRefSubmit = useCallback(async (raw: string) => {
    const ref = normalizeRef(raw);
    setLoading(true);
    setError(null);
    setVerse(null);
    setSelectedWord(null);
    setSelectedStrongs(null);

    try {
      const res = await fetch(`/api/verse/${encodeURIComponent(ref)}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError(`Verse not found: "${raw}". Try "John 3:16" or "Gen 1:1".`);
        } else {
          setError(`Error fetching verse (${res.status})`);
        }
        return;
      }
      const data: VerseWithWords = await res.json();
      setVerse(data);
    } catch (err) {
      setError(`Network error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleWordClick = useCallback(async (word: OriginalWord) => {
    setSelectedWord(word);
    setSelectedStrongs(null);

    if (word.strongs) {
      setStrongsLoading(true);
      try {
        const res = await fetch(`/api/strongs/${encodeURIComponent(word.strongs)}`);
        if (res.ok) {
          const data: StrongsEntry = await res.json();
          setSelectedStrongs(data);
        }
      } catch {
        // Silently fail — lexicon just shows empty
      } finally {
        setStrongsLoading(false);
      }
    }
  }, []);

  const handlePanelClose = useCallback(() => {
    setSelectedWord(null);
    setSelectedStrongs(null);
  }, []);

  return (
    <div className="app">
      <Header />
      <main className="app__main">
        <div className="app__content">
          <ReferenceInput onSubmit={handleRefSubmit} loading={loading} error={error} />
          {verse && (
            <div className="app__verse-area">
              <VerseDisplay
                verse={verse}
                selectedWordId={selectedWord?.id ?? null}
                onWordClick={handleWordClick}
              />
              {selectedWord && (
                <SidePanel
                  word={selectedWord}
                  strongs={strongsLoading ? null : selectedStrongs}
                  onClose={handlePanelClose}
                />
              )}
            </div>
          )}
        </div>
      </main>
      <footer className="app__footer">
        Lexicon and tagged-text data &copy;{' '}
        <a href="https://stepbible.org" target="_blank" rel="noopener noreferrer">
          STEPBible.org
        </a>
        , CC BY 4.0 &middot; Original-language texts: TAHOT (Hebrew OT) and TAGNT (Greek NT)
      </footer>
    </div>
  );
}

export default App;
