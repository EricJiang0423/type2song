import {
  resolveKeyToDegree,
  resolveNumberKeyToPianoNote,
  type DirectPianoMapping,
  type KeyDegreeMapping,
} from "./keyMapping";
import {
  degreeToMidi,
  getScale,
  midiToNoteName,
  normalizeDegree,
  type RootNote,
} from "./scales";
import type { QuantizeValue } from "./styles";

export type MotifVariant = "direct" | "chord-neighbor" | "motif-repeat" | "motif-neighbor";
export type InputMode = "scale-degree" | "number-piano";
export type KeyRegion = "left" | "right" | "center";
/** Returned when a playable key is dropped by the rate limit (no note, but the UI can still react). */
export const RATE_LIMITED = "rate-limited" as const;
export type ResolveKeyResult = ResolvedNoteEvent | typeof RATE_LIMITED | null;
const MELODY_BASE_OCTAVE = 3;

/** Touch-typing left-hand keys. */
const LEFT_HAND_KEYS = new Set("qwertasdfgzxcvb");
/** Touch-typing right-hand keys. */
const RIGHT_HAND_KEYS = new Set("yuiophjklnm");

export function keyToRegion(key: string): KeyRegion {
  const lower = key.toLowerCase();
  if (LEFT_HAND_KEYS.has(lower)) return "left";
  if (RIGHT_HAND_KEYS.has(lower)) return "right";
  return "center";
}

export interface CalculationStep {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone: "input" | "scale" | "harmony" | "rhythm" | "output";
}

export interface MotifNote {
  degree: number;
  midi: number;
  noteName: string;
  velocity: number;
  variant: MotifVariant;
  /** Time (ms) since the previous sounded note; NaN for the first note. */
  elapsedMs: number;
}

export interface ResolvedNoteEvent extends MotifNote {
  key: string;
  keyLabel: string;
  keyClass: KeyDegreeMapping["keyClass"];
  /** Touch-typing hand region for per-key timbre differentiation. */
  keyRegion: KeyRegion;
  quantize: QuantizeValue;
  scheduledTime: number;
  exportTimeSeconds: number;
  chordLabel: string;
  chordDegrees: number[];
  inputDegree: number;
  harmonicDegree: number;
  motifDegree: number;
  rawMidi: number;
  octaveShift: number;
  elapsedMs: number;
  harmonyScore: number;
  harmonyReason: string;
  inputMode: InputMode;
  calculation: CalculationStep[];
  motif: MotifNote[];
  /** True when this note follows a pause longer than ~550 ms — signals a phrase boundary. */
  isPhraseStart: boolean;
}

export interface ResolveKeyOptions {
  numberPianoMode: boolean;
  /** Skip the per-keystroke rate limit (used for intentional chords). */
  bypassRateLimit?: boolean;
}

export const PHRASE_PAUSE_MS = 550;
const ROLLING_WINDOW_SIZE = 8;

export class MusicEngine {
  private root: RootNote;
  private scaleId: string;
  private quantize: QuantizeValue;
  private lastMidi: number | null = null;
  private lastKeyTime: number | null = null;
  private noteCount = 0;
  private motif: MotifNote[] = [];
  /** 0 = sparse & calm, 1 = responsive (a note for almost every keystroke). */
  private density = 0.55;
  /** Rolling window of inter-keystroke intervals (ms) for adaptive feel. */
  private rollingIntervals: number[] = [];

  constructor(root: RootNote, scaleId: string, quantize: QuantizeValue) {
    this.root = root;
    this.scaleId = scaleId;
    this.quantize = quantize;
  }

  setKeyScale(root: RootNote, scaleId: string): void {
    this.root = root;
    this.scaleId = scaleId;
    this.lastMidi = null;
    this.lastKeyTime = null;
    this.motif = [];
    this.rollingIntervals = [];
  }

  setQuantize(quantize: QuantizeValue): void {
    this.quantize = quantize;
  }

  setDensity(density: number): void {
    this.density = Math.max(0, Math.min(1, density));
  }

  getMotif(): MotifNote[] {
    return [...this.motif];
  }

