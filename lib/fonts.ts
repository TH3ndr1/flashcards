// lib/fonts.ts
import localFont from 'next/font/local';
import type { FontOption } from "@/providers/settings-provider"; // Assuming this type is defined correctly

// --- 1. Define and Load Local Fonts using next/font ---

// Define OpenDyslexic font object
export const openDyslexicFont = localFont({
  src: [
    {
      // IMPORTANT: Adjust this path relative to THIS FILE (lib/fonts.ts)
      // If lib is at the root, and public is at the root, this should work.
      // If lib is inside src/, use '../../public/fonts/...'
      path: '../public/fonts/OpenDyslexic-Regular.woff2',
      weight: '400', // Or 'normal'
      style: 'normal',
    },
  ],
  variable: '--font-open-dyslexic', // CSS variable name for Tailwind
  display: 'swap', // Recommended: improves perceived performance
  // preload: false, // Optional: Set to false if you only load it conditionally (might not be needed here)
});

// Define Atkinson Hyperlegible font object
export const atkinsonFont = localFont({
  src: [
    {
      path: '../public/fonts/AtkinsonHyperlegibleNext-Regular.woff2', // Adjust path
      weight: '400',
      style: 'normal',
    },
  ],
  variable: '--font-atkinson', // CSS variable name for Tailwind
  display: 'swap',
  // preload: false, // Optional
});

// --- 2. Define Font Metadata (for UI, like Settings) ---
// We remove the 'family' property as it's now handled by the CSS variables

export const FONT_OPTIONS: Record<FontOption | 'default', { name: string; description: string }> = {
  default: {
    name: 'Default',
    // Assuming '--font-sans' is defined elsewhere (e.g., in layout.tsx with Inter)
    description: 'System default font',
  },
  opendyslexic: {
    name: 'OpenDyslexic',
    description: 'Designed to improve readability for readers with dyslexia',
  },
  atkinson: {
    name: 'Atkinson Hyperlegible',
    description: 'Focuses on letterform distinction to increase character recognition',
  },
} as const; // Using 'as const' is good practice here

// --- 3. Helper Function to Get Tailwind Class ---
// This remains the same and is still useful

export function getFontClass(font: FontOption | 'default' | undefined): string {
  switch (font) {
    case 'opendyslexic':
      return 'font-opendyslexic'; // This class needs to be defined in tailwind.config.js
    case 'atkinson':
      return 'font-atkinson';   // This class needs to be defined in tailwind.config.js
    case 'default':
    default:
      return 'font-sans';         // Assumes 'font-sans' is your configured default
  }
}

// --- Type Definitions (if not already defined elsewhere) ---
// Ensure FontOption includes the keys you use ('opendyslexic', 'atkinson')
// Example:
// export type FontOption = 'opendyslexic' | 'atkinson';

// If settings can be undefined or 'default', the getFontClass signature should handle it,
// which the updated version above does.