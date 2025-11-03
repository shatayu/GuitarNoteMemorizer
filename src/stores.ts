// Svelte stores for app state

import { writable } from 'svelte/store';

export interface Settings {
  enabledStrings: boolean[];
  wholeNotesOnly: boolean;
  frets1to12Only: boolean;
  highestFret: number;
  tolerance: number;
  a4: number;
  deviceId: string | null;
  isListening: boolean;
}

export interface QuizState {
  currentQuestion: number;
  score: number;
  streak: number;
  targetNote: string;
  targetString: number;
  targetFret: number;
  startTime: number;
}

export interface PitchDetection {
  frequency: number;
  note: string;
  cents: number;
  octave: number;
  value: number;
  string?: number;
  fret?: number;
}

export const settings = writable<Settings>({
  enabledStrings: [true, true, true, true, true, true],
  wholeNotesOnly: false,
  frets1to12Only: false,
  highestFret: 21,
  tolerance: 30,
  a4: 440,
  deviceId: null,
  isListening: false
});

export const quizState = writable<QuizState>({
  currentQuestion: 0,
  score: 0,
  streak: 0,
  targetNote: '',
  targetString: 0,
  targetFret: 0,
  startTime: 0
});

export const currentPitch = writable<PitchDetection | null>(null);
export const isCorrect = writable<boolean | null>(null);
export const isMicrophoneActive = writable<boolean>(false);
export const showMicrophonePopup = writable<boolean>(false);

// Load settings from localStorage
if (typeof window !== 'undefined') {
  const saved = localStorage.getItem('guitar-settings');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      const defaultSettings = {
        enabledStrings: [true, true, true, true, true, true],
        wholeNotesOnly: false,
        frets1to12Only: false,
        highestFret: 21,
        tolerance: 30,
        a4: 440,
        deviceId: null,
        isListening: false
      };
      settings.set({ ...defaultSettings, ...parsed });
    } catch (e) {
      // Ignore parse errors
    }
  }

  settings.subscribe((s) => {
    localStorage.setItem('guitar-settings', JSON.stringify(s));
  });
}
