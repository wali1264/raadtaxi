
import React, { CSSProperties } from 'react';

export const LocationMarkerIcon = ({ style, ariaLabel, color = "#007bff" }: { style?: CSSProperties, ariaLabel?: string, color?: string }) => (
  <svg style={{ width: '2.5rem', height: '2.5rem', ...style }} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label={ariaLabel}>
    <path fillRule="evenodd" clipRule="evenodd" d="M16 3C10.48 3 6 7.48 6 13C6 22 16 31 16 31C16 31 26 22 26 13C26 7.48 21.52 3 16 3ZM16 17.5C13.51 17.5 11.5 15.49 11.5 13C11.5 10.51 13.51 8.5 16 8.5C18.49 8.5 20.5 10.51 20.5 13C20.5 15.49 18.49 17.5 16 17.5Z" fill={color}/>
    <circle cx="16" cy="13" r="4.5" fill="#FFFFFF"/>
  </svg>
);
