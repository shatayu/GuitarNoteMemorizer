<script lang="ts">
  import { onMount } from 'svelte';
  import { settings } from '../stores.js';
  import { getAudioDevices } from '../lib/audio/mic.js';
  
  let devices: MediaDeviceInfo[] = [];
  let showSettings = false;
  
  async function loadDevices() {
    devices = await getAudioDevices();
  }
  
  function toggleString(index: number) {
    settings.update(s => {
      const enabled = [...s.enabledStrings];
      enabled[index] = !enabled[index];
      return { ...s, enabledStrings: enabled };
    });
  }
  
  function updateSetting(key: keyof typeof $settings, value: any) {
    settings.update(s => ({ ...s, [key]: value }));
  }
  
  function handleDeviceChange(e: Event) {
    const target = e.target as HTMLSelectElement;
    updateSetting('deviceId', target.value || null);
  }
  
  onMount(() => {
    loadDevices();
  });
</script>

<div class="controls">
  <button class="toggle-settings" on:click={() => showSettings = !showSettings}>
    {showSettings ? 'Hide' : 'Show'} Settings
  </button>
  
  {#if showSettings}
    <div class="settings-panel">
      <div class="setting-group">
        <label>Microphone:</label>
        <select on:change={handleDeviceChange}>
          <option value="">Default</option>
          {#each devices as device}
            <option value={device.deviceId} selected={$settings.deviceId === device.deviceId}>
              {device.label || `Microphone ${devices.indexOf(device) + 1}`}
            </option>
          {/each}
        </select>
      </div>
      
      <div class="setting-group">
        <label>Enabled Strings:</label>
        <div class="strings">
          {#each $settings.enabledStrings as enabled, i}
            <button 
              class="string-btn {enabled ? 'active' : ''}"
              on:click={() => toggleString(i)}
            >
              {6 - i}
            </button>
          {/each}
        </div>
      </div>
      
      <div class="setting-group">
        <label>
          <input type="checkbox" bind:checked={$settings.wholeNotesOnly} />
          Whole notes only
        </label>
      </div>
      
      <div class="setting-group">
        <label>
          <input type="checkbox" bind:checked={$settings.frets1to12Only} />
          Frets 1-12 only
        </label>
      </div>
      
      <div class="setting-group">
        <label>
          Tolerance: {$settings.tolerance}¢
          <input 
            type="range" 
            min="10" 
            max="100" 
            step="5"
            bind:value={$settings.tolerance}
          />
        </label>
      </div>
      
      <div class="setting-group">
        <label>
          A4 Frequency: {$settings.a4} Hz
          <input 
            type="number" 
            min="420" 
            max="450" 
            step="1"
            bind:value={$settings.a4}
          />
        </label>
      </div>
    </div>
  {/if}
</div>

<style>
  .controls {
    padding: 1rem;
    background: #1e1e1e;
    border-radius: 8px;
    margin: 1rem 0;
  }
  
  .toggle-settings {
    background: #333;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    margin-bottom: 1rem;
  }
  
  .settings-panel {
    margin: 1rem 0;
    padding: 1rem;
    background: #2a2a2a;
    border-radius: 4px;
  }
  
  .setting-group {
    margin: 1rem 0;
  }
  
  .setting-group label {
    display: block;
    margin-bottom: 0.5rem;
    color: #fff;
  }
  
  .setting-group input[type="range"] {
    width: 100%;
    margin-top: 0.5rem;
  }
  
  .strings {
    display: flex;
    gap: 0.5rem;
  }
  
  .string-btn {
    padding: 0.5rem 1rem;
    border: 1px solid #555;
    background: #333;
    color: white;
    border-radius: 4px;
    cursor: pointer;
  }
  
  .string-btn.active {
    background: #4caf50;
    border-color: #4caf50;
  }
  
  select {
    width: 100%;
    padding: 0.5rem;
    background: #333;
    color: white;
    border: 1px solid #555;
    border-radius: 4px;
  }
</style>
