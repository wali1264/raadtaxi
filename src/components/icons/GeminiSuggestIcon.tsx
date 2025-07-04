
import React, { CSSProperties } from 'react';

export const GeminiSuggestIcon = ({ style }: { style?: CSSProperties }) => (
    <svg style={{ width: '1.5rem', height: '1.5rem', ...style }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9.5 2.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"/>
        <path d="M6.02 5.02l.98.98"/>
        <path d="M2 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z"/>
        <path d="M5.02 12.98l.98.98"/>
        <path d="M9.5 16.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"/>
        <path d="M12.98 12.98l.98.98"/>
        <path d="M16.5 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z"/>
        <path d="M18.98 5.02l.98.98"/>
        <path d="M22 17.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"/>
        <path d="M17 14l-1.5 1.5-3-3L14 11l-1.5-1.5-3 3-1.5 1.5"/>
    </svg>
);
