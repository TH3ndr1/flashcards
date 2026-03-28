'use client';

/**
 * Subject-based watermark graphics for study method cards.
 * Ported from the design system — detects subject category from deck title/tags
 * and renders a matching faded SVG illustration in the card background.
 */

import React from 'react';
import { useTheme } from 'next-themes';
import type { StudyMethodType } from './study-method-config';

export const getSubjectCategory = (metadata: { title: string; tags?: string[] }) => {
  const tags = metadata.tags?.join(' ').toLowerCase() || '';
  const title = metadata.title.toLowerCase();
  const combined = `${tags} ${title}`;

  if (combined.match(/math|algebra|geometry|calculus|arithmetic|equation/)) return 'math';
  if (combined.match(/\bit\b|information technology|computer|programming|software|hardware|chip|processor|machine learning|artificial intelligence|\bai\b|\bml\b/)) return 'it';
  if (combined.match(/chemistry|chemical|reaction|molecule/)) return 'chemistry';
  if (combined.match(/science|physics|biology|quantum|rocket|startup|anatomy|medical|medicine/)) return 'science';
  if (combined.match(/art|painting|drawing|design|gallery|renaissance/)) return 'art';
  if (combined.match(/history|war|timeline|event|civilization/)) return 'history';
  if (combined.match(/literature|book|novel|poetry|writing/)) return 'literature';
  if (combined.match(/language|english|spanish|french|japanese|kanji|grammar|vocabulary/)) return 'language';
  if (combined.match(/music|song|melody|instrument|guitar/)) return 'music';
  if (combined.match(/astronomy|space|stars|planet/)) return 'astronomy';
  if (combined.match(/sport|basketball|football|soccer|tennis|athletics|fitness|exercise/)) return 'sport';
  if (combined.match(/movie|film|cinema|video/)) return 'movies';
  if (combined.match(/media|entertainment|disc|album|cd|dvd/)) return 'media';
  if (combined.match(/geography|map|continent|country|location/)) return 'geography';
  if (combined.match(/philosophy|philosophical|logic|ethics|metaphysics/)) return 'philosophy';
  if (combined.match(/economy|economics|finance|business|trade|market/)) return 'economy';
  if (combined.match(/technical|engineering|technology|mechanical|electrical/)) return 'technical';
  if (combined.match(/legal|law|court|justice|attorney/)) return 'legal';
  if (combined.match(/religion|religious|theology|spiritual|faith/)) return 'religion';

  return 'general';
};

