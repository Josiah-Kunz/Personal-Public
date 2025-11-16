// ----- helper you already provided (kept as-is) -----
function findSpritesWithPattern(patterns, reference) {
  if (typeof reference === "undefined") reference = "skin";
  let matches = [];
  for (let objName in game.objects["ids"]) {
    let gameObject = game.objects["ids"][objName];
    if (!gameObject) continue;

    let candidate = String(reference === "uid" ? gameObject.uid : gameObject.skin);

    for (let i = 0; i < patterns.length; i++) {
      var pattern = patterns[i];
      if (candidate.includes(pattern)) {
        if (reference === "uid" && gameObject.sprite) {
          gameObject.sprite.uid = gameObject.uid;
        }
        if (gameObject.sprite) matches.push(gameObject.sprite);
        break;
      }
    }
  }
  return matches;
}

// ----- Utility functions -----
function rgbToHex(r, g, b) {
  function toHex(c) { var s = c.toString(16); return s.length === 1 ? "0" + s : s; }
  return "#" + toHex(r) + toHex(g) + toHex(b);
}

function hexToRgb(hex) {
  hex = hex.replace("#", "");
  if (hex.length === 3) hex = hex.split("").map(function (c) { return c + c; }).join("");
  var int = parseInt(hex, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  var max = Math.max(r, g, b), min = Math.min(r, g, b);
  var h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; } else {
    var d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h, s: s, l: l };
}

// Sort palette by hue (option D)
function sortColorsByHue(colors) {
  var withHue = colors.map(function (hex) {
    var c = hexToRgb(hex);
    return { hex: hex, hue: rgbToHsl(c.r, c.g, c.b).h };
  });
  withHue.sort(function (a, b) { return a.hue - b.hue; });
  return withHue.map(function (c) { return c.hex; });
}

