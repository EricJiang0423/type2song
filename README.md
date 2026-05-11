# Type2Song

A web instrument you play by typing.

Type2Song is a browser-based creative instrument: you type normally, and every valid keystroke becomes part of a live musical performance. Instead of random keyboard clicks, it turns typing into scale-aware melodies, soft chord progressions, quantized rhythm, evolving motifs, and optional AI fills — so even messy typing sounds surprisingly musical.

It is part writing surface, part musical toy, part performance interface.

[简体中文 README](./README.zh-CN.md)

## Why It Feels Different

Most "keyboard music" projects stop at key clicks. Type2Song treats typing as musical input.

- Your keys map to scale degrees, not fixed notes.
- The melody stays inside the selected key and scale.
- Background harmony gives every phrase musical context.
- Typing is rate-limited to a musical pace, so fast bursts become a calm line instead of a wall of notes — a *Note density* slider lets you choose how sparse or responsive it feels. Keystrokes that get thinned out still leave a faint visual breadcrumb.
- Recent motifs can echo, repeat, and evolve; an AI continuation only fills in after you pause.
- Number Piano mode lets you play intentional melodies directly.

## Highlights

- Real-time sound powered by Tone.js (loaded only after you click **Start Audio**, so it respects browser autoplay rules)
- Instrument-style UI: a big writing stage with a note trail, ripples, a live "current note" display, an on-screen keyboard strip, and a signal-chain ribbon showing how each key becomes a note
- Three style moods — **Lo-fi Night**, **Sad Piano**, **Cute Game BGM** — each with a tuned timbre preset; a **Recommended** button re-applies it, **Reset** returns to a neutral default
- Key / Scale selector for changing the musical color
- Number Piano mode: `1=C3 2=D3 3=E3 4=F3 5=G3 6=A3 7=B3 8=C4 9=D4 0=E4`
- Scale-degree mode: `A S D F G H J K L` → degrees 1–9 of the current scale
- Multi-key chord triggering by holding several valid keys
- Timbre faders: brightness, warmth, attack, release, space, echo, pad, bass — plus the **Note density** control
- Smart layer: Auto Mood, AI Continuation, Bassline, Drums
- Live readout: current note, recent motif, generated phrase, and a step-by-step calculation view
- Export to MIDI, WAV, or JSON
- English / Chinese interface

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5173/`, click **Start Audio**, then type.

## Build

```bash
npm run build      # type-check + production bundle into dist/
npm run preview    # serve the production build
```

## Deploy (GitHub Pages)

`.github/workflows/deploy.yml` builds the app and publishes `dist/` to GitHub Pages on every push to `main`.

One-time setup on the repository:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. Push to `main` (or run the workflow manually from the Actions tab).

The Vite `base` is set to `./` (relative), so the build works at the domain root and at a project subpath (`https://<user>.github.io/<repo>/`) without further config.

## Tech Stack

- React 18 + TypeScript
- Vite
- Tailwind CSS v4 (config-less; theme lives in `src/index.css`, PostCSS pipeline inlined in `vite.config.ts`)
- Tone.js

## Project Structure

```text
src/
  main.tsx                Entry point
  index.css               Tailwind import + custom visual styles & theme vars
  vite-env.d.ts
  ui/
    App.tsx               Main interface, interaction wiring, and components
    i18n.ts               English / Chinese copy
  music/
    audioEngine.ts        Tone.js synths, transport, playback, note-duration shaping
    musicEngine.ts        Key → degree mapping, harmony selection, smoothing, motif memory, typing rate limit
    harmonyEngine.ts      Scale-aware harmony and chord voicing
    aiComposer.ts         Text-emotion analysis + motif continuation
    keyMapping.ts         Keyboard and number-piano mappings
    scales.ts             Scales, roots, note/degree math
    styles.ts             Musical style presets (incl. recommended timbre)
    timbre.ts             Timbre fader configuration
    exporters.ts          MIDI / WAV / JSON export
.github/workflows/deploy.yml   GitHub Pages CI
```

## Notes

Type2Song is client-only. The foundation is ready for more expressive features: richer sound design, recorded/shareable sessions, smarter continuation, and custom scales.