  /** Rolling average inter-keystroke interval (ms), or null when not enough data. */
  getRollingAvgIntervalMs(): number | null {
    if (this.rollingIntervals.length < 3) return null;
    return this.rollingIntervals.reduce((a, b) => a + b, 0) / this.rollingIntervals.length;
  }

  /** True if the user is in a fast-burst typing pattern. */
  get isBursting(): boolean {
    const avg = this.getRollingAvgIntervalMs();
    return avg !== null && avg < 160;
  }

  /**
   * Minimum real time between two *sounded* melody notes. Bursts of typing that
   * arrive faster than this are still typed as text but do not pile extra notes
   * onto the same quantize slot, which is what made fast typing sound chaotic.
   */
  private getMinNoteGapMs(): number {
    const gridBase = this.quantize === "16n" ? 150 : 230;
    return gridBase * (1.5 - this.density);
  }

  resolveKey(
    key: string,
    eventTimeMs: number,
    chordDegrees: number[],
    scheduledTime: number,
    exportTimeSeconds: number,
    chordLabel: string,
    options: ResolveKeyOptions = { numberPianoMode: false },
  ): ResolveKeyResult {
    if (options.numberPianoMode) {
      const direct = resolveNumberKeyToPianoNote(key);
      if (direct) {
        return this.resolveDirectPianoKey(
          key,
          direct,
          eventTimeMs,
          chordDegrees,
          scheduledTime,
          exportTimeSeconds,
          chordLabel,
        );
      }
    }

    const mapping = resolveKeyToDegree(key);
    if (!mapping) {
      return null;
    }

    const rawElapsed = this.lastKeyTime === null ? 420 : Math.max(0, eventTimeMs - this.lastKeyTime);
    if (!options.bypassRateLimit && this.lastKeyTime !== null && rawElapsed < this.getMinNoteGapMs()) {
      return RATE_LIMITED;
    }

    // Track rolling interval for adaptive feel.
    if (this.lastKeyTime !== null) {
      this.rollingIntervals.push(rawElapsed);
      if (this.rollingIntervals.length > ROLLING_WINDOW_SIZE) {
        this.rollingIntervals.shift();
      }
    }

    const scale = getScale(this.scaleId);
    const elapsed = Math.max(24, rawElapsed);
    const isPause = this.lastKeyTime === null || rawElapsed > PHRASE_PAUSE_MS;
    const strongInput = this.noteCount % 4 === 0 || isPause;
    const motifAdjusted = this.applyMotifMemory(mapping.degree, scale.intervals.length);
    const harmonic = this.chooseBestHarmonicCandidate(
      mapping.degree,
      motifAdjusted.degree,
      chordDegrees,
      strongInput,
    );
    const rawMidi = degreeToMidi(this.root, scale, harmonic.degree, MELODY_BASE_OCTAVE);
    const smoothing = this.smoothMidi(rawMidi);
    const velocity = this.calculateVelocity(elapsed, mapping);
    const noteName = midiToNoteName(smoothing.midi);
    const normalizedMotifDegree = normalizeDegree(harmonic.degree, scale);
    const motifNote: MotifNote = {
      degree: normalizedMotifDegree,
      midi: smoothing.midi,
      noteName,
      velocity,
      variant: harmonic.variant,
      elapsedMs: rawElapsed,
    };

    const calculation = this.buildCalculationSteps({
      keyLabel: mapping.label,
      inputDegree: mapping.degree,
      harmonicDegree: harmonic.degree,
      motifDegree: motifAdjusted.degree,
      rawMidi,
      noteName,
      velocity,
      elapsed,
      chordDegrees,
      chordLabel,
      octaveShift: smoothing.octaveShift,
      quantize: this.quantize,
      variant: motifNote.variant,
      harmonyScore: harmonic.score,
      harmonyReason: harmonic.reason,
      isPause,
    });

    this.lastMidi = smoothing.midi;
    this.lastKeyTime = eventTimeMs;
    this.noteCount += 1;
    this.motif = [...this.motif, motifNote].slice(-8);

    return {
      ...motifNote,
      key,
      keyLabel: mapping.label,
      keyClass: mapping.keyClass,
      quantize: this.quantize,
      scheduledTime,
      exportTimeSeconds,
      chordLabel,
      chordDegrees: [...chordDegrees],
      inputDegree: mapping.degree,
      harmonicDegree: harmonic.degree,
      motifDegree: motifAdjusted.degree,
      rawMidi,
      octaveShift: smoothing.octaveShift,
      elapsedMs: elapsed,
      harmonyScore: harmonic.score,
      harmonyReason: harmonic.reason,
      keyRegion: keyToRegion(key),
      inputMode: "scale-degree",
      calculation,
      motif: this.getMotif(),
      isPhraseStart: isPause && this.noteCount > 0,
    };
  }