export const SUBJECT_WATERMARK_DATA: Record<string, { transform: string; content: (color: string) => React.ReactNode }> = {
  language: {
    transform: "translate(105, 55) scale(5)",
    content: (color) => (
      <>
        <g>
          <polygon points="7.1,23 8.9,23 8,21.2" fill={color} />
          <path d="M13,16H3c-1.1,0-2,0.9-2,2v10c0,1.1,0.9,2,2,2h10c1.1,0,2-0.9,2-2V18C15,16.9,14.1,16,13,16z M12.4,27.9 C12.3,28,12.2,28,12,28c-0.4,0-0.7-0.2-0.9-0.6L9.9,25H6.1l-1.2,2.4c-0.2,0.5-0.8,0.7-1.3,0.4c-0.5-0.2-0.7-0.8-0.4-1.3l4-8 c0.3-0.7,1.5-0.7,1.8,0l4,8C13.1,27,12.9,27.6,12.4,27.9z" fill={color} />
        </g>
        <path d="M17,1H7C5.9,1,5,1.9,5,3v10c0,1.1,0.9,2,2,2h10c1.1,0,2-0.9,2-2V3C19,1.9,18.1,1,17,1z M12,11c0.9,0,1.7-0.4,2.2-1 c0.4-0.4,1-0.5,1.4-0.1c0.4,0.4,0.5,1,0.1,1.4c-1,1.1-2.3,1.7-3.8,1.7c-2.8,0-5-2.2-5-5s2.2-5,5-5c1.4,0,2.8,0.6,3.8,1.7 c0.4,0.4,0.3,1-0.1,1.4c-0.4,0.4-1,0.3-1.4-0.1c-0.6-0.7-1.4-1-2.2-1c-1.7,0-3,1.3-3,3S10.3,11,12,11z" fill={color} />
        <g>
          <path d="M24,24h-3v2h3c0.6,0,1-0.4,1-1S24.6,24,24,24z" fill={color} />
          <path d="M25,21c0-0.6-0.4-1-1-1h-3v2h3C24.6,22,25,21.6,25,21z" fill={color} />
          <path d="M28,16H18c-1.1,0-2,0.9-2,2v10c0,1.1,0.9,2,2,2h10c1.1,0,2-0.9,2-2V18C30,16.9,29.1,16,28,16z M27,25c0,1.7-1.3,3-3,3h-4 c-0.6,0-1-0.4-1-1v-4v-4c0-0.6,0.4-1,1-1h4c1.7,0,3,1.3,3,3c0,0.8-0.3,1.5-0.8,2C26.7,23.5,27,24.2,27,25z" fill={color} />
        </g>
      </>
    ),
  },
  science: {
    transform: "translate(110, 45) scale(5)",
    content: (color) => (
      <>
        <path d="M26,20.1c-1.8,0-3.3,1.2-3.8,2.8c-0.4-0.2-0.8-0.2-1.2-0.2c-1.7,0-3,1.3-3,2.9V26c0,1.1-0.9,2-2,2s-2-0.9-2-2v-0.4 c0-1.6-1.3-2.9-3-2.9c-0.4,0-0.8,0.1-1.2,0.2c-0.5-1.6-2-2.8-3.8-2.8c-2.2,0-4,1.8-4,4.1V30c0,0.6,0.4,1,1,1s1-0.4,1-1v-5.8 c0-1.1,0.9-2.1,2-2.1s2,0.9,2,2.1V26c0,0.6,0.4,1,1,1s1-0.4,1-1v-0.4c0-0.5,0.5-0.9,1-0.9s1,0.4,1,0.9V26c0,2.2,1.8,4,4,4 s4-1.8,4-4v-0.4c0-0.5,0.5-0.9,1-0.9s1,0.4,1,0.9V26c0,0.6,0.4,1,1,1s1-0.4,1-1v-1.8c0-1.1,0.9-2.1,2-2.1s2,0.9,2,2.1V30 c0,0.6,0.4,1,1,1s1-0.4,1-1v-5.8C30,21.9,28.2,20.1,26,20.1z" fill={color} />
        <path d="M11,19h10c0.4,0,0.7-0.2,0.9-0.5c0.2-0.3,0.2-0.7,0-1L19,12.7V6c0-0.2-0.1-0.4-0.2-0.6l-2-3c-0.4-0.6-1.3-0.6-1.7,0l-2,3 C13.1,5.6,13,5.8,13,6v6.7l-2.9,4.8c-0.2,0.3-0.2,0.7,0,1C10.3,18.8,10.6,19,11,19z" fill={color} />
        <path d="M15,21v3c0,0.6,0.4,1,1,1s1-0.4,1-1v-3c0-0.6-0.4-1-1-1S15,20.4,15,21z" fill={color} />
      </>
    ),
  },
  astronomy: {
    transform: "translate(110, 65) scale(5.5)",
    content: (color) => (
      <>
        <path d="M29.8,7.2c-1.1-1.8-4-2-8.2-0.6C20,5.6,18.1,5,16,5C9.9,5,5,9.9,5,16c0,0.4,0,0.8,0.1,1.2c-2.8,3.1-3.8,5.7-2.7,7.4 c0.7,1.1,1.9,1.5,3.5,1.5c3.5,0,8.8-2.2,13.4-5.2c3.5-2.2,6.6-4.8,8.5-7.3C30.7,10.3,30.5,8.3,29.8,7.2z M4.1,23.6 c-0.4-0.6,0-2,1.6-3.9c0.6,1.6,1.5,3,2.7,4.2C6.1,24.4,4.5,24.3,4.1,23.6z M26.4,12.4c-0.6-1.7-1.5-3.2-2.8-4.4 c2.6-0.6,4.1-0.4,4.5,0.2C28.5,8.8,28.2,10.2,26.4,12.4z" fill={color} />
        <path d="M11.8,26.2c1.3,0.5,2.7,0.8,4.2,0.8c5.8,0,10.5-4.5,11-10.2c-1.9,1.8-4.2,3.6-6.6,5.2C17.4,23.8,14.5,25.3,11.8,26.2z" fill={color} />
      </>
    ),
  },
  general: {
    transform: "translate(105, 60) scale(5)",
    content: (color) => (
      <>
        <g><path d="M31,25H10.5C8,25,6,23,6,20.5S8,16,10.5,16H31c0.6,0,1,0.4,1,1s-0.4,1-1,1H10.5C9.1,18,8,19.1,8,20.5S9.1,23,10.5,23H31 c0.6,0,1,0.4,1,1S31.6,25,31,25z" fill={color} /></g>
        <g><path d="M30,25c-0.3,0-0.7-0.2-0.9-0.5c-1.4-2.5-1.4-5.5,0-8c0.3-0.5,0.9-0.6,1.4-0.4c0.5,0.3,0.6,0.9,0.4,1.4 c-1.1,1.9-1.1,4.1,0,6c0.3,0.5,0.1,1.1-0.4,1.4C30.3,25,30.2,25,30,25z" fill={color} /></g>
        <g><path d="M25,32H4.5C2,32,0,30,0,27.5S2,23,4.5,23H25c0.6,0,1,0.4,1,1s-0.4,1-1,1H4.5C3.1,25,2,26.1,2,27.5S3.1,30,4.5,30H25 c0.6,0,1,0.4,1,1S25.6,32,25,32z" fill={color} /></g>
        <g><path d="M24,32c-0.3,0-0.7-0.2-0.9-0.5c-1.4-2.5-1.4-5.5,0-8c0.3-0.5,0.9-0.6,1.4-0.4c0.5,0.3,0.6,0.9,0.4,1.4 c-1.1,1.9-1.1,4.1,0,6c0.3,0.5,0.1,1.1-0.4,1.4C24.3,32,24.2,32,24,32z" fill={color} /></g>
        <g><path d="M16.9,5c-0.6,0-1-0.4-1-1c0-0.7-0.6-1.5-1.5-2l-0.2-0.1c-0.5-0.3-0.7-0.9-0.4-1.3c0.3-0.5,0.9-0.7,1.3-0.4l0.2,0.1 c1.6,0.9,2.6,2.3,2.6,3.8C17.9,4.6,17.5,5,16.9,5z" fill={color} /></g>
        <path d="M21.5,3.1L21.5,3.1c-1.2-0.2-2.4,0.1-3.4,0.7c-0.3,0.2-0.8,0.2-1.1,0c-0.3-0.2-0.7-0.4-1.1-0.5c0,0.2,0.1,0.5,0.1,0.7 c0,0.6-0.4,1-1,1s-1-0.4-1-1c0-0.3-0.1-0.6-0.3-0.9c0,0-0.1,0-0.1,0c-2.9,0.5-4.9,3.5-4.5,6.7c0.3,2.3,1.9,5.8,3.9,7.3 c0.7,0.5,1.4,0.8,2,0.8c0.1,0,0.3,0,0.4,0c0.5-0.1,0.9-0.3,1.3-0.6c0.4-0.3,1.1-0.3,1.5,0c0.4,0.3,0.9,0.5,1.3,0.6 c0.8,0.1,1.6-0.1,2.5-0.7c2-1.5,3.6-5,3.9-7.3C26.3,6.6,24.3,3.5,21.5,3.1z" fill={color} />
      </>
    ),
  },
  math: {
    transform: "translate(115, 55) scale(5)",
    content: (color) => (
      <path d="M25,0H7C5.3,0,4,1.3,4,3v26c0,1.7,1.3,3,3,3h18c1.7,0,3-1.3,3-3V3C28,1.3,26.7,0,25,0z M10,28c-1.1,0-2-0.9-2-2s0.9-2,2-2 s2,0.9,2,2S11.1,28,10,28z M10,22c-1.1,0-2-0.9-2-2s0.9-2,2-2s2,0.9,2,2S11.1,22,10,22z M10,16c-1.1,0-2-0.9-2-2s0.9-2,2-2 s2,0.9,2,2S11.1,16,10,16z M16,28c-1.1,0-2-0.9-2-2s0.9-2,2-2s2,0.9,2,2S17.1,28,16,28z M16,22c-1.1,0-2-0.9-2-2s0.9-2,2-2 s2,0.9,2,2S17.1,22,16,22z M16,16c-1.1,0-2-0.9-2-2s0.9-2,2-2s2,0.9,2,2S17.1,16,16,16z M22,28c-1.1,0-2-0.9-2-2s0.9-2,2-2 s2,0.9,2,2S23.1,28,22,28z M22,22c-1.1,0-2-0.9-2-2s0.9-2,2-2s2,0.9,2,2S23.1,22,22,22z M22,16c-1.1,0-2-0.9-2-2s0.9-2,2-2 s2,0.9,2,2S23.1,16,22,16z M24,9c0,0.6-0.4,1-1,1H9c-0.6,0-1-0.4-1-1V5c0-0.6,0.4-1,1-1h14c0.6,0,1,0.4,1,1V9z" fill={color} />
    ),
  },
  history: {
    transform: "translate(115, 54) scale(7.5)",
    content: (color) => (
      <path d="M18 8v11h-3v-4a2 2 0 1 0-4 0v4H0v-8a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1h2V8a2 2 0 0 1-2-2V1a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1h2V1a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v5a2 2 0 0 1-2 2zm-6 1a1 1 0 0 0 0 2h2a1 1 0 0 0 0-2h-2z" fill={color} transform="translate(1, 0)" />
    ),
  },
  art: {
    transform: "translate(105, 55) scale(3.6)",
    content: (color) => (
      <path d="M21.211 6c-12.632 0-20.211 10.133-20.211 15.2s2.526 8.867 7.579 8.867 7.58 1.266 7.58 5.066c0 5.066 3.789 8.866 8.842 8.866 16.422 0 24-8.866 24-17.732-.001-15.2-12.635-20.267-27.79-20.267zm-3.158 5.067c1.744 0 3.158 1.418 3.158 3.166 0 1.75-1.414 3.167-3.158 3.167s-3.158-1.418-3.158-3.167c0-1.748 1.414-3.166 3.158-3.166zm10.104 0c1.744 0 3.158 1.418 3.158 3.166 0 1.75-1.414 3.167-3.158 3.167-1.743 0-3.157-1.418-3.157-3.167 0-1.748 1.414-3.166 3.157-3.166zm10.106 5.066c1.745 0 3.159 1.417 3.159 3.167 0 1.75-1.414 3.166-3.159 3.166-1.744 0-3.157-1.417-3.157-3.166-.001-1.749 1.413-3.167 3.157-3.167zm-29.052 2.534c1.744 0 3.157 1.417 3.157 3.165 0 1.75-1.414 3.167-3.157 3.167s-3.158-1.418-3.158-3.167c0-1.748 1.414-3.165 3.158-3.165zm15.789 12.666c2.093 0 3.789 1.7 3.789 3.801 0 2.098-1.696 3.799-3.789 3.799s-3.789-1.701-3.789-3.799c0-2.101 1.696-3.801 3.789-3.801z" fill={color} />
    ),
  },
  music: {
    transform: "translate(115, 65) scale(5)",
    content: (color) => (
      <path d="M29.7,5.5c-0.4-0.4-1-0.4-1.4,0l-2.7,2.7l-0.6-0.6l-0.6-0.6L27,4.3c0.4-0.4,0.4-1,0-1.4s-1-0.4-1.4,0l-2.8,2.8 c-1.4-1-3.1-1.4-4.7-1.1c-2,0.3-3.7,1.5-4.6,3.2c-0.5,0.9-1.2,1.5-2.2,1.9l-3.9,1.5c-2.4,1-4.1,3-4.7,5.5C2.1,19.4,3,22.2,5,24.2 l3.4,3.4C9.9,29.1,12,30,14.2,30c0.5,0,1.1-0.1,1.6-0.2c2.6-0.5,4.6-2.2,5.5-4.7l1.5-3.9c0.4-0.9,1-1.7,1.9-2.2 c1.8-1,2.9-2.6,3.2-4.6c0.2-1.7-0.2-3.4-1.1-4.7L29.7,7C30.1,6.6,30.1,5.9,29.7,5.5z M14.1,23.5c-0.2,0.2-0.5,0.3-0.7,0.3 s-0.5-0.1-0.7-0.3L9,19.8c-0.4-0.4-0.4-1,0-1.4s1-0.4,1.4,0l3.7,3.7C14.5,22.5,14.5,23.1,14.1,23.5z M20.9,17.1 c-0.7,0.7-1.7,1.1-2.7,1.1s-2-0.4-2.7-1.1c-0.7-0.7-1.1-1.7-1.1-2.7s0.4-2,1.1-2.7c1.5-1.5,4-1.5,5.5,0c0.7,0.7,1.1,1.7,1.1,2.7 S21.6,16.3,20.9,17.1z" fill={color} />
    ),
  },
  sport: {
    transform: "translate(123, 73) scale(2.4)",
    content: (color) => (
      <>
        <path d="M46.154,46.143c-4.369,4.373-5.616,10.631-3.869,16.141c4.51-1.523,8.763-4.053,12.358-7.652 c3.6-3.596,6.128-7.848,7.652-12.357C56.785,40.529,50.528,41.773,46.154,46.143z" fill={color} />
        <path d="M17.857,17.846c4.369-4.374,5.612-10.631,3.869-16.143c-4.51,1.524-8.763,4.053-12.362,7.653 c-3.596,3.596-6.125,7.848-7.653,12.359C7.227,23.457,13.484,22.215,17.857,17.846z" fill={color} />
        <path d="M29.661,0.085c2.231,8.071,0.195,17.076-6.145,23.422c-6.343,6.336-15.348,8.373-23.419,6.141 c-0.563,7.703,1.649,15.553,6.632,21.957L51.618,6.722C45.213,1.734,37.36-0.478,29.661,0.085z" fill={color} />
        <path d="M57.277,12.381L12.394,57.266c6.405,4.986,14.258,7.199,21.957,6.637c-2.231-8.07-0.199-17.076,6.145-23.42 c6.343-6.34,15.349-8.375,23.419-6.141C64.478,26.639,62.265,18.787,57.277,12.381z" fill={color} />
      </>
    ),
  },
  movies: {
    transform: "translate(110, 65) scale(5)",
    content: (color) => (
      <>
        <path d="M29.5,14.1c-0.3-0.2-0.7-0.2-1,0l-4.6,2.3C23.7,15,22.5,14,21,14H7c-1.7,0-3,1.3-3,3v6c0,1.7,1.3,3,3,3h5.1l-3,4.4 c-0.3,0.5-0.2,1.1,0.3,1.4c0.5,0.3,1.1,0.2,1.4-0.3l3.2-4.8l3.2,4.8c0.2,0.3,0.5,0.4,0.8,0.4c0.2,0,0.4-0.1,0.6-0.2 c0.5-0.3,0.6-0.9,0.3-1.4l-3-4.4H21c1.5,0,2.7-1,2.9-2.4l4.6,2.3C28.7,26,28.8,26,29,26c0.2,0,0.4-0.1,0.5-0.1 c0.3-0.2,0.5-0.5,0.5-0.9V15C30,14.7,29.8,14.3,29.5,14.1z" fill={color} />
        <path d="M19,1c-2.1,0-3.9,1.1-5,2.7C12.9,2.1,11.1,1,9,1C5.7,1,3,3.7,3,7s2.7,6,6,6c2.1,0,3.9-1.1,5-2.7c1.1,1.6,2.9,2.7,5,2.7 c3.3,0,6-2.7,6-6S22.3,1,19,1z M9,9C7.9,9,7,8.1,7,7s0.9-2,2-2s2,0.9,2,2S10.1,9,9,9z M19,9c-1.1,0-2-0.9-2-2s0.9-2,2-2s2,0.9,2,2 S20.1,9,19,9z" fill={color} />
      </>
    ),
  },
  media: {
    transform: "translate(110, 65) scale(5)",
    content: (color) => (
      <g>
        <path d="M30.6,12.8C30.6,12.8,30.6,12.8,30.6,12.8C30.6,12.7,30.6,12.7,30.6,12.8c-1-4.6-4.1-8.4-8.2-10.3c0,0-0.1,0-0.1-0.1 c0,0-0.1,0-0.1,0C20.3,1.5,18.2,1,16,1C7.7,1,1,7.7,1,16c0,1.6,0.3,3.2,0.8,4.7c0,0,0,0,0,0.1c0,0,0,0.1,0,0.1 c0.7,2.2,2,4.1,3.6,5.7c0,0,0,0,0,0s0,0,0,0C8.1,29.3,11.9,31,16,31c8.3,0,15-6.7,15-15C31,14.9,30.9,13.8,30.6,12.8z M12,16 c0-2.2,1.8-4,4-4s4,1.8,4,4s-1.8,4-4,4S12,18.2,12,16z M16,3c1.6,0,3.1,0.3,4.6,0.8l-3,6.4c-0.5-0.1-1-0.2-1.6-0.2 c-3.3,0-6,2.7-6,6c0,0.3,0,0.6,0.1,0.9l-6.7,2.2C3.1,18.1,3,17.1,3,16C3,8.8,8.8,3,16,3z M16,29c-3.2,0-6.2-1.2-8.4-3.1l5-5 c1,0.7,2.2,1.1,3.5,1.1c3.3,0,6-2.7,6-6c0-0.1,0-0.2,0-0.3l6.9-1.5c0.1,0.6,0.1,1.2,0.1,1.8C29,23.2,23.2,29,16,29z" fill={color} />
        <path d="M19,16c0-1.7-1.3-3-3-3s-3,1.3-3,3s1.3,3,3,3S19,17.7,19,16z M15,16c0-0.6,0.4-1,1-1s1,0.4,1,1s-0.4,1-1,1S15,16.6,15,16z" fill={color} />
      </g>
    ),
  },
  geography: {
    transform: "translate(110, 68) scale(5)",
    content: (color) => (
      <g>
        <path d="M9.6,19.4c1.8,1.8,4.1,2.6,6.4,2.6s4.6-0.9,6.4-2.6c3.5-3.5,3.5-9.2,0-12.7c-3.5-3.5-9.2-3.5-12.7,0 C6.1,10.1,6.1,15.9,9.6,19.4z" fill={color} />
        <path d="M26.6,22.2l-1.5-1.5c-0.4-0.4-1-0.4-1.4,0C19.4,25,12.4,25,8.2,20.8C4,16.5,4,9.6,8.3,5.3c0.2-0.2,0.3-0.4,0.3-0.7 S8.5,4.1,8.3,3.9L6.8,2.4C6.4,2,5.8,2,5.4,2.4C5,2.8,5,3.4,5.4,3.8l0.8,0.8C1.9,9.7,2,17.4,6.8,22.2c2.3,2.3,5.2,3.5,8.2,3.7V27 c0,1.1-0.9,2-2,2h-1c-0.6,0-1,0.4-1,1s0.4,1,1,1h8c0.6,0,1-0.4,1-1s-0.4-1-1-1h-1c-1.1,0-2-0.9-2-2v-1.1c2.6-0.2,5.2-1.3,7.4-3.1 l0.8,0.8c0.4,0.4,1,0.4,1.4,0C27,23.2,27,22.6,26.6,22.2z" fill={color} />
      </g>
    ),
  },
  economy: {
    transform: "translate(115, 65) scale(5)",
    content: (color) => (
      <path d="M0 25v-18h32v18h-32zM2 8.938v14.062h28v-14.062h-28zM21 16c0-3.313-2.238-6-5-6h13v12h-13c2.762 0 5-2.687 5-6zM25 18c0.828 0 1.5-0.896 1.5-2s-0.672-2-1.5-2-1.5 0.896-1.5 2 0.672 2 1.5 2zM11 16c0 3.313 2.238 6 5 6h-13v-12h13c-2.762 0-5 2.687-5 6zM7 14c-0.829 0-1.5 0.896-1.5 2s0.671 2 1.5 2c0.828 0 1.5-0.896 1.5-2s-0.672-2-1.5-2z" fill={color} />
    ),
  },
  technical: {
    transform: "translate(105, 60) scale(5.5)",
    content: (color) => (
      <>
        <path d="M12.6,25.7C12.4,25,12,24.5,11.5,24H2.7C2.3,24.5,2,25.1,2,25.8V27c0,0.6,0.4,1,1,1h9c0.3,0,0.6-0.2,0.8-0.4 c0.2-0.3,0.2-0.6,0.1-0.9L12.6,25.7z" fill={color} />
        <path d="M30,10h-3V9.7C27,8.2,25.8,7,24.3,7H23c0-0.6-0.4-1-1-1H7c-2.8,0-5,2.2-5,5c0,2.3,1.6,4.2,3.7,4.8L3.6,22h8.1l0.7-2h2.3 c1.9,0,3.5-1.3,3.9-3l0.2-1H22c0.6,0,1-0.4,1-1h1.3c1.5,0,2.7-1.2,2.7-2.7V12h3c0.6,0,1-0.4,1-1S30.6,10,30,10z" fill={color} />
      </>
    ),
  },
  literature: {
    transform: "translate(110, 55) scale(5)",
    content: (color) => (
      <>
        <g>
          <path d="M26,7H9C8.4,7,8,6.6,8,6s0.4-1,1-1h17c0.6,0,1,0.4,1,1S26.6,7,26,7z" fill={color} />
        </g>
        <path d="M26,8h-9v13l-3-1l-3,1V8H9C7.9,8,7,7.1,7,6s0.9-2,2-2h17c0.6,0,1-0.4,1-1s-0.4-1-1-1H9C6.8,2,5,3.8,5,6v20c0,2.2,1.8,4,4,4h17c0.6,0,1-0.4,1-1V9C27,8.4,26.6,8,26,8z" fill={color} />
      </>
    ),
  },
  chemistry: {
    transform: "translate(110, 65) scale(5)",
    content: (color) => (
      <path d="M19.332 19.041c0 0-1.664 2.125-3.79 0-2.062-2-3.562 0-3.562 0l-4.967 9.79c-0.144 0.533 0.173 1.081 0.706 1.224h16.497c0.533-0.143 0.85-0.69 0.707-1.224l-5.591-9.79zM26.939 28.33l-7.979-13.428v-0.025l-0.014-7.869h0.551c0.826 0 1.498-0.671 1.498-1.499 0-0.827-0.672-1.498-1.498-1.498h-7.995c-0.827 0-1.498 0.671-1.498 1.498 0 0.828 0.671 1.499 1.498 1.499h0.482l-0.016 7.871-6.908 13.451c-0.428 1.599 0.521 3.242 2.119 3.67h17.641c1.6-0.428 2.549-2.071 2.119-3.67z" fill={color} />
    ),
  },
  it: {
    transform: "translate(110, 65) scale(5)",
    content: (color) => (
      <path d="M29,15c0.6,0,1-0.4,1-1s-0.4-1-1-1h-3v-2h3c0.6,0,1-0.4,1-1s-0.4-1-1-1h-3c0-1.7-1.3-3-3-3V3c0-0.6-0.4-1-1-1s-1,0.4-1,1v3 h-2V3c0-0.6-0.4-1-1-1s-1,0.4-1,1v3h-2V3c0-0.6-0.4-1-1-1s-1,0.4-1,1v3h-2V3c0-0.6-0.4-1-1-1S9,2.4,9,3v3C7.3,6,6,7.3,6,9H3 c-0.6,0-1,0.4-1,1s0.4,1,1,1h3v2H3c-0.6,0-1,0.4-1,1s0.4,1,1,1h3v2H3c-0.6,0-1,0.4-1,1s0.4,1,1,1h3v2H3c-0.6,0-1,0.4-1,1s0.4,1,1,1 h3c0,1.7,1.3,3,3,3v3c0,0.6,0.4,1,1,1s1-0.4,1-1v-3h2v3c0,0.6,0.4,1,1,1s1-0.4,1-1v-3h2v3c0,0.6,0.4,1,1,1s1-0.4,1-1v-3h2v3 c0,0.6,0.4,1,1,1s1-0.4,1-1v-3c1.7,0,3-1.3,3-3h3c0.6,0,1-0.4,1-1s-0.4-1-1-1h-3v-2h3c0.6,0,1-0.4,1-1s-0.4-1-1-1h-3v-2H29z M22,19 c0,1.7-1.3,3-3,3h-6c-1.7,0-3-1.3-3-3v-6c0-1.7,1.3-3,3-3h6c1.7,0,3,1.3,3,3V19z" fill={color} />
    ),
  },
};

