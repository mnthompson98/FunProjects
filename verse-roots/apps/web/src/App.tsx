import { useState, useCallback, useEffect } from 'react';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { ReferenceInput } from './components/ReferenceInput';
import { VerseDisplay } from './components/VerseDisplay';
import { SidePanel } from './components/SidePanel';
import { Library } from './components/Library';
import { AuthModal } from './components/auth/AuthModal';
import { AccountPage } from './components/auth/AccountPage';
import { normalizeRef } from './normalizeRef';
import type { OriginalWord, VerseWithWords, StrongsEntry } from './types';
import { getVerse, getStrongs } from '@verse-roots/bible-client';
import {
  onAuthStateChange,
  getSubscriptionStatus,
} from './lib/supabase';
import type { User, SubscriptionStatus } from './lib/supabase';
import { initialSync, maybeSyncStudy } from './study/sync';
import type { Study } from './study/types';
import './App.css';

const FREE_STATUS: SubscriptionStatus = { plan: 'free', currentPeriodEnd: null, canSync: false }; // canSync false = not logged in

function App() {
  const [verse, setVerse] = useState<VerseWithWords | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedWord, setSelectedWord] = useState<OriginalWord | null>(null);
  const [selectedStrongs, setSelectedStrongs] = useState<StrongsEntry | null>(null);
  const [strongsLoading, setStrongsLoading] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [selectedTranslation, setSelectedTranslation] = useState('KJV');

  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>(FREE_STATUS);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAccount, setShowAccount] = useState(false);

  const fetchSubscription = useCallback(async (u: User) => {
    const status = await getSubscriptionStatus(u.id);
    setSubscriptionStatus(status);
    return status;
  }, []);

  // On mount: restore session via onAuthStateChange (fires immediately with
  // INITIAL_SESSION for existing sessions, and SIGNED_IN when the magic-link
  // hash is processed on redirect-back). No separate getCurrentUser() call is
  // needed — the listener covers both the initial session and all subsequent
  // auth events.
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
      const data = await getVerse(ref);
      if (!data) {
        setError(`Verse not found: "${ref}". Try "John 3:16" or "Gen 1:1".`);
        return;
      }
      setVerse(data);

      // Auto-select the first word matching the Strong's number (concordance navigation)
      if (autoSelectStrongs) {
        const match = data.words.find((w) => w.strongs === autoSelectStrongs);
        if (match) {
          setSelectedWord(match);
          try {
            const sData: StrongsEntry | null = await getStrongs(autoSelectStrongs);
            if (sData) setSelectedStrongs(sData);
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
        const data: StrongsEntry | null = await getStrongs(word.strongs);
        if (data) setSelectedStrongs(data);
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

  /** Called by StudyTab after a successful local save */
  const handleStudySaved = useCallback((study: Study) => {
    if (user && subscriptionStatus.canSync) {
      maybeSyncStudy(study, user.id, subscriptionStatus.canSync);
    }
  }, [user, subscriptionStatus.canSync]);

  const handleManualSync = useCallback(async () => {
    if (!user || !subscriptionStatus.canSync) return;
    await initialSync(user.id);
  }, [user, subscriptionStatus.canSync]);

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
                  onStudySaved={handleStudySaved}
                  user={user}
                  subscriptionStatus={subscriptionStatus}
                  onOpenAuth={() => setShowAuthModal(true)}
                  onOpenAccount={() => setShowAccount(true)}
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