  private resolveDirectPianoKey(
    key: string,
    direct: DirectPianoMapping,
    eventTimeMs: number,
    chordDegrees: number[],
    scheduledTime: number,
    exportTimeSeconds: number,
    chordLabel: string,
  ): ResolvedNoteEvent {
    const rawElapsed = this.lastKeyTime === null ? 420 : Math.max(0, eventTimeMs - this.lastKeyTime);
    // Track intervals for piano mode too.
    if (this.lastKeyTime !== null) {
      this.rollingIntervals.push(rawElapsed);
      if (this.rollingIntervals.length > ROLLING_WINDOW_SIZE) {
        this.rollingIntervals.shift();
      }
    }
    const elapsed = Math.max(24, rawElapsed);
    const isPause = this.lastKeyTime === null || rawElapsed > PHRASE_PAUSE_MS;
    const velocity = this.calculateVelocity(elapsed, {
      degree: direct.degree,
      keyClass: "digit",
      label: direct.label,
      velocityBias: direct.velocityBias,
    });
    const noteName = midiToNoteName(direct.midi);
    const motifNote: MotifNote = {
      degree: direct.degree,
      midi: direct.midi,
      noteName,
      velocity,
      variant: "direct",
      elapsedMs: rawElapsed,
    };
    const calculation = this.buildDirectPianoCalculationSteps({
      keyLabel: direct.label,
      noteName,
      midi: direct.midi,
      velocity,
      elapsed,
      quantize: this.quantize,
      chordLabel,
    });

    this.lastMidi = direct.midi;
    this.lastKeyTime = eventTimeMs;
    this.noteCount += 1;
    this.motif = [...this.motif, motifNote].slice(-8);

    return {
      ...motifNote,
      key,
      keyLabel: direct.label,
      keyClass: "digit",
      quantize: this.quantize,
      scheduledTime,
      exportTimeSeconds,
      chordLabel,
      chordDegrees: [...chordDegrees],
      inputDegree: direct.degree,
      harmonicDegree: direct.degree,
      motifDegree: direct.degree,
      rawMidi: direct.midi,
      octaveShift: 0,
      elapsedMs: elapsed,
      harmonyScore: 0,
      harmonyReason: "direct piano key bypassed scale and chord remapping",
      keyRegion: keyToRegion(key),
      inputMode: "number-piano",
      calculation,
      motif: this.getMotif(),
      isPhraseStart: isPause && this.noteCount > 0,
    };
  }

