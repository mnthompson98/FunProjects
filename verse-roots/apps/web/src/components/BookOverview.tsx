import { getBook } from '../utils/bibleBooks';
import './BookOverview.css';

interface BookOverviewProps {
  bookOsis: string;
  onOpenChapter: (chapterRef: string) => void;
}

export function BookOverview({ bookOsis, onOpenChapter }: BookOverviewProps) {
  const book = getBook(bookOsis);
  if (!book) return null;

  const chapters = Array.from({ length: book.chapters }, (_, i) => i + 1);

  return (
    <section className="book-overview">
      <div className="book-overview__header">
        <h2 className="book-overview__name">{book.name}</h2>
        <span className="book-overview__count">{book.chapters} chapters</span>
      </div>
      <p className="book-overview__hint">Choose a chapter to start reading.</p>
      <div className="book-overview__grid">
        {chapters.map((ch) => (
          <button
            key={ch}
            className="book-overview__chapter"
            onClick={() => onOpenChapter(`${book.osis}.${ch}`)}
          >
            {ch}
          </button>
        ))}
      </div>
    </section>
  );
}
