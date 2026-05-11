export type KeyClass = "home" | "letter" | "digit" | "space" | "punctuation" | "control";

export interface KeyDegreeMapping {
  degree: number;
  keyClass: KeyClass;
  label: string;
  velocityBias: number;
}

export interface DirectPianoMapping {
  midi: number;
  degree: number;
  label: string;
  velocityBias: number;
}

const NUMBER_PIANO_KEYS: Record<string, DirectPianoMapping> = {
  "1": { midi: 48, degree: 1, label: "1=C3", velocityBias: 0.08 },
  "2": { midi: 50, degree: 2, label: "2=D3", velocityBias: 0.05 },
  "3": { midi: 52, degree: 3, label: "3=E3", velocityBias: 0.05 },
  "4": { midi: 53, degree: 4, label: "4=F3", velocityBias: 0.04 },
  "5": { midi: 55, degree: 5, label: "5=G3", velocityBias: 0.08 },
  "6": { midi: 57, degree: 6, label: "6=A3", velocityBias: 0.04 },
  "7": { midi: 59, degree: 7, label: "7=B3", velocityBias: 0.04 },
  "8": { midi: 60, degree: 8, label: "8=C4", velocityBias: 0.08 },
  "9": { midi: 62, degree: 9, label: "9=D4", velocityBias: 0.05 },
  "0": { midi: 64, degree: 10, label: "0=E4", velocityBias: 0.05 },
};

const HOME_ROW_DEGREES: Record<string, number> = {
  a: 1,
  s: 2,
  d: 3,
  f: 4,
  g: 5,
  h: 6,
  j: 7,
  k: 8,
  l: 9,
};

const CONTROL_DEGREES: Record<string, number> = {
  Enter: 1,
  Backspace: 5,
  Tab: 3,
};

const IGNORED_KEYS = new Set([
  "Alt",
  "AltGraph",
  "CapsLock",
  "Control",
  "Escape",
  "Meta",
  "Shift",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
  "Insert",
  "Delete",
]);

export function resolveKeyToDegree(key: string): KeyDegreeMapping | null {
  if (IGNORED_KEYS.has(key)) {
    return null;
  }

  const lower = key.toLowerCase();
  const homeDegree = HOME_ROW_DEGREES[lower];
  if (homeDegree) {
    return {
      degree: homeDegree,
      keyClass: "home",
      label: lower.toUpperCase(),
      velocityBias: 0.08,
    };
  }

  if (key === " ") {
    return {
      degree: 1,
      keyClass: "space",
      label: "Space",
      velocityBias: -0.18,
    };
  }

  const controlDegree = CONTROL_DEGREES[key];
  if (controlDegree) {
    return {
      degree: controlDegree,
      keyClass: "control",
      label: key,
      velocityBias: -0.12,
    };
  }

  if (/^[a-z]$/i.test(key)) {
    const code = lower.charCodeAt(0) - 97;
    return {
      degree: (code % 9) + 1,
      keyClass: "letter",
      label: lower.toUpperCase(),
      velocityBias: 0,
    };
  }

  if (/^\d$/.test(key)) {
    const numeric = Number(key);
    return {
      degree: numeric === 0 ? 5 : numeric,
      keyClass: "digit",
      label: key,
      velocityBias: 0.04,
    };
  }

  if (key.length === 1) {
    return {
      degree: (key.charCodeAt(0) % 7) + 1,
      keyClass: "punctuation",
      label: key,
      velocityBias: -0.08,
    };
  }

  return null;
}

export function resolveNumberKeyToPianoNote(key: string): DirectPianoMapping | null {
  return NUMBER_PIANO_KEYS[key] ?? null;
}
