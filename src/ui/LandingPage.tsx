import { useState, type CSSProperties } from "react";
import { STYLE_MODES } from "../music/styles";
import type { Language } from "./i18n";

type LandingStyle = CSSProperties & {
  "--accent": string;
  "--secondary": string;
  "--bg": string;
};

const DEFAULT_STYLE = STYLE_MODES[0];

const COPY: Record<Language, {
  nav: string;
  eyebrow: string;
  headline: string;
  body: string;
  cta: string;
  status: string;
  howTitle: string;
  how1: string;
  how2: string;
  how3: string;
  how4: string;
  voicesTitle: string;
  voiceLofiName: string;
  voiceLofiDesc: string;
  voiceEtherealName: string;
  voiceEtherealDesc: string;
  voiceGameName: string;
  voiceGameDesc: string;
  engineTitle: string;
  engineMotif: string;
  engineAI: string;
  engineMood: string;
  engineBand: string;
  seeTitle: string;
  seeChain: string;
  seeRoll: string;
  seeDegree: string;
  seeReadout: string;
  footerCta: string;
  footerHint: string;
}> = {
  en: {
    nav: "Typing-driven web instrument",
    eyebrow: "Type2Song",
    headline: "Every keystroke is a note. Your typing is the score.",
    body: "Type2Song is a browser-based musical instrument disguised as a text box. As you type, each keypress becomes a scale-tuned melody note backed by a real-time chord progression. It listens to your rhythm, remembers your phrases, and fills the silence after you pause — like a second musician who only plays when you stop. No music theory. No MIDI keyboard. No install. Just open the page, start audio, and write.",
    cta: "Enter Studio",
    status: "Works in any modern browser. Audio starts on your first click.",
    howTitle: "What happens when you press a key",
    how1: "Your keypress is mapped to a scale degree — not a fixed pitch. In C major, the A key plays the 6th degree (la); switch to A minor and that same A becomes the 1st (do). The scale does the heavy lifting so every random sentence already sounds like a phrase.",
    how2: "A chord progression runs underneath everything you play — four chords cycling in the background. Each note you type lands inside a harmonic context, so even a single index finger sounds like an improvisation.",
    how3: "Your typing speed controls expression. Type slowly and you get accented, weighty notes. Speed up and the engine switches to an even, flowing texture — dense passages become rhythmic fabric instead of sonic chaos. A built-in rate limiter silently drops the excess, leaving a faint visual trail so you know the system caught it.",
    how4: "The engine remembers your last eight notes — a rolling motif. When it detects a phrase pattern, it echoes it back: repeating the contour, varying the starting point, mirroring the rhythm. You don't have to perform; the music finds the shape in how you already type.",
    voicesTitle: "Three voices, one text box",
    voiceLofiName: "Lo‑fi Night",
    voiceLofiDesc: "Warm, unhurried, tape‑worn. A suspended‑chord progression at 72 bpm with soft sine pads, triangle bass, and just enough tape hiss in the filter to feel like a cassette left playing in the next room. Best with slow to medium typing.",
    voiceEtherealName: "Ethereal Keys",
    voiceEtherealDesc: "Hollow, bell‑like FM tones with a fast hammer attack that decays into a long, breathy tail. Minor‑key progression at 62 bpm with generous reverb. The timbre is percussive but weightless — like striking glass rods in a cathedral. Built for melancholy, pause‑heavy writing.",
    voiceGameName: "Cute Game BGM",
    voiceGameDesc: "Bright, bouncy, pixel‑bright. Triangle‑wave leads at 96 bpm over a major‑pentatonic progression, with optional kick‑snare‑hat drums that lock to the 16th‑note grid. Designed for fast, energetic typing — every burst of keys reads like a level‑clear fanfare.",
    engineTitle: "The engine beneath",
    engineMotif: "Motif memory: The engine tracks your last 8 notes as a rolling phrase. It extracts the pitch contour (up a third, down a step) and rhythm pattern (were you accelerating or pausing?) and uses these to generate echoes — the same melodic shape, transposed or re‑timed. It's why the music feels like it has a memory.",
    engineAI: "AI continuation: After you pause for more than ~300ms, the engine composes a short phrase from your motif and plays it back — mirroring your intervals, adapting to your rhythm. It only fires once every few seconds, so it never interrupts; it fills the silence after your sentences.",
    engineMood: "Auto mood detection: The engine scans what you're writing for emotional cues — words like 「rain」「quiet」「dream」 trigger the lo‑fi mode; 「tears」「lonely」「miss」 shift to ethereal keys; 「fast」「neon」「run」 switch to game energy. Confidence‑gated so false positives are rare.",
    engineBand: "Bassline and drums: A monophonic triangle bass follows the chord roots automatically. Optional drum patterns — kick on the downbeat, snare on the backbeat, pink‑noise hi‑hats — lock to the transport grid. Both can be toggled independently in the Smart Layer panel.",
    seeTitle: "See the music",
    seeChain: "Signal chain strip — five nodes (Key → Degree → Chord → Rhythm → Note) connected by arrows. Each keystroke sends a pulse of light across the chain, showing exactly how your input became a musical event.",
    seeRoll: "Mini piano roll — a horizontal scroll of the last ~40 notes, each a vertical bar positioned by pitch and colored by velocity. AI‑generated notes glow with a soft halo so you can tell what you played from what the engine added.",
    seeDegree: "Degree map — a 9‑cell grid showing which scale degree your last keystroke landed on, alongside the harmonic transformation (e.g. '4 → 2' when the chord context shifted the output). Also shows input mode: home‑row mapping or number piano.",
    seeReadout: "Live readout panel — the current note name and velocity, the active chord label, the recent 8‑note motif as a chip cloud, and the AI‑generated phrase that just played. Real‑time, no interpretation needed.",
    footerCta: "Open the studio and start typing.",
    footerHint: "No sign‑up. No download. Audio starts on click.",
  },
  zh: {
    nav: "打字驱动的网页乐器",
    eyebrow: "Type2Song",
    headline: "每一个按键都是一个音符。你的打字节奏就是乐谱。",
    body: "Type2Song 是一个藏在输入框里的浏览器乐器。你正常打字，每一个按键都会被实时翻译成有调性的旋律音，背后有一整套和弦进行在走。它会感知你的打字节奏、记住你敲出的短句、在你停顿时续写几个音——像一个只在你沉默时出声的第二个乐手。不需要乐理、不需要 MIDI 键盘、不需要安装任何东西。打开网页，点 Start Audio，开始写。",
    cta: "进入演奏界面",
    status: "所有现代浏览器都能运行。音频在你首次点击后启动。",
    howTitle: "按下一个键，发生了什么",
    how1: "你的按键先被映射到当前音阶的级数，而不是固定音高。在 C 大调里按 A 是 6 级音（la）；切到 A 小调，同一个 A 就变成了 1 级音（do）。音阶替你完成了旋律写作中最难的一步——选音。所以随便敲一句话听起来都像一句有意为之的乐句。",
    how2: "一整套和弦进行在你打字的同时循环——四个和弦按小节推进。你敲出的每一个音都落在和声上下文里，哪怕只用一个手指随便敲，也像在即兴。和弦的类型、色彩、转位都由当前风格决定，切换风格就换了整张和声画布。",
    how3: "打字速度直接控制音乐表情。慢敲是重音，每个音都带力度；加快后引擎自动切换为均匀织体——快速连击不会变成音墙，而是变成有节奏感的音符流。内置的限流器默默丢弃超速的按键，留一个很淡的视觉痕迹，告诉你知道它在响应，但你的耳朵不会受罪。",
    how4: "引擎会记住你最近的 8 个音——一个滚动的 motif。当它检测到反复出现的音程模式，就会开始回应：重复同一句旋律线、把轮廓换一个起始位置再说一遍、或者用你的节奏模式换一组音。它不是随机选音——它是在呼应你刚刚弹过的句子。你不需要刻意「演奏」，正常打字就够了。",
    voicesTitle: "三种声音，一个输入框",
    voiceLofiName: "Lo‑fi Night",
    voiceLofiDesc: "温暖、不急不躁、带一点磁带磨损感。72 bpm 的悬浮和弦进行，Sine pad + 三角波贝斯，滤波器故意留了一点「没刮干净的底噪」，听起来像隔壁房间放着的旧录音机。最适合慢到中等速度的打字节奏。",
    voiceEtherealName: "Ethereal Keys",
    voiceEtherealDesc: "空洞的、钟鸣般的 FM 音色——快速的琴槌起音后是一段绵长的、带呼吸感的尾音。62 bpm 小调进行，大混响。听起来不像钢琴，更像在空旷空间里敲击玻璃棒，每一次停顿都是乐句的一部分。适合停顿很多、带点忧郁气质的写作。",
    voiceGameName: "Cute Game BGM",
    voiceGameDesc: "明亮、弹跳、像素感。96 bpm 大三和弦进行的三角波主音，可以叠加底鼓·军鼓·镲片，全部锁在 16 分音符网格上。快打时每一串字符都像关卡通关的庆祝音效。活泼但不刺耳——过滤器和混响帮忙收住了高频。",
    engineTitle: "引擎底下",
    engineMotif: "Motif 记忆：引擎持续跟踪你最近的 8 个音，把它当作当前动机。它会提取音程走向（上一个音是往上还是往下？差了几个级数？）和节奏特征（你是在匀速敲、在加速、还是停了一下？），然后基于这些信息生成回声——同一条旋律线换调再奏、同一个音程轮廓换节奏再说。这就是为什么你敲了 30 秒后，音乐开始有一种「记忆感」。",
    engineAI: "AI 续写：当你的打字停顿超过约 300 毫秒，引擎会基于你最近的 motif 续写一小段旋律（通常 4 个音），沿用你的音程和节奏逻辑。它最少间隔 2 秒才触发一次，不会抢话；它填充的是你停下来之后的沉默。点一下开关就能关掉。",
    engineMood: "自动情绪识别：引擎会分析你正在输入的文字——「夜」「安静」「雨」「梦」触发 Lo‑fi 模式；「难过」「孤独」「想念」切到 Ethereal Keys；「快」「电」「run」「cyber」切到 Cute Game BGM。带置信度门槛，不会因为一个词就跳风格。不想用的话关掉 Auto Mood 就行。",
    engineBand: "贝斯和鼓：三角波单音贝斯自动跟随和弦根音走。可选的鼓组——底鼓在强拍、军鼓在反拍、粉噪镲片锁在节奏网格上——给 lo‑fi 律动加一层骨架。贝斯和鼓都可以在 Smart Layer 面板里独立开关。",
    seeTitle: "看见音乐",
    seeChain: "信号链路条：五个节点（按键 → 级数 → 和弦 → 节奏 → 音符）用箭头串起来，每次按键一道光扫过——一眼看懂「打字怎么变成了音乐」。每个节点都有当前值，悬停还有细节。",
    seeRoll: "迷你钢琴卷帘：水平滚动显示最近约 40 个音，每个音是一条竖线——高度对音高、不透明度对力度、颜色区分是你弹的还是 AI 生成。AI 生成的音带一层柔光，能一眼分辨。",
    seeDegree: "级数地图：一个 9 格网格，点亮你上一个按键落在哪个音阶级数，同时标出和声变换（比如「4 → 2」表示和弦上下文把输出移动了）。还会显示当前输入模式——默认的 home row 映射还是数字钢琴。",
    seeReadout: "实时读数面板：当前音符名和力度、当前和弦标签、最近 8 音 motif 的信息条、刚演奏的 AI 续写短句。全都实时更新，不用任何乐理就能看懂。",
    footerCta: "打开演奏界面，开始打字。",
    footerHint: "无需注册。无需下载。点击即启动音频。",
  },
};

