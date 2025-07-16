import React, { useState, CSSProperties } from 'react';
import { GoogleGenAI } from "@google/genai";
import { translations, Language } from '../translations';
import { DestinationSuggestion } from '../types';
import { CloseIcon } from './icons';

interface GeminiSuggestionModalProps {
    currentLang: Language;
    userLocation: { lat: number; lng: number } | null;
    onClose: () => void;
    onDestinationSelect: (suggestion: DestinationSuggestion) => void;
    onSuggestionsLoaded: (suggestions: DestinationSuggestion[]) => void;
}

const suggestionCategories = [
    { key: 'geminiCategoryRestaurant', emoji: '🍜' },
    { key: 'geminiCategoryCafe', emoji: '☕' },
    { key: 'geminiCategoryPark', emoji: '🌳' },
    { key: 'geminiCategoryShopping', emoji: '🛍️' },
    { key: 'geminiCategoryHistoric', emoji: '🏛️' },
];

export const GeminiSuggestionModal: React.FC<GeminiSuggestionModalProps> = ({ currentLang, userLocation, onClose, onDestinationSelect, onSuggestionsLoaded }) => {
    const t = translations[currentLang];
    const isRTL = currentLang !== 'en';

    const [userInput, setUserInput] = useState('');
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [suggestions, setSuggestions] = useState<DestinationSuggestion[]>([]);

    const handleCategoryToggle = (categoryKey: string) => {
        setSelectedCategories(prev =>
            prev.includes(categoryKey)
                ? prev.filter(c => c !== categoryKey)
                : [...prev, categoryKey]
        );
    };

    const handleGetSuggestions = async () => {
        if (!userLocation) {
            setError("Current location is not available.");
            return;
        }
        if (!userInput.trim() && selectedCategories.length === 0) {
            setError("Please describe what you're looking for or select a category.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setSuggestions([]);
        onSuggestionsLoaded([]);

        const selectedCategoryNames = selectedCategories.map(key => t[key as keyof typeof t]).join(', ');
        const promptText = `User is looking for: ${userInput}. Selected categories: ${selectedCategoryNames || 'None'}.`;

        const fullPrompt = `
            You are a helpful local guide for a user in Herat, Afghanistan. Their current location is latitude: ${userLocation.lat}, longitude: ${userLocation.lng}.
            ${promptText}
            Based on this, suggest 3-5 relevant places nearby. For each place, provide its name, a short compelling description, its category (e.g., Cafe, Restaurant, Park), and its precise latitude and longitude.
            Return your response ONLY as a valid JSON array of objects in the following format. Do not include any other text or markdown.
            [
              {
                "name": "Place Name",
                "category": "Category",
                "description": "A short, inviting description of the place.",
                "latitude": 34.12345,
                "longitude": 62.12345
              }
            ]
        `;

        try {
            const ai = new GoogleGenAI({apiKey: process.env.API_KEY as string});
            const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: fullPrompt,
              config: {
                responseMimeType: "application/json",
              }
            });

            let jsonStr = response.text.trim();
            const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
            const match = jsonStr.match(fenceRegex);
            if (match && match[2]) {
                jsonStr = match[2].trim();
            }

            const parsedData = JSON.parse(jsonStr);
            if (Array.isArray(parsedData)) {
                setSuggestions(parsedData);
                onSuggestionsLoaded(parsedData);
            } else {
                throw new Error("Invalid response format from AI.");
            }
        } catch (e) {
            console.error("Error getting suggestions from Gemini:", e);
            setError(t.geminiApiError);
        } finally {
            setIsLoading(false);
        }
    };

    const overlayStyle: CSSProperties = { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, direction: isRTL ? 'rtl' : 'ltr' };
    const modalStyle: CSSProperties = { backgroundColor: 'white', padding: '1.5rem', borderRadius: '0.75rem', boxShadow: '0 5px 15px rgba(0,0,0,0.3)', width: '90%', maxWidth: '500px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' };
    const headerStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #e0e0e0', paddingBottom: '1rem' };
    const titleStyle: CSSProperties = { fontSize: '1.25rem', fontWeight: 'bold', color: '#1F2937', margin: 0 };
    const closeButtonStyle: CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' };
    const contentAreaStyle: CSSProperties = { overflowY: 'auto', flexGrow: 1, minHeight: '300px' };
    const inputSectionStyle: CSSProperties = { marginBottom: '1rem' };
    const labelStyle: CSSProperties = { display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9rem', color: '#2D3748' };
    const textareaStyle: CSSProperties = { width: '100%', padding: '0.75rem', border: '1px solid #CBD5E0', borderRadius: '0.375rem', fontSize: '1rem', boxSizing: 'border-box', resize: 'vertical', minHeight: '80px', fontFamily: 'inherit' };
    const categoryContainerStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' };
    const categoryChipStyle = (isSelected: boolean): CSSProperties => ({ padding: '0.5rem 1rem', border: `1px solid ${isSelected ? '#3182CE' : '#CBD5E0'}`, borderRadius: '2rem', cursor: 'pointer', backgroundColor: isSelected ? '#EBF8FF' : 'white', transition: 'all 0.2s' });
    const actionButtonStyle: CSSProperties = { width: '100%', padding: '0.875rem', backgroundColor: '#3182CE', color: 'white', border: 'none', borderRadius: '0.5rem', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', opacity: isLoading ? 0.7 : 1 };
    const loadingStyle: CSSProperties = { textAlign: 'center', padding: '2rem', color: '#4A5568' };
    const errorStyle: CSSProperties = { textAlign: 'center', padding: '1rem', color: '#C53030', backgroundColor: '#FED7D7', borderRadius: '0.375rem', margin: '1rem 0'};

    const suggestionCardStyle: CSSProperties = { backgroundColor: '#F7FAFC', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem', border: '1px solid #E2E8F0' };
    const suggestionHeaderStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' };
    const suggestionNameStyle: CSSProperties = { fontWeight: 'bold', fontSize: '1.1rem', color: '#2D3748' };
    const suggestionCategoryStyle: CSSProperties = { fontSize: '0.8rem', color: '#4A5568', backgroundColor: '#E2E8F0', padding: '0.25rem 0.5rem', borderRadius: '1rem' };
    const suggestionDescStyle: CSSProperties = { fontSize: '0.9rem', color: '#4A5568', marginBottom: '1rem', lineHeight: 1.5 };
    const selectButtonStyle: CSSProperties = { width: '100%', padding: '0.6rem', backgroundColor: '#2B6CB0', color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer' };

    return (
        <div style={overlayStyle} onClick={onClose}>
            <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                <div style={headerStyle}>
                    <h2 style={titleStyle}>{t.geminiModalTitle}</h2>
                    <button style={closeButtonStyle} onClick={onClose}><CloseIcon /></button>
                </div>
                <div style={contentAreaStyle}>
                    {isLoading ? (
                        <div style={loadingStyle}>{t.geminiFindingPlaces}</div>
                    ) : suggestions.length > 0 ? (
                        <div>
                            {suggestions.map((s, index) => (
                                <div key={index} style={suggestionCardStyle}>
                                    <div style={suggestionHeaderStyle}>
                                        <h3 style={suggestionNameStyle}>{s.name}</h3>
                                        <span style={suggestionCategoryStyle}>{s.category}</span>
                                    </div>
                                    <p style={suggestionDescStyle}>{s.description}</p>
                                    <button style={selectButtonStyle} onClick={() => onDestinationSelect(s)}>
                                        {t.geminiSelectAsDestination}
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={inputSectionStyle}>
                            <label htmlFor="userInput" style={labelStyle}>{t.geminiTellUsMore}</label>
                            <textarea id="userInput" style={textareaStyle} value={userInput} onChange={e => setUserInput(e.target.value)} placeholder={t.geminiPromptPlaceholder} rows={3}></textarea>
                            <div style={categoryContainerStyle}>
                                {suggestionCategories.map(cat => (
                                    <div key={cat.key} style={categoryChipStyle(selectedCategories.includes(cat.key))} onClick={() => handleCategoryToggle(cat.key)}>
                                        {cat.emoji} {t[cat.key as keyof typeof t]}
                                    </div>
                                ))}
                            </div>
                            {error && <p style={errorStyle}>{error}</p>}
                        </div>
                    )}
                </div>
                {!isLoading && suggestions.length === 0 && (
                    <button style={actionButtonStyle} onClick={handleGetSuggestions} disabled={isLoading}>
                        {t.geminiGetSuggestions}
                    </button>
                )}
            </div>
        </div>
    );
};
