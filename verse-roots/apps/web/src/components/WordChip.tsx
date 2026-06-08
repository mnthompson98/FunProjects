import { OriginalWord } from '../types';
import './WordChip.css';

interface WordChipProps {
  word: OriginalWord;
  selected: boolean;
  onClick: (word: OriginalWord) => void;
}

export function WordChip({ word, selected, onClick }: WordChipProps) {
  return (
    <button
      className={`word-chip${selected ? ' word-chip--selected' : ''}`}
      onClick={() => onClick(word)}
      type="button"
    >
      <span className="word-chip__original">{word.originalText}</span>
      {word.transliteration && (
        <span className="word-chip__translit">{word.transliteration}</span>
      )}
      {word.gloss && (
        <span className="word-chip__gloss">{word.gloss}</span>
      )}
    </button>
  );
}
