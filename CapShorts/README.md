<div align="center">

# ⚡ CapShorts
### The 100% Free, Local-First AI Video Editor for Short-Form Creators

**Stop paying \$30/month for Opus Clip, Submagic, or CapCut Pro.**  
Generate word-accurate animated captions, extract viral vertical shorts, remove dead air, and export studio-quality videos — all from your desktop, with zero subscriptions and zero watermarks.

---

[![Release](https://img.shields.io/github/v/release/thealiraza2/CapShorts?style=for-the-badge&color=00f2fe&logo=github)](https://github.com/thealiraza2/CapShorts/releases/latest)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20(Universal)-4facfe?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/thealiraza2/CapShorts/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-00c6ff?style=for-the-badge)](./LICENSE)
[![Zero Setup](https://img.shields.io/badge/Setup-Zero%20Dependencies%20(Bundled)-6ee7b7?style=for-the-badge&logo=tauri)](https://github.com/thealiraza2/CapShorts/releases/latest)

<br />

[📥 Download for Windows & Mac](#-downloads) • [✨ Features](#-why-capshorts) • [⚡ Quickstart](#-quickstart--local-development) • [⌨️ Shortcuts](#%EF%B8%8F-keyboard-shortcuts)

---

</div>

<br />

## 📥 Downloads

Ready-to-run desktop installers. **No Python, Git, or FFmpeg installation needed** — everything is pre-packaged.

| Platform | Installer | Architecture | Download Link |
| :--- | :--- | :--- | :--- |
| **Windows** | `.exe` Setup | 64-bit (x86_64) | [**Download Setup (.exe)**](https://github.com/thealiraza2/CapShorts/releases/download/v1.1.0/CapShorts_1.1.0_x64-setup.exe) |
| **Windows** | `.msi` Package | 64-bit Enterprise | [**Download MSI (.msi)**](https://github.com/thealiraza2/CapShorts/releases/download/v1.1.0/CapShorts_1.1.0_x64_en-US.msi) |
| **macOS** | `.dmg` Universal | Apple Silicon (M1/M2/M3/M4) & Intel | [**Download Universal (.dmg)**](https://github.com/thealiraza2/CapShorts/releases/download/v1.1.0/CapShorts_1.1.0_universal.dmg) |

---

## 💡 Why CapShorts?

Every short-form creator knows the struggle:
- Cloud tools charge **\$20–\$50 every single month**.
- You wait in long queues just to upload a 500 MB file.
- Your data and private drafts sit on third-party servers.
- Free tiers slap massive watermarks across your video.

**CapShorts is built differently.** It runs directly on your machine. You own your media, your exports have **no watermarks**, and transcription takes literally 2 to 3 seconds.

---

## 📊 Feature Comparison

| Feature | ⚡ **CapShorts** | Opus Clip | Submagic | CapCut Pro |
| :--- | :---: | :---: | :---: | :---: |
| **Price** | **100% Free / Open Source** | \$19–\$49 / mo | \$20–\$50 / mo | \$10–\$15 / mo |
| **Watermarks** | **None (Never)** | Yes (on free plan) | Yes (on free plan) | Yes |
| **Export Limits** | **Unlimited** | 60 mins/mo | 3 videos/mo | Paid exports |
| **Offline Privacy** | **Runs on your machine** | Cloud only | Cloud only | Cloud connected |
| **Transcription Speed** | **~2-3 seconds (Groq Turbo)** | 2–5 minutes | 1–3 minutes | 1–2 minutes |
| **Standalone Daemon** | **Bundled (Zero Setup)** | N/A | N/A | Proprietary |
| **100+ Viral Subtitle Styles** | **Included** | Limited | Limited | Limited |

---

## ✨ What's Inside

### 1. ⚡ Word-Accurate AI Subtitles in ~3 Seconds
- Powered by Whisper Large-v3 with instant millisecond timestamps.
- **Embedded Turbo Cloud Engine**: Pre-configured out of the box with zero API setup needed.
- **Offline On-Device AI**: Automatic fallback to local CPU/GPU Faster-Whisper if you're completely offline.
- **Auto-Keywords**: Automatically detects and highlights high-impact viral words (*money, secrets, 10x, insane, stop, hack*).

### 2. 🎬 Opus-Style Viral Shorts Detection
- Drop any 10-to-60 minute video or podcast.
- CapShorts analyzes the speech transcript and extracts **25s–60s self-contained highlight clips**.
- **Complete-Thought Guarantee**: Never cuts off mid-sentence or mid-thought using smart grammar and pause boundary detection.
- Includes engagement virality score predictions.

### 3. 🎨 100+ Handcrafted Viral Subtitle Presets
Inspired by top creators and media studios:
- **Creators**: MrBeast Yellow Pop, Alex Hormozi Bold, Iman Gadzhi Minimal, Ali Abdaal Clean, Luke Belmar Gold, David Goggins Grit.
- **Documentary**: Vox Highlight Box, BBC Clean, National Geographic, Netflix Editorial.
- **Neon & Gaming**: Cyberpunk 2077, Glitch Matrix, Arcade Pulse, Synthwave 80s.
- **Karaoke Sweeps**: Smooth word-by-word gradient color wipe animations.

### 4. ✂️ CapCut-Style Desktop Timeline Studio
- **Razor Tool (`B`)**: Slice video clips and subtitle tracks instantly at the playhead.
- **Dead-Air Remover**: Detect and ripple-delete silence pauses across all audio tracks in 1 click.
- **Interactive Word Editor**: Click any subtitle token in the timeline to edit spelling, adjust timing, or toggle keyword status.
- **B-Roll Overlay Engine**: Automatically suggest and insert matching vertical B-roll stock video footage.

### 5. 🚀 16x Faster Local Hardware Rendering
- Hardware-accelerated GPU export using **NVIDIA NVENC, Intel QuickSync, AMD AMF, and Apple VideoToolbox**.
- Ultra-optimized vertical short renderer with cinematic blurred backgrounds that render in **5 to 10 seconds** instead of minutes.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>Space</kbd> | Play / Pause video preview |
| <kbd>B</kbd> | Activate Razor Blade / Split Tool |
| <kbd>Ctrl</kbd> + <kbd>B</kbd> | Split current clip at playhead position |
| <kbd>Delete</kbd> / <kbd>Backspace</kbd> | Delete selected segment |
| <kbd>←</kbd> / <kbd>→</kbd> | Step backward / forward 1 second |
| <kbd>Ctrl</kbd> + <kbd>Scroll</kbd> | Zoom in / out timeline |

---

## 🛠️ Architecture

CapShorts pairs a lightweight native desktop container with a blazing-fast Python media daemon:

```
CapShorts/
├── src-tauri/      → Native Rust Desktop Shell (Tauri v2)
│                     • Silent background process management
│                     • Native file system & OS dialogs
│                     • Pre-configured NSIS & DMG packaging
├── backend/        → Local AI Daemon (FastAPI + CTranslate2)
│                     • Word-accurate Faster-Whisper & Groq Cloud Turbo
│                     • Subtitle generation (.ass formatting)
│                     • Opus-style viral clip extraction & silence detection
│                     • Bundled standalone FFmpeg media pipeline
└── frontend/       → Dark-Mode Studio UI (React 18 + TypeScript + Vite)
                      • Zustand global state
                      • 60 FPS Canvas & Web Audio waveform preview
                      • 100+ CSS subtitle animations
```

---

## 💻 Quickstart & Local Development

If you want to contribute or build from source:

### Prerequisites
- Node.js 18+ & npm
- Rust & Cargo (`rustup default stable`)
- Python 3.10+

### 1. Clone the repository
```bash
git clone https://github.com/thealiraza2/CapShorts.git
cd CapShorts
```

### 2. Run the App
**Windows 1-Click:**
```cmd
run.bat
```

**Or start frontend & backend manually:**
```bash
# Terminal 1: Backend
cd CapShorts/backend
python -m venv venv
# Windows: venv\Scripts\activate | macOS: source venv/bin/activate
pip install -r requirements.txt
python engine.py

# Terminal 2: Frontend
cd CapShorts/frontend
npm install
npm run dev
```

---

## 🤝 Contributing

Contributions are warmly welcomed! Whether it's adding new subtitle presets, optimizing FFmpeg filters, or improving translation models:

1. Fork the repo.
2. Create your feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'feat: add amazing feature'`).
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request.

---

## 📜 License

Released under the [MIT License](./LICENSE). Free for personal and commercial content creation.

<div align="center">
  <sub>Built with ❤️ for content creators who value speed, privacy, and freedom.</sub>
</div>
