
import React, { CSSProperties } from 'react';

export const ClockIcon = ({ style }: { style?: CSSProperties }) => (
    <svg style={{ width: '1rem', height: '1rem', ...style }} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.414-1.415L11 9.586V6z" clipRule="evenodd" />
    </svg>
);
