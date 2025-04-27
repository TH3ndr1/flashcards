// lib/palettes.ts

export interface ColorPair {
  background: string; // Hex code
  text: string;       // Hex code
}

export interface Palette {
  id: string;         // Unique ID for storing in settings
  name: string;       // User-friendly name
  light: ColorPair;   // Colors for light theme background
  dark: ColorPair;    // Colors for dark theme background (with grey card)
}

//use url for inspiration
//https://venngage.com/tools/accessible-color-palette-generator


export const PREDEFINED_PALETTES: ReadonlyArray<Palette> = [
  { id: 'default', name: 'Default (No Color)', light: { background: 'transparent', text: 'inherit' }, dark: { background: 'transparent', text: 'inherit' } }, // Option to disable for a specific type
  { id: 'bw', name: 'Black/White', light: { background: '#000000', text: '#FFFFFF' }, dark: { background: '#000000', text: '#FFFFFF' } },
  { id: 'blue-hc', name: 'Blue - High Contrast', light: { background: '#0035B0', text: '#FFFFFF' }, dark: { background: '#99CAFF', text: '#000000' } },
  { id: 'purple-hc', name: 'Purple - High Contrast', light: { background: '#8D03C7', text: '#FFFFFF' }, dark: { background: '#E8B2FF', text: '#000000' } },
  { id: 'green-hc', name: 'Green - High Contrast', light: { background: '#00640A', text: '#FFFFFF' }, dark: { background: '#9CE9A4', text: '#000000' } },
  { id: 'gold-hc', name: 'Gold/Brown - High Contrast', light: { background: '#755200', text: '#FFFFFF' }, dark: { background: '#FFD26A', text: '#000000' } },
  { id: 'red-hc', name: 'Red/Salmon - High Contrast', light: { background: '#9D0000', text: '#FFFFFF' }, dark: { background: '#FF9191', text: '#000000' } }, 
  { id: 'blue', name: 'Blue', light: { background: '#2546F0', text: '#FFFFFF' }, dark: { background: '#2546F0', text: '#FFFFFF' } },
  { id: 'purple', name: 'Purple', light: { background: '#6D00AE', text: '#FFFFFF' }, dark: { background: '#6D00AE', text: '#FFFFFF' } },
  { id: 'green', name: 'Green', light: { background: '#89CE00', text: '#000000' }, dark: { background: '#89CE00', text: '#000000' } },
  { id: 'gold ', name: 'Gold/Brown', light: { background: '#FCC400', text: '#000000' }, dark: { background: '#FCC400', text: '#000000' } },
  { id: 'red', name: 'Red', light: { background: '#E40001', text: '#FFFFFF' }, dark: { background: '#E40001', text: '#FFFFFF' } },
] as const;

// Define default palette assignments
export const DEFAULT_PALETTE_CONFIG: Record<string, Record<string, string>> = {
  // Assign default palette IDs
  Noun: { Male: 'blue', Female: 'green', Default: 'bw' }, // Example: Blue for Male Nouns, Red for Female, B/W for Neutral/Other
  Verb: { Default: 'red' },
  Adjective: { Male: 'gold', Female: 'gold', Default: 'gold' }, // Use same for M/F/Default
  Adverb: { Default: 'purple' },
  Pronoun: { Male: 'blue', Female: 'blue', Default: 'blue' }, // Use same for M/F/Default
  Preposition: { Default: 'default' }, // Example: Default = no color
  Interjection: { Default: 'default' },
  Other: { Default: 'default' },
};

// Define the dark mode card background color from the image
export const DARK_MODE_CARD_BG = '#686868'; // Adjust this grey as needed