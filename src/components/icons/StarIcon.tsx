
import React, { CSSProperties } from 'react';
import { useAppContext } from '../../contexts/AppContext';

export const StarIcon = ({ filled, onClick, onMouseEnter, onMouseLeave, style, ariaLabel }: { filled: boolean; onClick?: () => void; onMouseEnter?: () => void; onMouseLeave?: () => void; style?: CSSProperties; ariaLabel?: string }) => {
    const { playClickSound } = useAppContext();
    const handleClick = () => {
        playClickSound();
        if (onClick) {
            onClick();
        }
    };

    return (
        <svg
            style={{ width: '2rem', height: '2rem', color: filled ? '#FFC107' : '#E0E0E0', cursor: onClick ? 'pointer' : 'default', transition: 'color 0.2s', ...style }}
            viewBox="0 0 20 20"
            fill="currentColor"
            onClick={onClick ? handleClick : undefined}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            role="button"
            tabIndex={onClick ? 0 : -1}
            aria-label={ariaLabel}
            aria-pressed={filled}
            onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); } : undefined}
        >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
    );
};
