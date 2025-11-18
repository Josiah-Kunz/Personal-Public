/**

A painting minigame that uses pre-drawn, pre-colored pieces of art. The player draws color on outlined versions and their performance is judged.

Example usage:

 - Upload a sprite to Pokengine. The sprite should be no bigger than 200 x 246 pixels.
 - On your map, create a sprite somewhere it can't be seen. Example:
    snorlax=sprite(186753/painting-mask-snorlax,void)
 - Have an NPC start the painting with, e.g.,:
	instructor.msg(Good luck!)&mapvar[paint_snorlax]=1
 - Modify this script with the relevant parameters. Make sure to put it at the very end of this script. Example:

	if (game.map.mapVars["paint_snorlax"] === 1) {
	  game.trigger("mapvar[paint_snorlax]=2&with&freeze");
	  console.log("Started painting a Snorlax!");

	  var painting = paintingGame(game, {
		width: 200,
		height: 246,
		maskPattern: ["painting-mask-snorlax"],
		initialBrushSize: game.map.mapVars["brush_size"] && game.map.mapVars["brush_size"] > 0 ? game.map.mapVars["brush_size"] : 30,
		initialBrushShape: game.map.mapVars["brush_shape"] === 2 ? "circle" : "square",
		showBrushSizePicker: true,
		showBrushShapePicker: true,
		showDoneButton: true,
		completenessThreshold: 0.98,
		forgivenessRatio: 0.08,
		onWin: function (stats) { 
		  console.log("Winner!", stats); 
		  painting.destroy(); 
		  game.trigger("mapvar[paint_snorlax]=100&unfreeze"); 
		},
		onLose: function (stats) { 
		  console.log("Too messy! You lose!", stats); 
		  painting.destroy(); 
		  if (stats.completeness < stats.threshold) game.trigger("mapvar[paint_snorlax]=50&unfreeze"); 
		  else game.trigger("mapvar[paint_snorlax]=60&unfreeze"); 
		}
	  });
	}
	
 - You can have follow-up conversations based on the performance. In this case:
	-> mapvar[paint_snorlax]=50 means the painting was incomplete (too much whitespace)
	-> mapvar[paint_snorlax]=60 means the painting was too messy (outside the outlines)
 - Finally, inject the JavaScript in Mapbuilder -> Settings -> Raw Code:

	game => {

		let scriptUrls = [
			"https://raw.githubusercontent.com/Josiah-Kunz/Personal-Public/f2cff496091040dd7fb0bc4125a35692b20b6c30/paint-minigame.js",

		];

		if (game.map.id != game.map.__cachedid) {
			game.map.__jsScripts = "";
			game.map.__cachedid = game.map.id;
			game.map.__scriptsLoading = true;

			Promise.all(scriptUrls.map(url => 
			  fetch(url)
				.then(response => response.text())
				.catch(e => {
					console.error(`Failed to load ${url.split('/').pop()}:`, e);
					return "";
				})
			)).then(scripts => {
				game.map.__jsScripts = scripts.join('\n');
				game.map.__scriptsLoading = false;
				eval(game.map.__jsScripts);
			});
			} else if (game.map && game.map.__jsScripts && !game.map.__scriptsLoading) {
			eval(game.map.__jsScripts);
		}
	} 

Author: JosiahKunz
Consulting AI:
	- ChatGPT
	- Claude

*/

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

