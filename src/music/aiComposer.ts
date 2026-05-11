import { degreeToMidi, getScale, midiToNoteName, type RootNote } from "./scales";
import type { MotifNote } from "./musicEngine";
import type { GeneratedPlaybackNote } from "./audioEngine";

/** How many original gap "ticks" map to one continuation step. */
const RHYTHM_SCALE = 0.55;

export type Emotion = "calm" | "sad" | "energy" | "cute" | "neutral";

export interface EmotionAnalysis {
  emotion: Emotion;
  styleId: string;
  confidence: number;
  reason: string;
  scores: Record<Emotion, number>;
}

const EMOTION_KEYWORDS: Record<Exclude<Emotion, "neutral">, string[]> = {
  calm: ["夜", "安静", "平静", "梦", "月", "雨", "慢", "calm", "quiet", "night", "dream", "rain", "soft"],
  sad: ["难过", "孤独", "想念", "失落", "哭", "痛", "sad", "lonely", "miss", "blue", "tears", "broken"],
  energy: ["快", "电", "冲", "赛博", "速度", "未来", "code", "cyber", "fast", "neon", "typing", "run"],
  cute: ["可爱", "开心", "糖", "游戏", "星星", "笑", "cute", "happy", "game", "star", "sweet", "fun"],
};

const EMOTION_STYLE: Record<Emotion, string> = {
  calm: "lofi-night",
  sad: "sad-piano",
  energy: "cute-game-bgm",
  cute: "cute-game-bgm",
  neutral: "lofi-night",
};

export function analyzeTextEmotion(text: string): EmotionAnalysis {
  const normalized = text.toLowerCase();
  const scores: Record<Emotion, number> = {
    calm: 0,
    sad: 0,
    energy: 0,
    cute: 0,
    neutral: 0.35,
  };

  for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS) as Array<[Exclude<Emotion, "neutral">, string[]]>) {
    scores[emotion] = keywords.reduce((score, keyword) => {
      return normalized.includes(keyword.toLowerCase()) ? score + 1 : score;
    }, 0);
  }

  const punctuationEnergy = (text.match(/[!！?？]/g) ?? []).length;
  scores.energy += Math.min(2, punctuationEnergy * 0.35);
  scores.cute += Math.min(1.5, (text.match(/[~～✨★☆]/g) ?? []).length * 0.4);
  scores.sad += Math.min(1.5, (text.match(/[。…]/g) ?? []).length * 0.18);

  const ranked = (Object.entries(scores) as Array<[Emotion, number]>).sort((a, b) => b[1] - a[1]);
  const [emotion, score] = ranked[0];
  const confidence = Math.max(0.2, Math.min(0.96, score / Math.max(1.2, score + ranked[1][1])));

  return {
    emotion,
    styleId: EMOTION_STYLE[emotion],
    confidence,
    reason: emotion === "neutral" ? "default texture" : `matched ${emotion} language cues`,
    scores,
  };
}

export function generateMotifContinuation(
  motif: MotifNote[],
  root: RootNote,
  scaleId: string,
): GeneratedPlaybackNote[] {
  if (motif.length < 3) {
    return [];
  }

  const scale = getScale(scaleId);
  const source = motif.slice(-4);
  const degrees = source.map((note) => note.degree);

  // Also capture the rhythm pattern (inter-keystroke gaps) from the source.
  const gaps = source.map((note) => note.elapsedMs).filter((g) => !isNaN(g) && g > 0);

  const intervals = degrees.slice(1).map((degree, index) => degree - degrees[index]);
  const lastDegree = degrees[degrees.length - 1];
  const transformed =
    intervals.length > 0
      ? [...intervals].reverse().map((interval) => clamp(interval, -2, 2))
      : [1, -1, 2];

  let cursor = lastDegree;
  return transformed.slice(0, 4).map((interval, index) => {
    cursor = Math.max(1, cursor + interval);
    const midi = smoothGeneratedMidi(degreeToMidi(root, scale, cursor, 3), source[source.length - 1].midi);

    // Derive delay from the source rhythm pattern when available.
    const gapIndex = index % Math.max(1, gaps.length);
    const rhythmDelay = gaps[gapIndex]
      ? Math.max(0.5, Math.round((gaps[gapIndex] * RHYTHM_SCALE) / 100))
      : 1;
    const delaySteps = index === 0 ? 1 : Math.max(1, rhythmDelay);

    return {
      degree: ((cursor - 1) % scale.intervals.length) + 1,
      midi,
      noteName: midiToNoteName(midi),
      velocity: Math.max(0.28, 0.58 - index * 0.07),
      delaySteps,
      durationSteps: gaps[gapIndex] && gaps[gapIndex] > 300 ? 2 : 1,
      reason:
        gaps[gapIndex] && gaps[gapIndex] > 300
          ? "rhythm-aware (slow gap → long note)"
          : index % 2 === 0
            ? "mirrored motif interval"
            : "scale-neighbor variation",
    };
  });
}

function smoothGeneratedMidi(rawMidi: number, anchorMidi: number): number {
  return [rawMidi - 24, rawMidi - 12, rawMidi, rawMidi + 12, rawMidi + 24].reduce((best, candidate) => {
    return Math.abs(candidate - anchorMidi) < Math.abs(best - anchorMidi) ? candidate : best;
  }, rawMidi);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
