import type { SynthPreset } from "./styles";
import { DEFAULT_TIMBRE_OPTIONS, type TimbreOptions } from "./timbre";

export type CapturedNoteSource = "typed" | "ai";

export interface CapturedNote {
  noteName: string;
  midi: number;
  degree: number;
  velocity: number;
  timeSeconds: number;
  durationSeconds: number;
  source: CapturedNoteSource;
  chordLabel: string;
  variant: string;
  keyLabel?: string;
}

export interface ExportSession {
  title: string;
  text: string;
  styleId: string;
  styleLabel: string;
  root: string;
  scaleLabel: string;
  bpm: number;
  synthPreset: SynthPreset;
  timbre: TimbreOptions;
  createdAt: string;
  notes: CapturedNote[];
}

const MIDI_TICKS_PER_QUARTER = 480;

export function createJsonBlob(session: ExportSession): Blob {
  return new Blob([JSON.stringify(session, null, 2)], { type: "application/json" });
}

export function createMidiBlob(session: ExportSession): Blob {
  const events: Array<{ tick: number; data: number[]; order: number }> = [
    { tick: 0, order: 0, data: [0xff, 0x03, ...withLength(asciiBytes(session.title))] },
    { tick: 0, order: 1, data: [0xff, 0x51, 0x03, ...tempoBytes(session.bpm)] },
    { tick: 0, order: 2, data: [0xff, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08] },
  ];

  for (const note of session.notes) {
    const startTick = secondsToTicks(note.timeSeconds, session.bpm);
    const durationTicks = Math.max(MIDI_TICKS_PER_QUARTER / 4, secondsToTicks(note.durationSeconds, session.bpm));
    const channel = note.source === "ai" ? 1 : 0;
    const velocity = Math.max(20, Math.min(118, Math.round(note.velocity * 127)));

    events.push({ tick: startTick, order: 10, data: [0x90 + channel, note.midi, velocity] });
    events.push({ tick: startTick + durationTicks, order: 9, data: [0x80 + channel, note.midi, 0] });
  }

  events.sort((a, b) => a.tick - b.tick || a.order - b.order);

  let previousTick = 0;
  const trackBytes: number[] = [];
  for (const event of events) {
    trackBytes.push(...writeVariableLength(event.tick - previousTick), ...event.data);
    previousTick = event.tick;
  }
  trackBytes.push(0x00, 0xff, 0x2f, 0x00);

  const bytes = [
    ...asciiBytes("MThd"),
    ...u32(6),
    ...u16(0),
    ...u16(1),
    ...u16(MIDI_TICKS_PER_QUARTER),
    ...asciiBytes("MTrk"),
    ...u32(trackBytes.length),
    ...trackBytes,
  ];

  return new Blob([new Uint8Array(bytes)], { type: "audio/midi" });
}

export function createWavBlob(session: ExportSession): Blob {
  const sampleRate = 44100;
  const maxEnd = Math.max(1, ...session.notes.map((note) => note.timeSeconds + note.durationSeconds + 0.8));
  const durationSeconds = Math.min(180, maxEnd);
  const samples = new Float32Array(Math.ceil(durationSeconds * sampleRate));
  const timbre = session.timbre ?? DEFAULT_TIMBRE_OPTIONS;

  for (const note of session.notes) {
    renderNote(samples, sampleRate, note, session.synthPreset, timbre);
  }

  let peak = 0.001;
  for (const sample of samples) {
    peak = Math.max(peak, Math.abs(sample));
  }
  const gain = Math.min(1, 0.92 / peak);
  const pcm = new Int16Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) {
    pcm[index] = Math.max(-32767, Math.min(32767, Math.round(samples[index] * gain * 32767)));
  }

  const header = createWavHeader(pcm.length, sampleRate);
  const pcmBuffer = new ArrayBuffer(pcm.byteLength);
  new Int16Array(pcmBuffer).set(pcm);
  return new Blob([header, pcmBuffer], { type: "audio/wav" });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function renderNote(
  samples: Float32Array,
  sampleRate: number,
  note: CapturedNote,
  preset: SynthPreset,
  timbre: TimbreOptions,
): void {
  const start = Math.max(0, Math.floor(note.timeSeconds * sampleRate));
  const releaseTail = 0.18 + timbre.release * 0.55;
  const end = Math.min(samples.length, Math.ceil((note.timeSeconds + note.durationSeconds + releaseTail) * sampleRate));
  const frequency = 440 * 2 ** ((note.midi - 69) / 12);
  const amplitude = note.velocity * (note.source === "ai" ? 0.18 : 0.28) * (0.86 + timbre.brightness * 0.12);

  for (let index = start; index < end; index += 1) {
    const time = (index - start) / sampleRate;
    const releaseStart = note.durationSeconds;
    const envelope = time < releaseStart
      ? attackDecay(time, preset, timbre)
      : Math.max(0, 1 - (time - releaseStart) / releaseTail) * (0.12 + timbre.warmth * 0.16);
    const phase = 2 * Math.PI * frequency * time;
    const sample = waveform(phase, preset, timbre) * envelope * amplitude;
    const echoIndex = index + Math.floor(sampleRate * (0.12 + timbre.echo * 0.18));

    samples[index] += sample;
    if (echoIndex < samples.length) {
      samples[echoIndex] += sample * (0.04 + timbre.echo * 0.24);
    }
  }
}

function attackDecay(time: number, preset: SynthPreset, timbre: TimbreOptions): number {
  const attack = (preset === "game" ? 0.004 : 0.008) + timbre.attack * (preset === "piano" ? 0.035 : 0.07);
  const decay = (preset === "piano" ? 0.55 : 0.2) + timbre.warmth * 0.35;
  if (time < attack) {
    return time / attack;
  }
  return 0.25 + 0.75 * Math.exp(-(time - attack) / decay);
}

function waveform(phase: number, preset: SynthPreset, timbre: TimbreOptions): number {
  if (preset === "game") {
    return (2 / Math.PI) * Math.asin(Math.sin(phase)) * (0.82 + timbre.brightness * 0.18);
  }

  return (
    Math.sin(phase) * (0.86 + timbre.warmth * 0.1) +
    Math.sin(phase * 2) * (0.04 + timbre.brightness * 0.14) +
    Math.sin(phase * 0.5) * timbre.warmth * 0.035
  );
}

function createWavHeader(sampleCount: number, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + sampleCount * 2, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, sampleCount * 2, true);
  return buffer;
}

function secondsToTicks(seconds: number, bpm: number): number {
  return Math.round((seconds * bpm * MIDI_TICKS_PER_QUARTER) / 60);
}

function tempoBytes(bpm: number): number[] {
  const microsecondsPerQuarter = Math.round(60_000_000 / bpm);
  return [(microsecondsPerQuarter >> 16) & 0xff, (microsecondsPerQuarter >> 8) & 0xff, microsecondsPerQuarter & 0xff];
}

function writeVariableLength(value: number): number[] {
  let buffer = value & 0x7f;
  const bytes = [buffer];
  while ((value >>= 7)) {
    buffer = (value & 0x7f) | 0x80;
    bytes.unshift(buffer);
  }
  return bytes;
}

function withLength(bytes: number[]): number[] {
  return [...writeVariableLength(bytes.length), ...bytes];
}

function asciiBytes(value: string): number[] {
  return Array.from(value).map((char) => char.charCodeAt(0) & 0x7f);
}

function u16(value: number): number[] {
  return [(value >> 8) & 0xff, value & 0xff];
}

function u32(value: number): number[] {
  return [(value >> 24) & 0xff, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}
