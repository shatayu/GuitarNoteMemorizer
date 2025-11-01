<script lang="ts">
  // Simple visual fretboard reference
</script>

<div class="fretboard">
  <div class="strings">
    {#each [6, 5, 4, 3, 2, 1] as string}
      <div class="string">
        <span class="open-note">E</span>
        <div class="frets">
          {#each Array(12) as _, i}
            <div class="fret"></div>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .fretboard {
    padding: 1rem;
    font-size: 0.8rem;
  }
  
  .strings {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .string {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .open-note {
    width: 2rem;
    text-align: center;
    opacity: 0.7;
  }
  
  .frets {
    display: flex;
    gap: 0.25rem;
    flex: 1;
  }
  
  .fret {
    flex: 1;
    height: 2rem;
    border: 1px solid #555;
    border-radius: 2px;
  }
</style>
