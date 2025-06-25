
import React, { CSSProperties } from 'react';

export const CancelRideIcon = ({ style }: { style?: CSSProperties }) => (
    <svg style={{ width: '1.25rem', height: '1.25rem', ...style }} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
    </svg>
);
