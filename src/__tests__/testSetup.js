// src/__tests__/testSetup.js
// Shared Vitest setup for browser APIs that jsdom does not fully implement.

function makeImageData(width, height) {
  return {
    data: new Uint8ClampedArray(Math.max(1, width * height * 4)),
    width,
    height,
  };
}

function makeCanvas2DContext(canvas) {
  return {
    canvas,
    fillStyle: "#000000",
    strokeStyle: "#000000",
    lineWidth: 1,
    globalAlpha: 1,
    fillRect() {},
    clearRect() {},
    strokeRect() {},
    beginPath() {},
    closePath() {},
    moveTo() {},
    lineTo() {},
    arc() {},
    fill() {},
    stroke() {},
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    scale() {},
    createLinearGradient() {
      return { addColorStop() {} };
    },
    createRadialGradient() {
      return { addColorStop() {} };
    },
    createImageData(width, height) {
      return makeImageData(width, height);
    },
    getImageData(_x, _y, width, height) {
      return makeImageData(width, height);
    },
    putImageData() {},
  };
}

if (typeof HTMLCanvasElement !== "undefined") {
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function patchedGetContext(type, ...args) {
    const fallback = type === "2d" ? makeCanvas2DContext(this) : null;

    if (typeof originalGetContext !== "function") {
      return fallback;
    }

    try {
      const ctx = originalGetContext.call(this, type, ...args);
      return ctx || fallback;
    } catch (_err) {
      return fallback;
    }
  };
}
