
import React, { CSSProperties } from 'react';

export const SearchingCarAnimationIcon = ({ style }: { style?: CSSProperties }) => (
  <svg viewBox="0 0 100 50" xmlns="http://www.w3.org/2000/svg" style={{ width: '8rem', height: '4rem', margin: '1rem auto', display: 'block', ...style }}>
    <style>
      {`
        .car-body { fill: #4CAF50; }
        .car-window { fill: #B2DFDB; }
        .car-wheel { fill: #333; }
        .road-line { stroke: #BDBDBD; stroke-width: 2; stroke-dasharray: 10, 8; animation: moveRoad 0.5s linear infinite; }
        @keyframes moveRoad { from { stroke-dashoffset: 0; } to { stroke-dashoffset: 18; } }
        .sun { fill: #FFC107; }
        .cloud { fill: #E0E0E0; animation: moveClouds 10s linear infinite; }
        @keyframes moveClouds {
          0% { transform: translateX(-20px); }
          50% { transform: translateX(5px); }
          100% { transform: translateX(-20px); }
        }
      `}
    </style>
    <circle cx="85" cy="15" r="10" className="sun" />
    <path d="M70 20 Q65 15 60 20 Q55 15 50 20 T40 20" className="cloud" style={{transform: 'translateX(-5px)'}} />
    <path d="M55 25 Q50 20 45 25 Q40 20 35 25 T25 25" className="cloud" />

    <path d="M5 30 L15 30 L20 20 L50 20 L55 30 L60 30 Q62 30 62 32 L62 40 Q62 42 60 42 L10 42 Q8 42 8 40 L8 32 Q8 30 10 30 Z" className="car-body" />
    <path d="M22 22 L48 22 L52 29 L25 29 Z" className="car-window" />
    <circle cx="18" cy="40" r="5" className="car-wheel" />
    <circle cx="52" cy="40" r="5" className="car-wheel" />
    <line x1="0" y1="48" x2="100" y2="48" className="road-line" />
  </svg>
);
