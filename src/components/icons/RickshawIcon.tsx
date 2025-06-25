
import React, { CSSProperties } from 'react';

export const RickshawIcon = ({ style }: { style?: CSSProperties }) => (
  <svg
    viewBox="0 0 64 64"
    xmlns="http://www.w3.org/2000/svg"
    style={{ width: '100%', height: '100%', objectFit: 'contain', ...style }}
    aria-label="Rickshaw Icon"
  >
    <rect x="12" y="10" width="40" height="18" rx="4" fill="#FFC107" />
    <rect x="15" y="13" width="34" height="13" rx="2.5" fill="#81D4FA" stroke="#FFFFFF" strokeWidth="1.5" />
    <rect x="10" y="28" width="44" height="16" rx="4" fill="#FFA000" />
    <circle cx="19" cy="36" r="3.5" fill="#F44336" />
    <circle cx="19" cy="36" r="1.5" fill="#FFFFFF" />
    <circle cx="45" cy="36" r="3.5" fill="#F44336" />
    <circle cx="45" cy="36" r="1.5" fill="#FFFFFF" />
    <path d="M18 44 C16 44 15 45 15 47 L15 52 C15 54 16 55 18 55 L25 55 L25 59 L39 59 L39 55 L46 55 C48 55 49 54 49 52 L49 47 C49 45 48 44 46 44 Z" fill="#424242"/>
    <rect x="20" y="47" width="5" height="9" fill="#545454" rx="1"/>
    <rect x="39" y="47" width="5" height="9" fill="#545454" rx="1"/>
    <circle cx="32" cy="56" r="5.5" fill="#545454"/>
  </svg>
);
