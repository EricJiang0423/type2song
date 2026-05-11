import { useState, type CSSProperties } from "react";
import { STYLE_MODES } from "../music/styles";
import type { Language } from "./i18n";

type LandingStyle = CSSProperties & {
  "--accent": string;
  "--secondary": string;
  "--bg": string;
};

const DEFAULT_STYLE = STYLE_MODES[0];

const LANDING_COPY: Record<Language, Record<string, string>> = {
  en: {
    nav: "Design / marketing index",
    eyebrow: "Type2Song",
    headline: "Turn an ordinary text box into a playable instrument.",
    body: "Type2Song translates typing into scale-aware melody, soft harmony, and visible musical reasoning. It is a writing surface, a small performance tool, and a music sketchpad in one browser page.",
    cta: "Enter Studio",
    secondary: "Read the design logic",
    status: "No downloads. Start audio, type, tune the sound.",
    previewTitle: "Live typing becomes music",
    previewText: "A/S/D follow scale degrees. Number Piano plays fixed pitches. Motifs echo, bend, and return.",
    statStyles: "style modes",
    statFaders: "timbre faders",
    statExports: "export formats",
    valueTitle: "Why it feels musical",
    value1Title: "Typing is treated as composition",
    value1Body: "Keys map to scale degrees, then pass through rhythm quantization, smoothing, motif memory, and chord-aware correction.",
    value2Title: "The interface explains the engine",
    value2Body: "The signal chain, degree map, note trail, and motif readout show how each keystroke becomes a musical event.",
    value3Title: "Preset mood, custom tone",
    value3Body: "Lo-fi, piano, and game modes set a direction; brightness, warmth, attack, release, space, echo, pad, and bass sliders let users shape it.",
    designTitle: "Design Notes",
    designBody: "The page keeps the existing studio language: warm dark paper, quiet panels, serif display type, fine-grained readouts, and restrained motion. The index adds marketing copy without becoming a separate brand world.",
  },
  zh: {
    nav: "设计说明 / Marketing 首页",
    eyebrow: "Type2Song",
    headline: "把一个普通输入框，变成可以演奏的网页乐器。",
    body: "Type2Song 会把打字转译成有调性、有和声、有节奏的实时音乐。它既是写作界面，也是演奏工具，还是一个可以快速捕捉旋律想法的浏览器乐器。",
    cta: "进入演奏界面",
    secondary: "查看设计逻辑",
    status: "无需下载。启动音频，开始输入，调整音色。",
    previewTitle: "输入行为实时变成音乐",
    previewText: "A/S/D 对应音阶级数，数字钢琴对应固定音高；motif 会被记录、变奏、回应。",
    statStyles: "风格模式",
    statFaders: "音色滑块",
    statExports: "导出格式",
    valueTitle: "为什么它听起来像音乐",
    value1Title: "把打字当作作曲输入",
    value1Body: "按键先映射到音阶级数，再经过节奏量化、音符平滑、motif 记忆和和弦贴合。",
    value2Title: "界面解释音乐引擎",
    value2Body: "生成链路、级数地图、音符轨迹和 motif 读数，会展示每个按键如何变成音符。",
    value3Title: "预设气质，自定义音色",
    value3Body: "Lo-fi、Piano、Game 模式决定方向；明亮度、温暖度、起音、尾音、空间、回声、Pad、低音负责塑形。",
    designTitle: "设计说明",
    designBody: "首页延续现有演奏页的语言：暖暗纸感、克制面板、衬线标题、细粒度读数和轻量动效。它承担 Marketing，但不另起一套品牌视觉。",
  },
};

