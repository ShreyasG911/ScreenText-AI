# ScreenText AI 🔍📝

> **"See it. Select it. Extract it."**  
> *Turn anything on your screen into editable, selectable, searchable, and copyable text.*

ScreenText AI is a production-ready, privacy-first, on-device Chrome Extension (Manifest V3) designed to extract text from any visible screen content—including images, scanned PDFs, infographics, video frames, presentations, code snippets, and websites with text selection disabled.

---

## 📑 Table of Contents

1. [The Problem & The Solution](#-the-problem--the-solution)
2. [Key Features](#-key-features)
3. [Privacy by Design (100% Local-First)](#-privacy-by-design-100-local-first)
4. [Technology Stack & Architecture](#-technology-stack--architecture)
5. [Project Folder Structure](#-project-folder-structure)
6. [Installation & Setup](#-installation--setup)
7. [How to Use](#-how-to-use)
   - [Area Selection Capture](#1-area-selection-capture)
   - [Full Tab Viewport Capture](#2-full-tab-viewport-capture)
   - [Keyboard Shortcuts](#3-keyboard-shortcuts)
   - [Editing, Copying & Exporting](#4-editing-copying--exporting)
8. [OCR Capabilities & Limitations](#-ocr-capabilities--limitations)
9. [Browser Security & Page Restrictions](#-browser-security--page-restrictions)
10. [Testing & QA Checklist](#-testing--qa-checklist)
11. [Future Roadmap](#-future-roadmap)
12. [Licenses & Attribution](#-licenses--attribution)

---

## 🎯 The Problem & The Solution

### The Problem
Every day, developers, researchers, students, and professionals encounter text trapped behind visual barriers:
- Scanned documents, receipts, and image-based PDFs.
- Slides, presentations, charts, and diagrams.
- Code blocks shown inside video tutorials or screenshots.
- Error dialogs, system prompts, and tooltips in images.
- Educational websites that disable mouse selection and right-click copy.
- Infographics, memes, and visual social media posts.

Historically, users had to either retype everything manually or take a screenshot, open a browser tab, find a third-party OCR web service, upload the image, wait, and risk sensitive data exposure.

### The Solution
ScreenText AI introduces a frictionless, 2-click workflow:
1. **Trigger ScreenText AI** (via toolbar popup or `Alt+Shift+X`).
2. **Select the text region** (or capture the visible tab).
3. **Edit, copy, or download** the extracted text immediately.

**No paid APIs. No backend servers. No user accounts. No tracking.**

---

## ✨ Key Features

- **🎯 Interactive Area Selection:** Drag a rectangular crosshair in any direction with a live dimension badge and cancel options (`Esc` key or Cancel button).
- **🖥️ Entire Tab Viewport Capture:** Capture the full active viewport in a single click without altering scroll positions.
- **⚡ 100% Offline OCR Engine:** Bundled local Tesseract.js WebAssembly engine with neural network LSTM recognition. Runs 100% offline without network latency or external API costs.
- **✏️ Split-Pane Results Editor:** Compare the cropped screenshot preview side-by-side with recognized text in a distraction-free workspace.
- **🌗 Light & Dark Theme:** Built-in theme switcher with automatic OS preference detection (`prefers-color-scheme`).
- **🔍 Image Zoom Controls:** Cycle between Fit, 100%, and 200% zoom to inspect fine details and verify character accuracy.
- **🔤 Font Mode Toggle:** Switch between Monospace (`JetBrains Mono`, `Consolas`) for code/tables and Clean Sans-Serif for reading prose.
- **📋 One-Click Copy & Toast:** Instant clipboard copying with temporary visual confirmation.
- **💾 UTF-8 Text File Export:** Download the edited text as a timestamped `.txt` file (`screentext-ai-YYYY-MM-DD.txt`).
- **⌨️ Keyboard Shortcuts:** Built-in command mappings for power users (`Alt+Shift+X` for instant area selection).

---

## 🔒 Privacy by Design (100% Local-First)

ScreenText AI was built from the ground up to respect user privacy:
- **No Cloud Uploads:** Screenshots and OCR text are processed purely inside your browser memory.
- **No Analytics or Telemetry:** Zero third-party trackers, beacons, or analytics scripts.
- **No Remote JavaScript:** 100% compliant with Chrome Extensions Manifest V3 CSP.
- **Minimal Justified Permissions:**
  - `activeTab`: Grants temporary access to capture the active tab only when you deliberately click the extension icon or use the shortcut.
  - `scripting`: Injects the drag-selection overlay into the current page.
  - `storage`: Temporarily holds the captured image and extracted text between popup and editor sessions.
- **No `<all_urls>` or Host Permissions:** ScreenText AI cannot inspect or monitor web traffic.

---

## 🛠️ Technology Stack & Architecture

- **Extension Framework:** Chrome Extensions Manifest V3
- **Languages:** Standard HTML5, CSS3, ES6+ JavaScript (zero build step needed)
- **Local OCR Engine:** Tesseract.js v5 (WebAssembly + Web Worker)
- **Offline Language Model:** English (`eng.traineddata.gz` ~10.9 MB)
- **Image Processing:** HTML5 Canvas API (dynamic DPR scaling, bicubic upscaling for small text)
- **Messaging Architecture:** Asynchronous Chrome Runtime messaging pipeline:
  ```
  [User Action] ──► [popup.js / Shortcut]
                          │
                          ▼
                  [background.js (Service Worker)]
                          │
          ┌───────────────┴───────────────┐
          ▼                               ▼
    [content.js Overlay]        [chrome.tabs.captureVisibleTab]
          │                               │
          └───────────────┬───────────────┘
                          ▼
            [storage.local: Image + Crop Coordinates]
                          │
                          ▼
            [results.html (Dedicated Workspace)]
                          │
            [Tesseract.js WebAssembly Worker]
                          │
                          ▼
            [Editable Text Area & Export]
  ```

---

## 📁 Project Folder Structure

```
ScreenText-AI/
├── manifest.json              # Extension Manifest V3 configuration
├── popup.html                 # Toolbar popup interface
├── popup.css                  # Toolbar popup styles (Light & Dark)
├── popup.js                   # Popup user interaction controller
├── background.js              # Service worker coordinating capture & state
├── content.js                 # Drag selection overlay & coordinate engine
├── content.css                # Visual overlay styling & crosshair cursor
├── results.html               # Persistent editor & screenshot preview pane
├── results.css                # Split-pane results workspace styling
├── results.js                 # Canvas cropping & clipboard/download controller
├── icons/                     # High-DPI extension icons
│   ├── icon16.png             # 16x16 toolbar icon
│   ├── icon48.png             # 48x48 management icon
│   └── icon128.png            # 128x128 store icon
├── lib/                       # Bundled offline OCR dependencies
│   ├── tesseract.min.js       # Tesseract.js client wrapper
│   ├── worker.min.js          # Web Worker thread script
│   ├── tesseract-core-simd-lstm.wasm.js # SIMD WebAssembly core
│   ├── tesseract-core.wasm.js # Standard WebAssembly core fallback
│   └── lang/
│       └── eng.traineddata.gz # English neural network traineddata model
├── LICENSE                    # MIT License
└── README.md                  # Comprehensive product documentation
```

---

## 🚀 Installation & Setup

1. **Clone or Download** this repository to your local computer:
   ```bash
   git clone https://github.com/your-username/screentext-ai.git
   ```
   *(or download and extract the ZIP archive).*

2. **Open Chrome Extensions Manager:**
   - In Google Chrome, navigate to `chrome://extensions/`.

3. **Enable Developer Mode:**
   - Toggle the **"Developer mode"** switch in the top-right corner to **ON**.

4. **Load the Extension:**
   - Click the **"Load unpacked"** button in the top-left toolbar.
   - Select the folder containing `manifest.json` (e.g., `C:\Users\...\ScreenText AI`).

5. **Pin to Toolbar:**
   - Click the puzzle piece icon (Extensions) in your browser toolbar and click the **Pin** icon next to **ScreenText AI**.

---

## 📖 How to Use

### 1. Area Selection Capture
1. Navigate to any webpage containing text you wish to extract.
2. Click the ScreenText AI icon in your toolbar, or press `Alt+Shift+X`.
3. Click and drag your mouse over the text region.
4. Release the mouse. The selection overlay will automatically close, and the **Results Editor** tab will open with your recognized text.

### 2. Full Tab Viewport Capture
1. Open the ScreenText AI popup from your toolbar.
2. Click **Capture Entire Tab**.
3. The visible viewport is captured, and the editor tab opens to process the entire screenshot.

### 3. Keyboard Shortcuts
| Shortcut | Action | Scope |
| :--- | :--- | :--- |
| `Alt+Shift+X` | Quick Area Selection | Any supported webpage |
| `Alt+Shift+S` | Open ScreenText AI Popup | Global in Chrome |
| `Esc` | Cancel Area Selection | Active selection overlay |
| `Ctrl+A` / `Cmd+A` | Select All Text | In results editor |

*(You can customize these shortcuts anytime at `chrome://extensions/shortcuts`)*.

### 4. Editing, Copying & Exporting
- **Edit Directly:** Click inside the editor textarea to make manual corrections, fix punctuation, or add notes.
- **Copy Text:** Click the **Copy Text** button to copy the entire editor contents to your clipboard.
- **Download TXT:** Click **Download TXT** to save the contents as an official UTF-8 `.txt` file.
- **Re-run OCR:** Click **Re-run OCR** to re-process the image if needed.
- **Theme Toggle:** Click the Moon/Sun icon in the header to switch between Dark and Light mode.

---

## ⚠️ OCR Capabilities & Limitations

- **Engine:** ScreenText AI uses Tesseract.js (LSTM neural network engine).
- **Language Support:** English (`eng`) is currently bundled offline. Additional language models can be placed in `lib/lang/`.
- **Text Resolution:** Tesseract works best when characters have an x-height of 25–35 pixels. For tiny fonts (< 14px), ScreenText AI applies automatic 2× canvas upscaling.
- **Background Contrast:** Clear, high-contrast text (dark on light or light on dark) achieves the highest accuracy. Extremely low contrast, artistic graffiti, or heavy motion blur may degrade recognition.
- **Code & Indentation:** The results editor preserves line breaks and tab/space indentation.

---

## 🛡️ Browser Security & Page Restrictions

Due to Chrome's built-in security architecture, extensions are blocked from running content scripts or capturing:
- Internal browser pages (`chrome://`, `chrome-extension://`, `edge://`, `about:blank`).
- The official Chrome Web Store (`chromewebstore.google.com`).
- View-source pages (`view-source:*`).

If you attempt to capture on one of these tabs, ScreenText AI will gracefully inform you with a security notice rather than failing silently. Simply switch to any standard website (`https://...`) to capture.

---

## 🧪 Testing & QA Checklist

- [x] **Manifest V3 Verification:** Valid manifest without deprecated V2 APIs or CSP violations.
- [x] **Full-Tab Capture:** Accurately captures visible viewports across standard and high-DPI displays.
- [x] **4-Directional Selection:** Dragging works top-left, bottom-right, bottom-left, top-right without negative crop errors.
- [x] **Overlay Dismissal:** `Esc` key and Cancel button unmount cleanly without leaving DOM artifacts.
- [x] **Offline Processing:** 100% of OCR files (`tesseract.min.js`, `worker.min.js`, `.wasm`, `.traineddata.gz`) are bundled locally. Tested without external network calls.
- [x] **Clipboard Handoff:** Copies edited contents smoothly with fallback and visual feedback.
- [x] **File Download:** UTF-8 encoded text export with timestamp.
- [x] **Dark Mode:** Accessible contrast in both light and dark themes.

---

## 🔮 Future Roadmap

- [ ] **Multi-Language Selector:** Add optional offline models for Spanish, French, German, Hindi, Japanese, and Chinese.
- [ ] **Smart Formatting AI (Optional Opt-In):** Optional cloud-assisted cleanup for tables, LaTeX math, and code blocks with explicit user consent.
- [ ] **Local Image File Upload:** Drag-and-drop a local PNG/JPEG file directly into the editor for instant OCR.
- [ ] **Side Panel Mode:** Optional integration with Chrome's Side Panel API (`chrome.sidePanel`) for users who prefer side-by-side docking.

---

## 📜 Licenses & Attribution

- **ScreenText AI:** Licensed under the [MIT License](LICENSE).
- **Tesseract.js:** Licensed under the [Apache License 2.0](https://github.com/naptha/tesseract.js/blob/master/LICENSE).
- **Tesseract OCR:** Licensed under the [Apache License 2.0](https://github.com/tesseract-ocr/tesseract/blob/main/LICENSE).

---

*Developed with ❤️ for speed, simplicity, and uncompromising privacy.*
