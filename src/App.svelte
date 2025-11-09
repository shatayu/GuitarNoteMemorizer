<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { quizState, settings, currentPitch, isCorrect, isMicrophoneActive, showMicrophonePopup } from './stores.js';
  import { initPitchDetector, startPitchDetection, stopPitchDetection } from './lib/audio/pitch.js';
  import { frequencyToNoteInfo, NOTE_NAMES, getOctave } from './lib/music/note.js';
  import { findGuitarPosition, matchesTarget, getOpenStringNote, getFretFrequency, getFretFromFrequency, OPEN_STRINGS } from './lib/music/guitar.js';
  import { startMicrophone, stopMicrophone, isMicrophoneListening } from './lib/audio/mic.js';
  import { requestWakeLock, releaseWakeLock } from './lib/wakeLock.js';
  import Prompt from './components/Prompt.svelte';
  import NowPlaying from './components/NowPlaying.svelte';
  import Controls from './components/Controls.svelte';
  import MicrophonePopup from './components/MicrophonePopup.svelte';
  
  let initialized = false;
  let stableDetections = 0;
  const STABLE_REQUIRED = 3;
  let isTransitioning = false;
  let transitionStartTime = 0;
  let previousTargetNote: string | null = null;
  
  let microphoneCheckInterval: number | null = null;
  
  // Shuffled note queue state
  interface NoteEntry {
    string: number;
    fret: number;
    displayNote: string;
  }
  let noteQueue: NoteEntry[] = [];
  let currentNoteIndex: number = 0;
  
  // Handle visibility change to reacquire wake lock when tab becomes visible
  function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      // Reacquire wake lock when tab becomes visible
      requestWakeLock();
    }
  }
  
  onMount(async () => {
    console.log('DEBUG: App mounted, initializing pitch detector...');
    
    // Request wake lock to prevent device from sleeping
    await requestWakeLock();
    
    // Listen for visibility changes to reacquire wake lock when tab becomes visible
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    try {
      await initPitchDetector();
      initialized = true;
      console.log('DEBUG: Pitch detector initialized successfully');
      // Initialize device tracking
      lastDeviceId = $settings.deviceId;
      listeningInitialized = true;
      
      // Check if microphone is already listening (e.g., from previous session)
      const isListening = isMicrophoneListening();
      isMicrophoneActive.set(isListening);
      
      // If microphone is not listening, show popup immediately
      // Don't automatically start - browsers require user interaction
      if (!isListening) {
        console.log('DEBUG: Microphone not listening, showing popup');
        showMicrophonePopup.set(true);
      } else {
        // If microphone is already listening, start pitch detection
        console.log('DEBUG: Microphone already listening, starting pitch detection');
        await startListening();
      }
      
      // Note: Microphone status checking is handled by MicrophoneIcon component
      // which polls every 100ms for immediate feedback
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log('DEBUG: Failed to initialize pitch detector | Error: ' + errorMsg);
      console.error('Failed to initialize pitch detector:', error);
      // Show popup instead of alert
      showMicrophonePopup.set(true);
    }
  });
  
  onDestroy(() => {
    // Release wake lock when component is destroyed
    releaseWakeLock();
    // Remove visibility change listener
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  });
  
  /**
   * Check if a string has multiple notes with the same name (different octaves)
   */
  function hasMultipleNotesWithSameName(string: number, noteName: string, maxFret: number): boolean {
    const openNote = getOpenStringNote(string);
    const noteIndex = NOTE_NAMES.indexOf(noteName);
    if (noteIndex === -1) return false;
    
    const octaves = new Set<number>();
    for (let fret = 0; fret <= maxFret; fret++) {
      const midiNote = openNote + fret;
      const currentNoteIndex = midiNote % 12;
      if (currentNoteIndex === noteIndex) {
        octaves.add(getOctave(midiNote));
      }
    }
    
    return octaves.size > 1;
  }
  
  /**
   * Shuffle an array using Fisher-Yates algorithm
   */
  function shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
  
  /**
   * Generate all possible notes based on current settings
   */
  function generateAllPossibleNotes(): NoteEntry[] {
    const currentSettings = $settings;
    const enabledStrings = currentSettings.enabledStrings
      .map((enabled: boolean, i: number) => enabled ? 6 - i : null)
      .filter((s): s is number => s !== null);
    
    if (enabledStrings.length === 0) {
      return [];
    }
    
    const maxFret = currentSettings.frets1to12Only ? 12 : currentSettings.highestFret;
    const allNotes: NoteEntry[] = [];
    
    for (const string of enabledStrings) {
      const openNote = getOpenStringNote(string);
      
      for (let fret = 0; fret <= maxFret; fret++) {
        const targetMidiNote = openNote + fret;
        const noteIndex = targetMidiNote % 12;
        let noteName = NOTE_NAMES[noteIndex];
        const octave = getOctave(targetMidiNote);
        
        // If whole notes only, skip sharps
        if (currentSettings.wholeNotesOnly && noteName.includes('♯')) {
          continue;
        }
        
        // Determine display note (with octave if needed)
        const showOctave = hasMultipleNotesWithSameName(string, noteName, maxFret);
        const displayNote = showOctave ? `${noteName}${octave}` : noteName;
        
        allNotes.push({
          string,
          fret,
          displayNote
        });
      }
    }
    
    return allNotes;
  }
  
  /**
   * Initialize the note queue with all possible notes in random order
   */
  function initializeNoteQueue() {
    const allNotes = generateAllPossibleNotes();
    noteQueue = shuffleArray(allNotes);
    currentNoteIndex = 0;
  }
  
  function generateRandomPrompt() {
    const currentSettings = $settings;
    const enabledStrings = currentSettings.enabledStrings
      .map((enabled: boolean, i: number) => enabled ? 6 - i : null)
      .filter((s): s is number => s !== null);
    
    if (enabledStrings.length === 0) {
      alert('Please enable at least one string');
      return;
    }
    
    // Initialize queue if empty or if we've reached the end
    if (noteQueue.length === 0 || currentNoteIndex >= noteQueue.length) {
      initializeNoteQueue();
    }
    
    // If queue is still empty after initialization, something went wrong
    if (noteQueue.length === 0) {
      console.error('ERROR: No notes available in queue');
      return;
    }
    
    // Get the next note from the queue
    const noteEntry = noteQueue[currentNoteIndex];
    currentNoteIndex++;
    
    // Update quiz state with the note from the queue
    quizState.update(state => ({
      ...state,
      currentQuestion: state.currentQuestion + 1,
      targetNote: noteEntry.displayNote,
      targetString: noteEntry.string,
      targetFret: noteEntry.fret,
      startTime: Date.now()
    }));
    
    isCorrect.set(null);
    stableDetections = 0;
    isTransitioning = false;
  }
  
  function checkCorrectness(pitch: any) {
    const currentQuizState = $quizState;
    const currentSettings = $settings;
    
    if (!currentQuizState.targetNote || !currentQuizState.targetString) return;
    
    // Extract note name from targetNote (e.g., "E2" -> "E")
    // Remove trailing digits to get just the note name
    const targetNoteName = currentQuizState.targetNote.replace(/\d+$/, '');
    
    // Check if note name matches first (noteInfo has 'name' property, not 'note')
    const noteName = pitch.name || pitch.note;
    if (noteName !== targetNoteName) {
      isCorrect.set(false);
      stableDetections = 0;
      return;
    }
    
    // Check position specifically on the target string
    const targetString = currentQuizState.targetString;
    const targetFret = currentQuizState.targetFret;
    
    // Calculate expected frequency for target string/fret
    const expectedFreq = getFretFrequency(targetString, targetFret, currentSettings.a4);
    
    // Calculate fret on target string from detected frequency
    const detectedFret = getFretFromFrequency(pitch.frequency, targetString, currentSettings.a4, currentSettings.highestFret);
    
    // Check if detected fret matches expected fret (with tolerance)
    if (Math.abs(detectedFret - targetFret) <= 1) {
      // Verify the frequency is close enough to the expected frequency (cents deviation)
      const centsDiff = Math.abs((1200 * Math.log(pitch.frequency / expectedFreq)) / Math.log(2));
      
      if (centsDiff <= currentSettings.tolerance) {
        stableDetections++;
        if (stableDetections >= STABLE_REQUIRED) {
          isCorrect.set(true);
          handleCorrect();
        } else {
          // Reset isCorrect to null when building up stable detections
          // This prevents showing "Try again" when playing correctly
          isCorrect.set(null);
        }
      } else {
        isCorrect.set(false);
        stableDetections = 0;
      }
    } else {
      isCorrect.set(false);
      stableDetections = 0;
    }
  }
  
  function handleCorrect() {
    // Store previous target note to ignore bleed-over
    previousTargetNote = $quizState.targetNote;
    
    // Keep success state visible, stop pitch updates, and clear current pitch
    isTransitioning = true;
    transitionStartTime = Date.now();
    currentPitch.set(null);
    // Keep isCorrect as true to show success feedback
    
    // Show success feedback for 250ms, then transition to next note
    setTimeout(() => {
      generateRandomPrompt();
      // Clear success state when transitioning to next note
      isCorrect.set(null);
      // Keep transition flag for a bit longer to ignore bleed-over
      setTimeout(() => {
        isTransitioning = false;
        // Clear previous target note after transition period
        setTimeout(() => {
          previousTargetNote = null;
        }, 1000); // Additional 1 second grace period
      }, 500); // 500ms after prompt generation
    }, 250); // 250ms of success feedback
  }
  
  function handleSkip() {
    // Store previous target note to ignore bleed-over
    previousTargetNote = $quizState.targetNote;
    
    // Immediately stop pitch updates and clear current pitch
    isTransitioning = true;
    transitionStartTime = Date.now();
    currentPitch.set(null);
    isCorrect.set(null);
    generateRandomPrompt();
    
    // Keep transition flag for a bit to ignore bleed-over
    setTimeout(() => {
      isTransitioning = false;
      // Clear previous target note after transition period
      setTimeout(() => {
        previousTargetNote = null;
      }, 1000); // Additional 1 second grace period
    }, 500); // 500ms after prompt generation
  }
  
  async function startListening() {
    console.log('DEBUG: startListening called | initialized:', initialized);
    if (!initialized) {
      console.log('DEBUG: Not initialized, returning');
      return;
    }
    
    try {
      // Ensure microphone is started first
      await startMicrophone($settings.deviceId || undefined);
      console.log('DEBUG: Microphone started, starting pitch detection');
      
      // Update microphone status
      isMicrophoneActive.set(isMicrophoneListening());
      
      // Stop pitch detection if already running to ensure clean restart
      stopPitchDetection();
      
      startPitchDetection((detection) => {
        // Skip updates during transition to prevent flashing
        if (isTransitioning) {
          return;
        }
        
        if (detection) {
          const currentSettings = $settings;
          const noteInfo = frequencyToNoteInfo(detection.frequency, currentSettings.a4);
          
          // Ignore detections that match the previous target note (bleed-over prevention)
          // Extract note name from previousTargetNote (e.g., "E2" -> "E")
          if (previousTargetNote) {
            const previousNoteName = previousTargetNote.replace(/\d+$/, '');
            if (noteInfo.name === previousNoteName) {
              return;
            }
          }
          
          const position = findGuitarPosition(detection.frequency, currentSettings.a4, currentSettings.highestFret);
          
          const logMsg = `Pitch detected | Freq: ${detection.frequency.toFixed(2)} Hz | Note: ${noteInfo.name}${noteInfo.octave} | Cents: ${noteInfo.cents} | Position: ${position ? `String ${position.string}, Fret ${position.fret}` : 'unknown'}`;
          console.log('DEBUG: ' + logMsg);
          
          currentPitch.set({
            note: noteInfo.name,
            value: noteInfo.value,
            octave: noteInfo.octave,
            cents: noteInfo.cents,
            frequency: noteInfo.frequency,
            string: position?.string,
            fret: position?.fret
          });
          
          checkCorrectness(noteInfo);
        } else {
          currentPitch.set(null);
          stableDetections = 0;
        }
      });
    } catch (error: any) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.log('DEBUG: Failed to start microphone in startListening | Error: ' + errorMsg);
      // Show popup instead of alert
      isMicrophoneActive.set(false);
      showMicrophonePopup.set(true);
    }
  }
  
  let listeningInitialized = false;
  let lastDeviceId: string | null = null;
  
  // Watch for device changes and restart listening
  $: if (initialized && $settings.deviceId !== lastDeviceId && lastDeviceId !== null) {
    // Device changed, restart listening
    console.log('DEBUG: Device changed, restarting listening...');
    lastDeviceId = $settings.deviceId;
    restartListening();
  }
  
  async function restartListening() {
    stopPitchDetection();
    stopMicrophone();
    currentPitch.set(null);
    isCorrect.set(null);
    isMicrophoneActive.set(false);
    await startListening();
  }
  
  async function handleMicrophoneEnabled() {
    console.log('DEBUG: Microphone enabled event received, starting listening...');
    // Request wake lock when microphone is enabled (after user interaction)
    await requestWakeLock();
    if (initialized) {
      await startListening();
    }
  }
  
  // Generate first prompt on mount
  let promptGenerated = false;
  $: if ($quizState.currentQuestion === 0 && !promptGenerated) {
    generateRandomPrompt();
    promptGenerated = true;
  }
  
  // Watch for settings changes and restart quiz if needed
  let prevSettings = {
    enabledStrings: JSON.stringify($settings.enabledStrings),
    wholeNotesOnly: $settings.wholeNotesOnly,
    frets1to12Only: $settings.frets1to12Only,
    highestFret: $settings.highestFret,
    tolerance: $settings.tolerance,
    a4: $settings.a4
  };
  
  $: {
    const currentEnabledStrings = JSON.stringify($settings.enabledStrings);
    const currentWholeNotesOnly = $settings.wholeNotesOnly;
    const currentFrets1to12Only = $settings.frets1to12Only;
    const currentHighestFret = $settings.highestFret;
    const currentTolerance = $settings.tolerance;
    const currentA4 = $settings.a4;
    
    // Check if any relevant settings changed
    const settingsChanged = 
      currentEnabledStrings !== prevSettings.enabledStrings ||
      currentWholeNotesOnly !== prevSettings.wholeNotesOnly ||
      currentFrets1to12Only !== prevSettings.frets1to12Only ||
      currentHighestFret !== prevSettings.highestFret ||
      currentTolerance !== prevSettings.tolerance ||
      currentA4 !== prevSettings.a4;
    
    // Restart quiz if settings changed and we have a current question
    if (settingsChanged && $quizState.currentQuestion > 0) {
      // Reset quiz state
      quizState.update(state => ({
        ...state,
        currentQuestion: 0,
        score: 0,
        streak: 0,
        targetNote: '',
        targetString: 0,
        targetFret: 0,
        startTime: 0
      }));
      
      // Clear current pitch and correctness
      currentPitch.set(null);
      isCorrect.set(null);
      stableDetections = 0;
      isTransitioning = false;
      
      // Regenerate note queue with new settings
      initializeNoteQueue();
      
      // Generate new prompt (will increment currentQuestion to 1)
      generateRandomPrompt();
      
      // Update previous settings
      prevSettings = {
        enabledStrings: currentEnabledStrings,
        wholeNotesOnly: currentWholeNotesOnly,
        frets1to12Only: currentFrets1to12Only,
        highestFret: currentHighestFret,
        tolerance: currentTolerance,
        a4: currentA4
      };
    } else if (settingsChanged) {
      // Regenerate note queue even if quiz wasn't active
      initializeNoteQueue();
      
      // Update previous settings even if quiz wasn't active
      prevSettings = {
        enabledStrings: currentEnabledStrings,
        wholeNotesOnly: currentWholeNotesOnly,
        frets1to12Only: currentFrets1to12Only,
        highestFret: currentHighestFret,
        tolerance: currentTolerance,
        a4: currentA4
      };
    }
  }
  
  // Keyboard shortcuts
  function handleKeydown(e: KeyboardEvent) {
    if (e.code === 'Space') {
      e.preventDefault();
      handleSkip();
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="app">
  <header>
    <h1>Guitar Note Memorizer</h1>
    <div class="header-controls">
      <Controls />
    </div>
  </header>
  
  <main>
    <Prompt 
      targetNote={$quizState.targetNote}
      targetString={$quizState.targetString}
      questionNum={$quizState.currentQuestion}
      onSkip={handleSkip}
    />
    
    <NowPlaying />
  </main>
  
    <MicrophonePopup on:microphoneEnabled={handleMicrophoneEnabled} />
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    background: #121212;
    color: #fff;
    min-height: 100vh;
  }
  
  .app {
    max-width: 800px;
    margin: 0 auto;
    padding: 1rem;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  
  header {
    text-align: center;
    margin-bottom: 1rem;
  }
  
  header h1 {
    font-size: 2rem;
    margin: 0 0 1rem 0;
  }
  
  .header-controls {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1rem;
  }
  
  main {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }
</style>
