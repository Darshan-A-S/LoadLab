# LoadLab Landing Page

A sleek, modern, zero-scroll single-page landing website built purely with vanilla **HTML5**, **CSS3**, and **JavaScript** for showcasing and distributing **LoadLab**.

---

## 🚀 Features

- **Strict Single-Viewport Zero-Scroll Design**: Fits 100% into the screen (`100vh`/`100vw`, `overflow: hidden`) on desktop monitors and laptops with responsive adaptation.
- **Dedicated 3 OS Download Cards**:
  - **Windows**: Direct download link to `LoadLab.Setup.0.1.2.exe` from GitHub Releases.
  - **macOS**: Apple Silicon & Intel DMG options with quick instructions.
  - **Linux**: AppImage and `.deb` universal binary options.
- **Auto OS Detection**: Automatically identifies if the visitor is on Windows, Mac, or Linux and highlights the recommended card.
- **100% Strictly Real Downloads Counter**:
  - Queries `https://api.github.com/repos/Darshan-A-S/LoadLab/releases` dynamically.
  - Automatically calculates and animates total downloads across all releases with zero artificial baseline offset.
  - Instant optimistic UI increment when any download button is clicked.
- **Interactive Live Desktop App Simulator**:
  - Realistic macOS window chrome and target config bar.
  - Real-time 60 FPS animated glowing canvas telemetry chart.
  - Live ticking metrics (Throughput RPS, Latency, p50/p95/p99 percentiles, and Status codes).
  - Pluggable engine switcher (**Autocannon**, **oha** in Rust, **Bombardier** in Go, **Artillery**).
- **Social & OpenGraph Meta Tags**: Pre-configured in `<head>` for rich link previews.

---

## 📁 Folder Structure

```
landing/
├── index.html       # Single-page layout (Left Hero & 3 OS downloads, Right Live Simulator)
├── style.css        # Pure CSS3 styling (dark mode, glassmorphism, zero-scroll layout)
├── app.js           # Vanilla JS (live telemetry canvas, OS detection, GitHub API download counter)
└── assets/
    ├── icon.png     # LoadLab high-res app icon (256x256)
    └── icon-small.png # LoadLab favicon (64x64)
```

---

## 💻 How to View & Test Locally

You can open the page immediately in any of the following ways:

### Option 1: Direct File Open
Simply double-click `landing/index.html` or open it in your browser.

### Option 2: Run a quick local server (PowerShell)
```powershell
npx serve landing
```
or with Python:
```powershell
python -m http.server 3000 --directory landing
```
Then visit `http://localhost:3000`.

---

## 🌐 How to Host for Free (60 Seconds)

### Option A: GitHub Pages (Recommended)
1. In your GitHub repository (`Darshan-A-S/LoadLab`), go to **Settings** &gt; **Pages**.
2. Under **Build and deployment**, select:
   - Source: **Deploy from a branch**
   - Branch: `main` &bull; Folder: `/docs` (or move contents of `landing/` to `docs/` or a `gh-pages` branch).
3. Click **Save**. Your site will be live at `https://darshan-a-s.github.io/LoadLab/`!

### Option B: Vercel / Netlify
1. Connect your GitHub repository to [Vercel](https://vercel.com) or [Netlify](https://netlify.com).
2. Set Root Directory: `landing`.
3. Click **Deploy**. Done!