const VOICE_COLORS: Record<string, string> = {
  "lofi-night": "#f2c76e",
  "ethereal-keys": "#b7c8ff",
  "cute-game-bgm": "#a8ec7b",
};

export function LandingPage({ onEnter }: { onEnter: () => void }) {
  const [language, setLanguage] = useState<Language>("zh");
  const t = COPY[language];
  const appStyle: LandingStyle = {
    "--accent": DEFAULT_STYLE.accent,
    "--secondary": DEFAULT_STYLE.secondary,
    "--bg": DEFAULT_STYLE.background,
  };

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[var(--bg)] text-[var(--ink)]" style={appStyle}>
      <div className="aura pointer-events-none fixed inset-0 opacity-80" aria-hidden />

      {/* ── header ─────────────────────────────────────────────── */}
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-5 py-5 sm:px-8">
        <div className="flex min-w-0 items-baseline gap-3">
          <span className="serif text-2xl font-semibold tracking-tight sm:text-3xl">
            <span className="text-[var(--accent)]">✦</span>&nbsp;Type2Song
          </span>
          <span className="hidden truncate text-sm t-dim sm:inline">{t.nav}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="seg flex" role="group" aria-label="Language">
            <button data-on={language === "zh"} onClick={() => setLanguage("zh")} type="button">中文</button>
            <button data-on={language === "en"} onClick={() => setLanguage("en")} type="button">EN</button>
          </div>
          <button className="btn btn-accent px-4 py-2 text-sm" onClick={onEnter} type="button">{t.cta}</button>
        </div>
      </header>

      {/* ── hero ───────────────────────────────────────────────── */}
      <section className="relative mx-auto w-full max-w-6xl px-5 pb-24 pt-16 sm:px-8 sm:pt-28">
        <p className="label-cap text-[var(--accent)] tracking-[0.2em]">{t.eyebrow}</p>
        <h1 className="serif mt-6 max-w-4xl text-5xl font-semibold leading-[1.04] tracking-tight sm:text-7xl sm:leading-[1.02]">
          {t.headline}
        </h1>
        <p className="mt-8 max-w-3xl text-lg leading-8 t-dim sm:text-xl sm:leading-9">
          {t.body}
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <button className="btn btn-accent px-6 py-3.5 text-base" onClick={onEnter} type="button">
            {t.cta}
          </button>
          <span className="text-sm t-faint">{t.status}</span>
        </div>
      </section>

      {/* ── how it works ───────────────────────────────────────── */}
      <section className="relative mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8">
        <div className="border-t divider pt-16" />
        <h2 className="serif text-3xl font-semibold tracking-tight sm:text-4xl">{t.howTitle}</h2>
        <div className="mt-10 grid gap-10 sm:grid-cols-2">
          <HowBlock body={t.how1} />
          <HowBlock body={t.how2} />
          <HowBlock body={t.how3} />
          <HowBlock body={t.how4} />
        </div>
      </section>

      {/* ── three voices ───────────────────────────────────────── */}
      <section className="relative mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8">
        <div className="border-t divider pt-16" />
        <h2 className="serif text-3xl font-semibold tracking-tight sm:text-4xl">{t.voicesTitle}</h2>
        <div className="mt-10 grid gap-10 sm:grid-cols-3">
          <VoiceBlock
            name={t.voiceLofiName}
            desc={t.voiceLofiDesc}
            accent={VOICE_COLORS["lofi-night"]}
          />
          <VoiceBlock
            name={t.voiceEtherealName}
            desc={t.voiceEtherealDesc}
            accent={VOICE_COLORS["ethereal-keys"]}
          />
          <VoiceBlock
            name={t.voiceGameName}
            desc={t.voiceGameDesc}
            accent={VOICE_COLORS["cute-game-bgm"]}
          />
        </div>
      </section>

      {/* ── engine ─────────────────────────────────────────────── */}
      <section className="relative mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8">
        <div className="border-t divider pt-16" />
        <h2 className="serif text-3xl font-semibold tracking-tight sm:text-4xl">{t.engineTitle}</h2>
        <div className="mt-10 grid gap-10 sm:grid-cols-2">
          <EngineBlock label="Motif" body={t.engineMotif} />
          <EngineBlock label="AI" body={t.engineAI} />
          <EngineBlock label="Auto Mood" body={t.engineMood} />
          <EngineBlock label="Bass & Drums" body={t.engineBand} />
        </div>
      </section>

      {/* ── see the music ──────────────────────────────────────── */}
      <section className="relative mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8">
        <div className="border-t divider pt-16" />
        <h2 className="serif text-3xl font-semibold tracking-tight sm:text-4xl">{t.seeTitle}</h2>
        <div className="mt-10 grid gap-10 sm:grid-cols-2">
          <SeeBlock label="Signal Chain" body={t.seeChain} />
          <SeeBlock label="Piano Roll" body={t.seeRoll} />
          <SeeBlock label="Degree Map" body={t.seeDegree} />
          <SeeBlock label="Live Readout" body={t.seeReadout} />
        </div>
      </section>

      {/* ── footer ─────────────────────────────────────────────── */}
      <section className="relative mx-auto w-full max-w-6xl px-5 pb-24 pt-8 sm:px-8">
        <div className="border-t divider pt-16 text-center">
          <button className="btn btn-accent px-8 py-4 text-lg" onClick={onEnter} type="button">
            {t.footerCta}
          </button>
          <p className="mt-4 text-sm t-faint">{t.footerHint}</p>
          <p className="mt-10 text-xs t-faint">
            Type2Song &middot; MIT License &middot;{" "}
            <a className="underline underline-offset-2 hover:text-[var(--accent)]" href="https://github.com/EricJiang0423/type2song">
              GitHub
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}

/* ── tiny sub-components ───────────────────────────────────────────── */

function HowBlock({ body }: { body: string }) {
  return (
    <p className="text-base leading-7 t-dim sm:text-lg sm:leading-8">
      {body}
    </p>
  );
}

function VoiceBlock({ name, desc, accent }: { name: string; desc: string; accent: string }) {
  return (
    <div>
      <h3 className="serif text-2xl font-semibold" style={{ color: accent }}>
        {name}
      </h3>
      <p className="mt-4 text-base leading-7 t-dim">{desc}</p>
    </div>
  );
}

function EngineBlock({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <p className="label-cap text-[var(--accent)]">{label}</p>
      <p className="mt-2 text-base leading-7 t-dim">{body}</p>
    </div>
  );
}

function SeeBlock({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <p className="mono text-sm text-[var(--secondary)]">{label}</p>
      <p className="mt-2 text-base leading-7 t-dim">{body}</p>
    </div>
  );
}
