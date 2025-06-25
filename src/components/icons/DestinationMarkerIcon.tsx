
import React, { CSSProperties } from 'react';

export const DestinationMarkerIcon = ({ style, ariaLabel, color = "#28a745" }: { style?: CSSProperties, ariaLabel?: string, color?: string }) => (
    <svg style={{ width: '2.5rem', height: '2.5rem', ...style }} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={ariaLabel}>
        <rect x="6" y="6" width="20" height="20" rx="3" fill={color}/>
        <circle cx="16" cy="16" r="4" fill="white"/>
    </svg>
);
