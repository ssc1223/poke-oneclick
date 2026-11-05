// jsdom 沒有排版，offsetParent 永遠是 null；這裡依 display:none 模擬「是否看得見」
export function polyfillOffsetParent(win) {
  Object.defineProperty(win.HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get() {
      if (!this.isConnected) return null;
      for (let e = this; e; e = e.parentElement) {
        if (e.style && e.style.display === 'none') return null;
      }
      return this.ownerDocument.body;
    },
  });
}