// Sort palette by hue
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

  var lastX = null;
  var lastY = null;
  
  // Limit canvas to width x height
  var x0 = (game.width-width)/2;
  var y0 = (game.height-height)/2;

  // Paintable canvas (below outline)
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
    pointerEvents: "auto",
    zIndex: "0"
  });
  var ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  // Outline canvas (above painting, below cursor)
  var outlineCanvas = document.createElement("canvas");
  outlineCanvas.id = "game-outline";
  outlineCanvas.width = game.width;
  outlineCanvas.height = game.height;
  Object.assign(outlineCanvas.style, {
    position: "absolute",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    imageRendering: "pixelated",
    pointerEvents: "none",
    zIndex: "1"
  });
  var oCtx = outlineCanvas.getContext("2d");
  oCtx.imageSmoothingEnabled = false;

  // Cursor canvas (top layer)
  var cursorCanvas = document.createElement("canvas");
  cursorCanvas.width = game.width;
  cursorCanvas.height = game.height;
  Object.assign(cursorCanvas.style, {
    position: "absolute",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    zIndex: "2",
    pointerEvents: "none",
    imageRendering: "pixelated"
  });
  var cCtx = cursorCanvas.getContext("2d");
  cCtx.imageSmoothingEnabled = false;

  var gameContainer = document.getElementById("game-container");
  if (gameContainer) {
    gameContainer.appendChild(canvas);
    gameContainer.appendChild(outlineCanvas);
    gameContainer.appendChild(cursorCanvas);
  }

  var isDrawing = false;
  var currentColor = null;

  // Mask structures - NOW IN CANVAS COORDINATES!
  var maskImage = null;
  var maskWidth = 0;
  var maskHeight = 0;
  var maskOffsetX = 0; // Where mask starts on canvas
  var maskOffsetY = 0;
  var canvasIndexMap = null; // Maps canvas coords to colors
  var ignoredPixels = null; // Set of canvas indices
  var palette = [];
  var regions = {};

  // track painted pixels
  var paintedInside = new Set();
  var paintedOutside = new Set();

  // ----- Load mask directly from Pixi sprite -----
  function loadMaskFromSprite(sprite, callback) {
    if (!sprite || !sprite._texture || !sprite._texture.baseTexture) {
      callback(new Error("Invalid Pixi sprite"));
      return;
    }

    // Access the underlying image or canvas
    let source = sprite._texture.baseTexture.resource?.source;
    if (!source) {
      callback(new Error("Cannot access underlying image of sprite"));
      return;
    }

    // Create a temporary canvas to read pixels
    let tcanvas = document.createElement("canvas");
    tcanvas.width = source.width;
    tcanvas.height = source.height;
    let tctx = tcanvas.getContext("2d");
    tctx.drawImage(source, 0, 0);

    let imgData = tctx.getImageData(0, 0, tcanvas.width, tcanvas.height).data;

    // Initialize mask structures
    maskImage = source;
    maskWidth = source.width;
    maskHeight = source.height;
    
    // Calculate where mask is positioned on canvas (centered)
    maskOffsetX = Math.floor((canvas.width - maskWidth) / 2);
    maskOffsetY = Math.floor((canvas.height - maskHeight) / 2);

    // Build index map in CANVAS coordinates
    canvasIndexMap = new Array(canvas.width * canvas.height);
    ignoredPixels = new Set();
    let colorList = [];
    let colorToIndex = {};
    regions = {};

    // Fill entire canvas with "__OUTSIDE__" by default
    for (let i = 0; i < canvasIndexMap.length; i++) {
      canvasIndexMap[i] = "__OUTSIDE__";
    }

    // Now map mask pixels to canvas coordinates
    for (let my = 0; my < maskHeight; my++) {
      for (let mx = 0; mx < maskWidth; mx++) {
        let maskIdx = (my * maskWidth + mx) * 4;
        let r = imgData[maskIdx], g = imgData[maskIdx + 1], b = imgData[maskIdx + 2], a = imgData[maskIdx + 3];

        // Calculate canvas position
        let canvasX = maskOffsetX + mx;
        let canvasY = maskOffsetY + my;
        let canvasIdx = canvasY * canvas.width + canvasX;

        // Transparent is outside
        if (a === 0) {
          canvasIndexMap[canvasIdx] = "__OUTSIDE__";
          continue;
        }

        let hex = rgbToHex(r, g, b).toUpperCase();
        
        // Black is ignored (outline)
        if (hex === "#000000") {
          ignoredPixels.add(canvasIdx);
          canvasIndexMap[canvasIdx] = "__IGNORED__";
          continue;
        }
        
        // White is outside
        if (hex === "#FFFFFF") {
          canvasIndexMap[canvasIdx] = "__OUTSIDE__";
          continue;
        }

        // Color gets assigned to a "region"
        if (!(hex in colorToIndex)) {
          colorToIndex[hex] = colorList.length;
          colorList.push(hex);
          regions[hex] = { total: 0, painted: 0, pixels: new Set() };
        }

        canvasIndexMap[canvasIdx] = hex;
        regions[hex].total += 1;
        regions[hex].pixels.add(canvasIdx);
      }
    }

    palette = sortColorsByHue(colorList);
    callback(null);
  }

  // ----- Locate and load mask -----
  function locateAndLoadMask(callback) {
    if (maskSprite) {
      loadMaskFromSprite(maskSprite, callback);
    } else if (maskPattern && maskPattern.length > 0) {
      let sprites = findSpritesWithPattern(maskPattern, "skin");
      if (sprites && sprites.length > 0) {
        loadMaskFromSprite(sprites[0], callback);
      } else {
        callback(new Error(`No sprite found matching pattern ${maskPattern}`));
      }
    } else {
      callback(new Error("No mask configured - maskPattern or maskSprite required"));
    }
  }

  // Draw white background
  function drawBackground() {
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(x0, y0, width, height);
  }

  // Draw the mask outline (black lines only)
  function drawOutline() {
    if (!maskImage) return;

    oCtx.clearRect(0, 0, outlineCanvas.width, outlineCanvas.height);

    let tcanvas = document.createElement("canvas");
    tcanvas.width = maskWidth;
    tcanvas.height = maskHeight;
    let tctx = tcanvas.getContext("2d");
    tctx.drawImage(maskImage, 0, 0);

    let imgData = tctx.getImageData(0, 0, maskWidth, maskHeight);
    let data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      let hex = rgbToHex(r, g, b).toUpperCase();
      data[i + 3] = (hex === "#000000" && a > 0) ? 255 : 0;
    }

    tctx.putImageData(imgData, 0, 0);
    oCtx.drawImage(tcanvas, maskOffsetX, maskOffsetY);
  }

  // Convert client coordinates to canvas
  function clientToCanvas(clientX, clientY, cvs) {
    var rect = cvs.getBoundingClientRect();
    var x = Math.floor((clientX - rect.left) * cvs.width / rect.width);
    var y = Math.floor((clientY - rect.top) * cvs.height / rect.height);
    return { x: x, y: y };
  }

  // Get mask color at canvas position - NOW JUST A SIMPLE LOOKUP!
  function getMaskColorAt(x, y) {
    if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) {
      return "__OUTSIDE__";
    }
    let idx = y * canvas.width + x;
    return canvasIndexMap[idx] || "__OUTSIDE__";
  }

  // Draw brush point
  function applyBrushPoint(x, y) {
    var half = Math.floor(brushSize / 2);

    for (var dx = -half; dx <= half; dx++) {
      for (var dy = -half; dy <= half; dy++) {
        if (brushShape === "circle") {
          if (dx * dx + dy * dy > (brushSize / 2) * (brushSize / 2)) continue;
        }

        var px = x + dx;
        var py = y + dy;

        // Don't paint outside white canvas bounds
        if (px < x0 || px >= width + x0 || py < y0 || py >= height + y0) continue;

        let canvasIdx = py * canvas.width + px;
        
        // Skip ignored (black outline) pixels
        if (ignoredPixels.has(canvasIdx)) {
          continue;
        }

        // Get what this pixel should be
        var maskColor = getMaskColorAt(px, py);
        var key = px + "," + py;

        if (maskColor === currentColor) {
          // Correct color in region
          ctx.fillStyle = currentColor;
          ctx.fillRect(px, py, 1, 1);

          if (!paintedInside.has(key)) {
            paintedInside.add(key);
            if (regions[maskColor]) {
              regions[maskColor].painted += 1;
            }
          }
        } else if (maskColor === "__OUTSIDE__") {
          // Painting outside the lines
          ctx.fillStyle = currentColor;
          ctx.fillRect(px, py, 1, 1);
          if (!paintedOutside.has(key)) paintedOutside.add(key);
        }
        // If maskColor is a different region color, we could count it as outside too
        // For now, just don't paint it
      }
    }
  }

  // Draw line between points
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

  // Draw cursor preview
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

  // Check completion
  function checkResult() {
    var totalPaintable = 0;
    var paintedCount = 0;
    for (var i = 0; i < palette.length; i++) {
      var hex = palette[i];
      if (regions[hex]) totalPaintable += regions[hex].total;
    }
    paintedCount = paintedInside.size;
    var comp = totalPaintable === 0 ? 0 : paintedCount / totalPaintable;
    var outRatio = paintedOutside.size / (paintedInside.size || 1);

    if (comp >= completenessThreshold && outRatio <= forgivenessRatio) {
      onWin({ completeness: comp, outsideRatio: outRatio, paintedInside: paintedInside.size, paintedOutside: paintedOutside.size, totalInside: totalPaintable, threshold: completenessThreshold });
    } else {
      onLose({ completeness: comp, outsideRatio: outRatio, paintedInside: paintedInside.size, paintedOutside: paintedOutside.size, totalInside: totalPaintable, threshold: completenessThreshold });
    }
  }

  // Mouse events
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

  // Touch events
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

  // Build UI
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
      padding: "2px",
      borderRadius: "6px",
      border: "2px solid black",
      display: "flex",
      gap: "4px",
      alignItems: "center",
      flexWrap: "wrap",
      width: "266px",
	  overflow: "visible"
    });

    if (showBrushSizePicker) {
      var brushDiv = document.createElement("div");
      brushDiv.innerHTML = '<label style="display:block;margin-bottom:2px;font-size:10px;font-weight:bold;color:black">Brush Size: <span id="brushSizeValue">' + brushSize + '</span></label>';
      var inputRange = document.createElement("input");
      inputRange.type = "range";
      inputRange.id = "brushSizeSlider";
      inputRange.min = 1;
      inputRange.max = 40;
      inputRange.value = brushSize;
      inputRange.style.width = "100px";
      inputRange.addEventListener("input", function (ev) {
        brushSize = parseInt(ev.target.value, 10);
        var el = document.getElementById("brushSizeValue");
        if (el) el.textContent = brushSize;
        if (game.map.mapVars["brush_size"] != brushSize) {
          game.trigger("mapvar[brush_size]=" + brushSize);
        }
      });
      brushDiv.appendChild(inputRange);
      uiContainer.appendChild(brushDiv);
    }

    if (showBrushShapePicker) {
      var shapeDiv = document.createElement("div");
      shapeDiv.innerHTML = '<label style="display:block;margin-bottom:2px;font-size:10px;font-weight:bold;color:black">Brush Shape:</label>';
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
        var brushIdx = brushShape === "circle" ? 2 : 1;
        if (game.map.mapVars["brush_shape"] != brushIdx) {
          game.trigger("mapvar[brush_shape]=" + brushIdx);
        }
      });
      shapeDiv.appendChild(select);
      uiContainer.appendChild(shapeDiv);
    }

    var paletteHolder = document.createElement("div");
    paletteHolder.id = "paletteHolder";
    paletteHolder.style.display = "flex";
    paletteHolder.style.gap = "4px";
    paletteHolder.style.alignItems = "center";
    uiContainer.appendChild(paletteHolder);

    if (showDoneButton) {
      var doneBtn = document.createElement("button");
      doneBtn.textContent = "Done";
      Object.assign(doneBtn.style, { padding: "4px 4px", fontSize: "10px", fontWeight: "bold", backgroundColor: "#4CAF50", color: "white", border: "none", borderRadius: "4px", cursor: "pointer" });
      doneBtn.addEventListener("click", function () { checkResult(); });
      uiContainer.appendChild(doneBtn);
    }

    gameContainer.appendChild(uiContainer);
  }

  // Render palette as swatch dropdown
  function renderPalette() {
    var holder = document.getElementById("paletteHolder");
    if (!holder) return;
    holder.innerHTML = "";
    if (!palette || palette.length === 0) return;
    
    var dropdownWrapper = document.createElement("div");
    Object.assign(dropdownWrapper.style, {
      position: "relative",
      display: "inline-block"
    });
    
    // Current color button
    var currentBtn = document.createElement("button");
    currentBtn.id = "currentColorBtn";
    Object.assign(currentBtn.style, {
      width: "32px",
      height: "32px",
      border: "2px solid black",
      borderRadius: "4px",
      background: palette[0],
      cursor: "pointer",
      padding: "0",
      position: "relative"
    });
    
    // Dropdown arrow indicator
    var arrow = document.createElement("div");
    Object.assign(arrow.style, {
      position: "absolute",
      bottom: "2px",
      right: "2px",
      width: "0",
      height: "0",
      borderLeft: "3px solid transparent",
      borderRight: "3px solid transparent",
      borderTop: "4px solid black",
      pointerEvents: "none"
    });
    currentBtn.appendChild(arrow);
    
    // Swatch panel
    var swatchPanel = document.createElement("div");
    swatchPanel.id = "swatchPanel";
    Object.assign(swatchPanel.style, {
      position: "absolute",
      bottom: "36px",
      left: "0",
      backgroundColor: "white",
      border: "2px solid black",
      borderRadius: "4px",
      padding: "4px",
      display: "none",
      gap: "4px",
      flexWrap: "wrap",
      width: "fit-content",
      maxWidth: "140px",
      zIndex: "3000"
    });
    
    // Create color swatches
    for (var i = 0; i < palette.length; i++) {
      (function(hex) {
        var swatch = document.createElement("button");
        Object.assign(swatch.style, {
          width: "24px",
          height: "24px",
          border: "2px solid black",
          borderRadius: "3px",
          background: hex,
          cursor: "pointer",
          padding: "0",
          margin: "0"
        });
        
        swatch.addEventListener("click", function() {
          currentColor = hex;
          currentBtn.style.background = hex;
          swatchPanel.style.display = "none";
        });
        
        swatchPanel.appendChild(swatch);
      })(palette[i]);
    }
    
    // Toggle dropdown
    var isOpen = false;
    currentBtn.addEventListener("click", function(e) {
      e.stopPropagation();
      isOpen = !isOpen;
      swatchPanel.style.display = isOpen ? "flex" : "none";
    });
    
    // Close when clicking outside
    document.addEventListener("click", function() {
      isOpen = false;
      swatchPanel.style.display = "none";
    });
    
    dropdownWrapper.appendChild(currentBtn);
    dropdownWrapper.appendChild(swatchPanel);
    holder.appendChild(dropdownWrapper);
    
    // Set initial color
    currentColor = palette[0];
  }

  // API functions
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
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    for (var c in regions) {
      if (regions.hasOwnProperty(c)) regions[c].painted = 0;
    }
  }

  buildUI();

  locateAndLoadMask(function (err) {
    if (err) {
      console.error("Mask load failed:", err);
      alert("Failed to load painting mask: " + err.message);
      return;
    }

    drawBackground();
    drawOutline();
    renderPalette();
  });

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
      if (outlineCanvas.parentElement) outlineCanvas.parentElement.removeChild(outlineCanvas);
      if (cursorCanvas.parentElement) cursorCanvas.parentElement.removeChild(cursorCanvas);
      if (uiContainer && uiContainer.parentElement) uiContainer.parentElement.removeChild(uiContainer);
    }
  };
}