  private chooseBestHarmonicCandidate(
    inputDegree: number,
    motifDegree: number,
    chordDegrees: number[],
    strongInput: boolean,
  ): { degree: number; variant: MotifVariant; score: number; reason: string } {
    const scale = getScale(this.scaleId);
    const scaleLength = scale.intervals.length;
    const chordTargets = chordDegrees.flatMap((degree) => nearestDegreeVariants(degree, inputDegree, scaleLength));
    const candidates = uniqueDegrees([
      inputDegree,
      motifDegree,
      inputDegree - 2,
      inputDegree - 1,
      inputDegree + 1,
      inputDegree + 2,
      motifDegree - 1,
      motifDegree + 1,
      ...chordTargets,
    ]).filter((degree) => degree >= 1);

    const scored = candidates.map((candidate) => {
      const normalized = normalizeDegree(candidate, scale);
      const isChordTone = chordDegrees.includes(normalized);
      const isMotif = candidate === motifDegree;
      const rawMidi = degreeToMidi(this.root, scale, candidate, MELODY_BASE_OCTAVE);
      const smoothedMidi = this.smoothMidi(rawMidi).midi;
      const melodicDistance = this.lastMidi === null ? 0 : Math.abs(smoothedMidi - this.lastMidi);
      const inputDistance = Math.abs(candidate - inputDegree);
      const motifDistance = Math.abs(candidate - motifDegree);
      const chordScore = isChordTone ? (strongInput ? 5.2 : 3.3) : strongInput ? -2.2 : -0.7;
      const melodicScore = this.lastMidi === null ? 1.5 : Math.max(-3.5, 3.2 - melodicDistance * 0.24);
      const inputScore = Math.max(-2.5, 2 - inputDistance * 0.75);
      const motifScore = isMotif ? 0.9 : Math.max(-1.2, 0.5 - motifDistance * 0.35);
      const repeatPenalty =
        this.lastMidi !== null && smoothedMidi === this.lastMidi ? (isChordTone ? -1.1 : -2.4) : 0;
      const score = chordScore + melodicScore + inputScore + motifScore + repeatPenalty;

      return {
        degree: candidate,
        normalized,
        isChordTone,
        isMotif,
        score,
      };
    });

    const best = scored.reduce((currentBest, candidate) => {
      return candidate.score > currentBest.score ? candidate : currentBest;
    }, scored[0]);

    const changedForHarmony = best.degree !== inputDegree;
    const changedForMotif = best.degree === motifDegree && motifDegree !== inputDegree;
    const variant: MotifVariant = changedForMotif
      ? "motif-repeat"
      : changedForHarmony
        ? "chord-neighbor"
        : "direct";

    return {
      degree: best.degree,
      variant,
      score: Math.round(best.score * 10) / 10,
      reason: best.isChordTone ? "selected stable chord/scale tone" : "kept nearby passing tone",
    };
  }

  private applyMotifMemory(
    degree: number,
    scaleLength: number,
  ): { degree: number; variant?: MotifVariant } {
    if (this.motif.length >= 6 && this.noteCount % 11 === 10) {
      const source = this.motif[this.motif.length - 5];
      const direction = this.noteCount % 2 === 0 ? 1 : -1;
      return {
        degree: Math.max(1, source.degree + direction),
        variant: "motif-neighbor",
      };
    }

    if (this.motif.length >= 4 && this.noteCount % 7 === 6) {
      const source = this.motif[this.motif.length - 4];
      const octaveLift = this.noteCount % 14 === 13 ? scaleLength : 0;
      return {
        degree: source.degree + octaveLift,
        variant: "motif-repeat",
      };
    }

    return { degree };
  }

  private smoothMidi(rawMidi: number): { midi: number; octaveShift: number } {
    if (this.lastMidi === null) {
      return { midi: rawMidi, octaveShift: 0 };
    }

    const candidates = [rawMidi - 24, rawMidi - 12, rawMidi, rawMidi + 12, rawMidi + 24];
    const smoothed = candidates.reduce((best, candidate) => {
      const bestDistance = Math.abs(best - this.lastMidi!);
      const candidateDistance = Math.abs(candidate - this.lastMidi!);
      return candidateDistance < bestDistance ? candidate : best;
    }, rawMidi);

    return {
      midi: smoothed,
      octaveShift: Math.round((smoothed - rawMidi) / 12),
    };
  }

  private calculateVelocity(elapsedMs: number, mapping: KeyDegreeMapping): number {
    // Deliberate, well-spaced keystrokes are the accents; quick runs settle back
    // into a soft, even texture instead of getting louder and louder.
    const base =
      elapsedMs > 650
        ? 0.78
        : elapsedMs > 360
          ? 0.66
          : elapsedMs > 230
            ? 0.56
            : elapsedMs > 140
              ? 0.48
              : 0.42;
    const degreeAccent = mapping.degree === 1 || mapping.degree === 5 || mapping.degree === 8 ? 0.05 : 0;
    return clamp(base + mapping.velocityBias + degreeAccent, 0.22, 0.84);
  }

