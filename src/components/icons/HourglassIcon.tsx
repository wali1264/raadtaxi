import React, { CSSProperties } from 'react';

export const HourglassIcon = ({ style }: { style?: CSSProperties }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '3rem', height: '3rem', color: '#4A5568', ...style }}>
        <style>
            {`
            @keyframes sand-top-fall {
                0% {
                    d: path("M 7 8 L 17 8 L 12 12 Z");
                }
                100% {
                    d: path("M 12 12 L 12 12 L 12 12 Z");
                }
            }
            @keyframes sand-bottom-rise {
                0% {
                    d: path("M 12 12 L 12 12 L 12 12 Z");
                }
                100% {
                    d: path("M 7 16 L 17 16 L 12 12 Z");
                }
            }
            .sand-top {
                animation: sand-top-fall 4s linear infinite;
            }
            .sand-bottom {
                animation: sand-bottom-rise 4s linear infinite;
            }
            `}
        </style>
        <path d="M6 2H18" />
        <path d="M6 22H18" />
        <path d="M6 2L12 12L6 22" />
        <path d="M18 2L12 12L18 22" />
        <g fill="currentColor" stroke="none">
             <path className="sand-top" />
             <path className="sand-bottom" />
        </g>
    </svg>
);