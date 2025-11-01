// Pitch detection using aubio.js (like tuner repo)

import { initAudio, getAnalyser, getAudioContext } from './mic.js';

let aubioLib: any = null;
let pitchDetector: any = null;
let buffer: Float32Array | null = null;
let isRunning = false;
let animationFrameId: number | null = null;

declare global {
  function aubio(): Promise<any>;
}

export async function initPitchDetector(bufferSize: number = 4096): Promise<void> {
  console.log('DEBUG: initPitchDetector called | bufferSize:', bufferSize);
  
  if (pitchDetector) {
    console.log('DEBUG: Pitch detector already initialized');
    return;
  }

  // Load aubio.js dynamically
  if (!aubioLib) {
    console.log('DEBUG: Loading aubio.js...');
    if (typeof window !== 'undefined' && (window as any).aubio) {
      console.log('DEBUG: aubio found in window, using it');
      aubioLib = await (window as any).aubio();
    } else {
      console.log('DEBUG: aubio not found, loading from CDN');
      // Fallback: try to load from CDN
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/aubiojs@0.1.1/build/aubio.min.js';
      document.head.appendChild(script);
      await new Promise((resolve, reject) => {
        script.onload = () => {
          console.log('DEBUG: aubio script loaded, initializing...');
          (window as any).aubio().then((aubio: any) => {
            aubioLib = aubio;
            console.log('DEBUG: aubio initialized successfully');
            resolve(null);
          }).catch((err: any) => {
            console.log('DEBUG: aubio initialization ERROR:', err);
            reject(err);
          });
        };
        script.onerror = () => {
          console.log('DEBUG: Failed to load aubio script');
          reject(new Error('Failed to load aubio.js'));
        };
      });
    }
  }

  const audioContext = await initAudio();
  console.log('DEBUG: Creating Pitch detector | SampleRate:', audioContext.sampleRate);
  
  pitchDetector = new aubioLib.Pitch(
    'default',
    bufferSize,
    1,
    audioContext.sampleRate
  );

  buffer = new Float32Array(bufferSize);
  console.log('DEBUG: Pitch detector initialized | Buffer size:', buffer.length);
}

export interface PitchDetection {
  frequency: number;
  note: string;
  cents: number;
  octave: number;
  value: number;
}

let lastDetection: PitchDetection | null = null;
let stableCount = 0;
const STABLE_THRESHOLD = 2; // Require 2 stable detections

export function startPitchDetection(
  callback: (detection: PitchDetection | null) => void,
  bufferSize: number = 4096
): void {
  console.log('DEBUG: startPitchDetection called | isRunning:', isRunning);
  
  if (isRunning) {
    console.log('DEBUG: Pitch detection already running');
    return;
  }

  const analyser = getAnalyser();
  if (!analyser || !pitchDetector || !buffer) {
    const debugInfo = `analyser: ${!!analyser} | pitchDetector: ${!!pitchDetector} | buffer: ${!!buffer}`;
    console.log('DEBUG: Pitch detector not initialized | ' + debugInfo);
    return;
  }

  console.log('DEBUG: Starting pitch detection loop');
  isRunning = true;
  lastDetection = null;
  stableCount = 0;
  let frameCount = 0;

  function tick() {
    if (!isRunning || !analyser || !pitchDetector || !buffer) {
      console.log('DEBUG: Tick stopped | isRunning:', isRunning, '| analyser:', !!analyser, '| pitchDetector:', !!pitchDetector, '| buffer:', !!buffer);
      return;
    }

    analyser.getFloatTimeDomainData(buffer);
    
    // Calculate buffer stats
    let bufferSum = 0;
    let bufferMax = 0;
    let bufferMin = 0;
    for (let i = 0; i < buffer.length; i++) {
      bufferSum += Math.abs(buffer[i]);
      bufferMax = Math.max(bufferMax, buffer[i]);
      bufferMin = Math.min(bufferMin, buffer[i]);
    }
    const bufferAvg = bufferSum / buffer.length;
    
    const frequency = pitchDetector.do(buffer);
    frameCount++;

    // Log every 60 frames (roughly once per second at 60fps)
    if (frameCount % 60 === 0) {
      const logMsg = `Frame ${frameCount} | Buffer avg: ${bufferAvg.toFixed(4)} | Buffer range: [${bufferMin.toFixed(4)}, ${bufferMax.toFixed(4)}] | Frequency: ${frequency ? frequency.toFixed(2) : 'null'} Hz | Stable count: ${stableCount}`;
      console.log('DEBUG: ' + logMsg);
    }

    if (frequency && frequency > 0) {
      // Use the same note calculation as tuner repo
      const audioContext = getAudioContext();
      const a4 = 440; // Can be made configurable
      const note = Math.round(12 * (Math.log(frequency / a4) / Math.log(2)) + 69);
      const standardFreq = a4 * Math.pow(2, (note - 69) / 12);
      const cents = Math.floor((1200 * Math.log(frequency / standardFreq)) / Math.log(2));
      
      const noteNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
      const detection: PitchDetection = {
        frequency,
        note: noteNames[note % 12],
        cents,
        octave: Math.floor(note / 12) - 1,
        value: note
      };

      // Stability check: require consistent detection
      if (lastDetection && Math.abs(detection.frequency - lastDetection.frequency) < 5) {
        stableCount++;
        if (stableCount >= STABLE_THRESHOLD) {
          const logMsg = `DETECTION | Note: ${detection.note}${detection.octave} | Freq: ${detection.frequency.toFixed(2)} Hz | Cents: ${detection.cents} | Stable: ${stableCount}`;
          console.log('DEBUG: ' + logMsg);
          callback(detection);
        }
      } else {
        stableCount = 0;
      }

      lastDetection = detection;
    } else {
      stableCount = 0;
      callback(null);
    }

    animationFrameId = requestAnimationFrame(tick);
  }

  tick();
}

export function stopPitchDetection(): void {
  console.log('DEBUG: stopPitchDetection called');
  isRunning = false;
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  lastDetection = null;
  stableCount = 0;
}
