// Frequency-to-note conversion and cents calculation (based on tuner repo approach)

export const NOTE_NAMES = [
  'C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'
];

export const NOTE_NAMES_FLAT = [
  'C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'
];

const MIDDLE_A_SEMITONE = 69; // A4 = MIDI note 69

/**
 * Convert frequency to MIDI note number
 */
export function frequencyToNote(frequency: number, a4: number = 440): number {
  const note = 12 * (Math.log(frequency / a4) / Math.log(2));
  return Math.round(note) + MIDDLE_A_SEMITONE;
}

/**
 * Get standard frequency for a MIDI note
 */
export function noteToFrequency(note: number, a4: number = 440): number {
  return a4 * Math.pow(2, (note - MIDDLE_A_SEMITONE) / 12);
}

/**
 * Get cents difference between frequency and standard note frequency
 */
export function getCents(frequency: number, note: number, a4: number = 440): number {
  const standardFreq = noteToFrequency(note, a4);
  return Math.floor((1200 * Math.log(frequency / standardFreq)) / Math.log(2));
}

/**
 * Get note name from MIDI note number
 */
export function getNoteName(note: number, useFlats: boolean = false): string {
  const names = useFlats ? NOTE_NAMES_FLAT : NOTE_NAMES;
  return names[note % 12];
}

/**
 * Get octave from MIDI note number
 */
export function getOctave(note: number): number {
  return Math.floor(note / 12) - 1;
}

/**
 * Convert frequency to note info
 */
export function frequencyToNoteInfo(frequency: number, a4: number = 440, useFlats: boolean = false) {
  const note = frequencyToNote(frequency, a4);
  const cents = getCents(frequency, note, a4);
  return {
    name: getNoteName(note, useFlats),
    value: note,
    octave: getOctave(note),
    cents,
    frequency
  };
}
