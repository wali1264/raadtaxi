
import React, { CSSProperties } from 'react';

export const TagIcon = ({ style }: { style?: CSSProperties }) => (
  <svg style={{ width: '1.25rem', height: '1.25rem', ...style }} viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A1 1 0 012 10V5a1 1 0 011-1h5a1 1 0 01.707.293l7 7zM6 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
  </svg>
);
