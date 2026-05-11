import type { RootNote } from "./scales";
import type { TimbreOptions } from "./timbre";

export type QuantizeValue = "8n" | "16n";
export type ChordQuality = "major" | "minor" | "sus2" | "power";
export type SynthPreset = "lofi" | "piano" | "game";
export type ChordColor = "none" | "add2" | "add4" | "add6" | "add7";

export interface RomanChord {
  label: string;
  semitoneOffset: number;
  quality: ChordQuality;
  color?: ChordColor;
}

export interface StyleModeConfig {
  id: string;
  label: string;
  bpm: number;
  defaultRoot: RootNote;
  defaultScale: string;
  quantize: QuantizeValue;
  noteDuration: "16n" | "8n" | "4n";
  synthPreset: SynthPreset;
  progression: RomanChord[];
  reverb: number;
  delay: number;
  padIntensity: number;
  bassIntensity: number;
  /** Timbre slider sweet spot for this style; applied when the style is selected. */
  recommendedTimbre: TimbreOptions;
  accent: string;
  secondary: string;
  background: string;
}

export const STYLE_MODES: StyleModeConfig[] = [
  {
    id: "lofi-night",
    label: "Lo-fi Night",
    bpm: 72,
    defaultRoot: "C",
    defaultScale: "majorPentatonic",
    quantize: "8n",
    noteDuration: "8n",
    synthPreset: "lofi",
    progression: [
      { label: "I6/9", semitoneOffset: 0, quality: "sus2", color: "add6" },
      { label: "Vsus", semitoneOffset: 7, quality: "sus2", color: "add6" },
      { label: "vi7", semitoneOffset: 9, quality: "minor", color: "add7" },
      { label: "IV6/9", semitoneOffset: 5, quality: "sus2", color: "add6" },
    ],
    reverb: 0.42,
    delay: 0.28,
    padIntensity: 0.52,
    bassIntensity: 0.24,
    recommendedTimbre: {
      brightness: 0.05,
      warmth: 0.50,
      attack: 0.80,
      release: 0.90,
      space: 0.25,
      echo: 0.50,
      pad: 0.65,
      bass: 0.40,
    },
    accent: "#c9956b",
    secondary: "#7fd5c6",
    background: "#15120f",
  },
  {
    id: "ethereal-keys",
    label: "Ethereal Keys",
    bpm: 62,
    defaultRoot: "A",
    defaultScale: "naturalMinor",
    quantize: "8n",
    noteDuration: "4n",
    synthPreset: "piano",
    progression: [
      { label: "i(add2)", semitoneOffset: 0, quality: "minor", color: "add2" },
      { label: "VImaj", semitoneOffset: 8, quality: "major", color: "add6" },
      { label: "III(add2)", semitoneOffset: 3, quality: "major", color: "add2" },
      { label: "VII", semitoneOffset: 10, quality: "sus2", color: "add4" },
    ],
    reverb: 0.52,
    delay: 0.08,
    padIntensity: 0.24,
    bassIntensity: 0.2,
    recommendedTimbre: {
      brightness: 0.35,
      warmth: 0.55,
      attack: 0.15,
      release: 0.72,
      space: 0.72,
      echo: 0.10,
      pad: 0.18,
      bass: 0.20,
    },
    accent: "#b7c8ff",
    secondary: "#f3a2ad",
    background: "#161416",
  },
  {
    id: "cute-game-bgm",
    label: "Cute Game BGM",
    bpm: 96,
    defaultRoot: "C",
    defaultScale: "majorPentatonic",
    quantize: "16n",
    noteDuration: "16n",
    synthPreset: "game",
    progression: [
      { label: "Iadd6", semitoneOffset: 0, quality: "major", color: "add6" },
      { label: "vi7", semitoneOffset: 9, quality: "minor", color: "add7" },
      { label: "IVsus", semitoneOffset: 5, quality: "sus2", color: "add6" },
      { label: "Vsus", semitoneOffset: 7, quality: "sus2", color: "add4" },
    ],
    reverb: 0.22,
    delay: 0.16,
    padIntensity: 0.32,
    bassIntensity: 0.3,
    recommendedTimbre: {
      brightness: 0.78,
      warmth: 0.34,
      attack: 0.06,
      release: 0.22,
      space: 0.2,
      echo: 0.18,
      pad: 0.4,
      bass: 0.5,
    },
    accent: "#a8ec7b",
    secondary: "#ffb35c",
    background: "#141510",
  },
];

export function getStyleMode(styleId: string): StyleModeConfig {
  return STYLE_MODES.find((style) => style.id === styleId) ?? STYLE_MODES[0];
}
