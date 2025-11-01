<script lang="ts">
  import { showMicrophonePopup } from '../stores.js';
  import { startMicrophone } from '../lib/audio/mic.js';
  import { settings } from '../stores.js';
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  let isRequesting = false;
  
  async function enableMicrophone() {
    if (isRequesting) return;
    
    isRequesting = true;
    try {
      // Start microphone - this will have user interaction context from the button click
      await startMicrophone($settings.deviceId || undefined);
      
      // Dispatch event to parent to start listening
      dispatch('microphoneEnabled');
      
      showMicrophonePopup.set(false);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      alert('Failed to enable microphone: ' + errorMsg + '\n\nPlease check your browser permissions and try again.');
      console.error('Failed to enable microphone:', error);
    } finally {
      isRequesting = false;
    }
  }
  
  function dismiss() {
    showMicrophonePopup.set(false);
  }
</script>

{#if $showMicrophonePopup}
  <div 
    class="popup-overlay" 
    role="dialog"
    aria-modal="true"
    aria-labelledby="popup-title"
    on:click={dismiss} 
    on:keydown={(e) => e.key === 'Escape' && dismiss()}
    tabindex="-1"
  >
    <div class="popup-content">
      <div class="popup-header">
        <h2 id="popup-title">Microphone Access Required</h2>
        <button class="close-btn" on:click={dismiss} aria-label="Close dialog">×</button>
      </div>
      <div class="popup-body">
        <div class="icon">🎤</div>
        <p>The microphone is not currently active. Please enable microphone access to use this app.</p>
        <p class="hint">Your browser will ask for permission to access your microphone.</p>
      </div>
      <div class="popup-footer">
        <button class="btn-enable" on:click={enableMicrophone} disabled={isRequesting}>
          {isRequesting ? 'Requesting Access...' : 'Enable Microphone'}
        </button>
        <button class="btn-cancel" on:click={dismiss}>Cancel</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .popup-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    animation: fadeIn 0.2s ease-out;
  }
  
  .popup-content {
    background: #1e1e1e;
    border-radius: 12px;
    padding: 0;
    max-width: 500px;
    width: 90%;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    animation: slideUp 0.3s ease-out;
  }
  
  .popup-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #333;
  }
  
  .popup-header h2 {
    margin: 0;
    font-size: 1.5rem;
    color: #fff;
  }
  
  .close-btn {
    background: none;
    border: none;
    color: #999;
    font-size: 2rem;
    line-height: 1;
    cursor: pointer;
    padding: 0;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: background 0.2s, color 0.2s;
  }
  
  .close-btn:hover {
    background: #333;
    color: #fff;
  }
  
  .popup-body {
    padding: 2rem 1.5rem;
    text-align: center;
  }
  
  .icon {
    font-size: 4rem;
    margin-bottom: 1rem;
  }
  
  .popup-body p {
    margin: 0.75rem 0;
    color: #fff;
    line-height: 1.6;
  }
  
  .hint {
    color: #999;
    font-size: 0.9rem;
  }
  
  .popup-footer {
    padding: 1.5rem;
    border-top: 1px solid #333;
    display: flex;
    gap: 1rem;
    justify-content: flex-end;
  }
  
  .popup-footer button {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-size: 1rem;
    cursor: pointer;
    transition: opacity 0.2s, transform 0.1s;
  }
  
  .popup-footer button:hover:not(:disabled) {
    opacity: 0.9;
    transform: translateY(-1px);
  }
  
  .popup-footer button:active:not(:disabled) {
    transform: translateY(0);
  }
  
  .btn-enable {
    background: #4caf50;
    color: white;
  }
  
  .btn-enable:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .btn-cancel {
    background: #333;
    color: white;
  }
  
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  
  @keyframes slideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
</style>

