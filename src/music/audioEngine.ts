import * as Tone from "tone";
import { HarmonyEngine } from "./harmonyEngine";
import { MusicEngine, RATE_LIMITED, type KeyRegion, type ResolveKeyOptions, type ResolveKeyResult, type ResolvedNoteEvent } from "./musicEngine";
import type { RootNote } from "./scales";
import type { StyleModeConfig } from "./styles";
import { DEFAULT_TIMBRE_OPTIONS, type TimbreOptions } from "./timbre";

export interface ArrangementOptions {
  bassEnabled: boolean;
  drumsEnabled: boolean;
  padEnabled: boolean;
}

export interface GeneratedPlaybackNote {
  degree: number;
  midi: number;
  noteName: string;
  velocity: number;
  delaySteps: number;
  durationSteps: number;
  reason: string;
}

export interface GeneratedPlaybackEvent extends GeneratedPlaybackNote {
  exportTimeSeconds: number;
  durationSeconds: number;
}

export class AudioEngine {
  private style: StyleModeConfig;
  private root: RootNote;
  private scaleId: string;
  private music: MusicEngine;
  private harmony: HarmonyEngine;
  private melodySynth: any = null;
  private padSynth: any = null;
  private bassSynth: any = null;
  private kickSynth: Tone.MembraneSynth | null = null;
  private snareSynth: Tone.NoiseSynth | null = null;
  private hatSynth: Tone.NoiseSynth | null = null;
  private master: Tone.Gain | null = null;
  private melodyGain: Tone.Gain | null = null;
  private melodyFilter: Tone.Filter | null = null;
  private padGain: Tone.Gain | null = null;
  private bassGain: Tone.Gain | null = null;
  private drumGain: Tone.Gain | null = null;
  private delay: Tone.FeedbackDelay | null = null;
  private reverb: Tone.Reverb | null = null;
  private harmonyEventId: number | null = null;
  private drumEventId: number | null = null;
  private chordStep = 0;
  private drumStep = 0;
  private arrangement: ArrangementOptions = {
    bassEnabled: true,
    drumsEnabled: false,
    padEnabled: true,
  };
  private timbre: TimbreOptions = { ...DEFAULT_TIMBRE_OPTIONS };
  private lastMelodySlot = -1;
  private autoFilter: Tone.AutoFilter | null = null;
  private autoPanner: Tone.AutoPanner | null = null;
  private autoFilterLfo: Tone.Signal | null = null;

  // ---- P2 parameters ----
  /** Per-key timbre offset: ±Hz added to melodyFilter frequency per region. */
  private keyRegionFilterOffset = 0;
  /** Emotion-driven bias shaping articulation: -1 (staccato) … +1 (legato). */
  private emotionArticulationBias = 0;
  /** Emotion-driven brightness bias: -1 (darker) … +1 (brighter). */
  private emotionBrightnessBias = 0;

  setEmotionParams(articulationBias: number, brightnessBias: number): void {
    this.emotionArticulationBias = clamp(articulationBias, -1, 1);
    this.emotionBrightnessBias = clamp(brightnessBias, -1, 1);
  }

  constructor(style: StyleModeConfig, root: RootNote, scaleId: string) {
    this.style = style;
    this.root = root;
    this.scaleId = scaleId;
    this.music = new MusicEngine(root, scaleId, style.quantize);
    this.harmony = new HarmonyEngine(style, root, scaleId);
    this.configureAudioGraph();
    this.scheduleHarmony();
    this.scheduleDrums();
  }

  async start(): Promise<void> {
    await Tone.start();
    Tone.Transport.bpm.value = this.style.bpm;

    if (Tone.Transport.state !== "started") {
      this.chordStep = 0;
      Tone.Transport.start("+0.05");
    }
  }

  stop(): void {
    Tone.Transport.stop();
    this.melodySynth?.releaseAll?.();
    this.padSynth?.releaseAll?.();
    this.bassSynth?.triggerRelease?.();
  }

