# Type2Song

用打字来演奏的网页乐器。

Type2Song 是一个浏览器端创意音乐项目：你在输入框里正常打字，每一次有效按键都会成为实时音乐的一部分。它不是简单的键盘音效，而是会把输入行为转译成有调性的旋律、柔和的和弦进行、量化的节奏、会演变的 motif，以及可选的 AI 续写——让随手乱打也能听起来出乎意料地像音乐。

它既像一个写作平面，也像一个可以现场演奏的网页乐器。

[English README](./README.md)

## 它有什么不一样

很多"键盘音乐"项目只是给按键加声音。Type2Song 把打字当成一种音乐输入方式。

- 按键映射到音阶级数，而不是固定音高。
- 旋律会被限制在当前调性和音阶里。
- 后台和弦进行为每一句输入提供音乐语境。
- 打字会被限流到一个"音乐化"的速度——猛敲不会堆成一面音墙，而是变成一条平稳的旋律线；"音符密度"滑块可以自己选偏稀疏还是偏跟手。被限流跳过的按键仍会留下一个很淡的视觉痕迹。
- 最近的 motif 会被记录、重复、轻微变奏；AI 续写只在你停顿之后才补上。
- 数字钢琴模式可以直接敲出明确的旋律。

## 功能亮点

- 使用 Tone.js 实现实时网页音频（在你点击 **Start Audio** 之后才加载，符合浏览器自动播放限制）
- 乐器化界面：大号书写舞台 + 音符轨迹 + 涟漪 + 实时"当前音符"显示 + 屏上键位条 + 展示"按键如何变成音符"的生成链路
- 三种气质风格——**Lo-fi Night**、**Sad Piano**、**Cute Game BGM**——每个都带一套调好的音色预设；**推荐** 按钮可重新套用，**重置** 回到中性默认
- Key / Scale 选择，改变旋律色彩
- 数字钢琴模式：`1=C3 2=D3 3=E3 4=F3 5=G3 6=A3 7=B3 8=C4 9=D4 0=E4`
- 音阶级数模式：`A S D F G H J K L` → 当前音阶的级数 1–9
- 同时按下多个有效按键触发和弦
- 音色推子：明亮度、温暖度、起音、尾音、空间、回声、Pad、低音——外加 **音符密度** 控制
- Smart Layer：Auto Mood、AI Continuation、Bassline、Drums
- 实时读数：当前音符、最近 motif、生成续写、逐步的计算过程
- 导出 MIDI、WAV、JSON
- 中英文界面

## 快速开始

```bash
npm install
npm run dev
```

打开 `http://localhost:5173/`，点击 **Start Audio**，然后开始输入。

## 构建

```bash
npm run build      # 类型检查 + 生产构建到 dist/
npm run preview    # 预览生产构建
```

## 部署（GitHub Pages）

`.github/workflows/deploy.yml` 会在每次推送到 `main` 时构建并把 `dist/` 发布到 GitHub Pages。

仓库上的一次性设置：

1. **Settings → Pages → Build and deployment → Source: GitHub Actions。**
2. 推送到 `main`（或在 Actions 标签页手动运行该 workflow）。

Vite 的 `base` 设为 `./`（相对路径），所以构建产物在域名根目录和项目子路径（`https://<user>.github.io/<repo>/`）下都能正常工作，无需额外配置。

## 技术栈

- React 18 + TypeScript
- Vite
- Tailwind CSS v4（无配置文件；主题写在 `src/index.css`，PostCSS 管线内联在 `vite.config.ts`）
- Tone.js

## 项目结构

```text
src/
  main.tsx                入口
  index.css               Tailwind 引入 + 自定义视觉样式与主题变量
  vite-env.d.ts
  ui/
    App.tsx               主界面、交互逻辑与组件
    i18n.ts               中英文文案
  music/
    audioEngine.ts        Tone.js 合成器、Transport、播放、音长塑形
    musicEngine.ts        按键→级数映射、和声选择、音符平滑、motif 记忆、打字限流
    harmonyEngine.ts      基于音阶的和弦与 voicing
    aiComposer.ts         文本情绪分析 + motif 续写
    keyMapping.ts         键盘映射与数字钢琴映射
    scales.ts             音阶、根音、音高/级数计算
    styles.ts             音乐风格预设（含推荐音色）
    timbre.ts             音色推子配置
    exporters.ts          MIDI / WAV / JSON 导出
.github/workflows/deploy.yml   GitHub Pages CI
```

## 说明

Type2Song 是纯前端项目。当前基础已经可以继续扩展：更丰富的音色设计、可录制/可分享的演奏片段、更聪明的续写、自定义音阶等。
