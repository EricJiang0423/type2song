import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CompositionEvent,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { COPY, type Language } from "./i18n";
import type { ArrangementOptions, AudioEngineRuntime, GeneratedPlaybackEvent } from "../music/audioTypes";
import { analyzeTextEmotion, generateMotifContinuation, type EmotionAnalysis } from "../music/aiComposer";
import {
  KEY_SCALE_OPTIONS,
  degreeToMidi,
  getScale,
  midiToNoteName,
  noteNameWithoutOctave,
  type RootNote,
} from "../music/scales";
import { STYLE_MODES, getStyleMode } from "../music/styles";
import { DEFAULT_TIMBRE_OPTIONS, TIMBRE_CONTROLS, type TimbreControlId, type TimbreOptions } from "../music/timbre";
import {
  RATE_LIMITED,
  type CalculationStep,
  type MotifNote,
  type ResolveKeyResult,
  type ResolvedNoteEvent,
} from "../music/musicEngine";
import { LandingPage } from "./LandingPage";

type Strings = (typeof COPY)[Language];

interface Ripple {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  label: string;
  /** A rate-limited keystroke: a faint, silent breadcrumb instead of a note. */
  ghost?: boolean;
}

interface RollNote {
  id: number;
  pitch: number; // 0..1, 1 = high
  velocity: number;
  color: string;
  ai: boolean;
}

interface SmartOptions {
  autoMood: boolean;
  aiContinuation: boolean;
  bassline: boolean;
  drums: boolean;
}

/** Shape of the parameter snapshot exposed to / accepted from the tuning harness. */
interface T2SParams {
  density: number;
  timbre: TimbreOptions;
  numberPianoMode: boolean;
  smartOptions: SmartOptions;
  styleId: string;
  root: string;
  scaleId: string;
}

type AppStyle = CSSProperties & {
  "--accent": string;
  "--secondary": string;
  "--bg": string;
};

const DEFAULT_STYLE = STYLE_MODES[0];

const HOME_ROW: ReadonlyArray<readonly [string, number]> = [
  ["A", 1],
  ["S", 2],
  ["D", 3],
  ["F", 4],
  ["G", 5],
  ["H", 6],
  ["J", 7],
  ["K", 8],
  ["L", 9],
];

const PIANO_ROW: ReadonlyArray<readonly [string, string]> = [
  ["1", "C3"],
  ["2", "D3"],
  ["3", "E3"],
  ["4", "F3"],
  ["5", "G3"],
  ["6", "A3"],
  ["7", "B3"],
  ["8", "C4"],
  ["9", "D4"],
  ["0", "E4"],
];

const STEP_TONE_COLOR: Record<CalculationStep["tone"], string> = {
  input: "#f2c76e",
  scale: "#9ec6ff",
  harmony: "#f3a2ad",
  rhythm: "#7fd5c6",
  output: "#a8ec7b",
};

type RouteView = "home" | "studio";

export default function App() {
  const [view, setView] = useState<RouteView>(() => getRouteView());

  useEffect(() => {
    const syncRoute = () => setView(getRouteView());
    window.addEventListener("hashchange", syncRoute);
    window.addEventListener("popstate", syncRoute);
    return () => {
      window.removeEventListener("hashchange", syncRoute);
      window.removeEventListener("popstate", syncRoute);
    };
  }, []);

  function openStudio() {
    window.location.hash = "studio";
    setView("studio");
  }

  function openHome() {
    window.history.pushState(null, "", `${window.location.pathname}${window.location.search}`);
    setView("home");
  }

  return view === "studio" ? <StudioApp onBackHome={openHome} /> : <LandingPage onEnter={openStudio} />;
}

