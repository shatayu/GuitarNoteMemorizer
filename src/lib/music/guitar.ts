// Guitar string/fret mapping for standard tuning

import { noteToFrequency, frequencyToNoteInfo } from './note.js';

// Standard guitar tuning (E2, A2, D3, G3, B3, E4)
const OPEN_STRINGS = [
  { note: 40, name: 'E', octave: 2 }, // 6th string (low E)
  { note: 45, name: 'A', octave: 2 }, // 5th string
  { note: 50, name: 'D', octave: 3 }, // 4th string
  { note: 55, name: 'G', octave: 3 }, // 3rd string
  { note: 59, name: 'B', octave: 3 }, // 2nd string
  { note: 64, name: 'E', octave: 4 }, // 1st string (high E)
];

export function getOpenStringNote(string: number): number {
  return OPEN_STRINGS[6 - string].note;
}

export function getOpenStringFrequency(string: number, a4: number = 440): number {
  return noteToFrequency(getOpenStringNote(string), a4);
}

export function getFretFrequency(string: number, fret: number, a4: number = 440): number {
  const openNote = getOpenStringNote(string);
  const frettedNote = openNote + fret;
  return noteToFrequency(frettedNote, a4);
}

export function getFretFromFrequency(frequency: number, string: number, a4: number = 440): number {
  const openFreq = getOpenStringFrequency(string, a4);
  const fret = Math.round(12 * (Math.log(frequency / openFreq) / Math.log(2)));
  return Math.max(0, Math.min(fret, 21)); // Cap at 21 frets (standard guitar max)
}

export interface GuitarPosition {
  string: number;
  fret: number;
  cents: number;
}

/**
 * Find the best guitar position for a given frequency
 */
export function findGuitarPosition(frequency: number, a4: number = 440, maxFret: number = 24): GuitarPosition | null {
  let best: GuitarPosition | null = null;
  let bestCents = Infinity;
  
  // Cap maxFret at 21 (standard guitar max frets)
  const actualMaxFret = Math.min(maxFret, 21);

  // Check strings from lowest (6) to highest (1) to prefer lower strings
  for (let string = 6; string >= 1; string--) {
    const fret = getFretFromFrequency(frequency, string, a4);
    if (fret < 0 || fret > actualMaxFret) continue;

    const expectedFreq = getFretFrequency(string, fret, a4);
    const cents = Math.abs((1200 * Math.log(frequency / expectedFreq)) / Math.log(2));

    // Prefer positions with better cents accuracy
    // When cents are similar (within 5 cents), prefer lower strings (higher string numbers) and lower frets
    const isBetter = cents < bestCents || 
      (Math.abs(cents - bestCents) < 5 && (
        string > (best?.string || 0) || 
        (string === best?.string && fret < (best?.fret || Infinity))
      ));
    
    if (isBetter) {
      bestCents = cents;
      best = { string, fret, cents };
    }
  }

  return best;
}

/**
 * Check if a note matches target on target string within tolerance
 */
export function matchesTarget(
  detectedFrequency: number,
  targetNote: number,
  targetString: number,
  tolerance: number,
  a4: number = 440,
  maxFret: number = 24
): boolean {
  const targetFreq = getFretFrequency(targetString, targetNote === 0 ? 0 : targetNote - getOpenStringNote(targetString), a4);
  const detectedInfo = frequencyToNoteInfo(detectedFrequency, a4);
  const targetInfo = frequencyToNoteInfo(targetFreq, a4);
  
  // Check if note names match
  if (detectedInfo.name !== targetInfo.name) return false;
  
  // Check cents within tolerance
  const cents = Math.abs(detectedInfo.cents);
  if (cents > tolerance) return false;
  
  // Check if on correct string
  const position = findGuitarPosition(detectedFrequency, a4, maxFret);
  if (!position || position.string !== targetString) return false;
  
  // Check fret range if target is not open string
  if (targetNote !== 0) {
    const expectedFret = targetNote - getOpenStringNote(targetString);
    if (Math.abs(position.fret - expectedFret) > 1) return false; // Allow 1 fret tolerance
  }
  
  return true;
}

export { OPEN_STRINGS };
