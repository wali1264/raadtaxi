
import React, { CSSProperties } from 'react';

export const LicensePlateAFGIcon = ({ plateParts, style }: { plateParts: { region: string, numbers: string, type: string }, style?: CSSProperties }) => {
    const isRTL = true;
    const containerStyle: CSSProperties = {
        display: 'inline-flex',
        direction: isRTL ? 'rtl' : 'ltr',
        border: '2px solid #333',
        borderRadius: '0.25rem',
        backgroundColor: 'white',
        color: 'black',
        fontFamily: 'Arial, "B Nazanin", "B Koodak", sans-serif',
        fontWeight: 'bold',
        overflow: 'hidden',
        height: '2.2rem',
        ...style
    };
    const partStyle: CSSProperties = {
        padding: '0.25rem 0.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.1rem',
        minWidth: '2rem',
    };
    const regionStyle: CSSProperties = {
        ...partStyle,
        backgroundColor: '#007bff',
        color: 'white',
        fontSize: '0.8rem',
        borderLeft: isRTL ? 'none' : '2px solid #333',
        borderRight: isRTL ? '2px solid #333' : 'none',
        padding: '0.25rem 0.4rem',
    };
    const numberStyle: CSSProperties = { ...partStyle, letterSpacing: '0.1em' };
    const typeStyle: CSSProperties = {
        ...partStyle,
        backgroundColor: 'black',
        color: 'white',
        writingMode: 'vertical-rl',
        textOrientation: 'mixed',
        fontSize: '0.8rem',
        padding: '0.25rem 0.3rem',
        borderLeft: isRTL ? '2px solid #333' : 'none',
        borderRight: isRTL ? 'none' : '2px solid #333',
    };

    return (
        <div style={containerStyle}>
            <div style={typeStyle}>{plateParts.type}</div>
            <div style={numberStyle}>{plateParts.numbers}</div>
            <div style={regionStyle}>{plateParts.region}</div>
        </div>
    );
};