  private buildCalculationSteps(input: {
    keyLabel: string;
    inputDegree: number;
    harmonicDegree: number;
    motifDegree: number;
    rawMidi: number;
    noteName: string;
    velocity: number;
    elapsed: number;
    chordDegrees: number[];
    chordLabel: string;
    octaveShift: number;
    quantize: QuantizeValue;
    variant: MotifVariant;
    harmonyScore: number;
    harmonyReason: string;
    isPause: boolean;
  }): CalculationStep[] {
    const scale = getScale(this.scaleId);
    const chordDegreeText = input.chordDegrees.length > 0 ? input.chordDegrees.join(", ") : "-";
    const octaveText = input.octaveShift === 0 ? "no octave shift" : `${input.octaveShift > 0 ? "+" : ""}${input.octaveShift} octave`;

    return [
      {
        id: "key",
        label: "Key",
        value: input.keyLabel,
        detail: `mapped to degree ${input.inputDegree}`,
        tone: "input",
      },
      {
        id: "scale",
        label: "Scale",
        value: `${this.root} ${scale.label}`,
        detail: `degree ${input.inputDegree} constrained to scale`,
        tone: "scale",
      },
      {
        id: "harmony",
        label: "Chord fit",
        value: input.chordLabel,
        detail: `targets: ${chordDegreeText}; score ${input.harmonyScore.toFixed(1)}`,
        tone: "harmony",
      },
      {
        id: "motif",
        label: "Motif",
        value: input.variant,
        detail: `${input.harmonyReason}; motif suggested ${input.motifDegree}`,
        tone: "harmony",
      },
      {
        id: "rhythm",
        label: "Rhythm",
        value: input.isPause ? "phrase · " + input.quantize : input.quantize,
        detail: input.isPause
          ? `phrase start · ${Math.round(input.elapsed)}ms gap`
          : `${Math.round(input.elapsed)}ms since previous key`,
        tone: "rhythm",
      },
      {
        id: "smooth",
        label: "Smoothing",
        value: octaveText,
        detail: `raw MIDI ${input.rawMidi} -> ${input.noteName}`,
        tone: "scale",
      },
      {
        id: "velocity",
        label: "Velocity",
        value: input.velocity.toFixed(2),
        detail: "typing speed and key position shaped loudness",
        tone: "output",
      },
    ];
  }

  private buildDirectPianoCalculationSteps(input: {
    keyLabel: string;
    noteName: string;
    midi: number;
    velocity: number;
    elapsed: number;
    quantize: QuantizeValue;
    chordLabel: string;
  }): CalculationStep[] {
    return [
      {
        id: "key",
        label: "Key",
        value: input.keyLabel,
        detail: "number key mapped to fixed piano white key",
        tone: "input",
      },
      {
        id: "scale",
        label: "Piano",
        value: input.noteName,
        detail: "bypassed scale-degree remapping for direct control",
        tone: "scale",
      },
      {
        id: "harmony",
        label: "Chord context",
        value: input.chordLabel,
        detail: "background harmony keeps playing; note is user-directed",
        tone: "harmony",
      },
      {
        id: "rhythm",
        label: "Rhythm",
        value: input.quantize,
        detail: `${Math.round(input.elapsed)}ms since previous key`,
        tone: "rhythm",
      },
      {
        id: "smooth",
        label: "Direct MIDI",
        value: `${input.midi}`,
        detail: "no octave smoothing applied in piano mode",
        tone: "scale",
      },
      {
        id: "velocity",
        label: "Velocity",
        value: input.velocity.toFixed(2),
        detail: "typing speed still shapes loudness",
        tone: "output",
      },
    ];
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function uniqueDegrees(degrees: number[]): number[] {
  return Array.from(new Set(degrees.map((degree) => Math.round(degree))));
}

function nearestDegreeVariants(normalizedDegree: number, anchorDegree: number, scaleLength: number): number[] {
  const variants: number[] = [];
  const anchorOctave = Math.floor((Math.max(1, anchorDegree) - 1) / scaleLength);
  for (let octave = anchorOctave - 1; octave <= anchorOctave + 1; octave += 1) {
    variants.push(normalizedDegree + octave * scaleLength);
  }
  return variants.filter((degree) => degree >= 1);
}
