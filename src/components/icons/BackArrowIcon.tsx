
import React, { CSSProperties } from 'react';

export const BackArrowIcon = ({ style }: { style?: CSSProperties }) => (
  <svg style={{ width: '1.5rem', height: '1.5rem', ...style }} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
  </svg>
);
