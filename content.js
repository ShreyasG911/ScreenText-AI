/**
 * ScreenText AI - Content Script (content.js)
 * Manages the screen selection overlay, drag rectangle, and coordinate calculation.
 */

(() => {
  // Prevent duplicate instances
  if (window.__screentextActiveOverlay) {
    window.__screentextActiveOverlay.cleanup();
  }

  class ScreenTextSelectionManager {
    constructor() {
      this.root = null;
      this.selectionBox = null;
      this.badge = null;
      this.isDragging = false;
      this.startX = 0;
      this.startY = 0;
      this.currentX = 0;
      this.currentY = 0;

      // Bound event handlers for clean removal
      this.onMouseDown = this.handleMouseDown.bind(this);
      this.onMouseMove = this.handleMouseMove.bind(this);
      this.onMouseUp = this.handleMouseUp.bind(this);
      this.onKeyDown = this.handleKeyDown.bind(this);
      this.onWindowBlur = this.handleWindowBlur.bind(this);

      window.__screentextActiveOverlay = this;
    }

    init() {
      this.createOverlayDOM();
      this.attachEventListeners();
    }

    createOverlayDOM() {
      // Remove any leftover element
      const existing = document.getElementById('screentext-overlay-root');
      if (existing) existing.remove();

      // Main container
      this.root = document.createElement('div');
      this.root.id = 'screentext-overlay-root';

      // Top instruction bar
      const bar = document.createElement('div');
      bar.className = 'screentext-instruction-bar';
      bar.innerHTML = `
        <div class="screentext-instruction-text">
          <span>Click & drag to select text</span>
          <span>•</span>
          <span>Press <span class="screentext-kbd">Esc</span> to cancel</span>
        </div>
        <button id="screentext-btn-cancel" class="screentext-cancel-btn">Cancel</button>
      `;

      // Active selection box
      this.selectionBox = document.createElement('div');
      this.selectionBox.className = 'screentext-selection-box';

      // Dimension badge
      this.badge = document.createElement('div');
      this.badge.className = 'screentext-badge';
      this.badge.textContent = '0 × 0 px';
      this.selectionBox.appendChild(this.badge);

      this.root.appendChild(bar);
      this.root.appendChild(this.selectionBox);
      document.body.appendChild(this.root);

      // Cancel button event
      const cancelBtn = bar.querySelector('#screentext-btn-cancel');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          this.cancelSelection();
        });
      }
    }

    attachEventListeners() {
      this.root.addEventListener('mousedown', this.onMouseDown, true);
      this.root.addEventListener('wheel', (e) => { e.preventDefault(); }, { passive: false });
      window.addEventListener('mousemove', this.onMouseMove, true);
      window.addEventListener('mouseup', this.onMouseUp, true);
      window.addEventListener('keydown', this.onKeyDown, true);
      window.addEventListener('blur', this.onWindowBlur, true);
    }

    handleMouseDown(e) {
      // Ignore right clicks or clicks on top cancel button
      if (e.button !== 0 || e.target.closest('#screentext-btn-cancel')) return;

      e.preventDefault();
      e.stopPropagation();

      this.isDragging = true;
      this.startX = e.clientX;
      this.startY = e.clientY;
      this.currentX = e.clientX;
      this.currentY = e.clientY;

      this.updateSelectionBox();
      this.selectionBox.style.display = 'block';
    }

    handleMouseMove(e) {
      if (!this.isDragging) return;

      e.preventDefault();
      e.stopPropagation();

      this.currentX = Math.max(0, Math.min(e.clientX, window.innerWidth));
      this.currentY = Math.max(0, Math.min(e.clientY, window.innerHeight));

      this.updateSelectionBox();
    }

    updateSelectionBox() {
      const x = Math.min(this.startX, this.currentX);
      const y = Math.min(this.startY, this.currentY);
      const w = Math.abs(this.currentX - this.startX);
      const h = Math.abs(this.currentY - this.startY);

      this.selectionBox.style.left = `${x}px`;
      this.selectionBox.style.top = `${y}px`;
      this.selectionBox.style.width = `${w}px`;
      this.selectionBox.style.height = `${h}px`;

      if (this.badge) {
        this.badge.textContent = `${Math.round(w)} × ${Math.round(h)} px`;
        // Position badge above or below depending on room
        if (y + h + 35 > window.innerHeight) {
          this.badge.style.bottom = 'auto';
          this.badge.style.top = '-28px';
        } else {
          this.badge.style.top = 'auto';
          this.badge.style.bottom = '-28px';
        }
      }
    }

    handleMouseUp(e) {
      if (!this.isDragging) return;

      e.preventDefault();
      e.stopPropagation();

      this.isDragging = false;

      const x = Math.min(this.startX, this.currentX);
      const y = Math.min(this.startY, this.currentY);
      const width = Math.abs(this.currentX - this.startX);
      const height = Math.abs(this.currentY - this.startY);

      // Minimum threshold: ignore accidental micro-clicks (< 6px)
      if (width < 6 || height < 6) {
        this.selectionBox.style.display = 'none';
        return;
      }

      const cropDetails = {
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(width),
        height: Math.round(height),
        dpr: window.devicePixelRatio || 1,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight
      };

      // 1. Hide overlay immediately so it's not captured in screenshot
      if (this.root) {
        this.root.style.display = 'none';
      }

      // 2. Allow browser one repaint frame without overlay before triggering capture
      setTimeout(() => {
        try {
          chrome.runtime.sendMessage({
            action: 'AREA_SELECTED',
            crop: cropDetails
          });
        } catch (err) {
          console.error('[ScreenText AI] Error sending crop coordinates:', err);
        } finally {
          this.cleanup();
        }
      }, 50);
    }

    handleKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.cancelSelection();
      }
    }

    handleWindowBlur() {
      // Clean up if user switches tabs or windows
      this.cancelSelection();
    }

    cancelSelection() {
      try {
        chrome.runtime.sendMessage({ action: 'SELECTION_CANCELLED' });
      } catch (err) {
        // Ignored
      }
      this.cleanup();
    }

    cleanup() {
      window.removeEventListener('mousemove', this.onMouseMove, true);
      window.removeEventListener('mouseup', this.onMouseUp, true);
      window.removeEventListener('keydown', this.onKeyDown, true);
      window.removeEventListener('blur', this.onWindowBlur, true);

      if (this.root && this.root.parentNode) {
        this.root.remove();
      }
      this.root = null;
      this.selectionBox = null;
      this.badge = null;
      window.__screentextActiveOverlay = null;
    }
  }

  // Listen for message from background to activate
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'INIT_SELECTION_OVERLAY') {
      const manager = new ScreenTextSelectionManager();
      manager.init();
      sendResponse({ success: true });
      return true;
    }
  });
})();
