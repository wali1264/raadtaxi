import React, { CSSProperties } from 'react';

export const LocationMarkerIcon = ({ style, ariaLabel, color = "#007bff" }: { style?: CSSProperties, ariaLabel?: string, color?: string }) => (
  <svg 
    style={{ width: '2.5rem', height: '3.5rem', ...style }}
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
      <circle cx="16" cy="16" r="14.5" fill="white" />
      
      {/* Main colored circle */}
      <circle cx="16" cy="16" r="14" fill={color} />

      {/* Inner white circle (hole) */}
      <circle cx="16" cy="16" r="6" fill="white" />
    </g>
  </svg>
);