// Square
if (game.map.mapVars["paint_square"] === 1) {
  game.trigger("mapvar[paint_square]=2&with&freeze");
  console.log("Started painting a Square!");

  var painting = paintingGame(game, {
    width: 200,
    height: 246,
    maskPattern: ["painting-mask-square"],
    initialBrushSize: game.map.mapVars["brush_size"] && game.map.mapVars["brush_size"] > 0 ? game.map.mapVars["brush_size"] : 30,
    initialBrushShape: game.map.mapVars["brush_shape"] === 2 ? "circle" : "square",
    showBrushSizePicker: true,
    showBrushShapePicker: true,
    showDoneButton: true,
    completenessThreshold: 0.90,
    forgivenessRatio: 0.15,
    onWin: function (stats) { 
      console.log("Winner!", stats); 
      painting.destroy(); 
      game.trigger("mapvar[paint_square]=100&unfreeze"); 
    },
    onLose: function (stats) { 
      console.log("Too messy! You lose!", stats); 
      painting.destroy(); 
      if (stats.completeness < stats.threshold) game.trigger("mapvar[paint_square]=50&unfreeze"); 
      else game.trigger("mapvar[paint_square]=60&unfreeze"); 
    }
  });
}

// Voltorb
if (game.map.mapVars["paint_voltorb"] === 1) {
  game.trigger("mapvar[paint_voltorb]=2&with&freeze");
  console.log("Started painting a Voltorb!");

  var painting = paintingGame(game, {
    width: 200,
    height: 246,
    maskPattern: ["painting-mask-voltorb"],
    initialBrushSize: game.map.mapVars["brush_size"] && game.map.mapVars["brush_size"] > 0 ? game.map.mapVars["brush_size"] : 30,
    initialBrushShape: game.map.mapVars["brush_shape"] === 2 ? "circle" : "square",
    showBrushSizePicker: true,
    showBrushShapePicker: true,
    showDoneButton: true,
    completenessThreshold: 0.95,
    forgivenessRatio: 0.10,
    onWin: function (stats) { 
      console.log("Winner!", stats); 
      painting.destroy(); 
      game.trigger("mapvar[paint_voltorb]=100&unfreeze"); 
    },
    onLose: function (stats) { 
      console.log("Too messy! You lose!", stats); 
      painting.destroy(); 
      if (stats.completeness < stats.threshold) game.trigger("mapvar[paint_voltorb]=50&unfreeze"); 
      else game.trigger("mapvar[paint_voltorb]=60&unfreeze"); 
    }
  });
}

