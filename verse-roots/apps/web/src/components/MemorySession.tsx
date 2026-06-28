import { useEffect, useMemo, useRef, useState } from 'react';
import { getChapter, getVerseTranslation } from '@verse-roots/bible-client';
import type { MemoryItem } from '../study/memory';
import { tokenize, wordCore, maskToken, pickBlankIndices, scoreTyping, shuffleStable } from '../study/memory';
import './MemorySession.css';

const MEMORY_TRANSLATION = 'KJV'; // public domain — always available, safe to display in full

interface MemorySessionProps {
  item: MemoryItem;
  onClose: () => void;
  onPracticed: (item: MemoryItem) => void;
}

type Mode = 'learning' | 'quiz' | 'builder';

export function MemorySession({ item, onClose, onPracticed }: MemorySessionProps) {
  const [mode, setMode] = useState<Mode>('learning');
  const [fullText, setFullText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const load = async () => {
      try {
        if (item.scope === 'chapter') {
          const verses = await getChapter(item.ref);
          if (!verses || verses.length === 0) throw new Error('Chapter not found');
          const texts = await Promise.all(
            verses.map((v) => getVerseTranslation(v.ref, MEMORY_TRANSLATION).then((d) => d?.text ?? '')),
          );
          if (!cancelled) setFullText(texts.filter(Boolean).join(' '));
        } else {
          const d = await getVerseTranslation(item.ref, MEMORY_TRANSLATION);
          if (!cancelled) setFullText(d?.text ?? null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [item.ref, item.scope]);

  const markPracticed = () => {
    onPracticed({
      ...item,
      lastPracticed: Date.now(),
      timesPracticed: (item.timesPracticed ?? 0) + 1,
    });
  };

  return (
    <div className="memsession-overlay" onClick={onClose}>
      <div className="memsession" onClick={(e) => e.stopPropagation()}>
        <div className="memsession__header">
          <button className="memsession__back" onClick={onClose}>← My List</button>
          <div className="memsession__ref">
            {item.topic && <span className="memsession__topic">{item.topic}</span>}
            {item.display}
          </div>
        </div>

        <div className="memsession__modes" role="group" aria-label="Practice mode">
          {(['learning', 'quiz', 'builder'] as const).map((m) => (
            <button
              key={m}
              className={`memsession__mode${mode === m ? ' memsession__mode--active' : ''}`}
              onClick={() => setMode(m)}
            >
              {m === 'learning' ? 'Learning' : m === 'quiz' ? 'Quiz' : 'Builder'}
            </button>
          ))}
        </div>

        <div className="memsession__body">
          {loading && <div className="memsession__spinner" aria-label="Loading" />}
          {error && <p className="memsession__error">Couldn’t load text: {error}</p>}
          {!loading && !error && fullText && (
            <>
              {mode === 'learning' && <LearningMode text={fullText} reference={item.display} onPracticed={markPracticed} />}
              {mode === 'quiz' && <QuizMode text={fullText} reference={item.display} />}
              {mode === 'builder' && <BuilderMode text={fullText} onPracticed={markPracticed} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── Learning ───────────────────────────

function LearningMode({ text, reference, onPracticed }: { text: string; reference: string; onPracticed: () => void }) {
  const [reads, setReads] = useState(0);
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const speak = () => {
    if (!canSpeak) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(`${text} ${reference}`);
    u.rate = 0.92;
    window.speechSynthesis.speak(u);
  };

  return (
    <div className="learn">
      <p className="learn__text">{text}</p>
      <p className="learn__ref">— {reference}</p>
      <div className="learn__actions">
        {canSpeak && <button className="mem-btn" onClick={speak}>🔊 Read aloud</button>}
        <button className="mem-btn" onClick={() => setReads((r) => r + 1)}>I read it through {reads > 0 ? `(${reads})` : ''}</button>
        <button className="mem-btn mem-btn--primary" onClick={onPracticed}>Mark practiced</button>
      </div>
      <p className="learn__tip">Read it aloud a few times, then try Quiz and Builder to lock it in.</p>
    </div>
  );
}

// ─────────────────────────── Quiz ───────────────────────────

function QuizMode({ text, reference }: { text: string; reference: string }) {
  const [sub, setSub] = useState<'blanks' | 'flash'>('blanks');
  return (
    <div className="quiz">
      <div className="quiz__toggle">
        <button className={`quiz__toggle-btn${sub === 'blanks' ? ' quiz__toggle-btn--active' : ''}`} onClick={() => setSub('blanks')}>Fill blanks</button>
        <button className={`quiz__toggle-btn${sub === 'flash' ? ' quiz__toggle-btn--active' : ''}`} onClick={() => setSub('flash')}>Flashcard</button>
      </div>
      {sub === 'blanks' ? <FillBlanks text={text} /> : <Flashcard text={text} reference={reference} />}
    </div>
  );
}

function Flashcard({ text, reference }: { text: string; reference: string }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div className="flash">
      <button className={`flash__card${flipped ? ' flash__card--flipped' : ''}`} onClick={() => setFlipped((f) => !f)}>
        {!flipped ? (
          <span className="flash__face flash__face--ref">{reference}<span className="flash__hint">tap to reveal the verse</span></span>
        ) : (
          <span className="flash__face flash__face--text">{text}<span className="flash__hint">tap to see the reference</span></span>
        )}
      </button>
      <p className="quiz__tip">See the reference, recite the verse from memory, then flip to check.</p>
    </div>
  );
}

interface BankWord { id: number; word: string; }

function FillBlanks({ text }: { text: string }) {
  const tokens = useMemo(() => tokenize(text), [text]);
  const blankIdx = useMemo(() => pickBlankIndices(tokens), [tokens]);
  const blankSet = useMemo(() => new Set(blankIdx), [blankIdx]);
  const bank = useMemo<BankWord[]>(
    () => shuffleStable(blankIdx.map((i, n) => ({ id: n, word: tokens[i] })), blankIdx.length + tokens.length),
    [blankIdx, tokens],
  );

  // answers: blank token-index → bank word id
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [selected, setSelected] = useState<number | null>(blankIdx[0] ?? null);
  const [checked, setChecked] = useState(false);

  const usedBankIds = new Set(Object.values(answers));
  const allFilled = blankIdx.every((i) => answers[i] !== undefined);

  const placeWord = (bankId: number) => {
    if (selected == null || checked) return;
    setAnswers((prev) => {
      const next = { ...prev };
      // remove this bank word from any other blank
      for (const k of Object.keys(next)) if (next[+k] === bankId) delete next[+k];
      next[selected] = bankId;
      return next;
    });
    // advance to next empty blank
    const next = blankIdx.find((i) => i !== selected && answers[i] === undefined);
    setSelected(next ?? null);
  };

  const clearBlank = (i: number) => {
    if (checked) return;
    setAnswers((prev) => { const n = { ...prev }; delete n[i]; return n; });
    setSelected(i);
  };

  const reset = () => { setAnswers({}); setChecked(false); setSelected(blankIdx[0] ?? null); };

  const correctCount = checked
    ? blankIdx.filter((i) => {
        const bw = bank.find((b) => b.id === answers[i]);
        return bw && wordCore(bw.word) === wordCore(tokens[i]);
      }).length
    : 0;

  return (
    <div className="blanks">
      <p className="blanks__text">
        {tokens.map((tok, i) => {
          if (!blankSet.has(i)) return <span key={i} className="blanks__word">{tok} </span>;
          const bw = answers[i] !== undefined ? bank.find((b) => b.id === answers[i]) : null;
          const isCorrect = checked && bw && wordCore(bw.word) === wordCore(tok);
          const cls = [
            'blanks__blank',
            selected === i ? 'blanks__blank--selected' : '',
            bw ? 'blanks__blank--filled' : '',
            checked ? (isCorrect ? 'blanks__blank--correct' : 'blanks__blank--wrong') : '',
          ].filter(Boolean).join(' ');
          return (
            <span key={i}>
              <button className={cls} onClick={() => (bw ? clearBlank(i) : setSelected(i))}>
                {bw ? bw.word : '     '}
              </button>{' '}
            </span>
          );
        })}
      </p>

      {!checked && (
        <div className="blanks__bank">
          {bank.map((b) => (
            <button
              key={b.id}
              className={`blanks__bank-word${usedBankIds.has(b.id) ? ' blanks__bank-word--used' : ''}`}
              onClick={() => placeWord(b.id)}
              disabled={usedBankIds.has(b.id)}
            >
              {b.word}
            </button>
          ))}
        </div>
      )}

      <div className="blanks__actions">
        {!checked ? (
          <button className="mem-btn mem-btn--primary" onClick={() => setChecked(true)} disabled={!allFilled}>Check</button>
        ) : (
          <>
            <span className="blanks__score">{correctCount} / {blankIdx.length} correct</span>
            <button className="mem-btn" onClick={reset}>Try again</button>
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────── Builder ───────────────────────────

const FADE_STAGES: { level: 0 | 1 | 2 | 3; label: string }[] = [
  { level: 0, label: 'Full text' },
  { level: 1, label: 'First letters' },
  { level: 2, label: 'Initials' },
  { level: 3, label: 'Blanks' },
];

function BuilderMode({ text, onPracticed }: { text: string; onPracticed: () => void }) {
  const tokens = useMemo(() => tokenize(text), [text]);
  const [stage, setStage] = useState(0); // 0..3 fade, 4 = type test
  const [revealed, setRevealed] = useState(false);

  const isType = stage === FADE_STAGES.length;

  const next = () => { setRevealed(false); setStage((s) => s + 1); };
  const back = () => { setRevealed(false); setStage((s) => Math.max(0, s - 1)); };

  return (
    <div className="builder">
      <div className="builder__progress">
        {[...FADE_STAGES.map((s) => s.label), 'Type it'].map((label, i) => (
          <span key={label} className={`builder__step${i === stage ? ' builder__step--active' : ''}${i < stage ? ' builder__step--done' : ''}`}>
            {label}
          </span>
        ))}
      </div>

      {!isType ? (
        <>
          <p className="builder__text">
            {(revealed ? tokens : tokens.map((t) => maskToken(t, FADE_STAGES[stage].level))).join(' ')}
          </p>
          <div className="builder__actions">
            {stage > 0 && <button className="mem-btn" onClick={back}>← Back</button>}
            <button className="mem-btn" onClick={() => setRevealed((r) => !r)}>{revealed ? 'Hide' : 'Reveal'}</button>
            <button className="mem-btn mem-btn--primary" onClick={next}>
              {stage < FADE_STAGES.length - 1 ? 'Next →' : 'Type it →'}
            </button>
          </div>
          <p className="builder__tip">Recite the verse, then Reveal to check. Each step gives you fewer cues.</p>
        </>
      ) : (
        <TypeTest text={text} onBack={back} onPracticed={onPracticed} />
      )}
    </div>
  );
}

function TypeTest({ text, onBack, onPracticed }: { text: string; onBack: () => void; onPracticed: () => void }) {
  const [value, setValue] = useState('');
  const [result, setResult] = useState<{ correct: number; total: number; perWord: boolean[] } | null>(null);
  const targetTokens = useMemo(() => tokenize(text), [text]);
  const ref = useRef<HTMLTextAreaElement>(null);

  const check = () => setResult(scoreTyping(value, text));
  const pct = result ? Math.round((result.correct / result.total) * 100) : 0;

  return (
    <div className="typetest">
      <textarea
        ref={ref}
        className="typetest__input"
        placeholder="Type the verse from memory…"
        value={value}
        onChange={(e) => { setValue(e.target.value); setResult(null); }}
        rows={4}
      />
      {result && (
        <div className="typetest__result">
          <div className="typetest__score">{result.correct} / {result.total} words · {pct}%</div>
          <p className="typetest__diff">
            {targetTokens.map((tok, i) => (
              <span key={i} className={`typetest__w${result.perWord[i] ? ' typetest__w--ok' : ' typetest__w--miss'}`}>{tok} </span>
            ))}
          </p>
        </div>
      )}
      <div className="builder__actions">
        <button className="mem-btn" onClick={onBack}>← Back</button>
        <button className="mem-btn mem-btn--primary" onClick={check} disabled={!value.trim()}>Check</button>
        {result && pct >= 80 && <button className="mem-btn mem-btn--primary" onClick={onPracticed}>Mark practiced ✓</button>}
      </div>
    </div>
  );
}
