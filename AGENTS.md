# Repository Guidelines

## Project Structure & Module Organization

Type2Song is a Vite + React + TypeScript web app for turning typed input into music.

- `src/App.tsx` contains the main UI and interaction wiring.
- `src/i18n.ts` stores English/Chinese UI copy.
- `src/index.css` contains Tailwind imports plus custom visual styles.
- `src/music/` contains the music system:
  - `audioEngine.ts`: Tone.js synths, transport, playback, chords.
  - `musicEngine.ts`: key-to-note resolution, smoothing, motif logic.
  - `harmonyEngine.ts`: scale-aware chord voicing.
  - `keyMapping.ts`: keyboard and number-piano mappings.
  - `styles.ts`: style mode presets.
  - `exporters.ts`: MIDI/WAV/JSON export.
- `dist/` is generated output; do not edit it directly.
- No test suite currently exists.

## Build, Test, and Development Commands

- `npm run dev` starts the Vite dev server on `0.0.0.0`.
- `npm run build` runs TypeScript checks and builds production assets.
- `npm run preview` serves the production build locally.
- `npm audit --audit-level=moderate` checks dependency vulnerabilities.

Run `npm run build` before handing off changes.

## Coding Style & Naming Conventions

Use TypeScript and React function components. Keep code modular and avoid putting music logic directly into UI components.

- Use 2-space indentation.
- Use `camelCase` for variables/functions and `PascalCase` for React components/types.
- Keep files focused by domain, especially under `src/music/`.
- Prefer explicit interfaces for cross-module data shapes.
- Avoid adding dependencies unless the feature clearly needs them.

## Testing Guidelines

There is no configured test framework yet. For now, validate changes with:

1. `npm run build`
2. Browser smoke test at `http://localhost:5173/`
3. Console check for errors/warnings
4. Manual checks for Start/Stop, style switching, number piano, export buttons, and typing playback

If tests are added later, place them near the implementation or under `src/__tests__/` and use descriptive names such as `musicEngine.test.ts`.

## Commit & Pull Request Guidelines

This directory currently has no git history. Use concise, imperative commit messages, for example:

- `Improve scale-aware chord voicing`
- `Add number piano input mode`

Pull requests should include:

- What changed and why
- Screenshots or short video for UI changes
- Verification commands run
- Any known limitations, especially audio/browser behavior

## Security & Configuration Tips

The app is client-only and uses Web Audio. Audio must start from a user gesture, so keep Tone.js initialization behind `Start Audio`. Do not commit `node_modules/`, `dist/`, or generated Playwright artifacts.
