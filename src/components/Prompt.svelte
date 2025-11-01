<script lang="ts">
  import { settings } from '../stores.js';
  
  export let targetNote: string;
  export let targetString: number;
  export let questionNum: number;
  export let score: number;
  export let streak: number;
</script>

<div class="prompt">
  <div class="question-info">
    <span class="question-num">Question {questionNum}</span>
    <span class="score">Score: {score}</span>
    <span class="streak">Streak: {streak}</span>
  </div>
  <div class="target">
    {#key targetNote}
      <h1>Play: {targetNote}</h1>
      <h2>On {targetString}{targetString === 1 ? 'st' : targetString === 2 ? 'nd' : targetString === 3 ? 'rd' : 'th'} string</h2>
    {/key}
  </div>
</div>

<style>
  .prompt {
    text-align: center;
    padding: 2rem;
    min-height: 200px;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  
  .question-info {
    display: flex;
    justify-content: space-between;
    margin-bottom: 2rem;
    font-size: 1rem;
    opacity: 0.7;
    min-height: 1.5rem;
  }
  
  .target {
    min-height: 150px;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  
  .target h1 {
    font-size: 4rem;
    margin: 0.5rem 0;
    font-weight: bold;
    line-height: 1.2;
    animation: slideInFromRight 0.5s ease-out;
  }
  
  .target h2 {
    font-size: 2rem;
    margin: 0.5rem 0;
    opacity: 0.8;
    line-height: 1.2;
    animation: slideInFromRight 0.5s ease-out 0.1s both;
  }
  
  @keyframes slideInFromRight {
    0% {
      opacity: 0;
      transform: translateX(30px);
    }
    100% {
      opacity: 1;
      transform: translateX(0);
    }
  }
</style>
