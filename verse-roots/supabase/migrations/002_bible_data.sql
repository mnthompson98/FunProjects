-- Public Bible data tables (no auth required, readable by anyone)

CREATE TABLE public.verses (
  ref TEXT PRIMARY KEY,
  book TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  testament TEXT NOT NULL
);

CREATE TABLE public.original_words (
  id INTEGER PRIMARY KEY,
  verse_ref TEXT NOT NULL REFERENCES public.verses(ref),
  position INTEGER NOT NULL,
  original_text TEXT NOT NULL,
  transliteration TEXT,
  strongs TEXT,
  morphology TEXT,
  gloss TEXT,
  UNIQUE(verse_ref, position)
);

CREATE INDEX idx_ow_verse_ref ON public.original_words(verse_ref);
CREATE INDEX idx_ow_strongs ON public.original_words(strongs);

CREATE TABLE public.strongs_entries (
  strongs TEXT PRIMARY KEY,
  language TEXT NOT NULL,
  lemma TEXT,
  transliteration TEXT,
  short_def TEXT,
  full_def TEXT
);

CREATE TABLE public.verse_translations (
  ref TEXT NOT NULL REFERENCES public.verses(ref),
  translation TEXT NOT NULL,
  text TEXT NOT NULL,
  PRIMARY KEY (ref, translation)
);

-- Public read access (no auth needed for Bible data)
ALTER TABLE public.verses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.original_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strongs_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verse_translations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_verses" ON public.verses FOR SELECT USING (true);
CREATE POLICY "public_read_original_words" ON public.original_words FOR SELECT USING (true);
CREATE POLICY "public_read_strongs" ON public.strongs_entries FOR SELECT USING (true);
CREATE POLICY "public_read_translations" ON public.verse_translations FOR SELECT USING (true);