const colorMap: Record<StudyMethodType, { light: string; dark: string }> = {
  flashcard:        { light: '#FBE1EE', dark: '#2E2A41' },
  story:            { light: '#F2E5FE', dark: '#292C48' },
  quiz:             { light: '#DDEAFE', dark: '#1F2F48' },
  mindmap:          { light: '#DBF7E5', dark: '#1D353C' },
  'knowledge-graph':{ light: '#FEE9D7', dark: '#2F2D35' },
};

export function SubjectWatermark({
  title,
  tags,
  methodType,
  className,
  svgViewBox = "0 0 460 300",
}: {
  title: string;
  tags?: string[];
  methodType: StudyMethodType;
  className?: string;
  svgViewBox?: string;
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const palette = colorMap[methodType] ?? colorMap.flashcard;
  const iconColor = isDark ? palette.dark : palette.light;

  const category = getSubjectCategory({ title, tags });
  const data = SUBJECT_WATERMARK_DATA[category] ?? {
    transform: "translate(200, 150)",
    content: (color: string) => (
      <>
        <circle cx="0" cy="0" r="70" fill={color} />
        <ellipse cx="0" cy="0" rx="110" ry="38" fill={color} />
      </>
    ),
  };

  return (
    <div
      className={`absolute pointer-events-none z-[1] flex items-center justify-center ${className ?? "right-3 top-1/2 -translate-y-1/2 w-[286px] h-[286px]"}`}
    >
      <svg viewBox={svgViewBox} preserveAspectRatio="xMidYMid meet" className="w-full h-full">
        <g transform={!className ? "translate(180, 0)" : undefined}>
          <g transform={data.transform}>
            {data.content(iconColor)}
          </g>
        </g>
      </svg>
    </div>
  );
}