// ----- Main paintingGame (function-style) -----
function paintingGame(game, config) {
  if (typeof config === "undefined") config = {};

  // config defaults
  var width = config.width || 356;
  var height = config.height || 288;
  var shape = config.shape || "square"; // fallback shapes still supported
  var shapeConfig = config.shapeConfig || { x: 100, y: 100, size: 200 };
  var colors = config.colors || ["#FF0000"]; // fallback
  var initialBrushSize = typeof config.initialBrushSize === "number" ? config.initialBrushSize : 10;
  var initialBrushShape = config.initialBrushShape || "square";
  var showBrushSizePicker = typeof config.showBrushSizePicker === "boolean" ? config.showBrushSizePicker : true;
  var showBrushShapePicker = typeof config.showBrushShapePicker === "boolean" ? config.showBrushShapePicker : true;
  var showDoneButton = typeof config.showDoneButton === "boolean" ? config.showDoneButton : true;
  var completenessThreshold = typeof config.completenessThreshold === "number" ? config.completenessThreshold : 0.95;
  var forgivenessRatio = typeof config.forgivenessRatio === "number" ? config.forgivenessRatio : 0.1;
  var onWin = typeof config.onWin === "function" ? config.onWin : function () { console.log("You win!"); };
  var onLose = typeof config.onLose === "function" ? config.onLose : function () { console.log("Too much outside the lines!"); };

  // mask options - you can provide maskPattern: ["voltorb_mask"] or maskSprite directly
  var maskPattern = config.maskPattern || null;
  var maskSprite = config.maskSprite || null;

  var brushSize = initialBrushSize;
  var brushShape = initialBrushShape;

  var x0 = Math.floor((game.width - width) / 2);
  var y0 = Math.floor((game.height - height) / 2);

  var lastX = null;
  var lastY = null;

  var canvas = document.createElement("canvas");
  canvas.id = "game-painting";
  canvas.width = game.width;
  canvas.height = game.height;
  Object.assign(canvas.style, {
    position: "absolute",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    imageRendering: "pixelated",
    pointerEvents: "auto"
  });
  var ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  var cursorCanvas = document.createElement("canvas");
  cursorCanvas.width = game.width;
  cursorCanvas.height = game.height;
  Object.assign(cursorCanvas.style, {
    position: "absolute",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    zIndex: "1",
    pointerEvents: "none",
    imageRendering: "pixelated"
  });
  var cCtx = cursorCanvas.getContext("2d");
  cCtx.imageSmoothingEnabled = false;

  var gameContainer = document.getElementById("game-container");
  if (gameContainer) {
    gameContainer.appendChild(canvas);
    gameContainer.appendChild(cursorCanvas);
  }

  var isDrawing = false;
  var currentColor = colors[0];

  // Mask structures
  var maskImage = null;
  var maskWidth = 0;
  var maskHeight = 0;
  // maskIndexMap maps flat index (y*maskWidth + x) -> color hex string or null for forbidden
  var maskIndexMap = null;
  // palette: array of hex strings (paintable colors)
  var palette = [];
  // quick lookup: color -> { total: n, painted: nPainted, pixels: Set of flat indices }
  var regions = {};

  // track painted pixels on the canvas as flat index "x,y"
  var paintedInside = new Set();
  var paintedOutside = new Set();

  var centerX = width / 2 + x0;
  var centerY = height / 2 + y0;

  // fallback geometric shapes (kept for backwards compatibility if no mask provided)
  function shapeSquare(x, y, cfg) {
    var cx = cfg.x, cy = cfg.y, size = cfg.size;
    var half = size / 2;
    var absX = centerX + cx;
    var absY = centerY + cy;
    return x >= absX - half && x < absX + half && y >= absY - half && y < absY + half;
  }
  function shapeCircle(x, y, cfg) {
    var cx = cfg.x, cy = cfg.y, radius = cfg.radius;
    var absX = centerX + cx;
    var absY = centerY + cy;
    var dx = x - absX, dy = y - absY;
    return dx * dx + dy * dy <= radius * radius;
  }

  // Load mask from a sprite object (sprite should provide .url or .src)
  function loadMaskFromSprite(sprite, callback) {
    // sprite may be a string (URL), or an object with common url/src fields
    var url = null;
    if (!sprite) { callback(new Error("No sprite provided")); return; }

    if (typeof sprite === "string") url = sprite;
    else {
      url = sprite.url || sprite.src || sprite.image || sprite.path || sprite.texture || sprite.sheet;
      // last resort: try to stringify
      if (!url && sprite.uid && sprite.skin) {
        // can't turn sprite into URL: fail gracefully
        url = null;
      }
    }
    if (!url) { callback(new Error("Sprite has no recognized URL field")); return; }

    var img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = function () {
      maskImage = img;
      maskWidth = img.width;
      maskHeight = img.height;

      var tcanvas = document.createElement("canvas");
      tcanvas.width = maskWidth;
      tcanvas.height = maskHeight;
      var tctx = tcanvas.getContext("2d");
      tctx.drawImage(img, 0, 0);
      var imgData = tctx.getImageData(0, 0, maskWidth, maskHeight).data;

      // Build maskIndexMap and regions
      maskIndexMap = new Array(maskWidth * maskHeight);
      var colorList = [];
      var colorToIndex = {};

      for (var my = 0; my < maskHeight; my++) {
        for (var mx = 0; mx < maskWidth; mx++) {
          var i = (my * maskWidth + mx) * 4;
          var r = imgData[i], g = imgData[i + 1], b = imgData[i + 2], a = imgData[i + 3];

          // Transparent => forbidden
          if (a === 0) {
            maskIndexMap[my * maskWidth + mx] = null;
            continue;
          }

          var hex = rgbToHex(r, g, b).toUpperCase();

          // White or black exact => forbidden per rules
          if (hex === "#FFFFFF" || hex === "#000000") {
            maskIndexMap[my * maskWidth + mx] = null;
            continue;
          }

          // Otherwise this is a paintable color
          // Record unique palette colors
          if (!(hex in colorToIndex)) {
            colorToIndex[hex] = colorList.length;
            colorList.push(hex);
            regions[hex] = { total: 0, painted: 0, pixels: new Set() };
          }

          var idx = colorToIndex[hex];
          maskIndexMap[my * maskWidth + mx] = hex;
          regions[hex].total += 1;
          regions[hex].pixels.add(my * maskWidth + mx);
        }
      }

      // Sort palette by hue (option D)
      palette = sortColorsByHue(colorList);

      callback(null);
    };
    img.onerror = function (err) {
      callback(new Error("Failed to load mask image: " + err));
    };
    img.src = url;
  }

  // If maskPattern provided, attempt to find sprite via findSpritesWithPattern
  function locateAndLoadMask(callback) {
    if (maskSprite) {
      loadMaskFromSprite(maskSprite, callback);
    } else if (maskPattern && maskPattern.length > 0) {
      var sprites = findSpritesWithPattern(maskPattern, "skin");
      if (sprites && sprites.length > 0) {
        // use first match
        loadMaskFromSprite(sprites[0], callback);
      } else {
        callback(new Error("No sprite found matching pattern"));
      }
    } else {
      // No mask configured; callback success but maskIndexMap remains null (fallback to shapes)
      callback(null);
    }
  }

  // Draw the mask overlay (outline) scaled into the content region
  function drawMaskOverlay() {
    // clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // white background
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(x0, y0, width, height);

    if (!maskImage) {
      // fallback: draw shape outline
      ctx.strokeStyle = "#00000040";
      ctx.lineWidth = 1;
      ctx.beginPath();
      if (shape === "square") {
        var cfg = shapeConfig;
        var half = cfg.size / 2;
        var absX = centerX + cfg.x;
        var absY = centerY + cfg.y;
        ctx.rect(absX - half, absY - half, cfg.size, cfg.size);
        ctx.stroke();
      } else if (shape === "circle") {
        var cfg2 = shapeConfig;
        var absXC = centerX + cfg2.x;
        var absYC = centerY + cfg2.y;
        ctx.beginPath();
        ctx.arc(absXC, absYC, cfg2.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      return;
    }

    // draw mask image scaled to the target content rectangle
    ctx.save();
    ctx.globalAlpha = 1.0;
    ctx.drawImage(maskImage, x0, y0, width, height);
    ctx.restore();
  }

  // Convert client coordinates to canvas pixel coordinates
  function clientToCanvas(clientX, clientY, cvs) {
    var rect = cvs.getBoundingClientRect();
    var x = Math.floor((clientX - rect.left) * cvs.width / rect.width);
    var y = Math.floor((clientY - rect.top) * cvs.height / rect.height);
    return { x: x, y: y };
  }

  // Convert canvas pixel (x,y) into mask coordinates (mx,my) - returns null if outside mask area
  function canvasToMaskXY(x, y) {
    // only within the content rect (x0..x0+width-1, y0..y0+height-1)
    if (x < x0 || x >= x0 + width || y < y0 || y >= y0 + height) return null;
    if (!maskImage) return null;
    var relX = x - x0;
    var relY = y - y0;
    var mx = Math.floor(relX * maskWidth / width);
    var my = Math.floor(relY * maskHeight / height);
    if (mx < 0 || mx >= maskWidth || my < 0 || my >= maskHeight) return null;
    return { mx: mx, my: my };
  }

  // Helper to get mask color at canvas pixel (x,y). Returns hex or null if forbidden/no-mask.
  function getMaskColorAtCanvasXY(x, y) {
    var m = canvasToMaskXY(x, y);
    if (!m) return null;
    var flat = m.my * maskWidth + m.mx;
    return maskIndexMap ? maskIndexMap[flat] || null : null;
  }

  // Draw a "point" with selected color onto the permanent canvas and track stats.
  function applyBrushPoint(x, y) {
    var half = Math.floor(brushSize / 2);

    // iterate brush footprint in pixel coordinates
    for (var dx = -half; dx <= half; dx++) {
      for (var dy = -half; dy <= half; dy++) {
        // if circle brush, skip outside circle
        if (brushShape === "circle") {
          if (dx * dx + dy * dy > (brushSize / 2) * (brushSize / 2)) continue;
        }

        var px = x + dx;
        var py = y + dy;

        // boundary check to content area
        if (px < x0 || px >= x0 + width || py < y0 || py >= y0 + height) continue;

        var maskHex = getMaskColorAtCanvasXY(px, py);
        var key = px + "," + py;

        if (maskHex && maskHex === currentColor) {
          // paint inside correct region
          // draw pixel onto canvas (we use fillRect for speed; could be imageData for more control)
          ctx.fillStyle = currentColor;
          ctx.fillRect(px, py, 1, 1);

          if (!paintedInside.has(key)) {
            paintedInside.add(key);
            // update region counts
            if (regions[maskHex]) {
              regions[maskHex].painted += 1;
            }
          }
        } else {
          // either forbidden or wrong-color region -> outside
          // We can choose to draw wrong color or ignore; here we draw the selected color to show mistake
          // If you'd prefer to ignore, comment out the next two lines.
          ctx.fillStyle = currentColor;
          ctx.fillRect(px, py, 1, 1);

          if (!paintedOutside.has(key)) paintedOutside.add(key);
        }
      }
    }
  }

  // Bresenham-ish line drawing via linear interpolation already used earlier
  function drawLinePoints(x1, y1, x2, y2) {
    var dx = x2 - x1;
    var dy = y2 - y1;
    var distance = Math.sqrt(dx * dx + dy * dy);
    var steps = Math.ceil(distance);
    for (var i = 0; i <= steps; i++) {
      var t = steps > 0 ? i / steps : 0;
      var x = Math.round(x1 + dx * t);
      var y = Math.round(y1 + dy * t);
      applyBrushPoint(x, y);
    }
  }

  // Cursor / preview draw
  function drawCursorPreview(clientX, clientY) {
    cCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
    var p = clientToCanvas(clientX, clientY, cursorCanvas);
    var x = p.x, y = p.y;
    var half = Math.floor(brushSize / 2);

    cCtx.globalAlpha = 1.0;
    cCtx.strokeStyle = "#000000";
    cCtx.lineWidth = 1;

    if (brushShape === "circle") {
      cCtx.beginPath();
      cCtx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
      cCtx.stroke();
    } else {
      cCtx.strokeRect(x - half, y - half, brushSize, brushSize);
    }
  }

  // Public: redraw everything (background + mask overlay + already painted content is on canvas)
  function redraw() {
    // we don't clear the permanent canvas painted content; but redraw background + mask overlay on top
    // To make outline visible, we re-draw the mask overlay after (but not clearing painted pixels)
    // Clear entire canvas and re-create painted content from paintedInside/paintedOutside sets would be expensive;
    // So we keep painted pixels permanently drawn and still overlay mask.
    drawMaskOverlay();
  }

  // Completion check
  function checkResult() {
    var totalPaintable = 0;
    var paintedCount = 0;
    for (var i = 0; i < palette.length; i++) {
      var hex = palette[i];
      if (regions[hex]) totalPaintable += regions[hex].total;
    }
    // paintedInside count approximated by paintedInside.size
    paintedCount = paintedInside.size;
    var comp = totalPaintable === 0 ? 0 : paintedCount / totalPaintable;
    var outRatio = paintedOutside.size / (paintedInside.size || 1);

    if (comp >= completenessThreshold && outRatio <= forgivenessRatio) {
      onWin({ completeness: comp, outsideRatio: outRatio, paintedInside: paintedInside.size, paintedOutside: paintedOutside.size, totalInside: totalPaintable, threshold: completenessThreshold });
    } else {
      onLose({ completeness: comp, outsideRatio: outRatio, paintedInside: paintedInside.size, paintedOutside: paintedOutside.size, totalInside: totalPaintable, threshold: completenessThreshold });
    }
  }

  // Mouse / touch event handlers
  canvas.addEventListener("mousedown", function (e) {
    isDrawing = true;
    var p = clientToCanvas(e.clientX, e.clientY, canvas);
    applyBrushPoint(p.x, p.y);
    lastX = p.x;
    lastY = p.y;
  });

  canvas.addEventListener("mousemove", function (e) {
    drawCursorPreview(e.clientX, e.clientY);
    if (isDrawing) {
      var p = clientToCanvas(e.clientX, e.clientY, canvas);
      if (lastX !== null && lastY !== null) drawLinePoints(lastX, lastY, p.x, p.y);
      else applyBrushPoint(p.x, p.y);
      lastX = p.x;
      lastY = p.y;
    }
  });

  canvas.addEventListener("mouseup", function () {
    isDrawing = false;
    lastX = null;
    lastY = null;
  });

  canvas.addEventListener("mouseleave", function () {
    isDrawing = false;
    lastX = null;
    lastY = null;
  });

  canvas.addEventListener("touchstart", function (e) {
    e.preventDefault();
    e.stopPropagation();
    isDrawing = true;
    var t = e.touches[0];
    var p = clientToCanvas(t.clientX, t.clientY, canvas);
    applyBrushPoint(p.x, p.y);
    lastX = p.x;
    lastY = p.y;
  }, { passive: false });

  canvas.addEventListener("touchmove", function (e) {
    e.preventDefault();
    e.stopPropagation();
    var t = e.touches[0];
    drawCursorPreview(t.clientX, t.clientY);
    if (isDrawing) {
      var p = clientToCanvas(t.clientX, t.clientY, canvas);
      if (lastX !== null && lastY !== null) drawLinePoints(lastX, lastY, p.x, p.y);
      else applyBrushPoint(p.x, p.y);
      lastX = p.x;
      lastY = p.y;
    }
  }, { passive: false });

  canvas.addEventListener("touchend", function (e) {
    e.preventDefault();
    e.stopPropagation();
    isDrawing = false;
    lastX = null;
    lastY = null;
  }, { passive: false });

  // UI container: brush size, shape, palette, done button
  var uiContainer = null;

  function buildUI() {
    if (!gameContainer) return;
    uiContainer = document.createElement("div");
    Object.assign(uiContainer.style, {
      position: "absolute",
      bottom: "4px",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: "2000",
      backgroundColor: "rgba(255,255,255,0.95)",
      padding: "8px",
      borderRadius: "6px",
      border: "2px solid black",
      display: "flex",
      gap: "8px",
      alignItems: "center",
      flexWrap: "wrap",
      maxWidth: "90%"
    });

    // brush size
    if (showBrushSizePicker) {
      var brushDiv = document.createElement("div");
      brushDiv.innerHTML = '<label style="display:block;margin-bottom:3px;font-size:12px;font-weight:bold;color:black">Brush Size: <span id="brushSizeValue">' + brushSize + '</span></label>';
      var inputRange = document.createElement("input");
      inputRange.type = "range";
      inputRange.id = "brushSizeSlider";
      inputRange.min = 1;
      inputRange.max = 100;
      inputRange.value = brushSize;
      inputRange.style.width = "120px";
      inputRange.addEventListener("input", function (ev) {
        brushSize = parseInt(ev.target.value, 10);
        var el = document.getElementById("brushSizeValue");
        if (el) el.textContent = brushSize;
        game.trigger("mapvar[brush_size]=" + brushSize);
      });
      brushDiv.appendChild(inputRange);
      uiContainer.appendChild(brushDiv);
    }

    // brush shape picker
    if (showBrushShapePicker) {
      var shapeDiv = document.createElement("div");
      shapeDiv.innerHTML = '<label style="display:block;margin-bottom:3px;font-size:12px;font-weight:bold;color:black">Brush Shape:</label>';
      var select = document.createElement("select");
      select.id = "brushShapeSelect";
      var optSquare = document.createElement("option");
      optSquare.value = "square";
      optSquare.text = "Square";
      var optCircle = document.createElement("option");
      optCircle.value = "circle";
      optCircle.text = "Circle";
      select.appendChild(optSquare);
      select.appendChild(optCircle);
      select.value = brushShape;
      select.addEventListener("change", function (ev) {
        brushShape = ev.target.value;
        game.trigger("mapvar[brush_shape]=" + (brushShape === "circle" ? 2 : 1));
      });
      shapeDiv.appendChild(select);
      uiContainer.appendChild(shapeDiv);
    }

    // palette container (populated after mask loads)
    var paletteHolder = document.createElement("div");
    paletteHolder.id = "paletteHolder";
    paletteHolder.style.display = "flex";
    paletteHolder.style.gap = "6px";
    paletteHolder.style.alignItems = "center";
    uiContainer.appendChild(paletteHolder);

    // done button
    if (showDoneButton) {
      var doneBtn = document.createElement("button");
      doneBtn.textContent = "Done";
      Object.assign(doneBtn.style, { padding: "8px 14px", fontSize: "14px", fontWeight: "bold", backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" });
      doneBtn.addEventListener("click", function () { checkResult(); });
      uiContainer.appendChild(doneBtn);
    }

    gameContainer.appendChild(uiContainer);
  }

  // create palette UI buttons from palette array (palette populated after mask load)
  function renderPalette() {
    var holder = document.getElementById("paletteHolder");
    if (!holder) return;
    holder.innerHTML = "";
    if (!palette || palette.length === 0) {
      // fallback: show single color (currentColor)
      var b = document.createElement("button");
      b.textContent = "Color";
      holder.appendChild(b);
      return;
    }
    for (var i = 0; i < palette.length; i++) {
      (function (hex) {
        var btn = document.createElement("button");
        btn.title = hex;
        btn.style.width = "26px";
        btn.style.height = "26px";
        btn.style.border = "2px solid black";
        btn.style.background = hex;
        btn.style.cursor = "pointer";
        btn.style.padding = "0";
        btn.style.outline = "none";
        btn.addEventListener("click", function () {
          currentColor = hex;
          // highlight selected
          var children = holder.children;
          for (var k = 0; k < children.length; k++) children[k].style.boxShadow = "";
          btn.style.boxShadow = "0 0 0 3px rgba(0,0,0,0.25) inset";
        });
        holder.appendChild(btn);
        // auto-select first
        if (i === 0) {
          currentColor = hex;
          setTimeout(function () { btn.style.boxShadow = "0 0 0 3px rgba(0,0,0,0.25) inset"; }, 0);
        }
      })(palette[i]);
    }
  }

  // API: set brush shape / size externally
  function setBrushSize(s) {
    brushSize = s;
    var sEl = document.getElementById("brushSizeSlider");
    var vEl = document.getElementById("brushSizeValue");
    if (sEl) sEl.value = s;
    if (vEl) vEl.textContent = s;
  }

  function setBrushShape(s) {
    brushShape = s;
    var sel = document.getElementById("brushShapeSelect");
    if (sel) sel.value = s;
  }

  function reset() {
    paintedInside.clear();
    paintedOutside.clear();
    // clear canvas to white and redraw mask overlay (painted pixels remain cleared)
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawMaskOverlay();
    // reset region painted counts
    for (var c in regions) {
      if (regions.hasOwnProperty(c)) regions[c].painted = 0;
    }
  }

  // Initialize UI now
  buildUI();

  // Start mask loading and once loaded, prepare palette and initial overlay
  locateAndLoadMask(function (err) {
    if (err) {
      // no mask: fallback behavior (we still draw overlay)
      console.warn("Mask load issue:", err);
    }

    // If mask exists but palette is empty -> user might expect provided colors fallback
    if (palette.length === 0 && colors && colors.length > 0) {
      // use fallback colors (but only include those not white/black)
      palette = colors.filter(function (h) { return h.toUpperCase() !== "#FFFFFF" && h.toUpperCase() !== "#000000"; });
      palette = sortColorsByHue(palette);
      for (var ii = 0; ii < palette.length; ii++) {
        var h = palette[ii];
        if (!regions[h]) regions[h] = { total: 0, painted: 0, pixels: new Set() };
      }
    }

    // Render overlay and palette
    drawMaskOverlay();
    renderPalette();
  });

  // expose API and return
  return {
    canvas: canvas,
    ctx: ctx,
    setColor: function (c) { if (palette.indexOf(c) >= 0) currentColor = c; },
    setBrushSize: setBrushSize,
    setBrushShape: setBrushShape,
    reset: reset,
    getStats: function () {
      var total = 0;
      var painted = 0;
      for (var j = 0; j < palette.length; j++) {
        var hex = palette[j];
        if (regions[hex]) {
          total += regions[hex].total;
          painted += regions[hex].painted;
        }
      }
      return {
        completeness: total === 0 ? 0 : painted / total,
        outsideRatio: paintedOutside.size / (paintedInside.size || 1),
        paintedInside: paintedInside.size,
        paintedOutside: paintedOutside.size,
        totalInside: total
      };
    },
    destroy: function () {
      if (canvas.parentElement) canvas.parentElement.removeChild(canvas);
      if (cursorCanvas.parentElement) cursorCanvas.parentElement.removeChild(cursorCanvas);
      if (uiContainer && uiContainer.parentElement) uiContainer.parentElement.removeChild(uiContainer);
    }
  };
}

// ----- Example usage for Voltorb (mask must exist as a sprite matching pattern) -----
if (game.map.mapVars["paint_voltorb"] === 1) {
  game.trigger("mapvar[paint_voltorb]=2&with&freeze");
  console.log("Started painting a Voltorb!");

  var painting = paintingGame(game, {
    width: 200,
    height: 246,
    // ask the engine to find a sprite whose skin includes "voltorb_mask" (adjust pattern as needed)
    maskPattern: ["voltorb_mask"],      // <- change to the actual pattern in your assets
    // OR supply maskSprite: someSpriteObject
    shape: "voltorb",                  // only used as fallback if mask fails
    shapeConfig: { x: 0, y: 0, radius: 80 },
    colors: ["#FF0000"],               // fallback palette if mask not found
    initialBrushSize: game.map.mapVars["brush_size"] && game.map.mapVars["brush_size"] > 0 ? game.map.mapVars["brush_size"] : 30,
    initialBrushShape: game.map.mapVars["brush_shape"] === 2 ? "circle" : "square",
    showBrushSizePicker: true,
    showBrushShapePicker: true,
    showDoneButton: true,
    completenessThreshold: 0.90,
    forgivenessRatio: 0.15,
    onWin: function (stats) { console.log("Winner!", stats); painting.destroy(); game.trigger("mapvar[paint_voltorb]=100&unfreeze"); },
    onLose: function (stats) { console.log("Too messy! You lose!", stats); painting.destroy(); if (stats.completeness < stats.threshold) game.trigger("mapvar[paint_voltorb]=50&unfreeze"); else game.trigger("mapvar[paint_voltorb]=60&unfreeze"); }
  });
}
