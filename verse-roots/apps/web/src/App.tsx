import { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { ReferenceInput } from './components/ReferenceInput';
import { VerseDisplay } from './components/VerseDisplay';
import { ChapterView } from './components/ChapterView';
import { SidePanel } from './components/SidePanel';
import { Library } from './components/Library';
import { normalizeRef } from './normalizeRef';
import type { OriginalWord, VerseWithWords, StrongsEntry } from './types';
import { getVerse, getStrongs, getChapter } from '@verse-roots/bible-client';
import { isApiBibleConfigured } from './utils/apiBible';
import { formatPassageRef } from './utils/formatRef';
import type { Study, ReflectionSelection } from './study/types';
import './App.css';

interface NavSnapshot {
  verse: VerseWithWords | null;
  chapter: VerseWithWords[] | null;
  chapterRef: string | null;
  expandedVerseRef: string | null;
  selectedWord: OriginalWord | null;
  selectedStrongs: StrongsEntry | null;
}

function App() {
  const [verse, setVerse] = useState<VerseWithWords | null>(null);
  const [chapter, setChapter] = useState<VerseWithWords[] | null>(null);
  const [chapterRef, setChapterRef] = useState<string | null>(null);
  const [expandedVerseRef, setExpandedVerseRef] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedWord, setSelectedWord] = useState<OriginalWord | null>(null);
  const [selectedStrongs, setSelectedStrongs] = useState<StrongsEntry | null>(null);
  const [strongsLoading, setStrongsLoading] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [selectedTranslation, setSelectedTranslation] = useState(
    isApiBibleConfigured ? 'NIV' : 'KJV'
  );
  const [navHistory, setNavHistory] = useState<NavSnapshot[]>([]);
  const [pendingReflection, setPendingReflection] = useState<ReflectionSelection | null>(null);

  // Always-current snapshot so loadVerse can push it without stale closures
  const snapshotRef = useRef<NavSnapshot>({
    verse: null, chapter: null, chapterRef: null,
    expandedVerseRef: null, selectedWord: null, selectedStrongs: null,
  });
  useEffect(() => {
    snapshotRef.current = { verse, chapter, chapterRef, expandedVerseRef, selectedWord, selectedStrongs };
  }, [verse, chapter, chapterRef, expandedVerseRef, selectedWord, selectedStrongs]);

  const restoreSnapshot = useCallback((snap: NavSnapshot) => {
    setVerse(snap.verse);
    setChapter(snap.chapter);
    setChapterRef(snap.chapterRef);
    setExpandedVerseRef(snap.expandedVerseRef);
    setSelectedWord(snap.selectedWord);
    setSelectedStrongs(snap.selectedStrongs);
    setError(null);
  }, []);

  const handleBack = useCallback(() => {
    setNavHistory((prev) => {
      if (prev.length === 0) return prev;
      restoreSnapshot(prev[prev.length - 1]);
      return prev.slice(0, -1);
    });
  }, [restoreSnapshot]);

  // Let browser back gesture/button trigger in-app back
  useEffect(() => {
    const onPopState = () => {
      setNavHistory((prev) => {
        if (prev.length === 0) return prev;
        restoreSnapshot(prev[prev.length - 1]);
        window.history.pushState({ depth: prev.length - 1 }, '');
        return prev.slice(0, -1);
      });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [restoreSnapshot]);

  const loadVerse = useCallback(async (ref: string, autoSelectStrongs?: string) => {
    // Push current view before navigating
    const current = snapshotRef.current;
    if (current.verse || current.chapter) {
      setNavHistory((prev) => [...prev, current]);
      window.history.pushState({ depth: 1 }, '');
    }

    setLoading(true);
    setError(null);
    setVerse(null);
    setChapter(null);
    setChapterRef(null);
    setExpandedVerseRef(null);
    setSelectedWord(null);
    setSelectedStrongs(null);

    try {
      const parts = ref.split('.');
      if (parts.length === 2) {
        const data = await getChapter(ref);
        if (!data || data.length === 0) {
          setError(`Chapter not found: "${ref}". Try "John 3:16" for a single verse.`);
          return;
        }
        setChapter(data);
        setChapterRef(ref);
      } else {
        const data = await getVerse(ref);
        if (!data) {
          setError(`Verse not found: "${ref}". Try "John 3:16" or "Gen 1:1".`);
          return;
        }
        setVerse(data);

        if (autoSelectStrongs) {
          const match = data.words.find((w) => w.strongs === autoSelectStrongs);
          if (match) {
            setSelectedWord(match);
            try {
              const sData: StrongsEntry | null = await getStrongs(autoSelectStrongs);
              if (sData) setSelectedStrongs(sData);
            } catch { /* silently fail */ }
          }
        }
      }
    } catch (err) {
      setError(`Network error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefSubmit = useCallback(async (raw: string) => {
    await loadVerse(normalizeRef(raw));
  }, [loadVerse]);

  const handleConcordanceNavigate = useCallback((osisRef: string, strongs: string) => {
    loadVerse(osisRef, strongs);
  }, [loadVerse]);

  const handleWordClick = useCallback(async (word: OriginalWord) => {
    setSelectedWord(word);
    setSelectedStrongs(null);
    if (word.strongs) {
      setStrongsLoading(true);
      try {
        const data: StrongsEntry | null = await getStrongs(word.strongs);
        if (data) setSelectedStrongs(data);
      } catch { /* silently fail */ }
      finally { setStrongsLoading(false); }
    }
  }, []);

  const handlePanelClose = useCallback(() => {
    setSelectedWord(null);
    setSelectedStrongs(null);
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleStudySaved = useCallback((_study: Study) => {}, []);

  const handleVerseExpand = useCallback((ref: string) => {
    setExpandedVerseRef((prev) => prev === ref ? null : ref);
    setSelectedWord(null);
    setSelectedStrongs(null);
  }, []);

  const canGoBack = navHistory.length > 0;

  const panelWrapperRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    if (!selectedWord || !panelWrapperRef.current) return;
    const node = panelWrapperRef.current;
    const timer = setTimeout(() => {
      // offsetTop traversal: reliable on iOS Safari PWA
      let top = 0;
      let el: HTMLElement | null = node;
      while (el) { top += el.offsetTop; el = el.offsetParent as HTMLElement | null; }
      const HEADER = 76; // 60px header + 16px breathing room
      const target = Math.max(0, top - HEADER);
      window.scroll(0, target);
      document.documentElement.scrollTop = target;
      document.body.scrollTop = target;
    }, 300);
    return () => clearTimeout(timer);
  }, [selectedWord?.id]); // re-fires each time a different word is selected

  return (
    <div className="app">
      <Header onOpenLibrary={() => setShowLibrary(true)} />

      <div className="app-search">
        <div className="app-search__inner">
          {canGoBack && (
            <button className="app-back-btn" onClick={handleBack} aria-label="Go back">
              ← Back
            </button>
          )}
          <ReferenceInput onSubmit={handleRefSubmit} loading={loading} error={error} />
        </div>
      </div>

      <main className="app-workspace">
        <div className="app-main-col">
          {!verse && !chapter && !loading && (
            <div className="app-empty">
              <div className="app-empty__icon">✦</div>
              <p className="app-empty__title">Explore Scripture in its original language</p>
              <p className="app-empty__hint">
                Enter a verse like <em>John 3:16</em> to study a single verse, or a chapter like <em>John 3</em> to browse and select from all its verses.
              </p>
            </div>
          )}

          {verse && (
            <VerseDisplay
              verse={verse}
              selectedWordId={selectedWord?.id ?? null}
              onWordClick={handleWordClick}
              translation={selectedTranslation}
              onTranslationChange={setSelectedTranslation}
            />
          )}

          {chapter && chapterRef && (
            <ChapterView
              verses={chapter}
              chapterRef={chapterRef}
              translation={selectedTranslation}
              onTranslationChange={setSelectedTranslation}
              expandedVerseRef={expandedVerseRef}
              onVerseExpand={handleVerseExpand}
              selectedWordId={selectedWord?.id ?? null}
              onWordClick={handleWordClick}
              selectedWord={selectedWord}
              selectedStrongs={strongsLoading ? null : selectedStrongs}
              onPanelClose={handlePanelClose}
              onNavigate={handleConcordanceNavigate}
              onStudySaved={handleStudySaved}
              onStartReflection={setPendingReflection}
            />
          )}
        </div>

        {verse && selectedWord && (
          <div ref={panelWrapperRef}>
            <SidePanel
              word={selectedWord}
              strongs={strongsLoading ? null : selectedStrongs}
              onClose={handlePanelClose}
              onNavigate={handleConcordanceNavigate}
              onStudySaved={handleStudySaved}
            />
          </div>
        )}
      </main>

      {pendingReflection && (
        <div className="reflect-preview-overlay" onClick={() => setPendingReflection(null)}>
          <div className="reflect-preview" onClick={(e) => e.stopPropagation()}>
            <h3 className="reflect-preview__ref">{formatPassageRef(pendingReflection.passageRef)}</h3>
            {pendingReflection.snapshot.text && (
              <blockquote className="reflect-preview__quote">"{pendingReflection.snapshot.text}"</blockquote>
            )}
            <p className="reflect-preview__meta">
              {pendingReflection.verseRefs.length} verse(s), {pendingReflection.wordIds.length} word(s) selected
            </p>
            <p className="reflect-preview__note">Reflection editor (method picker + journaling) arrives in the next step.</p>
            <button className="reflect-preview__close" onClick={() => setPendingReflection(null)}>Close</button>
          </div>
        </div>
      )}

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
