# Guitar Note Memorizer

A minimalist, high-performance web app for memorizing guitar notes using real-time pitch detection.

## Features

- **Real-time pitch detection** using aubio.js (same approach as the [qiuxiang/tuner](https://github.com/qiuxiang/tuner) repo)
- **Randomized prompts** for note memorization
- **Live feedback** showing detected note, cents offset, and guitar position
- **Configurable settings**: string filters, whole notes only, fret range, tolerance, A4 calibration
- **Keyboard shortcuts**: Space (skip), C (mark correct)
- **Dark theme** optimized for practice sessions

## Setup

```bash
npm install
npm run dev
```

## Usage

1. Click "Start Listening" to enable microphone
2. Grant microphone permissions when prompted
3. Play the prompted note on the specified string
4. The app detects your note and shows correctness
5. Use keyboard shortcuts for quick navigation

## Tech Stack

- **Svelte 4** - Minimal, reactive UI framework
- **Vite** - Fast build tool
- **aubio.js** - Pitch detection library (same as tuner repo)
- **TypeScript** - Type-safe code
- **Web Audio API** - Real-time audio processing

## Performance

- Minimal dependencies (only aubio.js)
- Lightweight pitch detection
- Efficient audio processing with requestAnimationFrame
- No heavy ML models - instant startup

## Browser Support

Works in modern browsers with Web Audio API support (Chrome, Firefox, Safari, Edge).
