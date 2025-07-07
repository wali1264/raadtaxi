
import React, { CSSProperties } from 'react';

export const UserPlaceMarkerIcon = ({ style }: { style?: CSSProperties }) => (
  <svg 
    style={{ width: '2rem', height: '2rem', ...style }}
    viewBox="0 0 30 38" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <defs>
      <filter id="shadow-user-place" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="1.5" floodColor="#000000" floodOpacity="0.3"/>
      </filter>
    </defs>
    <g style={{ filter: 'url(#shadow-user-place)' }}>
      <path 
        d="M15 35.5C15 35.5 29 24.167 29 14.75C29 6.60406 22.7025 1 15 1C7.29751 1 1 6.60406 1 14.75C1 24.167 15 35.5 15 35.5Z" 
        fill="#4A90E2" 
        stroke="#FFFFFF" 
        strokeWidth="2"
      />
      <path 
        d="M15 19C17.2091 19 19 17.2091 19 15C19 12.7909 17.2091 11 15 11C12.7909 11 11 12.7909 11 15C11 17.2091 12.7909 19 15 19Z" 
        fill="white"
      />
    </g>
  </svg>
);