// Snorlax
if (game.map.mapVars["paint_snorlax"] === 1) {
  game.trigger("mapvar[paint_snorlax]=2&with&freeze");
  console.log("Started painting a Snorlax!");

  var painting = paintingGame(game, {
    width: 200,
    height: 246,
    maskPattern: ["painting-mask-snorlax"],
    initialBrushSize: game.map.mapVars["brush_size"] && game.map.mapVars["brush_size"] > 0 ? game.map.mapVars["brush_size"] : 30,
    initialBrushShape: game.map.mapVars["brush_shape"] === 2 ? "circle" : "square",
    showBrushSizePicker: true,
    showBrushShapePicker: true,
    showDoneButton: true,
    completenessThreshold: 0.98,
    forgivenessRatio: 0.08,
    onWin: function (stats) { 
      console.log("Winner!", stats); 
      painting.destroy(); 
      game.trigger("mapvar[paint_snorlax]=100&unfreeze"); 
    },
    onLose: function (stats) { 
      console.log("Too messy! You lose!", stats); 
      painting.destroy(); 
      if (stats.completeness < stats.threshold) game.trigger("mapvar[paint_snorlax]=50&unfreeze"); 
      else game.trigger("mapvar[paint_snorlax]=60&unfreeze"); 
    }
  });
}