  dispose(): void {
    if (this.harmonyEventId !== null) {
      Tone.Transport.clear(this.harmonyEventId);
      this.harmonyEventId = null;
    }

    if (this.drumEventId !== null) {
      Tone.Transport.clear(this.drumEventId);
      this.drumEventId = null;
    }

    this.disposeAudioGraph();
  }

  setStyleMode(style: StyleModeConfig): void {
    this.style = style;
    this.music.setQuantize(style.quantize);
    this.harmony.setStyle(style);
    Tone.Transport.bpm.rampTo(style.bpm, 0.25);
    this.configureAudioGraph();
    this.scheduleHarmony();
    this.scheduleDrums();
  }

  setKeyScale(root: RootNote, scaleId: string): void {
    this.root = root;
    this.scaleId = scaleId;
    this.music.setKeyScale(root, scaleId);
    this.harmony.setKeyScale(root, scaleId);
  }

  setArrangementOptions(options: ArrangementOptions): void {
    this.arrangement = options;
    this.scheduleDrums();
  }

  setTimbreOptions(options: TimbreOptions): void {
    this.timbre = { ...options };
    this.applyTimbreToLiveGraph();
  }

  setDensity(density: number): void {
    this.music.setDensity(density);
  }

  triggerKey(key: string, eventTimeMs: number, options?: ResolveKeyOptions): ResolveKeyResult {
    // Resolve the key first so we can check isPhraseStart before scheduling.
    const chord = this.harmony.getCurrentChord();
    const tempTime = this.getQuantizedTime();
    const tempExport = this.getExportTimeSeconds(tempTime);
    const event = this.music.resolveKey(
      key,
      eventTimeMs,
      chord.scaleDegrees,
      tempTime,
      tempExport,
      `${chord.rootName} ${chord.label}`,
      options,
    );

    if (event === RATE_LIMITED || !event || !this.melodySynth) {
      return event;
    }

    // Phrase-start notes align to the next measure boundary for a composed feel.
    const scheduledTime = this.getQuantizedTime(event.isPhraseStart && !this.music.isBursting);
    const exportTimeSeconds = this.getExportTimeSeconds(scheduledTime);
    // Re-assign the correct schedule time to the event for the readout.
    event.scheduledTime = scheduledTime;
    event.exportTimeSeconds = exportTimeSeconds;

    // Update spatial modulation rate from typing speed.
    this.applyExpressionRate(this.music.getRollingAvgIntervalMs());

    // P2#7: per-key-region filter offset — left hand slightly darker, right hand brighter.
    this.keyRegionFilterOffset = this.getKeyRegionFilterOffset(event.keyRegion);

    // P2#8: emotion-driven brightness tweak rides on top of the timbre slider.
    const emotionFreqOffset = this.emotionBrightnessBias * 220;
    const baseCutoff = this.getMelodyCutoff() + this.keyRegionFilterOffset + emotionFreqOffset;
    this.melodyFilter?.frequency.rampTo(clamp(baseCutoff, 400, 7200), 0.03);

    // If this note lands on the same quantize slot as the previous one, pull it
    // back so a couple of fast keystrokes read as a soft dyad, not a thump.
    const stacked = Math.abs(scheduledTime - this.lastMelodySlot) < 1e-4;
    this.lastMelodySlot = scheduledTime;
    if (stacked) {
      event.velocity *= 0.55;
    }

    // Stereo pan by degree — lower degrees lean left, higher lean right.
    const pan = this.getPanForDegree(event.degree);
    this.melodySynth?.set?.({ pan });

    this.melodySynth.triggerAttackRelease(
      event.noteName,
      this.getMelodyNoteDuration(event.elapsedMs),
      scheduledTime,
      event.velocity,
    );

    if (event.variant === "motif-repeat" && this.padSynth) {
      const echoTime = scheduledTime + Tone.Time(this.style.quantize).toSeconds();
      this.padSynth.triggerAttackRelease(event.noteName, "16n", echoTime, event.velocity * 0.18);
    }

    return event;
  }

  /** Map a scale degree to a stereo position: 1→L, 9→R, interpolated. */
  private getPanForDegree(degree: number): number {
    const normalised = clamp((degree - 1) / 8, 0, 1);
    return -0.6 + normalised * 1.2; // -0.6 … +0.6 (not hard L/R)
  }

