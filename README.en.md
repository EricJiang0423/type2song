# Type2Song

> **Turn your typing into music. Not sound effects—actual melodies, chords, and rhythm.**

You type every day. What if those keystrokes could become music—not a series of sterile clicks, but real melodies with chord progressions, rhythmic groove, and evolving motifs?

Type2Song is a browser-based instrument that does exactly that. Type normally, and every valid keystroke generates a note in real time. No music theory required, no MIDI keyboard, no installation—open the page, hit Start Audio, and type.

It's part writing tool, part musical instrument, part live performance interface.

---

## What Makes It Different

Most "keyboard music" projects stop at key clicks—press a key, hear a sample. That's not music.

Type2Song works differently.

- **Your keys map to scale degrees, not fixed pitches.** Press A in C Major and it's the 6th degree (La). Switch to A Minor and the same key becomes the 1st degree (Do). A melody line emerges naturally.
- **Background chord progressions give every note harmonic context.** Type random letters and it sounds like improvisation over a real progression—because that's exactly what it is.
- **Your typing speed shapes the music.** Slow, deliberate keystrokes are accents; fast bursts settle into a soft, even texture. Your typing rhythm *is* the musical expression.
- **Recent notes are remembered.** A phrase echoes, repeats, and transforms. When you pause, the AI picks up and continues for a few notes—like another musician waiting for your cue.
- **Fast bursts don't become a wall of sound.** The engine rate-limits to a musical pace. Thinned-out keystrokes leave a faint visual breadcrumb, so you know it's still responding—but your ears don't suffer.

---

## Try It

[**ericjiang0423.github.io/type2song/**](https://ericjiang0423.github.io/type2song/)

Click **Start Audio**, then type. That's all.

---

## Features

- **Three style moods**: Lo-fi Night (warm, late-night feel), Sad Piano (soft, narrative piano), Cute Game BGM (chiptune energy). Each comes with a tuned timbre preset. Switch styles—the whole UI palette and sound character change with it.
- **Key / Scale selector**: 7 scales × root combinations. Pull the dropdown and the musical color changes instantly.
- **Two playing modes**:
  - **Scale-degree mode**: `A S D F G H J K L` → degrees 1–9 of the current scale. The default, for free typing.
  - **Number Piano**: `1=C3 2=D3 … 0=E4`—fixed pitches, for intentional melody playing.
- **Chord triggering**: Hold multiple valid keys and release—they're voiced as a chord with dynamic balancing.
- **8 timbre faders**: Brightness, Warmth, Attack, Release, Space, Echo, Pad, Bass. Every style has a **Recommended** preset; you can tweak freely and **Reset** to neutral defaults.
- **Note density control**: Lower = calmer when you type fast; higher = responsive to nearly every key. Default is tuned for the widest coverage.
- **Smart Layer**:
  - Auto Mood: reads the emotion of your text and switches style automatically.
  - AI Continuation: after a pause, the AI writes a few continuation notes.
  - Bassline: automatic bass accompaniment.
  - Drums: automatic percussion (especially playful in Cute Game mode).
- **Live readout**: current note, last 8 motif notes, AI-generated phrase, and a visual "signal chain" showing exactly how each keystroke becomes a note.
- **Note trail**: a mini piano roll showing pitch and velocity of the last ~40 notes.
- **Signal chain ribbon**: `Key → degree → chord → rhythm → note` with a pulse sweeping through on every keystroke.
- **English / Chinese UI**: toggle in the header.

---

## Quick Start

```bash
git clone https://github.com/EricJiang0423/type2song.git
cd type2song
npm install
npm run dev
```

Open `http://localhost:5173/`, click **Start Audio**, then type.

---

## Project Structure

```
src/
  main.tsx                Entry point
  index.css               Styles + theme vars (Tailwind v4, no separate config)
  ui/
    App.tsx               UI, interaction wiring, all components
    i18n.ts               Copy (zh/en)
  music/
    audioEngine.ts        Tone.js synths, transport, playback
    musicEngine.ts        Rate limit, key→degree, harmony selection, octave smoothing, motif
    harmonyEngine.ts      Scale-aware chord voicing
    aiComposer.ts         Text emotion analysis + motif continuation
    keyMapping.ts         Keyboard + number-piano mappings
    scales.ts             Scale and pitch math
    styles.ts             Three style presets + recommended timbre configs
    timbre.ts             Timbre fader descriptors
    exporters.ts          MIDI / WAV / JSON
.github/workflows/deploy.yml   GitHub Pages CI
```

---

## Deploy

Publishing to GitHub Pages is automatic on every push to `main`:

```bash
git push origin main
# Or trigger manually from the Actions tab
```

Live at: [**https://ericjiang0423.github.io/type2song/**](https://ericjiang0423.github.io/type2song/)

---

## Design Philosophy

### The input is the instrument.

The writing area owns the stage. The control panel scrolls independently on the right—you can dial in a timbre, switch a style, glance at the readout, and never lose keyboard focus from where the music happens.

### Restraint is a feature.

Limiting to one note per quantize slot, inverting the velocity curve so fast typing gets softer instead of louder, deferring AI continuation until after a pause—these decisions shape the sound more than any feature list.

### The browser is enough.

No installation. No sign-up. No hardware. Open the page and play. Lowering that threshold is the point.

---

## Stack

React 18 · TypeScript · Vite · Tailwind CSS v4 · Tone.js

Client-only. Tone.js loads after Start Audio to respect browser autoplay rules.

---

## Roadmap

- Richer synthesis engine
- Recordable, shareable sessions
- Smarter continuation
- Custom scales

---

[MIT](LICENSE) · A web instrument you play by typing.

*[简体中文 README →](./README.md)*
