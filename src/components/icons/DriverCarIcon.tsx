import React, { CSSProperties } from 'react';

export const DriverCarIcon = ({ style }: { style?: CSSProperties }) => (
    <svg 
        style={{ width: '2.5rem', height: '2.5rem', ...style }} 
        viewBox="-5 -5 64 118" // Add padding in viewbox for shadow and mirrors
        xmlns="http://www.w3.org/2000/svg"
    >
        <defs>
            <filter id="taxi_dropshadow" height="130%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="3"/> 
                <feOffset dx="2" dy="3" result="offsetblur"/>
                <feComponentTransfer>
                    <feFuncA type="linear" slope="0.5"/>
                </feComponentTransfer>
                <feMerge> 
                    <feMergeNode/>
                    <feMergeNode in="SourceGraphic"/> 
                </feMerge>
            </filter>
        </defs>
        <g style={{ filter: 'url(#taxi_dropshadow)' }}>
            {/* Main Body */}
            <path d="M50,15 C50,5 40,0 27,0 C14,0 4,5 4,15 L4,90 C4,100 14,105 27,105 C40,105 50,100 50,90 Z" 
                  fill="#FFC107" 
                  stroke="#E6A200" 
                  strokeWidth="1.5" />

            {/* Side pillars/frame */}
            <rect x="8" y="25" width="38" height="55" fill="none" stroke="#455A64" strokeWidth="1.5" />

            {/* Front Windshield */}
            <path d="M9,25 L45,25 L40,12 L14,12 Z" fill="#424242" stroke="#212121" strokeWidth="0.5"/>
            {/* Rear Windshield */}
            <path d="M9,80 L45,80 L40,93 L14,93 Z" fill="#424242" stroke="#212121" strokeWidth="0.5"/>

            {/* Taxi Sign */}
            <rect x="20" y="48" width="14" height="8" fill="#4E342E" rx="1" />

            {/* Side Mirrors */}
            <rect x="0" y="32" width="4" height="6" fill="#FFC107" stroke="#E6A200" strokeWidth="1" rx="1" />
            <rect x="50" y="32" width="4" height="6" fill="#FFC107" stroke="#E6A200" strokeWidth="1" rx="1" />

            {/* Headlights */}
            <rect x="10" y="8" width="8" height="3" fill="#FFF9C4" rx="1" />
            <rect x="36" y="8" width="8" height="3" fill="#FFF9C4" rx="1" />

            {/* Taillights */}
            <rect x="10" y="99" width="8" height="3" fill="#E57373" rx="1" />
            <rect x="36" y="99" width="8" height="3" fill="#E57373" rx="1" />
        </g>
    </svg>
);
