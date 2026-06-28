// Reflection study methods — passage-level journaling templates.
//
// Each method is adapted (paraphrased in our own words) from a Navigators
// "Bible Study Tools" resource and attributed back to them. We deliberately do
// not reproduce their text verbatim; the prompt labels and short guidance below
// are our own wording of the published method structure.
// Source: https://www.navigators.org/resource/bible-study-tools/

export interface MethodSection {
  id: string;
  label: string;
  hint: string; // placeholder guidance shown in the textarea
}

export interface StudyMethod {
  id: string;
  name: string;
  blurb: string;        // one-line description shown in the method picker
  attribution: string;  // credit line shown on the reflection
  sourceUrl: string;
  infoCard?: string;    // optional teaching text (used by The Word Hand)
  sections: MethodSection[];
}

export const STUDY_METHODS: StudyMethod[] = [
  {
    id: 'four-rs',
    name: 'The Four Rs',
    blurb: 'Read slowly and listen: Read, Reflect, Respond, Rest.',
    attribution: "Adapted from The Navigators' “Four Rs of Bible Study,” excerpted from MaryKate Morse, Lifelong Leadership (NavPress, 2020). Used by permission.",
    sourceUrl: 'https://www.navigators.org/resource/bible-study-tools/',
    sections: [
      { id: 'read',    label: 'Read',    hint: 'Read the passage slowly. What word or phrase stands out to you?' },
      { id: 'reflect', label: 'Reflect', hint: 'How does this passage speak to your life today?' },
      { id: 'respond', label: 'Respond', hint: 'Write a short prayer of response.' },
      { id: 'rest',    label: 'Rest',    hint: 'Receive it quietly. What truth will you rest in?' },
    ],
  },
  {
    id: 'inductive',
    name: 'Inductive Study',
    blurb: 'Observe, interpret, and apply a passage in seven steps.',
    attribution: "Adapted from The Navigators, “How to Study the Bible: A 7-Step Inductive Method.”",
    sourceUrl: 'https://www.navigators.org/resource/bible-study-tools/',
    sections: [
      { id: 'background',   label: 'Background',          hint: 'Who wrote this, to whom, and why? Note the historical setting.' },
      { id: 'paraphrase',   label: 'Personal Paraphrase', hint: 'Rewrite the passage in your own words.' },
      { id: 'questions',    label: 'Questions & Answers', hint: "What's unclear or worth exploring? Jot answers as you find them." },
      { id: 'crossrefs',    label: 'Cross-References',     hint: 'Related passages that come to mind.' },
      { id: 'insights',     label: 'Insights',            hint: 'Observations that stand out to you.' },
      { id: 'application',  label: 'Personal Application', hint: 'How does this passage apply to your life?' },
      { id: 'summary',      label: 'Title & Summary',     hint: 'Give it a title and summarize the main point.' },
    ],
  },
  {
    id: 'word-hand',
    name: 'The Word Hand',
    blurb: 'Meditate on a passage you are hearing, reading, studying, and memorizing.',
    attribution: 'Adapted from The Navigators’ “The Word Hand.”',
    sourceUrl: 'https://www.navigators.org/resource/bible-study-tools/',
    infoCard:
      'The Word Hand is a Navigators illustration of five ways we take hold of ' +
      'Scripture, each like a finger of the hand. Hearing (Romans 10:17) and ' +
      'Reading (Revelation 1:3) give us breadth; Studying (Acts 17:11) and ' +
      'Memorizing (Psalm 119:9-11) give us depth. Meditation (Psalm 1:2-3) is the ' +
      'thumb that can touch every finger — it works alongside all four. The more ' +
      'fingers you use, the firmer your grasp on the Word.',
    sections: [
      { id: 'meditate', label: 'Meditate on this Passage', hint: 'Slowly turn this passage over in your mind. What is God showing you as you hear, read, study, and reflect on it?' },
    ],
  },
];

export function getMethod(id: string): StudyMethod | undefined {
  return STUDY_METHODS.find((m) => m.id === id);
}
