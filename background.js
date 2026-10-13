/**
 * ScreenText AI - Background Service Worker (background.js)
 * Coordinates screenshot capture, content script injection, and results workflow.
 */

// Helper to log with prefix
const log = (...args) => console.log('[ScreenText AI Background]', ...args);

/**
 * Checks if a tab URL is restricted by Chrome extension security policies
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
 * Resolves the target web tab for capture or area selection
 */
async function resolveTargetTab(providedTabId) {
  if (providedTabId) {
    try {
      const tab = await chrome.tabs.get(providedTabId);
      if (tab) return tab;
    } catch (e) {
      // Ignored
    }
  }

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const extensionPrefix = chrome.runtime.getURL('');

  // If the active tab is our results page or an extension page, find the most recent normal tab
  if (activeTab && activeTab.url && activeTab.url.startsWith(extensionPrefix)) {
    const allTabs = await chrome.tabs.query({ currentWindow: true });
    const normalTab = allTabs.find(t => t.url && !t.url.startsWith(extensionPrefix) && !isRestrictedUrl(t.url));
    if (normalTab) {
      await chrome.tabs.update(normalTab.id, { active: true });
      await new Promise(r => setTimeout(r, 150));
      return normalTab;
    }
  }

  return activeTab;
}

/**
 * Handle incoming runtime messages
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  log('Received message:', message.action);

  if (message.action === 'START_AREA_SELECTION') {
    handleStartAreaSelection(message.tabId, sendResponse);
    return true; // asynchronous response
  }

  if (message.action === 'CAPTURE_ENTIRE_TAB') {
    handleCaptureEntireTab(message.tabId, sendResponse);
    return true; // asynchronous response
  }

  if (message.action === 'AREA_SELECTED') {
    handleAreaSelected(message.crop, sender.tab, sendResponse);
    return true;
  }

  if (message.action === 'SELECTION_CANCELLED') {
    log('Area selection cancelled by user');
    chrome.storage.local.set({
      latestStatus: { type: 'idle', message: 'Selection cancelled' }
    });
    sendResponse({ success: true });
    return false;
  }
});

/**
 * Injects content script and CSS into active tab to launch selection overlay
 */
async function handleStartAreaSelection(tabId, sendResponse) {
  try {
    const targetTab = await resolveTargetTab(tabId);

    if (!targetTab || !targetTab.id) {
      sendResponse({ success: false, error: 'No active tab found to select from.' });
      return;
    }

    if (isRestrictedUrl(targetTab.url)) {
      sendResponse({ success: false, error: 'Cannot capture Chrome system or Web Store pages due to security restrictions.' });
      return;
    }

    // 1. Inject CSS and content script programmatically
    await chrome.scripting.insertCSS({
      target: { tabId: targetTab.id },
      files: ['content.css']
    });

    await chrome.scripting.executeScript({
      target: { tabId: targetTab.id },
      files: ['content.js']
    });

    // 2. Trigger overlay initialization in content script
    chrome.tabs.sendMessage(targetTab.id, { action: 'INIT_SELECTION_OVERLAY' }, (res) => {
      if (chrome.runtime.lastError) {
        log('Error notifying content script:', chrome.runtime.lastError.message);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true });
      }
    });
  } catch (err) {
    log('Failed to start area selection:', err);
    sendResponse({ success: false, error: err.message || 'Injection failed' });
  }
}

/**
 * Captures visible tab and stores screenshot data
 */
async function handleCaptureEntireTab(tabId, sendResponse) {
  try {
    const targetTab = await resolveTargetTab(tabId);

    if (!targetTab || !targetTab.id) {
      sendResponse({ success: false, error: 'No active tab found to capture.' });
      return;
    }

    if (isRestrictedUrl(targetTab.url)) {
      sendResponse({ success: false, error: 'Cannot capture Chrome system or Web Store pages due to security restrictions.' });
      return;
    }

    // Capture tab viewport
    const dataUrl = await chrome.tabs.captureVisibleTab(targetTab.windowId, { format: 'png' });

    if (!dataUrl) {
      sendResponse({ success: false, error: 'Failed to capture tab screenshot' });
      return;
    }

    // Store in chrome.storage.local for results page and popup
    await chrome.storage.local.set({
      capturedImage: dataUrl,
      cropData: null, // full tab
      captureTimestamp: Date.now(),
      latestStatus: { type: 'working', message: 'Tab captured. Starting OCR...' }
    });

    // Open dedicated results tab
    await openResultsTab();

    sendResponse({ success: true });
  } catch (err) {
    log('Capture entire tab error:', err);
    sendResponse({ success: false, error: err.message || 'Failed to capture visible tab' });
  }
}

/**
 * Handles cropped area received from content script
 */
async function handleAreaSelected(crop, tab, sendResponse) {
  try {
    log('Handling area selected:', crop);

    const windowId = tab ? tab.windowId : null;
    const dataUrl = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });

    if (!dataUrl) {
      sendResponse({ success: false, error: 'Screenshot capture failed' });
      return;
    }

    // Save image & crop data to storage
    await chrome.storage.local.set({
      capturedImage: dataUrl,
      cropData: crop,
      captureTimestamp: Date.now(),
      latestStatus: { type: 'working', message: 'Area captured. Starting OCR...' }
    });

    // Open results tab to process and display OCR
    await openResultsTab();

    sendResponse({ success: true });
  } catch (err) {
    log('Area selected processing error:', err);
    sendResponse({ success: false, error: err.message });
  }
}

/**
 * Helper to open or focus results.html tab
 */
async function openResultsTab() {
  const resultsUrl = chrome.runtime.getURL('results.html');
  const tabs = await chrome.tabs.query({ url: resultsUrl });

  if (tabs.length > 0) {
    // Focus existing results tab and trigger capture reload
    await chrome.tabs.update(tabs[0].id, { active: true });
    chrome.tabs.sendMessage(tabs[0].id, { action: 'NEW_CAPTURE_READY' });
  } else {
    // Open a new results tab
    await chrome.tabs.create({ url: resultsUrl });
  }
}
