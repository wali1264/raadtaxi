
import React, { CSSProperties } from 'react';

export const CreditCardIcon = ({ style }: { style?: CSSProperties }) => (
    <svg style={{ width: '1.25rem', height: '1.25rem', ...style }} viewBox="0 0 20 20" fill="currentColor">
        <path d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V8a2 2 0 00-2-2H4zm0 2h12v1H4V6zm0 3h12v5H4V9z" />
    </svg>
);
