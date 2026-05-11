import type { ResolveKeyOptions, ResolveKeyResult, ResolvedNoteEvent } from "./musicEngine";
import type { RootNote } from "./scales";
import type { StyleModeConfig } from "./styles";
import type { TimbreOptions } from "./timbre";

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

export interface AudioEngineRuntime {
  start(): Promise<void>;
  stop(): void;
  dispose(): void;
  setStyleMode(style: StyleModeConfig): void;
  setKeyScale(root: RootNote, scaleId: string): void;
  setArrangementOptions(options: ArrangementOptions): void;
  setTimbreOptions(options: TimbreOptions): void;
  setDensity(density: number): void;
  setEmotionParams(articulationBias: number, brightnessBias: number): void;
  triggerKey(key: string, eventTimeMs: number, options?: ResolveKeyOptions): ResolveKeyResult | undefined;
  triggerChord(keys: string[], eventTimeMs: number, options?: ResolveKeyOptions): ResolvedNoteEvent[];
  triggerGeneratedNotes(notes: GeneratedPlaybackNote[]): GeneratedPlaybackEvent[];
  captureWav(durationMs: number): Promise<string>;
}
