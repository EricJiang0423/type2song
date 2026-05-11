export const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

export type RootNote = (typeof NOTE_NAMES)[number];

export interface ScaleDefinition {
  id: string;
  label: string;
  intervals: number[];
  color: string;
}

export const SCALES: Record<string, ScaleDefinition> = {
  majorPentatonic: {
    id: "majorPentatonic",
    label: "Major Pentatonic",
    intervals: [0, 2, 4, 7, 9],
    color: "#c9956b",
  },
  minorPentatonic: {
    id: "minorPentatonic",
    label: "Minor Pentatonic",
    intervals: [0, 3, 5, 7, 10],
    color: "#9ec6ff",
  },
  major: {
    id: "major",
    label: "Major",
    intervals: [0, 2, 4, 5, 7, 9, 11],
    color: "#ffcf7a",
  },
  naturalMinor: {
    id: "naturalMinor",
    label: "Natural Minor",
    intervals: [0, 2, 3, 5, 7, 8, 10],
    color: "#c7b4ff",
  },
  dorian: {
    id: "dorian",
    label: "Dorian",
    intervals: [0, 2, 3, 5, 7, 9, 10],
    color: "#75d7c6",
  },
  lydian: {
    id: "lydian",
    label: "Lydian",
    intervals: [0, 2, 4, 6, 7, 9, 11],
    color: "#b7ee78",
  },
  phrygian: {
    id: "phrygian",
    label: "Phrygian",
    intervals: [0, 1, 3, 5, 7, 8, 10],
    color: "#ff9a86",
  },
};

export interface KeyScaleOption {
  root: RootNote;
  scaleId: string;
  label: string;
}

export const KEY_SCALE_OPTIONS: KeyScaleOption[] = [
  { root: "C", scaleId: "majorPentatonic", label: "C Major Pentatonic" },
  { root: "G", scaleId: "majorPentatonic", label: "G Major Pentatonic" },
  { root: "A", scaleId: "minorPentatonic", label: "A Minor Pentatonic" },
  { root: "C", scaleId: "major", label: "C Major" },
  { root: "A", scaleId: "naturalMinor", label: "A Natural Minor" },
  { root: "D", scaleId: "dorian", label: "D Dorian" },
  { root: "F", scaleId: "lydian", label: "F Lydian" },
  { root: "E", scaleId: "phrygian", label: "E Phrygian" },
];

export function getScale(scaleId: string): ScaleDefinition {
  return SCALES[scaleId] ?? SCALES.majorPentatonic;
}

export function noteToMidi(root: RootNote, octave: number): number {
  return NOTE_NAMES.indexOf(root) + (octave + 1) * 12;
}

export function midiToNoteName(midi: number): string {
  const rounded = Math.round(midi);
  const note = NOTE_NAMES[((rounded % 12) + 12) % 12];
  const octave = Math.floor(rounded / 12) - 1;
  return `${note}${octave}`;
}

export function noteNameWithoutOctave(noteName: string): string {
  return noteName.replace(/-?\d+$/, "");
}

export function degreeToMidi(
  root: RootNote,
  scale: ScaleDefinition,
  degree: number,
  baseOctave = 4,
): number {
  const safeDegree = Math.max(1, Math.round(degree));
  const zeroBased = safeDegree - 1;
  const scaleOctave = Math.floor(zeroBased / scale.intervals.length);
  const scaleIndex = zeroBased % scale.intervals.length;
  return noteToMidi(root, baseOctave) + scale.intervals[scaleIndex] + scaleOctave * 12;
}

export function normalizeDegree(degree: number, scale: ScaleDefinition): number {
  const zeroBased = Math.max(0, Math.round(degree) - 1);
  return (zeroBased % scale.intervals.length) + 1;
}

export function buildScaleNotes(
  root: RootNote,
  scale: ScaleDefinition,
  baseOctave = 3,
  octaves = 3,
): string[] {
  const notes: string[] = [];
  const totalDegrees = scale.intervals.length * octaves;

  for (let degree = 1; degree <= totalDegrees; degree += 1) {
    notes.push(midiToNoteName(degreeToMidi(root, scale, degree, baseOctave)));
  }

  return notes;
}
