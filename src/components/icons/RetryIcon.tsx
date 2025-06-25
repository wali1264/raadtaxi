
import React, { CSSProperties } from 'react';

export const RetryIcon = ({ style }: { style?: CSSProperties }) => (
    <svg style={{ width: '1.25rem', height: '1.25rem', ...style }} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
    </svg>
);
