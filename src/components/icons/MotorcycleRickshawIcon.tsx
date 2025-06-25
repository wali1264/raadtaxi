
import React, { CSSProperties } from 'react';

export const MotorcycleRickshawIcon = ({ style }: { style?: CSSProperties }) => {
  const primaryColor = "#009688"; const darkTeal = "#00796B"; const lightTeal = "#4DB6AC";
  const metalColor = "#9E9E9E"; const darkMetal = "#616161"; const tireColor = "#333333";
  const seatColor = "#424242"; const canopyFrameColor = "#212121";
  const headlightColor = "#FFEB3B"; const headlightAccent = "#FFFDE7";
  return (
    <svg viewBox="0 0 130 85" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%', objectFit: 'contain', ...style }} aria-label="Cargo Rickshaw Icon">
      <circle cx="78" cy="70" r="10" fill={tireColor} /> <circle cx="78" cy="70" r="4" fill={darkMetal} />
      <circle cx="107" cy="70" r="10" fill={tireColor} /> <circle cx="107" cy="70" r="4" fill={darkMetal} />
      <rect x="65" y="40" width="60" height="25" fill={primaryColor} rx="2"/>
      <rect x="65" y="40" width="60" height="3" fill={darkTeal} /> <rect x="65" y="62" width="60" height="3" fill={darkTeal} />
      <rect x="65" y="40" width="3" height="25" fill={darkTeal} /> <rect x="122" y="40" width="3" height="25" fill={darkTeal} />
      <line x1="65" y1="52" x2="125" y2="52" stroke={darkTeal} strokeWidth="1.5" />
      <path d="M50 45 L65 45 L65 65 L45 65 Q40 65 40 60 L40 50 Q40 45 45 45 Z" fill={primaryColor} />
      <rect x="44" y="49" width="18" height="9" fill={seatColor} rx="1" />
      <rect x="35" y="12" width="50" height="18" fill={lightTeal} rx="3" stroke={canopyFrameColor} strokeWidth="1.5"/>
      <line x1="45" y1="30" x2="48" y2="46" stroke={canopyFrameColor} strokeWidth="2.5" />
      <line x1="78" y1="30" x2="63" y2="46" stroke={canopyFrameColor} strokeWidth="2.5" />
      <path d="M22 50 L50 50 L50 70 L22 70 Q17 70 17 65 L17 55 Q17 50 22 50 Z" fill={darkMetal} />
      <rect x="25" y="53" width="20" height="12" fill={metalColor} rx="2" />
      <circle cx="20" cy="70" r="10" fill={tireColor} /> <circle cx="20" cy="70" r="4" fill={darkMetal} />
      <path d="M8 70 Q20 55 32 70" fill="none" stroke={metalColor} strokeWidth="4.5" strokeLinecap="round"/>
      <line x1="40" y1="46" x2="35" y2="38" stroke={canopyFrameColor} strokeWidth="2.5" />
      <rect x="31" y="36" width="9" height="3.5" fill={canopyFrameColor} rx="1"/>
      <circle cx="15" cy="53" r="6" fill={headlightColor} stroke={darkMetal} strokeWidth="1"/>
      <circle cx="15" cy="53" r="3" fill={headlightAccent}/>
    </svg>
  );
};
