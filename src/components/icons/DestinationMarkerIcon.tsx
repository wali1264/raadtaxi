import React, { CSSProperties } from 'react';

export const DestinationMarkerIcon = ({ style, ariaLabel, color = "#28a745" }: { style?: CSSProperties, ariaLabel?: string, color?: string }) => (
    <svg 
      style={{ width: '100%', height: '100%', ...style }}
      viewBox="0 0 32 42" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      role="img" 
      aria-label={ariaLabel}
    >
        {/* Pin */}
        <line x1="16" y1="30" x2="16" y2="42" stroke="#4A5568" strokeWidth="2.5" />

        {/* Main Icon Body with a drop shadow for depth */}
        <g style={{ filter: 'drop-shadow(0px 2px 3px rgba(0,0,0,0.2))' }}>
            {/* Outer white border for contrast */}
            <rect x="1" y="1" width="30" height="30" rx="6" fill="white"/>

            {/* Main colored square */}
            <rect x="2" y="2" width="28" height="28" rx="5" fill={color}/>

            {/* Inner white square (hole) */}
            <rect x="10" y="10" width="12" height="12" rx="2" fill="white"/>
        </g>
    </svg>
);