export function LandingPage({ onEnter }: { onEnter: () => void }) {
  const [language, setLanguage] = useState<Language>("zh");
  const t = LANDING_COPY[language];
  const appStyle: LandingStyle = {
    "--accent": DEFAULT_STYLE.accent,
    "--secondary": DEFAULT_STYLE.secondary,
    "--bg": DEFAULT_STYLE.background,
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--bg)] text-[var(--ink)]" style={appStyle}>
      <div className="aura pointer-events-none fixed inset-0 opacity-80" aria-hidden />

      <header className="relative mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-5 py-5 sm:px-8">
        <div className="flex min-w-0 items-baseline gap-3">
          <span className="serif text-2xl font-semibold tracking-tight sm:text-3xl">
            <span className="text-[var(--accent)]">✦</span>&nbsp;Type2Song
          </span>
          <span className="hidden truncate text-sm t-dim sm:inline">{t.nav}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="seg flex" role="group" aria-label="Language">
            <button data-on={language === "zh"} onClick={() => setLanguage("zh")} type="button">
              中文
            </button>
            <button data-on={language === "en"} onClick={() => setLanguage("en")} type="button">
              EN
            </button>
          </div>
          <button className="btn btn-accent hidden px-4 py-2 text-sm sm:inline-flex" onClick={onEnter} type="button">
            {t.cta}
          </button>
        </div>
      </header>

      <section className="relative mx-auto grid min-h-[calc(100vh-88px)] w-full max-w-7xl items-center gap-8 px-5 pb-10 pt-3 sm:px-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
        <div className="max-w-3xl">
          <p className="label-cap text-[var(--accent)]">{t.eyebrow}</p>
          <h1 className="serif mt-4 text-5xl font-semibold leading-[0.98] tracking-tight sm:text-7xl">
            {t.headline}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 t-dim sm:text-xl">{t.body}</p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button className="btn btn-accent px-5 py-3 text-base" onClick={onEnter} type="button">
              {t.cta}
            </button>
            <a className="btn px-5 py-3 text-base" href="#design-notes">
              {t.secondary}
            </a>
          </div>
          <p className="mt-4 text-sm t-faint">{t.status}</p>

          <div className="mt-10 grid max-w-2xl grid-cols-3 gap-2">
            <MarketingStat value="3" label={t.statStyles} />
            <MarketingStat value="8" label={t.statFaders} />
            <MarketingStat value="MIDI/WAV/JSON" label={t.statExports} />
          </div>
        </div>

        <div className="surface relative overflow-hidden rounded-3xl p-4 shadow-2xl shadow-black/20">
          <div className="paper-lines pointer-events-none absolute inset-0 opacity-75" aria-hidden />
          <div className="relative z-10 flex min-h-[500px] flex-col justify-between gap-5">
            <div className="flex items-center justify-between">
              <span className="label-cap">{t.previewTitle}</span>
              <span className="mono rounded-full surface-2 px-2.5 py-1 text-[11px] text-[var(--accent)]">live-ready</span>
            </div>

            <div className="serif rounded-2xl surface-2 p-5 text-3xl leading-relaxed sm:text-4xl">
              <span className="t-dim">Type an idea,</span>
              <br />
              <span>hear the shape</span>
              <br />
              <span className="text-[var(--accent)]">underneath.</span>
            </div>

            <div className="grid gap-3">
              <LandingSignal label="Input" value="A / S / D / F" />
              <LandingSignal label="Scale" value="C major pentatonic" />
              <LandingSignal label="Harmony" value="C -> G -> Am -> F" />
              <LandingSignal label="Output" value="C3 · D3 · E3 · G3" strong />
            </div>

            <div className="grid grid-cols-8 gap-1.5">
              {["Bright", "Warm", "Atk", "Rel", "Space", "Echo", "Pad", "Bass"].map((label, index) => (
                <div className="flex h-20 flex-col items-center justify-end gap-1 rounded-lg surface-2 p-1.5" key={label}>
                  <span
                    className="w-1.5 rounded-full bg-[var(--accent)]"
                    style={{ height: `${26 + ((index * 19) % 48)}px` }}
                  />
                  <span className="mono text-[9px] t-faint">{label}</span>
                </div>
              ))}
            </div>

            <p className="text-sm leading-6 t-dim">{t.previewText}</p>
          </div>
        </div>
      </section>

      <section className="relative mx-auto grid w-full max-w-7xl gap-4 px-5 pb-12 sm:px-8 lg:grid-cols-3">
        <h2 className="serif text-3xl font-semibold lg:col-span-3">{t.valueTitle}</h2>
        <MarketingBlock title={t.value1Title} body={t.value1Body} />
        <MarketingBlock title={t.value2Title} body={t.value2Body} />
        <MarketingBlock title={t.value3Title} body={t.value3Body} />
      </section>

      <section id="design-notes" className="relative mx-auto w-full max-w-7xl px-5 pb-16 sm:px-8">
        <div className="surface rounded-3xl p-6 sm:p-8">
          <p className="label-cap text-[var(--accent)]">{t.designTitle}</p>
          <p className="serif mt-4 max-w-4xl text-2xl leading-10 t-dim">{t.designBody}</p>
        </div>
      </section>
    </main>
  );
}

function MarketingStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="surface rounded-2xl px-3 py-3">
      <p className="mono text-lg text-[var(--accent)]">{value}</p>
      <p className="mt-1 text-xs t-faint">{label}</p>
    </div>
  );
}

function LandingSignal({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl surface-2 px-3 py-2">
      <span className="label-cap text-[10px]">{label}</span>
      <span className={`mono truncate text-sm ${strong ? "text-[var(--accent)]" : "t-dim"}`}>{value}</span>
    </div>
  );
}

function MarketingBlock({ title, body }: { title: string; body: string }) {
  return (
    <article className="surface rounded-3xl p-5">
      <h3 className="serif text-2xl font-semibold">{title}</h3>
      <p className="mt-3 text-sm leading-7 t-dim">{body}</p>
    </article>
  );
}
