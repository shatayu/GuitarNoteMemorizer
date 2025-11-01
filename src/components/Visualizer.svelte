<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { getAnalyser, getAudioContext, isMicrophoneListening } from '../lib/audio/mic.js';
  import { showMicrophonePopup } from '../stores.js';
  
  let canvas: HTMLCanvasElement;
  let animationFrameId: number | null = null;
  let analyser: AnalyserNode | null = null;
  let frequencyData: Uint8Array | null = null;
  let timeData: Float32Array | null = null;
  let audioLevel = 0;
  let peakFreq = 0;
  let isActive = false;
  
  async function startVisualizer() {
    if (isActive) return;
    
    analyser = getAnalyser();
    if (!analyser) {
      console.log('DEBUG: Visualizer - No analyser found');
      return;
    }
    
    const audioContext = getAudioContext();
    if (!audioContext) {
      console.log('DEBUG: Visualizer - No AudioContext found');
      return;
    }
    
    // Resume AudioContext if suspended
    if (audioContext.state === 'suspended') {
      console.log('DEBUG: Visualizer - AudioContext suspended, attempting to resume...');
      try {
        await audioContext.resume();
        console.log('DEBUG: Visualizer - AudioContext resumed | New state:', audioContext.state);
      } catch (error) {
        console.log('DEBUG: Visualizer - Failed to resume AudioContext:', error);
        return;
      }
    }
    
    console.log('DEBUG: Visualizer started | AudioContext state:', audioContext.state, '| SampleRate:', audioContext.sampleRate);
    
    isActive = true;
    frequencyData = new Uint8Array(analyser.frequencyBinCount);
    timeData = new Float32Array(analyser.fftSize);
    
    function draw() {
      if (!isActive || !analyser || !canvas || !frequencyData || !timeData) {
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
          animationFrameId = null;
        }
        return;
      }
      
      const audioContext = getAudioContext();
      // Resume AudioContext if it becomes suspended
      if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume().catch((err) => {
          console.log('DEBUG: Visualizer - Failed to resume AudioContext in draw loop:', err);
        });
      }
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      analyser.getByteFrequencyData(frequencyData as any);
      analyser.getFloatTimeDomainData(timeData as any);
      
      // Calculate audio level
      let sum = 0;
      for (let i = 0; i < frequencyData.length; i++) {
        sum += frequencyData[i];
      }
      audioLevel = sum / frequencyData.length;
      
      // Find peak frequency
      let maxIndex = 0;
      let maxValue = 0;
      for (let i = 0; i < frequencyData.length; i++) {
        if (frequencyData[i] > maxValue) {
          maxValue = frequencyData[i];
          maxIndex = i;
        }
      }
      const nyquist = audioContext?.sampleRate || 44100;
      peakFreq = (maxIndex * nyquist) / (2 * frequencyData.length);
      
      // Draw waveform
      ctx.fillStyle = '#121212';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw frequency bars
      ctx.fillStyle = '#4caf50';
      const barWidth = canvas.width / frequencyData.length;
      for (let i = 0; i < frequencyData.length; i++) {
        const barHeight = (frequencyData[i] / 255) * canvas.height;
        ctx.fillRect(i * barWidth, canvas.height - barHeight, barWidth, barHeight);
      }
      
      // Draw waveform
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const sliceWidth = canvas.width / timeData.length;
      let x = 0;
      for (let i = 0; i < timeData.length; i++) {
        const v = timeData[i] * 0.5 + 0.5;
        const y = v * canvas.height;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }
      ctx.stroke();
      
      animationFrameId = requestAnimationFrame(draw);
    }
    
    draw();
  }
  
  function stopVisualizer() {
    isActive = false;
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }
  
  let checkInterval: ReturnType<typeof setInterval>;
  
  onMount(() => {
    checkInterval = setInterval(async () => {
      const currentAnalyser = getAnalyser();
      const audioContext = getAudioContext();
      
      // Check microphone status - if not listening, show popup
      const micListening = isMicrophoneListening();
      if (!micListening && !$showMicrophonePopup) {
        console.log('DEBUG: Visualizer - Microphone not listening, showing popup');
        showMicrophonePopup.set(true);
      }
      
      // Only start if analyser exists and AudioContext is running
      if (currentAnalyser && audioContext) {
        if (audioContext.state === 'running' && !isActive) {
          await startVisualizer();
        } else if (audioContext.state === 'suspended' && !isActive) {
          // Try to resume if suspended
          try {
            await audioContext.resume();
            // Check state after resume attempt - state can change after resume
            const stateAfterResume = audioContext.state as AudioContextState;
            if (stateAfterResume === 'running') {
              await startVisualizer();
            }
          } catch (err) {
            console.log('DEBUG: Visualizer - Cannot resume AudioContext without user interaction');
          }
        }
      } else if (!currentAnalyser && isActive) {
        stopVisualizer();
      }
      
      // If visualizer is blank (no analyser), show popup if not already showing
      if (!currentAnalyser && !$showMicrophonePopup) {
        console.log('DEBUG: Visualizer - No analyser found (visualizer blank), showing popup');
        showMicrophonePopup.set(true);
      }
      
      // Update analyser reference for reactive display
      analyser = currentAnalyser;
    }, 100);
  });
  
  onDestroy(() => {
    stopVisualizer();
    if (checkInterval) clearInterval(checkInterval);
  });
</script>

<div class="visualizer">
  <h3>Audio Visualizer</h3>
  <canvas bind:this={canvas} width="800" height="200"></canvas>
  <div class="stats">
    <div>Audio Level: {audioLevel.toFixed(1)}</div>
    <div>Peak Freq: {peakFreq.toFixed(1)} Hz</div>
    <div>Status: {analyser ? 'Active' : 'Inactive'}</div>
  </div>
</div>

<style>
  .visualizer {
    padding: 1rem;
    background: #1e1e1e;
    border-radius: 8px;
    margin: 1rem 0;
  }
  
  .visualizer h3 {
    margin: 0 0 1rem 0;
    font-size: 1.2rem;
  }
  
  canvas {
    width: 100%;
    height: 200px;
    background: #121212;
    border: 1px solid #333;
    border-radius: 4px;
  }
  
  .stats {
    display: flex;
    gap: 2rem;
    margin-top: 0.5rem;
    font-size: 0.9rem;
    opacity: 0.8;
  }
</style>
