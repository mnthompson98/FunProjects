import { useState, useCallback } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { ReferenceInput } from './components/ReferenceInput';
import { VerseDisplay } from './components/VerseDisplay';
import { SidePanel } from './components/SidePanel';
import { Library } from './components/Library';
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
  const [showLibrary, setShowLibrary] = useState(false);
  const [selectedTranslation, setSelectedTranslation] = useState('KJV');

  /**
   * Core verse-loading logic — shared by both the ReferenceInput and the
   * concordance "click to navigate" path.  `autoSelectStrongs` lets the
   * concordance tab automatically highlight the word it just navigated to.
   */
  const loadVerse = useCallback(async (
    ref: string,
    autoSelectStrongs?: string,
  ) => {
    setLoading(true);
    setError(null);
    setVerse(null);
    setSelectedWord(null);
    setSelectedStrongs(null);

    try {
      const res = await fetch(`/api/verse/${encodeURIComponent(ref)}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError(`Verse not found: "${ref}". Try "John 3:16" or "Gen 1:1".`);
        } else {
          setError(`Error fetching verse (${res.status})`);
        }
        return;
      }
      const data: VerseWithWords = await res.json();
      setVerse(data);

      // Auto-select the first word matching the Strong's number (concordance navigation)
      if (autoSelectStrongs) {
        const match = data.words.find((w) => w.strongs === autoSelectStrongs);
        if (match) {
          setSelectedWord(match);
          try {
            const sRes = await fetch(`/api/strongs/${encodeURIComponent(autoSelectStrongs)}`);
            if (sRes.ok) {
              const sData: StrongsEntry = await sRes.json();
              setSelectedStrongs(sData);
            }
          } catch {
            // Silently fail
          }
        }
      }
    } catch (err) {
      setError(`Network error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefSubmit = useCallback(async (raw: string) => {
    const ref = normalizeRef(raw);
    await loadVerse(ref);
  }, [loadVerse]);

  /** Called by ConcordanceTab when the user clicks an entry */
  const handleConcordanceNavigate = useCallback((osisRef: string, strongs: string) => {
    loadVerse(osisRef, strongs);
  }, [loadVerse]);

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
      <Header onOpenLibrary={() => setShowLibrary(true)} />
      <main className="app__main">
        <div className="app__content">
          <ReferenceInput onSubmit={handleRefSubmit} loading={loading} error={error} />
          {verse && (
            <div className="app__verse-area">
              <VerseDisplay
                verse={verse}
                selectedWordId={selectedWord?.id ?? null}
                onWordClick={handleWordClick}
                translation={selectedTranslation}
                onTranslationChange={setSelectedTranslation}
              />
              {selectedWord && (
                <SidePanel
                  word={selectedWord}
                  strongs={strongsLoading ? null : selectedStrongs}
                  onClose={handlePanelClose}
                  onNavigate={handleConcordanceNavigate}
                />
              )}
            </div>
          )}
        </div>
      </main>
      {showLibrary && (
        <Library
          onOpen={(ref) => { loadVerse(ref); setShowLibrary(false); }}
          onClose={() => setShowLibrary(false)}
        />
      )}
      <Footer />
    </div>
  );
}

export default App;
