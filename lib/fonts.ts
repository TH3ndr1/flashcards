// lib/fonts.ts
import localFont from 'next/font/local';
import type { FontOption } from "@/providers/settings-provider"; // Assuming this type is defined correctly

// --- 1. Define and Load Local Fonts using next/font ---

// Define OpenDyslexic font object
export const openDyslexicFont = localFont({
  src: [
    { path: '../public/fonts/OpenDyslexic-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../public/fonts/OpenDyslexic-Bold.woff2', weight: '700', style: 'normal' },
    { path: '../public/fonts/OpenDyslexic-Italic.woff2', weight: '400', style: 'italic' },
    { path: '../public/fonts/OpenDyslexic-Bold-Italic.woff2', weight: '700', style: 'italic' },
  ],
  variable: '--font-open-dyslexic',
  display: 'swap',
});

// Define Atkinson Hyperlegible font object
export const atkinsonFont = localFont({
  src: [
    { path: '../public/fonts/AtkinsonHyperlegibleNext-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../public/fonts/AtkinsonHyperlegibleNext-SemiBold.woff2', weight: '600', style: 'normal' },
    { path: '../public/fonts/AtkinsonHyperlegibleNext-Bold.woff2', weight: '700', style: 'normal' },
    { path: '../public/fonts/AtkinsonHyperlegibleNext-RegularItalic.woff2', weight: '400', style: 'italic' },
    { path: '../public/fonts/AtkinsonHyperlegibleNext-SemiBoldItalic.woff2', weight: '600', style: 'italic' },
    { path: '../public/fonts/AtkinsonHyperlegibleNext-BoldItalic.woff2', weight: '700', style: 'italic' },
  ],
  variable: '--font-atkinson',
  display: 'swap',
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