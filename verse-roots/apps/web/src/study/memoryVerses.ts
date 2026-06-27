// Topical Memory System (TMS) verse list, curated by The Navigators.
// Source: https://www.navigators.org/resource/bible-study-tools/ (navlink.org/memorize)
//
// This is reference data only — topic names + Bible references. References are
// display-form and run through normalizeRef() before navigation.

export interface MemoryVerse {
  topic: string;
  refs: string[]; // one or two references per topic, as in the TMS card
}

export interface MemoryVerseGroup {
  series: string;
  verses: MemoryVerse[];
}

export const MEMORY_VERSE_GROUPS: MemoryVerseGroup[] = [
  {
    series: 'Living the New Life',
    verses: [
      { topic: 'Christ the Center',    refs: ['2 Corinthians 5:17', 'Galatians 2:20'] },
      { topic: 'Obedience to Christ',  refs: ['Romans 12:1', 'John 14:21'] },
      { topic: 'The Word',             refs: ['2 Timothy 3:16', 'Joshua 1:8'] },
      { topic: 'Prayer',               refs: ['John 15:7', 'Philippians 4:6-7'] },
      { topic: 'Fellowship',           refs: ['Matthew 18:20', 'Hebrews 10:24-25'] },
      { topic: 'Witnessing',           refs: ['Matthew 4:19', 'Romans 1:16'] },
    ],
  },
  {
    series: 'Proclaiming Christ',
    verses: [
      { topic: 'All Have Sinned',          refs: ['Romans 3:23', 'Isaiah 53:6'] },
      { topic: "Sin's Penalty",            refs: ['Romans 6:23', 'Hebrews 9:27'] },
      { topic: 'Christ Paid the Penalty',  refs: ['Romans 5:8', '1 Peter 3:18'] },
      { topic: 'Salvation is not by Works', refs: ['Ephesians 2:8-9', 'Titus 3:5'] },
      { topic: 'Must Receive Christ',      refs: ['John 1:12', 'Revelation 3:20'] },
      { topic: 'Assurance of Salvation',   refs: ['1 John 5:13', 'John 5:24'] },
    ],
  },
  {
    series: "Reliance on God's Resources",
    verses: [
      { topic: 'His Spirit',            refs: ['1 Corinthians 3:16', '1 Corinthians 2:12'] },
      { topic: 'His Strength',          refs: ['Isaiah 41:10', 'Philippians 4:13'] },
      { topic: 'His Faithfulness',      refs: ['Lamentations 3:22-23', 'Numbers 23:19'] },
      { topic: 'His Peace',             refs: ['Isaiah 26:3', '1 Peter 5:7'] },
      { topic: 'His Provision',         refs: ['Romans 8:32', 'Philippians 4:19'] },
      { topic: 'His Help in Temptation', refs: ['Hebrews 2:18', 'Psalm 119:9,11'] },
    ],
  },
  {
    series: "Being Christ's Disciple",
    verses: [
      { topic: 'Put Christ First',       refs: ['Matthew 6:33', 'Luke 9:23'] },
      { topic: 'Separate From the World', refs: ['1 John 2:15-16', 'Romans 12:2'] },
      { topic: 'Be Steadfast',           refs: ['1 Corinthians 15:58', 'Hebrews 12:3'] },
      { topic: 'Serve Others',           refs: ['Mark 10:45', '2 Corinthians 4:5'] },
      { topic: 'Give Generously',        refs: ['Proverbs 3:9-10', '2 Corinthians 9:6-7'] },
      { topic: 'Develop World Vision',   refs: ['Acts 1:8', 'Matthew 28:19-20'] },
    ],
  },
  {
    series: 'Growth in Christlikeness',
    verses: [
      { topic: 'Love',       refs: ['John 13:34-35', '1 John 3:18'] },
      { topic: 'Humility',   refs: ['Philippians 2:3-4', '1 Peter 5:5-6'] },
      { topic: 'Purity',     refs: ['Ephesians 5:3', '1 Peter 2:11'] },
      { topic: 'Honesty',    refs: ['Leviticus 19:11', 'Acts 24:16'] },
      { topic: 'Faith',      refs: ['Hebrews 11:6', 'Romans 4:20-21'] },
      { topic: 'Good Works', refs: ['Galatians 6:9-10', 'Matthew 5:16'] },
    ],
  },
];