  triggerChord(keys: string[], eventTimeMs: number, options?: ResolveKeyOptions): ResolvedNoteEvent[] {
    const uniqueKeys = Array.from(new Set(keys)).slice(0, 6);
    if (!this.melodySynth || uniqueKeys.length === 0) {
      return [];
    }

    const scheduledTime = this.getQuantizedTime();
    const exportTimeSeconds = this.getExportTimeSeconds(scheduledTime);
    const chord = this.harmony.getCurrentChord();
    const chordOptions: ResolveKeyOptions = {
      numberPianoMode: options?.numberPianoMode ?? false,
      bypassRateLimit: true,
    };
    const rawEvents = uniqueKeys
      .map((key) => {
        return this.music.resolveKey(
          key,
          eventTimeMs,
          chord.scaleDegrees,
          scheduledTime,
          exportTimeSeconds,
          `${chord.rootName} ${chord.label}`,
          chordOptions,
        );
      })
      .filter((event): event is ResolvedNoteEvent => event !== null && event !== RATE_LIMITED);
    const chordGain = Math.max(0.42, 1 / Math.sqrt(rawEvents.length || 1));
    const events = rawEvents.map((event) => ({
      ...event,
      velocity: event.velocity * chordGain,
    }));

    this.applyExpressionRate(this.music.getRollingAvgIntervalMs());

    for (const event of events) {
      this.melodySynth?.set?.({ pan: this.getPanForDegree(event.degree) });
      this.melodySynth.triggerAttackRelease(
        event.noteName,
        this.style.noteDuration,
        scheduledTime,
        event.velocity,
      );
    }
    this.lastMelodySlot = scheduledTime;

    return events;
  }

  triggerGeneratedNotes(notes: GeneratedPlaybackNote[]): GeneratedPlaybackEvent[] {
    if (!this.melodySynth) {
      return [];
    }

    const stepSeconds = Tone.Time(this.style.quantize).toSeconds();
    const startTime = Tone.now() + stepSeconds;
    const startExportTime = this.getExportTimeSeconds(startTime);

    return notes.map((note) => {
      const time = startTime + stepSeconds * note.delaySteps;
      const durationSeconds = stepSeconds * Math.max(1, note.durationSteps);
      this.melodySynth.triggerAttackRelease(note.noteName, durationSeconds, time, note.velocity);

      if (this.padSynth && this.arrangement.padEnabled) {
        this.padSynth.triggerAttackRelease(note.noteName, durationSeconds * 1.2, time + stepSeconds * 0.5, note.velocity * 0.16);
      }

      return {
        ...note,
        exportTimeSeconds: startExportTime + stepSeconds * note.delaySteps,
        durationSeconds,
      };
    });
  }

