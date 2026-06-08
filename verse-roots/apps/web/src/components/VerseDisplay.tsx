import { OriginalWord, VerseWithWords } from '../types';
import { WordChip } from './WordChip';
import './VerseDisplay.css';

interface VerseDisplayProps {
  verse: VerseWithWords;
  selectedWordId: number | null;
  onWordClick: (word: OriginalWord) => void;
}

export function VerseDisplay({ verse, selectedWordId, onWordClick }: VerseDisplayProps) {
  return (
    <section className="verse-display">
      <h2 className="verse-ref">{verse.ref}</h2>
      <div className="verse-words">
        {verse.words.map((word) => (
          <WordChip
            key={word.id}
            word={word}
            selected={word.id === selectedWordId}
            onClick={onWordClick}
          />
        ))}
      </div>
    </section>
  );
}
