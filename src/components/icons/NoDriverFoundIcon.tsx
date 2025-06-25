
import React, { CSSProperties } from 'react';

export const NoDriverFoundIcon = ({ style }: { style?: CSSProperties }) => (
    <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" style={{ width: '6rem', height: '6rem', margin: '1rem auto', display: 'block', ...style }}>
        <circle cx="32" cy="32" r="28" fill="#E0E0E0" />
        <path d="M20 20 L44 44 M44 20 L20 44" stroke="#757575" strokeWidth="4" strokeLinecap="round" />
        <circle cx="24" cy="28" r="2.5" fill="#757575" />
        <circle cx="40" cy="28" r="2.5" fill="#757575" />
        <path d="M26 40 Q32 35 38 40" fill="none" stroke="#757575" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
);
