# Type2Song — Research & Optimization Notes

> 基于同类项目调研 + 学术论文 + 现有代码分析，对编曲逻辑的优化方案与实现记录。

---

## 一、同类项目调研

### 1. Typatone — Google Experiments
- **链接**: https://experiments.withgoogle.com/typatone
- **思路**: 每个字母映射到一个固定音高，打字即作曲。
- **可学**: 极简的 on-ramp（零学习成本）；"墨水感"视觉——字体会随敲击产生微弱的反馈。
- **局限**: 无调性约束，一段话的效果高度取决于拼写，不是刻意设计的"音乐句法"。

### 2. Qwerty Hancock
- **链接**: （已下线，曾经流行的 Web 钢琴）
- **思路**: QWERTY 键盘两排映射为钢琴白键，每行一个八度。
- **可学**: 键位布局的直觉——哪排对应哪个八度更适合数字钢琴模式。
- **局限**: 会弹钢琴才知道怎么用。Type2Song 解决的是"不懂音乐的人也能打字即兴演奏"。

### 3. Patatap — Jono Brandel
- **链接**: https://patatap.com
- **思路**: 每个键触发预录采样 + 几何动画（Canvas 圆圈/形状爆发），打击垫式交互。
- **可学**: **视觉反馈系统**——泡泡 + 颜色 + 形状 + 轨迹，多层质感。Type2Song 的涟漪系统可以在视觉丰富度上往这个方向靠。
- **局限**: 非生成式音乐，不能演奏旋律线。

### 4. HSynth（Morse 码合成器）
- **思路**: 每个字母拆成 Morse 码的点和划，每个点/划对应一个音符。
- **可学**: **打字节奏显式化**——Morse 码把按键间隔模式本身变成音乐参数。打字节奏是有模式感的，这点 Type2Song 的量化/限流已经在做，但还可以更进一步。

### 5. Blotter.js — Bradley Griffith
- **链接**: https://github.com/bradleygriffith/blotter
- **思路**: 文本动画 + WebAudio 合成，文字运动同步映射到音高/谐波变化。
- **可学**: **视觉运动→音频参数的映射方式**——频率、谐波量、音量都可被文本渲染实时控制。

### 6. eyeTUNES — mariamuzas
- **链接**: https://github.com/mariamuzas/eyeTUNES_music_visualizer
- **思路**: React 键盘→音乐，最接近 Type2Song 的项目。
- **可学**: "Inclusive access" 理念——让不同能力的人都能通过打字创作音乐。

---

## 二、学术论文

### 1. "Web-based Temporal Typography for Musical Expression and Performance"
- **作者**: Lee, S. W. & Essl, G. — NIME 2015
- **核心观点**: 打字是**时间性的**——按键之间的间隔本身就是音乐数据。提出了 programmable text rendering 概念，将 typing 视作动态表演。
- **引用**: 14 citations
- **对我们的价值**: 验证了"inter-keystroke timing → 音乐参数"的方向是正确的。该论文同时使用麦克风输入和按键间隔作为双输入源（人声节奏 + 打字节奏叠加）。*Cited by 14*

### 2. "AI-assisted Composition: A Unified Development Framework for Rule-informed Music Composition"
- **作者**: Erspamer, A. M. — 2025
- **核心观点**: 按键力度（keypress strength）可直接映射到表现力参数（expression mapping）。提出 integer-to-rhythm mapping——将整数输入直接映射到节奏模式。
- **对我们的价值**: 为 "每个键的击键剖面不同→音色不同"提供了理论基础。Type2Song 的左手/右手键区音色差异化可以基于此。

### 3. "The Instrumental Dissolution of Typing: Why AI Challenges the Keyboard Era in Knowledge Work"
- **作者**: Hua, W. R. — 2026
- **核心观点**: 打字本身就是创作行为的一部分，"keystroke-by-keystroke authorship" 的节奏具备音乐性。
- **对我们的价值**: 非常新的视角——打字节奏是"知识工作的音乐性"。Type2Song 处于这一交叉点的正中心。

### 4. "Hands-on Music Generation with Magenta"
- **作者**: Dubreuil, A. — 2020
- **核心观点**: 浏览器端生成式音乐的实操指南。涵盖 keypress → MIDI event → 生成模型 pipeline。
- **对我们的价值**: Magenta.js 的 Drums RNN / Melody RNN 作为 AI Continuation 的替代方案（当前是规则驱动的 motif 镜像+反转）。

---

## 三、优化实现

详见以下文件的变更：

| 文件 | 改动 |
|------|------|
| `src/music/musicEngine.ts` | 打字节奏分组（P0#1）、自适应量化（P0#2）、motif 节奏记忆（P0#3） |
| `src/music/audioEngine.ts` | 强拍同步调度（P0#1）、击键表情映射（P1#4）、立体声自动声场（P1#5） |
| `src/music/aiComposer.ts` | 节奏感知续写（P0#3） |
| `src/ui/App.tsx` | 速度指示器 / 量化吸附度控制 |
| `src/ui/i18n.ts` | 新增文案 |
| `src/index.css` | 新增 UI 样式 |
| `RESEARCH.md` | 本文档 |

### P0 — 核心编曲逻辑

#### #1 打字节奏决定乐句结构（Rhythmic Grouping）
- 连续快键 (`<150ms`) → 绑定为 rhythmic group，第一个音 accent，其余量化到网格
- 长停顿 (`>550ms`) → 自动视作乐句结束，下一个音对齐到强拍（measure boundary）
- 代码：`audioEngine.ts` 的 `getQuantizedTime()` 增加 downbeat sync 模式

#### #2 速度自适应量化（Adaptive Quantize）
- 跟踪最近 8 个按键的平均间隔，动态选择量化分辨率
- 平均间隔 <150ms → 16n；150-400ms → 8n；>400ms → 4n（允许完整尾音）
- 代码：`musicEngine.ts` 新增 `getAdaptiveQuantize()` + 滚动窗口

#### #3 节奏感知续写（Rhythm-Aware Continuation）
- `MotifNote` 新增 `elapsedMs` 字段，保存按键间隔
- 续写时不仅复制 degree 模式，也复制间隔模式
- 代码：`musicEngine.ts` + `aiComposer.ts`

### P1 — 表现力增强

#### #4 击键表情映射（Expression Mapping）
- 短间隔按键 → 触键更断奏（已有）+ 轻微滑音处理
- 长间隔按键 → 更连奏，加入轻微颤音/autofilter sweep
- 代码：`audioEngine.ts` 新增自动声场氛围层（AutoFilter + AutoPanner）

#### #5 立体声自动声场（Spatial Mapping）
- 按 degree 分配左右位置（低→左，中→中，高→右），随时间缓慢扫动
- 代码：`audioEngine.ts` 的 `getPanForDegree()` + `AutoPanner`

---

## 四、后续方向

- 更丰富的合成器架構（per-key timbre profile — P2#7）
- 情绪节奏映射（文字内容驱动节奏参数 — P2#8）
- 长记忆 motif 召回（Shift+Enter 回顾之前出现的模式 — P1#6）
- Magenta.js / MusicVAE 替代规则型续写
- 人声 + 打字双输入（Lee & Essl 2015 的方向）

---

*最后更新: 2026-05-11*
