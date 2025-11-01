// Microphone setup and audio context management

import { showMicrophonePopup } from '../../stores.js';

let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let source: MediaStreamAudioSourceNode | null = null;
let stream: MediaStream | null = null;
let stateChangeHandler: (() => void) | null = null;

export async function initAudio(deviceId?: string): Promise<AudioContext> {
  if (audioContext) {
    console.log('DEBUG: AudioContext already exists | State:', audioContext.state);
    
    // Ensure state change listener is set up
    if (!stateChangeHandler) {
      stateChangeHandler = () => {
        if (audioContext) {
          console.log('DEBUG: AudioContext state changed | New state:', audioContext.state);
          // If AudioContext stops (closed or suspended), show popup immediately
          if (audioContext.state === 'closed' || audioContext.state === 'suspended') {
            console.log('DEBUG: AudioContext stopped, showing microphone popup');
            showMicrophonePopup.set(true);
          } else if (audioContext.state === 'running') {
            // If AudioContext resumes, hide popup (user can dismiss manually if needed)
            console.log('DEBUG: AudioContext running, hiding microphone popup');
            showMicrophonePopup.set(false);
          }
        }
      };
      audioContext.addEventListener('statechange', stateChangeHandler);
    }
    
    // Check current state - if stopped, show popup immediately
    // (statechange event only fires on transitions, not current state)
    if (audioContext.state === 'closed' || audioContext.state === 'suspended') {
      console.log('DEBUG: AudioContext currently stopped, showing microphone popup');
      showMicrophonePopup.set(true);
    }
    return audioContext;
  }

  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error('AudioContext not supported');
  }

  console.log('DEBUG: Creating new AudioContext');
  audioContext = new AudioContextClass();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 4096;
  analyser.smoothingTimeConstant = 0.3;

  console.log('DEBUG: AudioContext created | State:', audioContext.state, '| SampleRate:', audioContext.sampleRate);
  
  // Set up state change listener to detect when AudioContext stops
  if (stateChangeHandler) {
    audioContext.removeEventListener('statechange', stateChangeHandler);
  }
  stateChangeHandler = () => {
    if (audioContext) {
      console.log('DEBUG: AudioContext state changed | New state:', audioContext.state);
      // If AudioContext stops (closed or suspended), show popup immediately
      if (audioContext.state === 'closed' || audioContext.state === 'suspended') {
        console.log('DEBUG: AudioContext stopped, showing microphone popup');
        showMicrophonePopup.set(true);
      } else if (audioContext.state === 'running') {
        // If AudioContext resumes, hide popup (user can dismiss manually if needed)
        console.log('DEBUG: AudioContext running, hiding microphone popup');
        showMicrophonePopup.set(false);
      }
    }
  };
  audioContext.addEventListener('statechange', stateChangeHandler);
  
  // Check initial state - if stopped, show popup immediately
  // (statechange event only fires on transitions, not initial state)
  if (audioContext.state === 'closed' || audioContext.state === 'suspended') {
    console.log('DEBUG: AudioContext initially stopped, showing microphone popup');
    showMicrophonePopup.set(true);
  }

  return audioContext;
}

export async function startMicrophone(deviceId?: string): Promise<MediaStream> {
  console.log('DEBUG: startMicrophone called | deviceId:', deviceId || 'default');
  
  if (stream) {
    console.log('DEBUG: Microphone already started, returning existing stream');
    return stream;
  }

  const constraints: MediaStreamConstraints = {
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      ...(deviceId ? { deviceId: { exact: deviceId } } : {})
    }
  };

  console.log('DEBUG: Requesting getUserMedia with constraints:', JSON.stringify(constraints));
  
  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log('DEBUG: getUserMedia success | Stream active:', stream.active, '| Tracks:', stream.getAudioTracks().length);
    
    // Log track details
    stream.getAudioTracks().forEach((track, index) => {
      console.log(`DEBUG: Track ${index} | Enabled: ${track.enabled} | ReadyState: ${track.readyState} | Label: ${track.label}`);
    });
    
    if (!audioContext || !analyser) {
      console.log('DEBUG: AudioContext not initialized, initializing...');
      await initAudio();
    }

    if (source) {
      console.log('DEBUG: Disconnecting existing source');
      source.disconnect();
    }

    // Check AudioContext state - if closed, we need to reinitialize
    if (audioContext!.state === 'closed') {
      console.log('DEBUG: AudioContext closed, reinitializing...');
      audioContext = null;
      analyser = null;
      await initAudio();
    }

    source = audioContext!.createMediaStreamSource(stream);
    source.connect(analyser!);
    
    console.log('DEBUG: Microphone setup complete | AudioContext state:', audioContext!.state, '| SampleRate:', audioContext!.sampleRate, '| Analyser FFT size:', analyser!.fftSize, '| Source connected:', !!source);

    return stream;
  } catch (error) {
    console.log('DEBUG: getUserMedia ERROR:', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

export function stopMicrophone(): void {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  if (source) {
    source.disconnect();
    source = null;
  }
}

export function getAnalyser(): AnalyserNode | null {
  return analyser;
}

export function getAudioContext(): AudioContext | null {
  return audioContext;
}

export async function getAudioDevices(): Promise<MediaDeviceInfo[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter(d => d.kind === 'audioinput');
}

export function isMicrophoneListening(): boolean {
  if (!stream) {
    return false;
  }
  
  // Check if stream is active
  if (!stream.active) {
    return false;
  }
  
  // Check if at least one audio track is enabled and ready
  const audioTracks = stream.getAudioTracks();
  if (audioTracks.length === 0) {
    return false;
  }
  
  // Check if at least one track is enabled and not ended
  return audioTracks.some(track => track.enabled && track.readyState === 'live');
}
