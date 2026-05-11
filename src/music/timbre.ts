export interface TimbreOptions {
  brightness: number;
  warmth: number;
  attack: number;
  release: number;
  space: number;
  echo: number;
  pad: number;
  bass: number;
}

export type TimbreControlId = keyof TimbreOptions;

export interface TimbreControl {
  id: TimbreControlId;
  min: number;
  max: number;
  step: number;
}

export const DEFAULT_TIMBRE_OPTIONS: TimbreOptions = {
  brightness: 0.42,
  warmth: 0.58,
  attack: 0.2,
  release: 0.5,
  space: 0.46,
  echo: 0.22,
  pad: 0.45,
  bass: 0.38,
};

export const TIMBRE_CONTROLS: TimbreControl[] = [
  { id: "brightness", min: 0, max: 1, step: 0.01 },
  { id: "warmth", min: 0, max: 1, step: 0.01 },
  { id: "attack", min: 0, max: 1, step: 0.01 },
  { id: "release", min: 0, max: 1, step: 0.01 },
  { id: "space", min: 0, max: 1, step: 0.01 },
  { id: "echo", min: 0, max: 1, step: 0.01 },
  { id: "pad", min: 0, max: 1, step: 0.01 },
  { id: "bass", min: 0, max: 1, step: 0.01 },
];