  private configureAudioGraph(): void {
    this.disposeAudioGraph();

    this.master = new Tone.Gain(0.82).toDestination();
    this.reverb = new Tone.Reverb({
      decay: this.style.synthPreset === "piano" ? 4.6 : 3.8,
      wet: this.getReverbWet(),
    }).connect(this.master);
    this.delay = new Tone.FeedbackDelay({
      delayTime: this.style.quantize,
      feedback: this.getDelayFeedback(),
      wet: this.getDelayWet(),
    }).connect(this.reverb);

    this.melodyFilter = new Tone.Filter({
      frequency: this.getMelodyCutoff(),
      type: "lowpass",
      Q: this.getFilterQ(),
    }).connect(this.delay);

    // AutoFilter: subtle filter sweep that responds to burst density.
    this.autoFilter = new Tone.AutoFilter({
      frequency: 0.06, // very slow sweep
      depth: 0.18,
      baseFrequency: 300,
      type: "sine",
      wet: 0.12,
    }).connect(this.melodyFilter);

    // AutoPanner: gentle stereo movement for spatial width.
    this.autoPanner = new Tone.AutoPanner({
      frequency: 0.04,
      depth: 0.1,
      wet: 0.2,
    }).connect(this.autoFilter);

    // Route the melody synth output through our spatial chain: gain → panner → filter → delay.
    // Since PolySynth.connect() replaces its output, we connect the synth to melodyGain's input
    // which then flows through the spatial chain. Actually for PolySynth we need to connect it
    // directly — so let the synth connect to melodyGain and route the gain → spatial chain.
    // Fix: melody synth connects to melodyGain, melodyGain feeds the spatial chain.
    this.melodyGain = new Tone.Gain(0.78).connect(this.autoPanner!);
    this.padGain = new Tone.Gain(this.getPadGain()).connect(this.reverb);
    this.bassGain = new Tone.Gain(this.getBassGain()).connect(this.master);
    this.drumGain = new Tone.Gain(0.24).connect(this.master);

    this.melodySynth = this.createMelodySynth();
    this.padSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
      envelope: {
        attack: 0.8,
        decay: 0.2,
        sustain: 0.72,
        release: 1.1,
      },
    }).connect(this.padGain);
    this.bassSynth = new Tone.MonoSynth({
      oscillator: { type: "triangle" },
      envelope: {
        attack: 0.02,
        decay: 0.18,
        sustain: 0.3,
        release: 0.55,
      },
      filterEnvelope: {
        attack: 0.02,
        decay: 0.1,
        sustain: 0.18,
        release: 0.4,
        baseFrequency: 80,
        octaves: 2.2,
      },
    }).connect(this.bassGain);
    this.kickSynth = new Tone.MembraneSynth({
      pitchDecay: 0.04,
      octaves: 4,
      envelope: {
        attack: 0.001,
        decay: 0.24,
        sustain: 0.02,
        release: 0.18,
      },
    }).connect(this.drumGain);
    this.snareSynth = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: {
        attack: 0.001,
        decay: 0.08,
        sustain: 0,
        release: 0.09,
      },
    }).connect(this.drumGain);
    this.hatSynth = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: {
        attack: 0.001,
        decay: 0.025,
        sustain: 0,
        release: 0.025,
      },
    }).connect(this.drumGain);
  }

  private createMelodySynth(): any {
    if (!this.melodyGain) {
      return null;
    }

    const settings = this.getMelodySynthSettings();

    if (this.style.synthPreset === "game") {
      return new Tone.PolySynth(Tone.Synth, settings).connect(this.melodyGain);
    }

    if (this.style.synthPreset === "piano") {
      return new Tone.PolySynth(Tone.FMSynth, settings).connect(this.melodyGain);
    }

    return new Tone.PolySynth(Tone.Synth, settings).connect(this.melodyGain);
  }

  private getMelodySynthSettings(): Record<string, unknown> {
    if (this.style.synthPreset === "game") {
      return {
        oscillator: { type: "triangle8" },
        envelope: {
          attack: 0.002 + this.timbre.attack * 0.025,
          decay: 0.08 + this.timbre.warmth * 0.1,
          sustain: 0.18 + this.timbre.warmth * 0.18,
          release: 0.08 + this.timbre.release * 0.38,
        },
      };
    }

    if (this.style.synthPreset === "piano") {
      // Felt-piano flavour: keep the FM modulation low so it stays warm and woody
      // instead of metallic, with a soft hammer "ping" that decays into a pure body.
      return {
        harmonicity: 1.4 + this.timbre.brightness * 1.5,
        modulationIndex: 1.6 + this.timbre.brightness * 4.0,
        oscillator: { type: "triangle" },
        modulation: { type: "sine" },
        envelope: {
          attack: 0.003 + this.timbre.attack * 0.022,
          decay: 0.7 + this.timbre.warmth * 1.2,
          sustain: 0.01 + this.timbre.warmth * 0.05,
          release: 0.8 + this.timbre.release * 1.9,
        },
        modulationEnvelope: {
          attack: 0.002,
          decay: 0.16 + this.timbre.brightness * 0.4,
          sustain: 0,
          release: 0.1 + this.timbre.release * 0.25,
        },
      };
    }

    return {
      oscillator: { type: "fatsine4" },
      envelope: {
        attack: 0.006 + this.timbre.attack * 0.075,
        decay: 0.16 + this.timbre.warmth * 0.28,
        sustain: 0.12 + this.timbre.warmth * 0.22,
        release: 0.28 + this.timbre.release * 1.05,
      },
    };
  }

  private applyTimbreToLiveGraph(): void {
    this.melodySynth?.set?.(this.getMelodySynthSettings());
    this.reverb?.wet.rampTo(this.getReverbWet(), 0.08);
    this.delay?.wet.rampTo(this.getDelayWet(), 0.08);
    this.delay?.feedback.rampTo(this.getDelayFeedback(), 0.08);
    this.padGain?.gain.rampTo(this.getPadGain(), 0.08);
    this.bassGain?.gain.rampTo(this.getBassGain(), 0.08);
    this.melodyFilter?.frequency.rampTo(this.getMelodyCutoff(), 0.08);
    this.melodyFilter?.Q.rampTo(this.getFilterQ(), 0.08);
  }

  /** Adjust the spatial modulation rates based on the current typing tempo. */
  private applyExpressionRate(avgIntervalMs: number | null): void {
    if (!this.autoFilter || !this.autoPanner) return;
    // Faster typing → slightly more active modulation (shortens the LFO cycle).
    // The mapping: avg 60ms → ~0.18 Hz, avg 500ms+ → ~0.04 Hz.
    const norm = avgIntervalMs !== null ? clamp(avgIntervalMs / 500, 0.12, 1) : 0.5;
    const filterRate = 0.04 + (1 - norm) * 0.18;
    const pannerRate = 0.03 + (1 - norm) * 0.1;
    this.autoFilter.frequency.rampTo(filterRate, 0.2);
    this.autoPanner.frequency.rampTo(pannerRate, 0.2);
  }

  /** Offset applied to the melody filter frequency per key hand-region. */
  private getKeyRegionFilterOffset(keyRegion: KeyRegion): number {
    switch (keyRegion) {
      case "left":  return -90;  // warmer/darker
      case "right": return +100; // brighter/clearer
      default:      return 0;
    }
  }

  private getMelodyNoteDuration(elapsedMs: number): string | number {
    // P2#8: emotion articulation bias shifts the note-length threshold.
    // Legato bias (+1) = allow longer notes at higher speeds.
    // Staccato bias (-1) = shorten notes even at moderate speeds.
    const biasMs = this.emotionArticulationBias * 100;
    const threshold = 240 + biasMs;
    if (elapsedMs < threshold) {
      return Tone.Time(this.style.quantize).toSeconds() * 1.1;
    }
    return this.style.noteDuration;
  }

  private getMelodyCutoff(): number {
    const emotionOffset = this.emotionBrightnessBias * 220;
    return clamp(720 + this.timbre.brightness * 5600 - this.timbre.warmth * 420 + emotionOffset, 400, 7200);
  }

  private getFilterQ(): number {
    return clamp(0.55 + this.timbre.warmth * 1.25, 0.5, 1.9);
  }

  private getReverbWet(): number {
    return clamp(this.style.reverb * (0.32 + this.timbre.space * 1.45), 0.04, 0.78);
  }

  private getDelayWet(): number {
    return clamp(this.style.delay * (0.18 + this.timbre.echo * 1.35), 0, 0.58);
  }

  private getDelayFeedback(): number {
    return clamp(this.style.delay * (0.35 + this.timbre.echo * 1.2), 0, 0.72);
  }

  private getPadGain(): number {
    return this.style.padIntensity * (0.22 + this.timbre.pad * 0.9);
  }

  private getBassGain(): number {
    return this.style.bassIntensity * (0.24 + this.timbre.bass * 0.92);
  }

  private scheduleHarmony(): void {
    if (this.harmonyEventId !== null) {
      Tone.Transport.clear(this.harmonyEventId);
    }

    this.chordStep = 0;
    this.harmonyEventId = Tone.Transport.scheduleRepeat((time) => {
      const chord = this.harmony.getChordForStep(this.chordStep);
      const chordVelocity = 0.12 + this.style.padIntensity * 0.18;

      if (this.padSynth && this.style.padIntensity > 0.05 && this.arrangement.padEnabled) {
        this.padSynth.triggerAttackRelease(chord.notes, "2n.", time, chordVelocity);
      }

      if (this.bassSynth && this.style.bassIntensity > 0.05 && this.arrangement.bassEnabled) {
        this.bassSynth.triggerAttackRelease(chord.bassNote, "2n", time, 0.18 + this.style.bassIntensity * 0.24);
      }

      this.chordStep = (this.chordStep + 1) % this.style.progression.length;
    }, "1m");
  }

  private scheduleDrums(): void {
    if (this.drumEventId !== null) {
      Tone.Transport.clear(this.drumEventId);
      this.drumEventId = null;
    }

    this.drumStep = 0;
    if (!this.arrangement.drumsEnabled) {
      return;
    }

    this.drumEventId = Tone.Transport.scheduleRepeat((time) => {
      const step = this.drumStep % 8;
      const game = this.style.synthPreset === "game";

      if (this.kickSynth && (step === 0 || (game && step === 6))) {
        this.kickSynth.triggerAttackRelease("C2", "16n", time, 0.42);
      }

      if (this.snareSynth && (step === 2 || step === 6)) {
        this.snareSynth.triggerAttackRelease("16n", time, 0.2);
      }

      if (this.hatSynth && (game || step % 2 === 0)) {
        this.hatSynth.triggerAttackRelease("32n", time, 0.1);
      }

      this.drumStep = (this.drumStep + 1) % 8;
    }, "8n");
  }

  /** Returns a quantized schedule time. When `alignToMeasure` is true and the
   *  transport is running, snaps to the next measure boundary (full bar) for a
   *  "phrase start" feel. */
  private getQuantizedTime(alignToMeasure = false): number {
    const now = Tone.now();
    if (Tone.Transport.state !== "started") {
      return now + 0.01;
    }

    if (alignToMeasure) {
      // Align to the next full-measure boundary.
      const transport = Tone.Transport as unknown as {
        nextSubdivision?: (sub: string) => number;
      };
      const nextMeasure = transport.nextSubdivision?.("1m");
      if (typeof nextMeasure === "number" && Number.isFinite(nextMeasure)) {
        return Math.max(nextMeasure, now + 0.01);
      }
      // Fallback: four times the basic quantize step.
      const fourBars = Tone.Time("4n").toSeconds() * 4;
      return Math.ceil(now / fourBars + 0.001) * fourBars;
    }

    const transport = Tone.Transport as unknown as {
      nextSubdivision?: (subdivision: string) => number;
    };
    const nextSubdivision = transport.nextSubdivision?.(this.style.quantize);

    if (typeof nextSubdivision === "number" && Number.isFinite(nextSubdivision)) {
      return Math.max(nextSubdivision, now + 0.01);
    }

    const step = Tone.Time(this.style.quantize).toSeconds();
    return Math.ceil((now + 0.01) / step) * step;
  }

  private getExportTimeSeconds(scheduledTime: number): number {
    if (Tone.Transport.state !== "started") {
      return 0;
    }

    return Math.max(0, Tone.Transport.seconds + scheduledTime - Tone.now());
  }

  private disposeAudioGraph(): void {
    this.melodySynth?.dispose();
    this.padSynth?.dispose();
    this.bassSynth?.dispose();
    this.kickSynth?.dispose();
    this.snareSynth?.dispose();
    this.hatSynth?.dispose();
    this.melodyFilter?.dispose();
    this.autoFilter?.dispose();
    this.autoPanner?.dispose();
    this.delay?.dispose();
    this.reverb?.dispose();
    this.melodyGain?.dispose();
    this.padGain?.dispose();
    this.bassGain?.dispose();
    this.drumGain?.dispose();
    this.master?.dispose();

    this.melodySynth = null;
    this.padSynth = null;
    this.bassSynth = null;
    this.kickSynth = null;
    this.snareSynth = null;
    this.hatSynth = null;
    this.melodyFilter = null;
    this.autoFilter = null;
    this.autoPanner = null;
    this.delay = null;
    this.reverb = null;
    this.melodyGain = null;
    this.padGain = null;
    this.bassGain = null;
    this.drumGain = null;
    this.master = null;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
