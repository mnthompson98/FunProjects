export interface StudySection {
  id: string;
  label: string;
  content: string; // markdown-ish text the user writes
}

export const STUDY_TEMPLATE: StudySection[] = [
  { id: 'context',      label: 'Context',            content: '' },
  { id: 'key-word',     label: 'Key Word(s)',         content: '' },
  { id: 'lexicon-def',  label: 'Lexicon Definition',  content: '' },
  { id: 'usage-map',    label: 'Usage Map',           content: '' },
  { id: 'which-sense',  label: 'Which Sense Applies', content: '' },
  { id: 'cross-refs',   label: 'Cross-References',    content: '' },
  { id: 'reflection',   label: 'Reflection',          content: '' },
  { id: 'application',  label: 'Application',         content: '' },
];

export interface Study {
  id: string;           // uuid (crypto.randomUUID())
  verseRef: string;     // e.g. "Lam.3.22"
  title: string;        // user-editable, defaults to display ref e.g. "Lamentations 3:22"
  focusStrongs: string | null;  // Strong's number of the key word being studied
  focusWord: string | null;     // original text of the focus word
  sections: StudySection[];
  createdAt: number;    // Date.now()
  updatedAt: number;
  tags: string[];       // user-added tags, for future search
}
