/**
 * ScreenText AI - Results Page Controller (results.js)
 * Manages image crop rendering, local Tesseract.js OCR engine,
 * text editing, clipboard, export actions, dark theme, and zoom.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // UI Elements
  const previewImg = document.getElementById('capturedImagePreview');
  const placeholder = document.getElementById('imagePlaceholder');
  const imgDimensionsBadge = document.getElementById('imgDimensionsBadge');
  const captureModeBadge = document.getElementById('captureModeBadge');
  const previewContainer = document.getElementById('previewContainer');
  
  const mainEditor = document.getElementById('mainEditor');
  const editorStatsBadge = document.getElementById('editorStatsBadge');
  const ocrStatusBadge = document.getElementById('ocrStatusBadge');
  const ocrStatusText = document.getElementById('ocrStatusText');
  const ocrProgressBar = document.getElementById('ocrProgressBar');
  const ocrProgressContainer = document.getElementById('ocrProgressContainer');

  const btnCopyResult = document.getElementById('btnCopyResult');
  const copyBtnText = document.getElementById('copyBtnText');
  const btnSelectAllResult = document.getElementById('btnSelectAllResult');
  const btnDownloadResult = document.getElementById('btnDownloadResult');
  const btnMergeLines = document.getElementById('btnMergeLines');
  const btnRerunOCR = document.getElementById('btnRerunOCR');
  const btnClearResult = document.getElementById('btnClearResult');

  const btnNewSelectArea = document.getElementById('btnNewSelectArea');
  const btnNewCaptureTab = document.getElementById('btnNewCaptureTab');
  const btnThemeToggle = document.getElementById('btnThemeToggle');
  const themeIconSun = document.getElementById('themeIconSun');
  const themeIconMoon = document.getElementById('themeIconMoon');
  
  const btnZoomToggle = document.getElementById('btnZoomToggle');
  const zoomLabel = document.getElementById('zoomLabel');
  const btnFontToggle = document.getElementById('btnFontToggle');
  const fontToggleLabel = document.getElementById('fontToggleLabel');

  const toast = document.getElementById('toastNotification');
  const toastMessage = document.getElementById('toastMessage');
  const cropCanvas = document.getElementById('cropCanvas');

  // State
  let ocrWorker = null;
  let isProcessing = false;
  let lastProcessedTimestamp = 0;
  let currentImageDataUrl = null;
  let zoomModeIndex = 0; // 0: Fit, 1: 100%, 2: 200%
  const zoomModes = [
    { label: 'Zoom: Fit', className: 'zoom-fit' },
    { label: 'Zoom: 100%', className: 'zoom-100' },
    { label: 'Zoom: 200%', className: 'zoom-200' }
  ];

  // Initialize saved theme
  await initTheme();

  /**
   * Display floating toast notification
   */
  let toastTimer = null;
  function showToast(message, duration = 2400) {
    if (!toast) return;
    toastMessage.textContent = message;
    toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.add('hidden');
    }, duration);
  }

  /**
   * Initializes theme from storage or system preference
   */
  async function initTheme() {
    try {
      const { userTheme } = await chrome.storage.local.get(['userTheme']);
      const isDark = userTheme === 'dark' || (!userTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
      applyTheme(isDark ? 'dark' : 'light');
    } catch (e) {
      applyTheme('light');
    }
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      themeIconSun.classList.remove('hidden');
      themeIconMoon.classList.add('hidden');
    } else {
      themeIconSun.classList.add('hidden');
      themeIconMoon.classList.remove('hidden');
    }
  }

  btnThemeToggle.addEventListener('click', async () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    await chrome.storage.local.set({ userTheme: next });
    showToast(`Switched to ${next} theme`);
  });

  /**
   * Zoom Toggle
   */
  btnZoomToggle.addEventListener('click', () => {
    zoomModeIndex = (zoomModeIndex + 1) % zoomModes.length;
    const mode = zoomModes[zoomModeIndex];
    previewImg.className = `preview-img ${mode.className}`;
    zoomLabel.textContent = mode.label;
    if (mode.className === 'zoom-fit') {
      previewContainer.style.overflow = 'hidden';
    } else {
      previewContainer.style.overflow = 'auto';
    }
  });

  /**
   * Font Toggle (Monospace vs Sans)
   */
  btnFontToggle.addEventListener('click', () => {
    if (mainEditor.classList.contains('font-mono')) {
      mainEditor.classList.remove('font-mono');
      mainEditor.classList.add('font-sans');
      fontToggleLabel.textContent = 'Sans-Serif';
    } else {
      mainEditor.classList.remove('font-sans');
      mainEditor.classList.add('font-mono');
      fontToggleLabel.textContent = 'Monospace';
    }
  });

  /**
   * Updates character & word count
   */
  function updateStats() {
    const text = mainEditor.value;
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const lines = text.trim() ? text.split('\n').length : 0;
    editorStatsBadge.textContent = `${chars} chars • ${words} words • ${lines} lines`;
  }

  /**
   * Set Status Pill state: 'ready' | 'processing' | 'error'
   */
  function setStatus(type, message) {
    ocrStatusBadge.className = `status-pill status-${type}`;
    ocrStatusText.textContent = message;
  }

  /**
   * Set Progress Bar (0 - 100) or hide when null
   */
  function setProgress(percent) {
    if (percent === null || percent === undefined) {
      ocrProgressContainer.classList.add('hidden');
    } else {
      ocrProgressContainer.classList.remove('hidden');
      ocrProgressBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
    }
  }

  /**
   * Initialize or return cached Tesseract.js Worker
   * 100% offline, local-first using bundled assets in lib/
   */
  async function getOCRWorker() {
    if (ocrWorker) return ocrWorker;

    setStatus('processing', 'Initializing OCR engine...');
    setProgress(15);

    const workerOptions = {
      workerPath: chrome.runtime.getURL('lib/worker.min.js'),
      corePath: chrome.runtime.getURL('lib/tesseract-core-simd-lstm.wasm.js'),
      langPath: chrome.runtime.getURL('lib/lang'),
      workerBlobURL: false,
      logger: (progressInfo) => {
        if (!progressInfo) return;

        if (progressInfo.status === 'recognizing text') {
          const pct = Math.round((progressInfo.progress || 0) * 100);
          setProgress(pct);
          setStatus('processing', `Recognizing text (${pct}%)...`);
        } else if (progressInfo.status === 'loading tesseract core') {
          setProgress(30);
          setStatus('processing', 'Loading OCR core...');
        } else if (progressInfo.status === 'loading language traineddata') {
          setProgress(55);
          setStatus('processing', 'Loading language data...');
        } else if (progressInfo.status === 'initializing api') {
          setProgress(75);
          setStatus('processing', 'Preparing recognition...');
        }
      }
    };

    try {
      ocrWorker = await window.Tesseract.createWorker('eng', 1, workerOptions);
      return ocrWorker;
    } catch (simdErr) {
      console.warn('[ScreenText AI] SIMD initialization failed, falling back to standard core:', simdErr);
      workerOptions.corePath = chrome.runtime.getURL('lib/tesseract-core.wasm.js');
      ocrWorker = await window.Tesseract.createWorker('eng', 1, workerOptions);
      return ocrWorker;
    }
  }

  /**
   * Executes local OCR on an image data URL or canvas
   */
  async function performOCR(imageSource) {
    if (isProcessing) {
      showToast('OCR is already processing. Please wait...');
      return;
    }

    if (!imageSource) {
      setStatus('error', 'No image loaded for OCR');
      return;
    }

    isProcessing = true;
    setProgress(5);
    setStatus('processing', 'Starting text recognition...');

    // Liveness timeout warning (20s)
    const slowTimer = setTimeout(() => {
      if (isProcessing) {
        setStatus('processing', 'Processing high-resolution content...');
      }
    }, 15000);

    try {
      const worker = await getOCRWorker();
      setProgress(40);

      const result = await worker.recognize(imageSource);
      clearTimeout(slowTimer);

      const rawText = result?.data?.text || '';

      // Normalize line endings without destroying code indentation
      const cleanText = rawText
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      if (!cleanText) {
        setStatus('error', 'No readable text detected');
        mainEditor.placeholder = 'No text detected in this capture. Try selecting a higher-contrast region or zooming into the text.';
        showToast('No readable text detected in this capture');
      } else {
        mainEditor.value = cleanText;
        updateStats();
        setStatus('ready', 'Recognition complete');
        showToast('Text recognized successfully!');

        // Persist recognized text to storage for popup synchronization
        await chrome.storage.local.set({
          latestExtractedText: cleanText,
          latestStatus: { type: 'idle', message: 'Recognition complete' }
        });
      }
    } catch (err) {
      clearTimeout(slowTimer);
      console.error('[ScreenText AI] OCR processing error:', err);
      setStatus('error', 'OCR failed: ' + (err.message || 'Unknown error'));
      showToast('OCR Error: ' + (err.message || 'Processing failed'));
    } finally {
      isProcessing = false;
      setProgress(null);
    }
  }

  /**
   * Crops the screenshot accurately based on CSS coordinates and DPR/zoom scaling
   */
  function cropImage(img, crop) {
    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;
    const viewW = crop.innerWidth || window.innerWidth;
    const viewH = crop.innerHeight || window.innerHeight;

    // Calculate exact scaling factors between natural screenshot and CSS viewport
    const scaleX = naturalW / viewW;
    const scaleY = naturalH / viewH;

    let sx = Math.round(crop.x * scaleX);
    let sy = Math.round(crop.y * scaleY);
    let sw = Math.round(crop.width * scaleX);
    let sh = Math.round(crop.height * scaleY);

    // Strict boundary clamping to prevent Canvas drawImage errors
    sx = Math.max(0, Math.min(sx, naturalW - 1));
    sy = Math.max(0, Math.min(sy, naturalH - 1));
    sw = Math.max(1, Math.min(sw, naturalW - sx));
    sh = Math.max(1, Math.min(sh, naturalH - sy));

    // OCR pre-processing: upscale small text regions for higher accuracy
    let targetW = sw;
    let targetH = sh;
    if (sw < 300 || sh < 150) {
      const upscaleFactor = 2;
      targetW = sw * upscaleFactor;
      targetH = sh * upscaleFactor;
    }

    cropCanvas.width = targetW;
    cropCanvas.height = targetH;
    const ctx = cropCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);

    return cropCanvas.toDataURL('image/png');
  }

  /**
   * Load screenshot and coordinate crop data from storage
   */
  async function loadCapturedData() {
    try {
      const data = await chrome.storage.local.get(['capturedImage', 'cropData', 'captureTimestamp']);
      
      if (!data.capturedImage) {
        placeholder.classList.remove('hidden');
        placeholder.style.display = 'flex';
        previewImg.classList.add('hidden');
        previewImg.style.display = 'none';
        imgDimensionsBadge.textContent = '0 × 0 px';
        return;
      }

      // Check if this capture has already been processed
      const captureTime = data.captureTimestamp || 0;
      const isNewCapture = captureTime > lastProcessedTimestamp;
      lastProcessedTimestamp = captureTime;

      const img = new Image();
      img.onload = async () => {
        let finalImageDataUrl = data.capturedImage;

        if (data.cropData) {
          // Crop selected rectangular area
          captureModeBadge.textContent = 'Selected Area';
          finalImageDataUrl = cropImage(img, data.cropData);
          imgDimensionsBadge.textContent = `${Math.round(data.cropData.width)} × ${Math.round(data.cropData.height)} px`;
        } else {
          // Entire tab capture
          captureModeBadge.textContent = 'Entire Tab';
          imgDimensionsBadge.textContent = `${img.naturalWidth} × ${img.naturalHeight} px`;
        }

        currentImageDataUrl = finalImageDataUrl;

        // Show image in preview panel and cleanly hide placeholder
        placeholder.classList.add('hidden');
        placeholder.style.display = 'none';
        previewImg.src = finalImageDataUrl;
        previewImg.classList.remove('hidden');
        previewImg.style.display = 'block';

        // Automatically trigger OCR for new captures
        if (isNewCapture) {
          mainEditor.value = '';
          updateStats();
          await performOCR(finalImageDataUrl);
        }
      };
      img.src = data.capturedImage;
    } catch (err) {
      console.error('[ScreenText AI Results] Error loading captured data:', err);
      setStatus('error', 'Error loading captured image');
    }
  }

  /**
   * Action: Copy Text
   */
  btnCopyResult.addEventListener('click', async () => {
    const text = mainEditor.value;
    if (!text) {
      showToast('Editor is empty');
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      btnCopyResult.classList.add('copied');
      copyBtnText.textContent = 'Copied!';
      showToast('Copied to clipboard!');
      setTimeout(() => {
        btnCopyResult.classList.remove('copied');
        copyBtnText.textContent = 'Copy Text';
      }, 2000);
    } catch (err) {
      mainEditor.select();
      document.execCommand('copy');
      btnCopyResult.classList.add('copied');
      copyBtnText.textContent = 'Copied!';
      showToast('Copied to clipboard!');
      setTimeout(() => {
        btnCopyResult.classList.remove('copied');
        copyBtnText.textContent = 'Copy Text';
      }, 2000);
    }
  });

  /**
   * Action: Select All
   */
  btnSelectAllResult.addEventListener('click', () => {
    mainEditor.focus();
    mainEditor.select();
    showToast('All text selected');
  });

  /**
   * Action: Re-run OCR
   */
  btnRerunOCR.addEventListener('click', async () => {
    if (!currentImageDataUrl) {
      showToast('No screenshot available to re-run');
      return;
    }
    await performOCR(currentImageDataUrl);
  });

  /**
   * Action: Download TXT
   */
  btnDownloadResult.addEventListener('click', () => {
    const text = mainEditor.value;
    if (!text) {
      showToast('Editor is empty');
      return;
    }

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `screentext-ai-${dateStr}.txt`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${filename}`);
  });

  /**
   * Action: Merge Lines (Format Paragraphs)
   */
  btnMergeLines.addEventListener('click', () => {
    const text = mainEditor.value;
    if (!text.trim()) {
      showToast('Editor is empty');
      return;
    }

    // Join single line breaks into continuous text while preserving paragraph breaks
    const merged = text
      .replace(/([^\n])\n([^\n])/g, '$1 $2')
      .replace(/[ \t]{2,}/g, ' ');

    mainEditor.value = merged;
    updateStats();
    chrome.storage.local.set({ latestExtractedText: merged });
    showToast('Merged lines into smooth paragraphs');
  });

  // Editor shortcut: Ctrl+S or Cmd+S to download text file
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      btnDownloadResult.click();
    }
  });

  /**
   * Action: Clear Text
   */
  btnClearResult.addEventListener('click', () => {
    if (!mainEditor.value && !currentImageDataUrl) return;
    if (confirm('Clear the extracted text and captured screenshot from storage?')) {
      mainEditor.value = '';
      updateStats();
      currentImageDataUrl = null;
      previewImg.src = '';
      previewImg.classList.add('hidden');
      previewImg.style.display = 'none';
      placeholder.classList.remove('hidden');
      placeholder.style.display = 'flex';
      imgDimensionsBadge.textContent = '0 × 0 px';
      chrome.storage.local.remove(['latestExtractedText', 'capturedImage', 'cropData']);
      setStatus('ready', 'Cleared');
      showToast('Cleared text and screenshot from storage');
    }
  });

  /**
   * Header Action: Start New Area Selection
   */
  btnNewSelectArea.addEventListener('click', async () => {
    chrome.runtime.sendMessage({ action: 'START_AREA_SELECTION' });
  });

  /**
   * Header Action: Capture Tab
   */
  btnNewCaptureTab.addEventListener('click', async () => {
    chrome.runtime.sendMessage({ action: 'CAPTURE_ENTIRE_TAB' });
  });

  /**
   * Realtime stats update on typing
   */
  mainEditor.addEventListener('input', () => {
    updateStats();
    chrome.storage.local.set({ latestExtractedText: mainEditor.value });
  });

  // Listen for storage changes so results automatically refreshes on new captures
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.captureTimestamp) {
      loadCapturedData();
    }
  });

  // Listen for direct runtime messages from background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'NEW_CAPTURE_READY') {
      loadCapturedData();
    }
  });

  // Initial load
  await loadCapturedData();
});
