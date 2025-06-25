
import React, { CSSProperties } from 'react';

export const TaxiIcon = ({ style }: { style?: CSSProperties }) => (
  <svg
    viewBox="0 0 120 60"
    xmlns="http://www.w3.org/2000/svg"
    style={{ width: '100%', height: '100%', objectFit: 'contain', ...style }}
    aria-label="Taxi Icon"
  >
    <path d="M5 25 Q2 25 2 28 L2 40 Q2 43 5 43 L12 43 L15 50 Q16 52 18 52 L32 52 Q34 52 35 50 L38 43 L82 43 L85 50 Q86 52 88 52 L102 52 Q104 52 105 50 L108 43 L115 43 Q118 43 118 40 L118 28 Q118 25 115 25 L90 25 L85 15 Q83 12 80 12 L40 12 Q37 12 35 15 L30 25 Z" fill="#FFC107"/>
    <path d="M38 15 L78 15 Q80 15 81 17 L84 24 L36 24 L39 17 Q40 15 38 15 Z" fill="#333"/>
    <path d="M41 24 L57 24 L57 16 L42 16 L41 18 Z" fill="#444" />
    <path d="M60 24 L79 24 L78 16 L61 16 L60 18 Z" fill="#444" />
    <circle cx="25" cy="46" r="8" fill="#333"/> <circle cx="25" cy="46" r="5" fill="#9E9E9E"/> <circle cx="25" cy="46" r="2" fill="#616161"/>
    <circle cx="95" cy="46" r="8" fill="#333"/> <circle cx="95" cy="46" r="5" fill="#9E9E9E"/> <circle cx="95" cy="46" r="2" fill="#616161"/>
    <rect x="45" y="6" width="30" height="7" rx="1" fill="#FFC107"/> <rect x="46" y="7" width="28" height="5" fill="#212121"/>
    <text x="60" y="11.5" fontFamily="Arial, sans-serif" fontSize="4.5" fill="white" textAnchor="middle" fontWeight="bold">TAXI</text>
    <rect x="47.5" y="7.5" width="1.5" height="1.5" fill="white"/> <rect x="49" y="7.5" width="1.5" height="1.5" fill="#212121"/>
    <rect x="47.5" y="9" width="1.5" height="1.5" fill="#212121"/> <rect x="49" y="9" width="1.5" height="1.5" fill="white"/>
    <text x="59" y="36" fontFamily="Arial, sans-serif" fontSize="5.5" fill="black" textAnchor="middle" fontWeight="bold">TAXI</text>
    {[0,1,2,3].map(i => <rect key={`fcheck1-${i}`} x={10 + i*2.5} y="27" width="2.5" height="2.5" fill={i%2 === 0 ? 'black' : 'white'} />)}
    {[0,1,2,3].map(i => <rect key={`fcheck2-${i}`} x={10 + i*2.5} y="29.5" width="2.5" height="2.5" fill={i%2 === 0 ? 'white' : 'black'} />)}
    {[0,1,2,3].map(i => <rect key={`rcheck1-${i}`} x={78 + i*2.5} y="27" width="2.5" height="2.5" fill={i%2 === 0 ? 'black' : 'white'} />)}
    {[0,1,2,3].map(i => <rect key={`rcheck2-${i}`} x={78 + i*2.5} y="29.5" width="2.5" height="2.5" fill={i%2 === 0 ? 'white' : 'black'} />)}
    <polygon points="5,26 10,26 12,29 10,32 5,32" fill="#E0E0E0"/>
    <polygon points="115,26 110,26 108,29 110,32 115,32" fill="#F44336"/>
    <rect x="39" y="32" width="8" height="1.5" rx="0.5" fill="#616161"/> <rect x="74" y="32" width="8" height="1.5" rx="0.5" fill="#616161"/>
  </svg>
);
