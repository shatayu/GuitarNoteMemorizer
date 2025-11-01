<script lang="ts">
  import { currentPitch, isCorrect, quizState, settings } from '../stores.js';
  import { findGuitarPosition } from '../lib/music/guitar.js';
  
  let smoothedPitch: { note: string; octave: number; string?: number; fret?: number } | null = null;
  let lastStablePitch: { note: string; octave: number; string?: number; fret?: number } | null = null;
  let stabilityCounter = 0;
  const STABILITY_THRESHOLD = 2; // Require 2 frames of stability before updating
  
  // Clear smoothed pitch when transitioning or when isCorrect changes
  $: if ($isCorrect === true) {
    // Success state - clear pitch to show clean success message
    smoothedPitch = null;
    lastStablePitch = null;
    stabilityCounter = 0;
  }
  
  // Smooth transitions to prevent flashing
  $: if ($currentPitch) {
    const position = findGuitarPosition($currentPitch.frequency, $settings.a4);
    if (position && (!$currentPitch.string || $currentPitch.string !== position.string)) {
      currentPitch.update(p => p ? { ...p, string: position.string, fret: position.fret } : null);
    }
    
    // Smooth the pitch display - only update if it's been stable for a few frames
    const current = {
      note: $currentPitch.note,
      octave: $currentPitch.octave,
      string: $currentPitch.string,
      fret: $currentPitch.fret
    };
    
    // Check if current pitch matches last stable pitch
    if (!lastStablePitch || 
        (lastStablePitch.note === current.note && 
         lastStablePitch.string === current.string &&
         lastStablePitch.fret === current.fret)) {
      stabilityCounter++;
      // Update smoothed pitch after stability threshold
      if (stabilityCounter >= STABILITY_THRESHOLD) {
        smoothedPitch = current;
        lastStablePitch = current;
      }
    } else {
      // Reset counter when pitch changes
      stabilityCounter = 0;
      lastStablePitch = current;
    }
  } else {
    // Reset when no pitch detected
    smoothedPitch = null;
    lastStablePitch = null;
    stabilityCounter = 0;
  }
  
</script>

<div class="now-playing">
  <div class="detection">
    {#if $isCorrect === true}
      <!-- Success state -->
      <div class="success-state">
        <div class="success-icon">✓</div>
        <div class="success-message">Correct!</div>
      </div>
    {:else if $isCorrect === false && smoothedPitch}
      <!-- Error state - show what was played -->
      <div class="error-state">
        <div class="error-icon">✗</div>
        <div class="error-message">
          You played <span class="played-note">{smoothedPitch.note}{smoothedPitch.octave}</span>
          {#if smoothedPitch.string && smoothedPitch.fret !== undefined}
            on string {smoothedPitch.string}, fret {smoothedPitch.fret}
          {/if}
        </div>
      </div>
    {:else if smoothedPitch}
      <!-- Listening state - show current pitch -->
      <div class="listening-state">
        <div class="current-note">
          <span class="note-name">{smoothedPitch.note}</span>
          <span class="octave">{smoothedPitch.octave}</span>
        </div>
        {#if smoothedPitch.string && smoothedPitch.fret !== undefined}
          <div class="position">
            String {smoothedPitch.string}, Fret {smoothedPitch.fret}
          </div>
        {/if}
        <div class="frequency">
          {#if $currentPitch}
            {$currentPitch.frequency.toFixed(1)} Hz
          {/if}
        </div>
      </div>
    {:else}
      <!-- No pitch detected -->
      <div class="listening-state">
        <div class="no-pitch">Listening...</div>
      </div>
    {/if}
  </div>
  
  <div class="status {$isCorrect === true ? 'correct' : $isCorrect === false ? 'incorrect' : ''}">
    {#if $isCorrect === true}
      <span class="status-placeholder">&nbsp;</span>
    {:else if $isCorrect === false}
      <span class="status-placeholder">&nbsp;</span>
    {:else}
      <span class="status-placeholder">&nbsp;</span>
    {/if}
  </div>
</div>

<style>
  .now-playing {
    text-align: center;
    padding: 2rem;
  }
  
  .detection {
    margin: 1rem 0;
    height: 200px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }
  
  /* Success state */
  .success-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    animation: successPulse 0.2s ease-out;
  }
  
  .success-icon {
    font-size: 5rem;
    color: #4caf50;
    font-weight: bold;
    animation: successScale 0.2s ease-out;
  }
  
  .success-message {
    font-size: 2.5rem;
    color: #4caf50;
    font-weight: bold;
  }
  
  @keyframes successPulse {
    0% {
      opacity: 0;
      transform: scale(0.8);
    }
    50% {
      transform: scale(1.1);
    }
    100% {
      opacity: 1;
      transform: scale(1);
    }
  }
  
  @keyframes successScale {
    0% {
      transform: scale(0);
    }
    50% {
      transform: scale(1.2);
    }
    100% {
      transform: scale(1);
    }
  }
  
  /* Error state */
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    animation: errorShake 0.2s ease-out;
  }
  
  .error-icon {
    font-size: 4rem;
    color: #f44336;
    font-weight: bold;
  }
  
  .error-message {
    font-size: 1.5rem;
    color: #fff;
    line-height: 1.5;
  }
  
  .played-note {
    font-weight: bold;
    color: #f44336;
    font-size: 1.8rem;
  }
  
  @keyframes errorShake {
    0%, 100% {
      transform: translateX(0);
    }
    25% {
      transform: translateX(-10px);
    }
    75% {
      transform: translateX(10px);
    }
  }
  
  /* Listening state */
  .listening-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }
  
  .current-note {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }
  
  .note-name {
    font-size: 3rem;
    font-weight: bold;
    color: #fff;
    transition: opacity 0.2s ease-out;
  }
  
  .octave {
    font-size: 2rem;
    opacity: 0.7;
    color: #fff;
  }
  
  .position {
    font-size: 1.2rem;
    color: #999;
    opacity: 0.8;
  }
  
  .frequency {
    font-size: 1rem;
    color: #666;
    opacity: 0.7;
    margin-top: 0.5rem;
  }
  
  .no-pitch {
    font-size: 2rem;
    opacity: 0.5;
    color: #666;
    font-style: italic;
  }
  
  .status {
    font-size: 1.5rem;
    margin: 1rem 0;
    min-height: 2.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .status-placeholder {
    visibility: hidden;
  }
</style>
