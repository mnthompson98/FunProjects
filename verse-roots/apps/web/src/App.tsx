import { useState, useCallback, useEffect } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { ReferenceInput } from './components/ReferenceInput';
import { VerseDisplay } from './components/VerseDisplay';
import { ChapterView } from './components/ChapterView';
import { SidePanel } from './components/SidePanel';
import { Library } from './components/Library';
import { AuthModal } from './components/auth/AuthModal';
import { AccountPage } from './components/auth/AccountPage';
import { normalizeRef } from './normalizeRef';
import type { OriginalWord, VerseWithWords, StrongsEntry } from './types';
import { getVerse, getStrongs, getChapter } from '@verse-roots/bible-client';
import { isApiBibleConfigured } from './utils/apiBible';
import {
  onAuthStateChange,
  getSubscriptionStatus,
} from './lib/supabase';
import type { User, SubscriptionStatus } from './lib/supabase';
import { initialSync, maybeSyncStudy } from './study/sync';
import type { Study } from './study/types';
import './App.css';

const FREE_STATUS: SubscriptionStatus = { plan: 'free', currentPeriodEnd: null, canSync: false };

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

  const [user, setUser] = useState<User | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>(FREE_STATUS);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAccount, setShowAccount] = useState(false);

  const fetchSubscription = useCallback(async (u: User) => {
    const status = await getSubscriptionStatus(u.id);
    setSubscriptionStatus(status);
    return status;
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (u) => {
      setUser(u);
      if (u) {
        const status = await fetchSubscription(u);
        if (status.canSync) {
          initialSync(u.id).catch((err) =>
            console.warn('[sync] initialSync error:', err),
          );
        }
      } else {
        setSubscriptionStatus(FREE_STATUS);
      }
    });
    return unsubscribe;
  }, [fetchSubscription]);

  const loadVerse = useCallback(async (ref: string, autoSelectStrongs?: string) => {
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
        // Chapter mode
        const data = await getChapter(ref);
        if (!data || data.length === 0) {
          setError(`Chapter not found: "${ref}". Try "John 3:16" for a single verse.`);
          return;
        }
        setChapter(data);
        setChapterRef(ref);
      } else {
        // Single verse mode
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
  }, []);

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

  const handleStudySaved = useCallback((study: Study) => {
    if (user && subscriptionStatus.canSync) {
      maybeSyncStudy(study, user.id, subscriptionStatus.canSync);
    }
  }, [user, subscriptionStatus.canSync]);

  const handleManualSync = useCallback(async () => {
    if (!user || !subscriptionStatus.canSync) return;
    await initialSync(user.id);
  }, [user, subscriptionStatus.canSync]);

  const handleVerseExpand = useCallback((ref: string) => {
    setExpandedVerseRef((prev) => prev === ref ? null : ref);
    setSelectedWord(null);
    setSelectedStrongs(null);
  }, []);

  return (
    <div className="app">
      <Header
        onOpenLibrary={() => setShowLibrary(true)}
        user={user}
        subscriptionStatus={subscriptionStatus}
        onOpenAuth={() => setShowAuthModal(true)}
        onOpenAccount={() => setShowAccount(true)}
        onSync={handleManualSync}
      />

      <div className="app-search">
        <div className="app-search__inner">
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
              user={user}
              subscriptionStatus={subscriptionStatus}
              onOpenAuth={() => setShowAuthModal(true)}
              onOpenAccount={() => setShowAccount(true)}
            />
          )}
        </div>

        {/* Right-column panel only in single-verse mode */}
        {verse && selectedWord && (
          <SidePanel
            word={selectedWord}
            strongs={strongsLoading ? null : selectedStrongs}
            onClose={handlePanelClose}
            onNavigate={handleConcordanceNavigate}
            onStudySaved={handleStudySaved}
            user={user}
            subscriptionStatus={subscriptionStatus}
            onOpenAuth={() => setShowAuthModal(true)}
            onOpenAccount={() => setShowAccount(true)}
          />
        )}
      </main>

      {showLibrary && (
        <Library
          onOpen={(ref) => { loadVerse(ref); setShowLibrary(false); }}
          onClose={() => setShowLibrary(false)}
        />
      )}
      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} />}
      {showAccount && user && (
        <AccountPage
          user={user}
          subscriptionStatus={subscriptionStatus}
          onClose={() => setShowAccount(false)}
          onSubscriptionUpdated={() => fetchSubscription(user)}
        />
      )}
      <Footer />
    </div>
  );
}

export default App;
