const CLICK_SOUND_URI = 'data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhBwAAAP9/AAAA//8E/wI/Aj8E/wD//38AAAAA';
const SILENT_AUDIO_URI = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

let clickAudio: HTMLAudioElement | null = null;
let isAudioUnlocked = false;

// This function should be called once on the first user interaction.
export const unlockAudioContext = () => {
    if (isAudioUnlocked) return;
    
    // Create a silent audio element and play it.
    const audio = new Audio(SILENT_AUDIO_URI);
    audio.volume = 0;
    audio.play().then(() => {
        isAudioUnlocked = true;
        console.log("Audio context unlocked.");
    }).catch(() => {
        // Play failed, will retry on next user interaction.
    });
};

export const playClickSound = (volume: number = 0.4) => {
    if (!isAudioUnlocked) {
        // If the context isn't unlocked yet, try to unlock it now.
        // The click itself is the user interaction.
        unlockAudioContext();
    }

    if (!clickAudio) {
        clickAudio = new Audio(CLICK_SOUND_URI);
    }
    clickAudio.volume = volume;
    // Rewind to the start. This allows the sound to be played again in quick succession.
    clickAudio.currentTime = 0; 
    clickAudio.play().catch(e => console.warn("Could not play click sound:", e.message));
};
