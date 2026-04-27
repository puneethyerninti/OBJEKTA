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
    // jsdom logs noisy "Not implemented" warnings for 2D canvas. For tests that
    // only need a shape-compatible context, return a deterministic stub directly.
    if (type === "2d") {
      return makeCanvas2DContext(this);
    }

    if (typeof originalGetContext !== "function") {
      return null;
    }

    try {
      return originalGetContext.call(this, type, ...args);
    } catch (_err) {
      return null;
    }
  };
}
