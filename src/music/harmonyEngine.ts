import {
  degreeToMidi,
  getScale,
  midiToNoteName,
  normalizeDegree,
  noteNameWithoutOctave,
  noteToMidi,
  type RootNote,
} from "./scales";
import type { ChordColor, RomanChord, StyleModeConfig } from "./styles";

const QUALITY_INTERVALS = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  sus2: [0, 2, 7],
  power: [0, 7, 12],
} as const;

export interface ResolvedChord {
  label: string;
  rootName: string;
  notes: string[];
  bassNote: string;
  scaleDegrees: number[];
  chordToneDegrees: number[];
  safePitchClasses: number[];
  rootPitchClass: number;
}

export class HarmonyEngine {
  private style: StyleModeConfig;
  private root: RootNote;
  private scaleId: string;
  private currentStep = 0;

  constructor(style: StyleModeConfig, root: RootNote, scaleId: string) {
    this.style = style;
    this.root = root;
    this.scaleId = scaleId;
  }

  setStyle(style: StyleModeConfig): void {
    this.style = style;
    this.currentStep = 0;
  }

  setKeyScale(root: RootNote, scaleId: string): void {
    this.root = root;
    this.scaleId = scaleId;
    this.currentStep = 0;
  }

  getChordForStep(step: number): ResolvedChord {
    const chord = this.style.progression[step % this.style.progression.length];
    this.currentStep = step % this.style.progression.length;
    return this.resolveChord(chord);
  }

  getCurrentChord(): ResolvedChord {
    return this.getChordForStep(this.currentStep);
  }

  getCurrentChordLabel(): string {
    const chord = this.getCurrentChord();
    return `${chord.rootName} ${this.style.progression[this.currentStep].label}`;
  }

  private resolveChord(chord: RomanChord): ResolvedChord {
    const rootMidi = noteToMidi(this.root, 3) + chord.semitoneOffset;
    const chordPitchClasses = this.getChordPitchClasses(rootMidi, chord);
    const safePitchClasses = this.getScalePitchClasses();
    const notes = this.buildOpenVoicing(rootMidi, chordPitchClasses, safePitchClasses);
    const bassNote = midiToNoteName(rootMidi - 12);
    const rootName = noteNameWithoutOctave(midiToNoteName(rootMidi));
    const chordToneDegrees = this.getScaleDegreesForPitchClasses(chordPitchClasses);
    const scaleDegrees = this.getScaleDegreesForPitchClasses(
      notes.map((note) => noteToPitchClass(noteNameToMidi(note))),
    );

    return {
      label: chord.label,
      rootName,
      notes,
      bassNote,
      scaleDegrees: scaleDegrees.length > 0 ? scaleDegrees : chordToneDegrees,
      chordToneDegrees,
      safePitchClasses,
      rootPitchClass: noteToPitchClass(rootMidi),
    };
  }

  private getScalePitchClasses(): number[] {
    const scale = getScale(this.scaleId);
    return scale.intervals.map((interval) => noteToPitchClass(noteToMidi(this.root, 4) + interval));
  }

  private getChordPitchClasses(rootMidi: number, chord: RomanChord): number[] {
    const intervals = [...QUALITY_INTERVALS[chord.quality], ...getColorIntervals(chord.color)];
    return Array.from(new Set(intervals.map((interval) => noteToPitchClass(rootMidi + interval))));
  }

  private buildOpenVoicing(rootMidi: number, chordPitchClasses: number[], safePitchClasses: number[]): string[] {
    const scale = getScale(this.scaleId);
    const scaleSafe = new Set(safePitchClasses);
    const rootPc = noteToPitchClass(rootMidi);
    const isPentatonic = scale.intervals.length <= 5;
    const preferred = chordPitchClasses.filter((pitchClass) => {
      return scaleSafe.has(pitchClass) || (!isPentatonic && pitchClass === rootPc);
    });

    const fallback = safePitchClasses.filter((pitchClass) => {
      return getPitchClassDistance(pitchClass, rootPc) <= 5;
    });
    const selectedPitchClasses = uniquePitchClasses(preferred.length >= 2 ? preferred : [...preferred, ...fallback]).slice(0, 4);
    const finalPitchClasses = selectedPitchClasses.length >= 2 ? selectedPitchClasses : safePitchClasses.slice(0, 3);
    const targetMidis = finalPitchClasses
      .map((pitchClass, index) => pitchClassToRange(pitchClass, index === 0 ? 52 : index === 1 ? 59 : 64, 48, 76))
      .sort((a, b) => a - b);

    return thinCloseNotes(targetMidis).map(midiToNoteName);
  }

  private getScaleDegreesForPitchClasses(pitchClasses: number[]): number[] {
    const scale = getScale(this.scaleId);
    const pitchClassSet = new Set(pitchClasses.map(noteToPitchClass));
    const chordPitchClasses = new Set(
      Array.from(pitchClassSet),
    );

    const degrees: number[] = [];
    for (let degree = 1; degree <= scale.intervals.length * 2; degree += 1) {
      const midi = degreeToMidi(this.root, scale, degree, 4);
      const pitchClass = ((midi % 12) + 12) % 12;
      if (chordPitchClasses.has(pitchClass)) {
        degrees.push(normalizeDegree(degree, scale));
      }
    }

    return Array.from(new Set(degrees));
  }
}

function getColorIntervals(color: ChordColor = "none"): number[] {
  if (color === "add2") {
    return [2, 14];
  }
  if (color === "add4") {
    return [5];
  }
  if (color === "add6") {
    return [9, 14];
  }
  if (color === "add7") {
    return [10];
  }
  return [];
}

function noteNameToMidi(noteName: string): number {
  const match = noteName.match(/^([A-G]#?)(-?\d+)$/);
  if (!match) {
    return noteToMidi("C", 4);
  }
  return noteToMidi(match[1] as RootNote, Number(match[2]));
}

function noteToPitchClass(midi: number): number {
  return ((Math.round(midi) % 12) + 12) % 12;
}

function uniquePitchClasses(pitchClasses: number[]): number[] {
  return Array.from(new Set(pitchClasses.map(noteToPitchClass)));
}

function pitchClassToRange(pitchClass: number, preferred: number, min: number, max: number): number {
  const candidates: number[] = [];
  for (let midi = min; midi <= max; midi += 1) {
    if (noteToPitchClass(midi) === noteToPitchClass(pitchClass)) {
      candidates.push(midi);
    }
  }

  return candidates.reduce((best, candidate) => {
    return Math.abs(candidate - preferred) < Math.abs(best - preferred) ? candidate : best;
  }, candidates[0] ?? preferred);
}

function thinCloseNotes(midis: number[]): number[] {
  const thinned: number[] = [];
  for (const midi of midis) {
    if (thinned.every((existing) => Math.abs(existing - midi) >= 3)) {
      thinned.push(midi);
    }
  }
  return thinned.slice(0, 4);
}

function getPitchClassDistance(a: number, b: number): number {
  const distance = Math.abs(noteToPitchClass(a) - noteToPitchClass(b));
  return Math.min(distance, 12 - distance);
}
