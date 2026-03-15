// Deck Tags - 32-bit tag system with grouped organization

export type DeckTag = {
  id: number;
  name: string;
  group: 'Mode' | 'Team Size' | 'Playstyle' | 'Composition' | 'Strategy & Tempo' | 'Other';
};

export const DECK_TAGS: DeckTag[] = [
  // Mode
  { id: 0, name: 'Casual', group: 'Mode' },
  { id: 1, name: 'Competitive', group: 'Mode' },
  { id: 2, name: 'Solo', group: 'Mode' },
  { id: 3, name: 'Duo', group: 'Mode' },
  { id: 4, name: 'Team Play', group: 'Mode' },
  { id: 5, name: 'PvE', group: 'Mode' },

  // Team Size
  { id: 6, name: '1v1', group: 'Team Size' },
  { id: 7, name: '2v2', group: 'Team Size' },
  { id: 8, name: '3v3', group: 'Team Size' },
  { id: 9, name: '4v4', group: 'Team Size' },
  { id: 10, name: '5v5', group: 'Team Size' },

  // Playstyle
  { id: 11, name: 'Aggressive', group: 'Playstyle' },
  { id: 12, name: 'Defensive', group: 'Playstyle' },
  { id: 13, name: 'Support', group: 'Playstyle' },
  { id: 14, name: 'Frontline', group: 'Playstyle' },
  { id: 15, name: 'Skirmish', group: 'Playstyle' },
  { id: 16, name: 'Urban', group: 'Playstyle' },
  { id: 17, name: 'Forest', group: 'Playstyle' },
  { id: 18, name: 'Open', group: 'Playstyle' },
  { id: 19, name: 'Smoke-Heavy', group: 'Playstyle' },

  // Composition
  { id: 20, name: 'Combined Arms', group: 'Composition' },
  { id: 21, name: 'Heavy', group: 'Composition' },
  { id: 22, name: 'Mid', group: 'Composition' },
  { id: 23, name: 'Light', group: 'Composition' },
  { id: 24, name: 'CQC', group: 'Composition' },
  { id: 25, name: 'Artillery', group: 'Composition' },
  { id: 26, name: 'CAS', group: 'Composition' },
  { id: 27, name: 'Strike', group: 'Composition' },

  // Strategy & Tempo
  { id: 28, name: 'Rush', group: 'Strategy & Tempo' },
  { id: 29, name: 'Spam', group: 'Strategy & Tempo' },
  { id: 30, name: 'Timing', group: 'Strategy & Tempo' },
  { id: 31, name: 'Late', group: 'Strategy & Tempo' },
  { id: 32, name: 'Slow', group: 'Strategy & Tempo' },
  { id: 33, name: 'Micro', group: 'Strategy & Tempo' },
  { id: 34, name: 'Harassment', group: 'Strategy & Tempo' },
  { id: 35, name: 'Paradrop', group: 'Strategy & Tempo' },
  { id: 36, name: 'Map Control', group: 'Strategy & Tempo' },
  { id: 37, name: 'Attrition', group: 'Strategy & Tempo' },
  { id: 38, name: 'SEAD', group: 'Strategy & Tempo' },
  { id: 39, name: 'All-In', group: 'Strategy & Tempo' },
  { id: 40, name: 'Flexible / Adaptive', group: 'Strategy & Tempo' },

  // Other
  { id: 41, name: 'Meta', group: 'Other' },
  { id: 42, name: 'Anti-Meta', group: 'Other' },
  { id: 43, name: 'Balanced', group: 'Other' },
  { id: 44, name: 'Experimental', group: 'Other' },
  { id: 45, name: 'Beginner Friendly', group: 'Other' },
  { id: 46, name: 'Meme', group: 'Other' },
  { id: 47, name: 'Low-APM Friendly', group: 'Other' },
];

export const TAG_BIT_LENGTH = DECK_TAGS.length; // Dynamic bit length

export function encodeTagIndicesToBitstring(indices: number[]): string {
  const bits = Array.from({ length: TAG_BIT_LENGTH }, () => '0');
  for (const idx of indices) {
    if (idx >= 0 && idx < TAG_BIT_LENGTH) bits[idx] = '1';
  }
  return bits.join('');
}

export function decodeBitstringToIndices(bitstring?: string | null): number[] {
  if (!bitstring || !/^[01]+$/.test(bitstring)) return [];
  const indices: number[] = [];
  const len = Math.min(bitstring.length, TAG_BIT_LENGTH);
  for (let i = 0; i < len; i++) {
    if (bitstring[i] === '1') indices.push(i);
  }
  return indices;
}


