<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { getAnalyser, getAudioContext, isMicrophoneListening } from '../lib/audio/mic.js';
  import { showMicrophonePopup } from '../stores.js';
  
  const microphoneSvg = '/microphone.svg';
  
  let canvas: HTMLCanvasElement;
  let animationFrameId: number | null = null;
  let analyser: AnalyserNode | null = null;
  let frequencyData: Uint8Array | null = null;
  let isActive = false;
  
  async function startVisualizer() {
    if (isActive) return;
    
    analyser = getAnalyser();
    if (!analyser) {
      return;
    }
    
    const audioContext = getAudioContext();
    if (!audioContext) {
      return;
    }
    
    // Resume AudioContext if suspended
    if (audioContext.state === 'suspended') {
      try {
        await audioContext.resume();
      } catch (error) {
        return;
      }
    }
    
    isActive = true;
    frequencyData = new Uint8Array(analyser.frequencyBinCount);
    
    function draw() {
      if (!isActive || !analyser || !canvas || !frequencyData) {
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
          animationFrameId = null;
        }
        return;
      }
      
      const audioContext = getAudioContext();
      if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume().catch(() => {});
      }
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      analyser.getByteFrequencyData(frequencyData as any);
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw small frequency bars (mini visualizer)
      const barCount = 3;
      const barWidth = 3;
      const barSpacing = 2;
      const maxBarHeight = 16;
      const centerY = canvas.height / 2;
      const startX = 2;
      
      ctx.fillStyle = analyser ? '#4caf50' : '#666';
      
      // Sample frequency data (take every nth sample)
      const sampleStep = Math.max(1, Math.floor(frequencyData.length / barCount));
      
      for (let i = 0; i < barCount; i++) {
        const dataIndex = i * sampleStep;
        const value = frequencyData[dataIndex] || 0;
        const barHeight = (value / 255) * maxBarHeight;
        const x = startX + i * (barWidth + barSpacing);
        const y = centerY - barHeight / 2;
        
        ctx.fillRect(x, y, barWidth, barHeight);
      }
      
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
  
  function clearVisualizer() {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  
  let checkInterval: ReturnType<typeof setInterval>;
  
  onMount(() => {
    checkInterval = setInterval(async () => {
      const currentAnalyser = getAnalyser();
      const audioContext = getAudioContext();
      
      // Check microphone status - if not listening, show popup
      const micListening = isMicrophoneListening();
      if (!micListening && !$showMicrophonePopup) {
        showMicrophonePopup.set(true);
      }
      
      // Only start if analyser exists and AudioContext is running
      if (currentAnalyser && audioContext) {
        if (audioContext.state === 'running' && !isActive) {
          await startVisualizer();
        } else if (audioContext.state === 'suspended' && !isActive) {
          try {
            await audioContext.resume();
            const stateAfterResume = audioContext.state as AudioContextState;
            if (stateAfterResume === 'running') {
              await startVisualizer();
            }
          } catch (err) {
            // Cannot resume without user interaction
          }
        }
      } else if (!currentAnalyser && isActive) {
        stopVisualizer();
        clearVisualizer();
      }
      
      // If visualizer is blank (no analyser), show popup if not already showing
      if (!currentAnalyser && !$showMicrophonePopup) {
        showMicrophonePopup.set(true);
      }
      
      analyser = currentAnalyser;
    }, 100);
  });
  
  onDestroy(() => {
    stopVisualizer();
    if (checkInterval) clearInterval(checkInterval);
  });
</script>

<div class="microphone-icon">
  <div class="microphone-svg-wrapper" class:active={!!analyser}>
    <img 
      src={microphoneSvg} 
      alt="Microphone" 
      class="microphone-svg"
    />
  </div>
  <canvas bind:this={canvas} width="20" height="24"></canvas>
</div>

<style>
  .microphone-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    position: relative;
  }
  
  .microphone-svg-wrapper {
    width: 24px;
    height: 24px;
    position: relative;
    opacity: 0.6;
    transition: opacity 0.2s;
  }
  
  .microphone-svg-wrapper.active {
    opacity: 1;
    background-color: #4caf50;
    -webkit-mask-image: url(/microphone.svg);
    mask-image: url(/microphone.svg);
    -webkit-mask-size: contain;
    mask-size: contain;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-position: center;
    mask-position: center;
  }
  
  .microphone-svg {
    width: 100%;
    height: 100%;
    filter: brightness(0) invert(1);
  }
  
  .microphone-svg-wrapper.active .microphone-svg {
    display: none;
  }
  
  canvas {
    width: 20px;
    height: 24px;
    background: transparent;
  }
</style>

