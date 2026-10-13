/**
 * ScreenText AI - Popup Controller (popup.js)
 */

document.addEventListener('DOMContentLoaded', async () => {
  // UI Elements
  const btnSelectArea = document.getElementById('btnSelectArea');
  const btnCaptureTab = document.getElementById('btnCaptureTab');
  const statusBanner = document.getElementById('statusBanner');
  const statusText = document.getElementById('statusText');
  
  const resultsSection = document.getElementById('resultsSection');
  const resultEditor = document.getElementById('resultEditor');
  const charCountBadge = document.getElementById('charCountBadge');
  const btnOpenFull = document.getElementById('btnOpenFull');
  const btnCopy = document.getElementById('btnCopy');
  const copyBtnLabel = document.getElementById('copyBtnLabel');
  const btnSelectAll = document.getElementById('btnSelectAll');
  const btnDownload = document.getElementById('btnDownload');
  const btnClear = document.getElementById('btnClear');

  // Initialize theme from storage or system preference
  try {
    const { userTheme } = await chrome.storage.local.get(['userTheme']);
    const isDark = userTheme === 'dark' || (!userTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  } catch (e) {
    // Default light
  }

  // Listen for theme changes from results page
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.userTheme) {
      document.documentElement.setAttribute('data-theme', changes.userTheme.newValue || 'light');
    }
  });

  // Load any existing session result from storage
  await loadStoredResult();

  /**
   * Updates the visual status banner
   */
  function setStatus(state, message) {
    statusBanner.className = `status-banner status-${state}`;
    statusText.textContent = message;
  }

  /**
   * Helper: Check if tab URL is restricted by Chrome
   */
  function isRestrictedUrl(url) {
    if (!url) return true;
    return (
      url.startsWith('chrome://') ||
      url.startsWith('chrome-extension://') ||
      url.startsWith('edge://') ||
      url.startsWith('about:') ||
      url.startsWith('view-source:') ||
      url.includes('chrome.google.com/webstore') ||
      url.includes('chromewebstore.google.com')
    );
  }

  /**
   * Get current active tab
   */
  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  /**
   * Update character & word count badges
   */
  function updateCounts() {
    const text = resultEditor.value;
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    charCountBadge.textContent = `${chars} chars • ${words} words`;
  }

  /**
   * Display text result in popup
   */
  function showResult(text) {
    resultEditor.value = text || '';
    updateCounts();
    resultsSection.classList.remove('hidden');
    setStatus('idle', 'Recognition complete');
  }

  /**
   * Load stored result from recent capture
   */
  async function loadStoredResult() {
    try {
      const data = await chrome.storage.local.get(['latestExtractedText', 'latestStatus']);
      if (data.latestExtractedText) {
        showResult(data.latestExtractedText);
      }
      if (data.latestStatus) {
        setStatus(data.latestStatus.type || 'idle', data.latestStatus.message || 'Ready');
      }
    } catch (err) {
      console.warn('Could not read stored results:', err);
    }
  }

  /**
   * Action: Select Area
   */
  btnSelectArea.addEventListener('click', async () => {
    try {
      setStatus('working', 'Checking active tab...');
      const tab = await getActiveTab();

      if (!tab || !tab.id) {
        setStatus('error', 'No active tab found');
        return;
      }

      if (isRestrictedUrl(tab.url)) {
        setStatus('error', 'Cannot capture Chrome system/Web Store pages');
        return;
      }

      setStatus('working', 'Starting area selection...');

      // Notify background to start area selection workflow
      chrome.runtime.sendMessage({
        action: 'START_AREA_SELECTION',
        tabId: tab.id
      }, (response) => {
        if (chrome.runtime.lastError) {
          setStatus('error', 'Failed: ' + chrome.runtime.lastError.message);
          return;
        }
        // Close popup immediately so user can drag selection on page
        window.close();
      });
    } catch (err) {
      setStatus('error', err.message || 'Failed to start selection');
    }
  });

  /**
   * Action: Capture Entire Tab
   */
  btnCaptureTab.addEventListener('click', async () => {
    try {
      setStatus('working', 'Checking tab...');
      const tab = await getActiveTab();

      if (!tab || !tab.id) {
        setStatus('error', 'No active tab found');
        return;
      }

      if (isRestrictedUrl(tab.url)) {
        setStatus('error', 'Cannot capture Chrome system/Web Store pages');
        return;
      }

      setStatus('working', 'Capturing viewport...');

      // Send capture request to background
      chrome.runtime.sendMessage({
        action: 'CAPTURE_ENTIRE_TAB',
        tabId: tab.id
      }, (response) => {
        if (chrome.runtime.lastError) {
          setStatus('error', 'Capture error: ' + chrome.runtime.lastError.message);
          return;
        }

        if (response && response.success) {
          setStatus('working', 'Captured! Initializing OCR...');
          // Popup will also be kept updated or redirect to results.html
          if (response.text) {
            showResult(response.text);
          }
        } else if (response && response.error) {
          setStatus('error', response.error);
        }
      });
    } catch (err) {
      setStatus('error', err.message || 'Failed to capture tab');
    }
  });

  /**
   * Action: Open Full Results Tab
   */
  btnOpenFull.addEventListener('click', async () => {
    const resultsUrl = chrome.runtime.getURL('results.html');
    const tabs = await chrome.tabs.query({ url: resultsUrl });
    if (tabs.length > 0) {
      await chrome.tabs.update(tabs[0].id, { active: true });
    } else {
      await chrome.tabs.create({ url: resultsUrl });
    }
    window.close();
  });

  /**
   * Action: Copy Text
   */
  btnCopy.addEventListener('click', async () => {
    const text = resultEditor.value;
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      btnCopy.classList.add('copied');
      copyBtnLabel.textContent = 'Copied!';
      setTimeout(() => {
        btnCopy.classList.remove('copied');
        copyBtnLabel.textContent = 'Copy';
      }, 2000);
    } catch (err) {
      // Fallback
      resultEditor.select();
      document.execCommand('copy');
      copyBtnLabel.textContent = 'Copied!';
      setTimeout(() => {
        copyBtnLabel.textContent = 'Copy';
      }, 2000);
    }
  });

  /**
   * Action: Select All
   */
  btnSelectAll.addEventListener('click', () => {
    resultEditor.focus();
    resultEditor.select();
  });

  /**
   * Action: Clear
   */
  btnClear.addEventListener('click', async () => {
    if (!resultEditor.value) return;
    resultEditor.value = '';
    updateCounts();
    resultsSection.classList.add('hidden');
    await chrome.storage.local.remove(['latestExtractedText', 'capturedImage', 'cropData']);
    setStatus('idle', 'Text and screenshot cleared');
  });

  /**
   * Action: Download TXT
   */
  btnDownload.addEventListener('click', () => {
    const text = resultEditor.value;
    if (!text) return;

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
  });

  /**
   * Textarea input event: update counters
   */
  resultEditor.addEventListener('input', () => {
    updateCounts();
    chrome.storage.local.set({ latestExtractedText: resultEditor.value });
  });

  // Listen for messages from background (e.g., OCR completion)
  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'OCR_COMPLETED' && message.text) {
      showResult(message.text);
    } else if (message.action === 'OCR_STATUS') {
      setStatus(message.statusType || 'working', message.message || 'Processing...');
    }
  });
});
