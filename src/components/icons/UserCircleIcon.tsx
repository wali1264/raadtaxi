import React, { CSSProperties } from 'react';

export const UserCircleIcon = ({ style }: { style?: CSSProperties }) => (
    <svg 
        style={{ width: '100%', height: '100%', objectFit: 'contain', color: '#A0AEC0', ...style }} 
        viewBox="0 0 24 24" 
        fill="currentColor" 
        stroke="currentColor" 
        strokeWidth="1"
    >
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);