function StudioApp({ onBackHome }: { onBackHome: () => void }) {
  const [language, setLanguage] = useState<Language>("zh");
  const [styleId, setStyleId] = useState(DEFAULT_STYLE.id);
  const [root, setRoot] = useState<RootNote>(DEFAULT_STYLE.defaultRoot);
  const [scaleId, setScaleId] = useState(DEFAULT_STYLE.defaultScale);
  const [text, setText] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [numberPianoMode, setNumberPianoMode] = useState(false);
  const [lastNote, setLastNote] = useState<ResolvedNoteEvent | null>(null);
  const [motif, setMotif] = useState<MotifNote[]>([]);
  const [generatedPhrase, setGeneratedPhrase] = useState<GeneratedPlaybackEvent[]>([]);
  const [emotion, setEmotion] = useState<EmotionAnalysis>(() => analyzeTextEmotion(""));
  const [smartOptions, setSmartOptions] = useState<SmartOptions>({
    autoMood: false,
    aiContinuation: true,
    bassline: true,
    drums: false,
  });
  const [timbreOptions, setTimbreOptions] = useState<TimbreOptions>(DEFAULT_STYLE.recommendedTimbre);
  const [density, setDensity] = useState(0.60);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [rollNotes, setRollNotes] = useState<RollNote[]>([]);
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());
  const [pulseId, setPulseId] = useState(0);

  const engineRef = useRef<AudioEngineRuntime | null>(null);
  const pressedKeysRef = useRef<Set<string>>(new Set());
  const lastCompositionDataRef = useRef("");
  const lastCompositionSoundRef = useRef("");
  const visualIdRef = useRef(0);
  const typedNoteCountRef = useRef(0);
  const lastContinuationAtRef = useRef(0);

  const t = COPY[language];
  const styleMode = useMemo(() => getStyleMode(styleId), [styleId]);
  const currentScale = useMemo(() => getScale(scaleId), [scaleId]);
  const appStyle: AppStyle = {
    "--accent": styleMode.accent,
    "--secondary": styleMode.secondary,
    "--bg": styleMode.background,
  };

  useEffect(() => {
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setStyleMode(styleMode);
  }, [styleMode]);

  useEffect(() => {
    engineRef.current?.setKeyScale(root, scaleId);
    setMotif([]);
    setLastNote(null);
    setGeneratedPhrase([]);
  }, [root, scaleId]);

  useEffect(() => {
    const arrangement: ArrangementOptions = {
      bassEnabled: smartOptions.bassline,
      drumsEnabled: smartOptions.drums,
      padEnabled: true,
    };
    engineRef.current?.setArrangementOptions(arrangement);
  }, [smartOptions.bassline, smartOptions.drums]);

  useEffect(() => {
    engineRef.current?.setTimbreOptions(timbreOptions);
  }, [timbreOptions]);

  useEffect(() => {
    engineRef.current?.setDensity(density);
  }, [density]);

  // P2#8: Sync emotion → articulation/brightness bias to the engine.
  useEffect(() => {
    let articulationBias = 0;
    let brightnessBias = 0;
    switch (emotion.emotion) {
      case "calm":
        articulationBias = 0.2;
        brightnessBias = -0.25;
        break;
      case "sad":
        articulationBias = 0.5;
        brightnessBias = -0.15;
        break;
      case "energy":
        articulationBias = -0.3;
        brightnessBias = 0.35;
        break;
      case "cute":
        articulationBias = -0.4;
        brightnessBias = 0.45;
        break;
      // neutral: 0, 0
    }
    engineRef.current?.setEmotionParams(articulationBias, brightnessBias);
  }, [emotion]);

  // ---- Headless tuning harness API ----------------------------------------
  // Exposed on `window` so Playwright (tuning/pipeline.ts) can drive the engine
  // via page.evaluate(). Re-assigned every render so getParams reads fresh state.
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;

    w.__t2s_setParams = (params: Partial<T2SParams>) => {
      if (typeof params.density === "number") setDensity(params.density);
      if (params.timbre) setTimbreOptions((current) => ({ ...current, ...params.timbre }));
      if (typeof params.numberPianoMode === "boolean") setNumberPianoMode(params.numberPianoMode);
      if (params.smartOptions) setSmartOptions((current) => ({ ...current, ...params.smartOptions }));
      // styleId is applied directly (not via applyStyle) so an explicit
      // root/scale/timbre passed alongside it is not clobbered by the preset.
      if (params.styleId) setStyleId(params.styleId);
      if (params.root) setRoot(params.root as RootNote);
      if (params.scaleId) setScaleId(params.scaleId);
    };

    w.__t2s_getParams = (): T2SParams => ({
      density,
      timbre: timbreOptions,
      numberPianoMode,
      smartOptions,
      styleId,
      root,
      scaleId,
    });

    w.__t2s_getState = () => ({ isPlaying, hasEngine: !!engineRef.current });

    w.__t2s_record = (durationMs: number): Promise<string> => {
      const engine = engineRef.current;
      if (!engine) return Promise.reject(new Error("audio engine not started"));
      return engine.captureWav(durationMs);
    };
  });

  async function handleStartAudio() {
    const engine = await getOrCreateEngine();
    await engine.start();
    setIsPlaying(true);
  }

  function handleStopAudio() {
    engineRef.current?.stop();
    pressedKeysRef.current.clear();
    lastCompositionDataRef.current = "";
    lastCompositionSoundRef.current = "";
    setActiveKeys(new Set());
    setIsPlaying(false);
  }

  async function getOrCreateEngine(): Promise<AudioEngineRuntime> {
    if (!engineRef.current) {
      const { AudioEngine: AudioEngineConstructor } = await import("../music/audioEngine");
      engineRef.current = new AudioEngineConstructor(styleMode, root, scaleId);
      engineRef.current.setArrangementOptions({
        bassEnabled: smartOptions.bassline,
        drumsEnabled: smartOptions.drums,
        padEnabled: true,
      });
      engineRef.current.setTimbreOptions(timbreOptions);
      engineRef.current.setDensity(density);
    }

    return engineRef.current;
  }

  function applyStyle(nextStyleId: string) {
    const nextStyle = getStyleMode(nextStyleId);
    setStyleId(nextStyle.id);
    setRoot(nextStyle.defaultRoot);
    setScaleId(nextStyle.defaultScale);
    setTimbreOptions(nextStyle.recommendedTimbre);
  }

  function handleStyleChange(nextStyleId: string) {
    applyStyle(nextStyleId);
  }

  function handleKeyScaleChange(value: string) {
    const [nextRoot, nextScaleId] = value.split(":");
    setRoot(nextRoot as RootNote);
    setScaleId(nextScaleId);
  }

  function handleTextChange(value: string) {
    setText(value);
    const analysis = analyzeTextEmotion(value);
    setEmotion(analysis);

    if (smartOptions.autoMood && value.trim().length >= 8 && analysis.confidence > 0.48 && analysis.styleId !== styleId) {
      applyStyle(analysis.styleId);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!isPlaying || event.repeat || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    const nativeEvent = event.nativeEvent as KeyboardEvent<HTMLTextAreaElement>["nativeEvent"] & {
      isComposing?: boolean;
    };
    if (nativeEvent.isComposing) {
      const composingKey = getPlayableComposingKey(event.key);
      if (!composingKey) {
        return;
      }

      playKeyResult(engineRef.current?.triggerKey(composingKey, event.timeStamp, { numberPianoMode }), composingKey);
      return;
    }

    pressedKeysRef.current.add(event.key);
    const heldKeys = Array.from(pressedKeysRef.current);
    if (heldKeys.length > 1) {
      commitNoteEvents(engineRef.current?.triggerChord(heldKeys, event.timeStamp, { numberPianoMode }) ?? [], heldKeys);
    } else {
      playKeyResult(engineRef.current?.triggerKey(event.key, event.timeStamp, { numberPianoMode }), event.key);
    }
  }

  function handleKeyUp(event: KeyboardEvent<HTMLTextAreaElement>) {
    pressedKeysRef.current.delete(event.key);
  }

  function handleCompositionUpdate(event: CompositionEvent<HTMLTextAreaElement>) {
    if (!isPlaying) {
      return;
    }

    const char = getLatestComposedCharacter(event.data);
    lastCompositionDataRef.current = event.data;
    if (!char || char === lastCompositionSoundRef.current) {
      return;
    }

    lastCompositionSoundRef.current = char;
    playKeyResult(engineRef.current?.triggerKey(char, event.timeStamp, { numberPianoMode: false }), char);
  }

  function handleCompositionEnd(event: CompositionEvent<HTMLTextAreaElement>) {
    pressedKeysRef.current.clear();
    if (!isPlaying) {
      lastCompositionDataRef.current = "";
      lastCompositionSoundRef.current = "";
      return;
    }

    const char = getLatestComposedCharacter(event.data || lastCompositionDataRef.current);
    if (char && char !== lastCompositionSoundRef.current) {
      playKeyResult(engineRef.current?.triggerKey(char, event.timeStamp, { numberPianoMode: false }), char);
    }

    lastCompositionDataRef.current = "";
    lastCompositionSoundRef.current = "";
  }

  function commitNoteEvents(noteEvents: ResolvedNoteEvent[], sourceKey: string | string[]) {
    if (noteEvents.length === 0) {
      return;
    }

    const newRipples: Ripple[] = [];
    const newRoll: RollNote[] = [];

    for (const noteEvent of noteEvents) {
      typedNoteCountRef.current += 1;
      const chordTone = noteEvent.variant === "direct" || noteEvent.inputMode === "number-piano";
      const color = chordTone ? styleMode.accent : styleMode.secondary;
      newRipples.push(makeRipple(noteEvent.inputDegree, noteEvent.velocity, color, noteNameWithoutOctave(noteEvent.noteName)));
      newRoll.push({ id: nextVisualId(), pitch: pitchToNorm(noteEvent.midi), velocity: noteEvent.velocity, color, ai: false });
    }

    setRipples((current) => [...current, ...newRipples].slice(-18));
    setRollNotes((current) => [...current, ...newRoll].slice(-40));
    flashKeys(sourceKey);
    expireRipples(newRipples.map((r) => r.id), 1150);
    setPulseId((value) => value + 1);

    const noteEvent = noteEvents[noteEvents.length - 1];
    setLastNote(noteEvent);
    setMotif(noteEvent.motif);

    // Only let the AI fill in after a deliberate pause — never on top of a fast
    // run — and not more than once every couple of seconds.
    const now = Date.now();
    if (
      smartOptions.aiContinuation &&
      noteEvent.motif.length >= 4 &&
      noteEvent.elapsedMs > 320 &&
      now - lastContinuationAtRef.current > 2400
    ) {
      lastContinuationAtRef.current = now;
      window.setTimeout(() => triggerContinuation(noteEvent.motif), 110);
    }
  }

  function handleInputBlur() {
    pressedKeysRef.current.clear();
    lastCompositionDataRef.current = "";
    lastCompositionSoundRef.current = "";
  }

  function playKeyResult(result: ResolveKeyResult | undefined, key: string) {
    if (result === RATE_LIMITED) {
      pushGhostRipple();
      return;
    }
    if (result) {
      commitNoteEvents([result], key);
    }
  }

  function pushGhostRipple() {
    const ripple: Ripple = {
      id: nextVisualId(),
      x: clamp(50 + (Math.random() - 0.5) * 64, 8, 92),
      y: clamp(60 + (Math.random() - 0.5) * 28, 18, 82),
      size: 16 + Math.random() * 12,
      color: styleMode.secondary,
      label: "",
      ghost: true,
    };
    setRipples((current) => [...current, ripple].slice(-18));
    expireRipples([ripple.id], 680);
  }

  function triggerContinuation(sourceMotif: MotifNote[]) {
    const generated = generateMotifContinuation(sourceMotif, root, scaleId);
    const played = engineRef.current?.triggerGeneratedNotes(generated) ?? [];
    if (played.length === 0) {
      return;
    }

    setGeneratedPhrase(played);

    const newRipples: Ripple[] = [];
    const newRoll: RollNote[] = [];
    for (const note of played) {
      newRipples.push(makeRipple(note.degree, note.velocity, styleMode.secondary, noteNameWithoutOctave(note.noteName)));
      newRoll.push({ id: nextVisualId(), pitch: pitchToNorm(note.midi), velocity: note.velocity, color: styleMode.secondary, ai: true });
    }
    setRipples((current) => [...current, ...newRipples].slice(-18));
    setRollNotes((current) => [...current, ...newRoll].slice(-40));
    expireRipples(newRipples.map((r) => r.id), 1150);
  }

  function toggleSmartOption(key: keyof SmartOptions) {
    setSmartOptions((current) => ({
      ...current,
      [key]: !current[key],
    }));
  }

  function updateTimbreOption(key: TimbreControlId, value: number) {
    setTimbreOptions((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function nextVisualId(): number {
    visualIdRef.current += 1;
    return visualIdRef.current;
  }

  function makeRipple(degree: number, velocity: number, color: string, label: string): Ripple {
    const degreeIndex = Math.min(10, Math.max(1, Math.round(degree)));
    const slot = (degreeIndex - 1) / 9;
    const jitterX = (Math.random() - 0.5) * 10;
    const jitterY = (Math.random() - 0.5) * 14;
    return {
      id: nextVisualId(),
      x: clamp(10 + slot * 78 + jitterX, 6, 94),
      y: clamp(40 + (1 - velocity) * 26 + jitterY, 14, 78),
      size: 44 + velocity * 52,
      color,
      label,
    };
  }

  function expireRipples(ids: number[], delayMs: number) {
    window.setTimeout(() => {
      setRipples((current) => current.filter((item) => !ids.includes(item.id)));
    }, delayMs);
  }

  function flashKeys(sourceKey: string | string[]) {
    const keys = Array.isArray(sourceKey) ? sourceKey : [sourceKey];
    const normalized = keys.map((key) => key.toLowerCase()).filter((key) => key.length === 1);
    if (normalized.length === 0) {
      return;
    }

    setActiveKeys((current) => {
      const next = new Set(current);
      for (const key of normalized) {
        next.add(key);
      }
      return next;
    });
    window.setTimeout(() => {
      setActiveKeys((current) => {
        const next = new Set(current);
        for (const key of normalized) {
          next.delete(key);
        }
        return next;
      });
    }, 240);
  }

  return (
    <main
      className="relative flex min-h-screen flex-col overflow-y-auto bg-[var(--bg)] text-[var(--ink)] transition-colors duration-500 lg:h-screen lg:overflow-hidden"
      style={appStyle}
    >
      <div className="aura pointer-events-none fixed inset-0 opacity-80" aria-hidden />

      <header className="relative flex shrink-0 flex-wrap items-center justify-between gap-3 border-b divider px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-baseline gap-3">
          <span className="serif text-2xl font-semibold tracking-tight sm:text-3xl">
            <span className="text-[var(--accent)]">✦</span>&nbsp;Type2Song
          </span>
          <span className="hidden truncate text-sm t-dim sm:inline">{t.subtitle}</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn hidden px-3 py-2 text-sm sm:inline-flex" onClick={onBackHome} type="button">
            {t.home}
          </button>
          <div className="seg flex" role="group" aria-label={t.language}>
            <button data-on={language === "zh"} onClick={() => setLanguage("zh")} type="button">
              中文
            </button>
            <button data-on={language === "en"} onClick={() => setLanguage("en")} type="button">
              EN
            </button>
          </div>
          <button className="btn btn-accent flex items-center gap-2 px-4 py-2 text-sm" onClick={handleStartAudio} type="button">
            <span className={`h-1.5 w-1.5 rounded-full bg-[var(--bg)] ${isPlaying ? "animate-pulse" : "opacity-50"}`} />
            {isPlaying ? t.audioRunning : t.startAudio}
          </button>
          <button
            className="btn px-4 py-2 text-sm"
            disabled={!isPlaying}
            onClick={handleStopAudio}
            type="button"
          >
            {t.stopAudio}
          </button>
        </div>
      </header>

      <div className="relative grid min-h-0 flex-1 gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]">
        {/* ------------------------------- STAGE ------------------------------- */}
        <section className="flex min-h-0 flex-col gap-3">
          <PianoRoll notes={rollNotes} label={t.noteTrail} />

          <div className="surface relative flex min-h-[220px] lg:min-h-[170px] flex-1 flex-col overflow-hidden rounded-2xl">
            <div className="paper-lines pointer-events-none absolute inset-0" aria-hidden />

            <div className="pointer-events-none absolute bottom-2 right-4 z-0 select-none text-right" aria-hidden>
              <div className="note-watermark text-[5.5rem] sm:text-[8rem]">
                {lastNote ? noteNameWithoutOctave(lastNote.noteName) : "·"}
              </div>
              {lastNote && (
                <div className="mono -mt-2 text-sm t-faint">
                  {lastNote.noteName} · {lastNote.chordLabel}
                </div>
              )}
            </div>

            <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden" aria-hidden>
              {ripples.map((ripple) => (
                <span key={`ring-${ripple.id}`}>
                  <span
                    className={ripple.ghost ? "ripple ripple-ghost" : "ripple"}
                    style={{
                      left: `${ripple.x}%`,
                      top: `${ripple.y}%`,
                      width: ripple.size,
                      height: ripple.size,
                      color: ripple.color,
                    }}
                  />
                  {!ripple.ghost && (
                    <span
                      className="glyph-rise serif text-lg font-medium"
                      style={{ left: `${ripple.x}%`, top: `${ripple.y}%`, color: ripple.color }}
                    >
                      {ripple.label}
                    </span>
                  )}
                </span>
              ))}
            </div>

            {isPlaying && (
              <span className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-full surface-2 px-2.5 py-1 text-[11px] t-dim">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)]" />
                {t.live}
              </span>
            )}

            <textarea
              className="serif relative z-10 h-full min-h-[220px] lg:min-h-[170px] w-full flex-1 resize-none bg-transparent p-5 text-2xl leading-relaxed caret-[var(--accent)] outline-none sm:p-8 sm:text-3xl"
              onBlur={handleInputBlur}
              onChange={(event) => handleTextChange(event.target.value)}
              onCompositionEnd={handleCompositionEnd}
              onCompositionUpdate={handleCompositionUpdate}
              onKeyDown={handleKeyDown}
              onKeyUp={handleKeyUp}
              placeholder={isPlaying ? t.typeReady : t.typeLocked}
              spellCheck={false}
              value={text}
            />

            <div className="faint-fill relative z-10 h-1 w-full">
              <div className="vel-bar h-full" style={{ width: `${Math.round((lastNote?.velocity ?? 0) * 100)}%` }} />
            </div>
          </div>

          <KeyboardStrip
            numberPianoMode={numberPianoMode}
            activeKeys={activeKeys}
            root={root}
            scaleId={scaleId}
            t={t}
          />

          <SignalChain lastNote={lastNote} pulseId={pulseId} t={t} />
        </section>

        {/* ------------------------------ CONSOLE ------------------------------ */}
        <aside className="thin-scroll flex min-h-0 flex-col gap-5 overflow-y-auto pr-1 lg:pb-2">
          {/* SOUND & KEY ---------------------------------------------------- */}
          <section className="flex flex-col gap-3">
            <SectionTitle>{t.sectionSound}</SectionTitle>

            <div>
              <p className="label-cap mb-1.5">{t.styleMode}</p>
              <div className="flex flex-col gap-1.5">
                {STYLE_MODES.map((mode) => (
                  <button
                    key={mode.id}
                    className="mood-card"
                    data-on={mode.id === styleId}
                    onClick={() => handleStyleChange(mode.id)}
                    type="button"
                  >
                    <span
                      className="mood-swatch"
                      style={{ background: `linear-gradient(160deg, ${mode.accent}, ${mode.secondary})` }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{mode.label}</span>
                      <span className="mono block text-[11px] t-faint">
                        {mode.bpm} BPM · {getScale(mode.defaultScale).label}
                      </span>
                    </span>
                    {mode.id === styleId && <span className="mono text-[10px] text-[var(--accent)]">●</span>}
                  </button>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="label-cap mb-1.5 block">{t.keyScale}</span>
              <select
                className="field-select h-10 w-full px-3 text-sm"
                onChange={(event) => handleKeyScaleChange(event.target.value)}
                value={`${root}:${scaleId}`}
              >
                {KEY_SCALE_OPTIONS.map((option) => (
                  <option key={`${option.root}:${option.scaleId}`} value={`${option.root}:${option.scaleId}`}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <p className="label-cap">{t.timbre}</p>
                <div className="flex gap-1.5">
                  <button
                    className="btn px-2 py-0.5 text-[11px]"
                    onClick={() => setTimbreOptions(styleMode.recommendedTimbre)}
                    type="button"
                    title={styleMode.label}
                  >
                    {t.recommendTimbre}
                  </button>
                  <button
                    className="btn px-2 py-0.5 text-[11px] t-dim"
                    onClick={() => setTimbreOptions(DEFAULT_TIMBRE_OPTIONS)}
                    type="button"
                  >
                    {t.resetTimbre}
                  </button>
                </div>
              </div>
              <div className="surface grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-xl p-3">
                {TIMBRE_CONTROLS.map((control) => (
                  <Fader
                    key={control.id}
                    label={t[control.id]}
                    max={control.max}
                    min={control.min}
                    onChange={(value) => updateTimbreOption(control.id, value)}
                    step={control.step}
                    value={timbreOptions[control.id]}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* HOW YOU PLAY -------------------------------------------------- */}
          <section className="flex flex-col gap-3 border-t divider pt-4">
            <SectionTitle>{t.sectionPlay}</SectionTitle>

            <button
              className="chip flex items-center justify-between gap-3 px-3 py-2.5 text-left"
              data-on={numberPianoMode}
              onClick={() => setNumberPianoMode((current) => !current)}
              type="button"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium">{t.numberPiano}</span>
                <span className="mono block text-[11px] t-faint">
                  {numberPianoMode ? "1=C3 … 0=E4" : t.homeRowMap}
                </span>
              </span>
              <span className={`mono text-[11px] ${numberPianoMode ? "text-[var(--accent)]" : "t-faint"}`}>
                {numberPianoMode ? "ON" : "OFF"}
              </span>
            </button>

            <div className="surface rounded-xl p-3">
              <Fader label={t.density} min={0} max={1} step={0.01} value={density} onChange={setDensity} />
              <p className="mt-1 text-[11px] leading-snug t-faint">{t.densityHint}</p>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="label-cap">{t.smartLayer}</p>
                <span className="mono rounded surface px-2 py-0.5 text-[11px] t-dim">
                  {emotion.emotion} {Math.round(emotion.confidence * 100)}%
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <ToggleChip label={t.autoMood} on={smartOptions.autoMood} onClick={() => toggleSmartOption("autoMood")} />
                <ToggleChip label={t.aiContinuation} on={smartOptions.aiContinuation} onClick={() => toggleSmartOption("aiContinuation")} />
                <ToggleChip label={t.bassline} on={smartOptions.bassline} onClick={() => toggleSmartOption("bassline")} />
                <ToggleChip label={t.drums} on={smartOptions.drums} onClick={() => toggleSmartOption("drums")} />
              </div>
            </div>
          </section>

          {/* LIVE READOUT -------------------------------------------------- */}
          <section className="flex flex-col gap-3 border-t divider pt-4">
            <SectionTitle>{t.sectionReadout}</SectionTitle>

            <div className="surface rounded-xl p-3">
              <p className="label-cap mb-2">{t.calculation}</p>
              {lastNote ? (
                <ol className="flex flex-col gap-1.5">
                  {lastNote.calculation.map((step) => (
                    <li key={step.id} className="flex gap-2.5">
                      <span
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: STEP_TONE_COLOR[step.tone] }}
                      />
                      <span className="min-w-0">
                        <span className="text-[13px]">
                          <span className="t-dim">{step.label}</span>
                          <span className="mono"> · {step.value}</span>
                        </span>
                        <span className="block text-[11px] leading-snug t-faint">{step.detail}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm t-faint">{t.silence}</p>
              )}
            </div>

            <DegreeMap lastNote={lastNote} numberPianoMode={numberPianoMode} t={t} />

            <div className="surface rounded-xl p-3">
              <p className="label-cap mb-2">{t.recentMotif}</p>
              <NoteChips notes={motif} empty={t.noData} />
            </div>

            <div className="surface rounded-xl p-3">
              <p className="label-cap mb-2">{t.generatedPhrase}</p>
              <div className="flex min-h-9 flex-wrap content-start gap-1.5">
                {generatedPhrase.length === 0 ? (
                  <span className="text-sm t-faint">{t.noData}</span>
                ) : (
                  generatedPhrase.map((note, index) => (
                    <span
                      key={`${note.noteName}-${note.exportTimeSeconds}-${index}`}
                      className="mono rounded-md border px-2 py-1 text-[13px]"
                      style={{
                        borderColor: "color-mix(in srgb, var(--secondary) 45%, transparent)",
                        background: "color-mix(in srgb, var(--secondary) 12%, transparent)",
                      }}
                      title={note.reason}
                    >
                      {note.noteName}
                    </span>
                  ))
                )}
              </div>
            </div>
          </section>

          {/* SESSION STATS ------------------------------------------------- */}
          <section className="flex flex-col gap-3 border-t divider pt-4">
            <SectionTitle>{t.session}</SectionTitle>
            <div className="grid grid-cols-4 gap-2">
              <Stat label={t.chars} value={`${text.length}`} />
              <Stat label={t.notes} value={`${typedNoteCountRef.current}`} />
              <Stat label={t.root} value={root} />
              <Stat label={t.scale} value={currentScale.label.replace(" Pentatonic", " Penta")} />
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}

/* ============================ visual components ============================ */

function PianoRoll({ notes, label }: { notes: RollNote[]; label: string }) {
  return (
    <div className="surface relative h-14 shrink-0 overflow-hidden rounded-xl px-3 sm:h-20">
      <span className="label-cap pointer-events-none absolute left-3 top-1.5 text-[10px]">{label}</span>
      {[0.22, 0.5, 0.78].map((line) => (
        <span
          key={line}
          className="faint-fill pointer-events-none absolute left-0 right-0 h-px"
          style={{ top: `${line * 100}%` }}
          aria-hidden
        />
      ))}
      <div className="roll-track flex h-full items-stretch justify-end gap-[3px] py-3 sm:gap-1">
        {notes.map((note) => (
          <span key={note.id} className="relative h-full w-1.5 sm:w-2">
            <span
              className="roll-note"
              style={{
                top: `${6 + (1 - note.pitch) * 88}%`,
                marginTop: "-3px",
                background: note.color,
                opacity: 0.35 + note.velocity * 0.6,
                boxShadow: note.ai ? `0 0 8px ${note.color}` : "none",
              }}
            />
          </span>
        ))}
      </div>
    </div>
  );
}

function KeyboardStrip({
  numberPianoMode,
  activeKeys,
  root,
  scaleId,
  t,
}: {
  numberPianoMode: boolean;
  activeKeys: Set<string>;
  root: RootNote;
  scaleId: string;
  t: Strings;
}) {
  const scale = getScale(scaleId);
  const cells: Array<{ cap: string; sub: string; matchKey: string }> = numberPianoMode
    ? PIANO_ROW.map(([cap, note]) => ({ cap, sub: note, matchKey: cap }))
    : HOME_ROW.map(([cap, degree]) => ({
        cap,
        sub: midiToNoteName(degreeToMidi(root, scale, degree, 3)),
        matchKey: cap.toLowerCase(),
      }));

  return (
    <div className="surface shrink-0 overflow-x-auto rounded-xl p-2 thin-scroll">
      <div className="mb-1 flex items-center justify-between px-1">
        <span className="label-cap text-[10px]">{numberPianoMode ? t.numberPiano : t.homeRowMap}</span>
        <span className="mono text-[10px] t-faint">{numberPianoMode ? "fixed pitches" : `${root} ${scale.label}`}</span>
      </div>
      <div
        className="grid gap-1"
        style={{
          gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))`,
          minWidth: `${cells.length * 30}px`,
        }}
      >
        {cells.map((cell) => (
          <div key={cell.cap} className="kb-key" data-active={activeKeys.has(cell.matchKey)}>
            <span className="kb-cap">{cell.cap}</span>
            <span className="kb-sub">{cell.sub}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SignalChain({ lastNote, pulseId, t }: { lastNote: ResolvedNoteEvent | null; pulseId: number; t: Strings }) {
  const dash = t.noData;
  const degreeText = lastNote
    ? lastNote.inputMode === "number-piano"
      ? `${lastNote.inputDegree}`
      : `${lastNote.inputDegree} → ${lastNote.harmonicDegree}`
    : dash;
  const nodes: Array<{ label: string; value: string }> = [
    { label: t.keyLabel, value: lastNote ? lastNote.keyLabel : dash },
    { label: t.degree, value: degreeText },
    { label: t.chord, value: lastNote ? lastNote.chordLabel : dash },
    { label: t.rhythm, value: lastNote ? `${lastNote.quantize} · ${Math.round(lastNote.elapsedMs)}ms` : dash },
    { label: t.note, value: lastNote ? `${lastNote.noteName} · v${lastNote.velocity.toFixed(2)}` : dash },
  ];

  return (
    <div className="surface relative shrink-0 overflow-hidden rounded-xl px-3 py-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="label-cap">{t.signalChain}</span>
        <span className="hidden text-[11px] t-faint sm:inline">{t.chainHint}</span>
      </div>
      <div className="flex items-stretch gap-1 overflow-x-auto thin-scroll">
        {nodes.map((node, index) => (
          <div key={node.label} className="flex flex-1 items-center gap-1">
            <div className="surface-2 min-w-0 flex-1 rounded-lg px-2.5 py-1.5">
              <div className="label-cap text-[9px]">{node.label}</div>
              <div className="mono truncate text-[13px]" title={node.value}>
                {node.value}
              </div>
            </div>
            {index < nodes.length - 1 && <span className="t-faint shrink-0 text-xs">→</span>}
          </div>
        ))}
      </div>
      {pulseId > 0 && <span key={pulseId} className="chain-pulse" aria-hidden />}
    </div>
  );
}

function DegreeMap({
  lastNote,
  numberPianoMode,
  t,
}: {
  lastNote: ResolvedNoteEvent | null;
  numberPianoMode: boolean;
  t: Strings;
}) {
  const cellCount = lastNote?.inputMode === "number-piano" || numberPianoMode ? 10 : 9;

  return (
    <div className="surface rounded-xl p-3">
      <p className="label-cap mb-2">{t.degree}</p>
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${cellCount}, minmax(0, 1fr))` }}>
        {Array.from({ length: cellCount }, (_, index) => {
          const degree = index + 1;
          return (
            <div
              key={degree}
              className="deg-cell"
              data-in={lastNote?.inputDegree === degree}
              data-harm={lastNote?.harmonicDegree === degree}
              data-out={lastNote?.degree === degree}
              title={`degree ${degree}`}
            >
              {degree}
            </div>
          );
        })}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <Stat label={t.input} value={lastNote ? `${lastNote.inputDegree}` : t.noData} />
        <Stat label={t.harmony} value={lastNote ? `${lastNote.harmonicDegree}` : t.noData} />
        <Stat label={t.output} value={lastNote ? lastNote.noteName : t.noData} />
      </div>
    </div>
  );
}

/* ============================ small components ============================ */

function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="label-cap text-[var(--accent)]">{children}</h2>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-2 min-w-0 rounded-md px-2 py-1.5">
      <p className="truncate text-[9px] uppercase tracking-[0.16em] t-faint">{label}</p>
      <p className="mono mt-0.5 truncate text-[13px]">{value}</p>
    </div>
  );
}

function ToggleChip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button className="chip px-2.5 py-2 text-left text-[13px]" data-on={on} onClick={onClick} type="button">
      <span className={`mono mr-1.5 text-[10px] ${on ? "text-[var(--accent)]" : "t-faint"}`}>{on ? "ON" : "OFF"}</span>
      {label}
    </button>
  );
}

function Fader({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <div className="mb-0.5 flex items-baseline justify-between gap-2">
        <span className="truncate text-[12px] t-dim">{label}</span>
        <span className="mono text-[10px] t-faint">{Math.round(value * 100)}</span>
      </div>
      <input
        className="fader"
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type="range"
        value={value}
      />
    </label>
  );
}

function NoteChips({ notes, empty }: { notes: MotifNote[]; empty: string }) {
  return (
    <div className="flex min-h-9 flex-wrap content-start gap-1.5">
      {notes.length === 0 ? (
        <span className="text-sm t-faint">{empty}</span>
      ) : (
        notes.map((note, index) => (
          <span
            key={`${note.noteName}-${note.midi}-${index}`}
            className="mono rounded-md border px-2 py-1 text-[13px]"
            style={
              note.variant === "direct"
                ? {
                    borderColor: "color-mix(in srgb, var(--ink) 14%, transparent)",
                    background: "color-mix(in srgb, var(--ink) 5%, transparent)",
                  }
                : {
                    borderColor: "color-mix(in srgb, var(--secondary) 45%, transparent)",
                    background: "color-mix(in srgb, var(--secondary) 12%, transparent)",
                  }
            }
            title={note.variant}
          >
            {note.noteName}
          </span>
        ))
      )}
    </div>
  );
}

/* ============================ pure helpers ============================ */

function getRouteView(): RouteView {
  return window.location.hash === "#studio" ? "studio" : "home";
}

function pitchToNorm(midi: number): number {
  return clamp((midi - 36) / 48, 0, 1);
}

function getPlayableComposingKey(key: string): string | null {
  if (/^[a-z0-9]$/i.test(key)) {
    return key;
  }

  const char = getLatestComposedCharacter(key);
  return char ?? null;
}

function getLatestComposedCharacter(data: string): string | null {
  const chars = Array.from(data).filter(isComposedLanguageCharacter);
  return chars.length > 0 ? chars[chars.length - 1] : null;
}

function isComposedLanguageCharacter(char: string): boolean {
  const codePoint = char.codePointAt(0);
  if (codePoint === undefined) {
    return false;
  }

  return (
    (codePoint >= 0x3400 && codePoint <= 0x9fff) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0x3040 && codePoint <= 0x30ff) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7af)
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
