const BrushShapeMap = {
  square: 1,
  circle: 2,
};

const BrushShapeReverseMap = Object.fromEntries(
  Object.entries(BrushShapeMap).map(([k, v]) => [v, k])
);

const paintingGame = (game, config = {}) => {
  const {
    width = 356,
    height = 288,
    shape = 'square',
    shapeConfig = { x: 100, y: 100, size: 200 },
    colors = ['#FF0000'],
    initialBrushSize = 10,
	initialBrushShape = 'square',
    showBrushSizePicker = true,
	showBrushShapePicker = true,
    showDoneButton = true,
    completenessThreshold = 0.95,
    forgivenessRatio = 0.1,
    onWin = () => console.log('You win!'),
    onLose = () => console.log('Too much outside the lines!'),
  } = config;

  let brushSize = initialBrushSize;
  let brushShape = initialBrushShape;
  
  let x0 = (game.width - width)/2;
  let y0 = (game.height - height)/2;
  
  let lastX = null;
  let lastY = null;

  const canvas = document.createElement('canvas');
  canvas.id = 'game-painting';
  canvas.width = game.width;
  canvas.height = game.height;
  Object.assign(canvas.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    imageRendering: 'pixelated',
    pointerEvents: 'auto'
  });
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  
  const cursorCanvas = document.createElement('canvas');
  cursorCanvas.width = game.width;
  cursorCanvas.height = game.height;
  Object.assign(cursorCanvas.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    zIndex: '1',
    pointerEvents: 'none',
    imageRendering: 'pixelated'
  });
  const cCtx = cursorCanvas.getContext('2d');
  cCtx.imageSmoothingEnabled = false;
  
  const gameContainer = document.getElementById('game-container');
  if (gameContainer) {
    gameContainer.appendChild(canvas);
    gameContainer.appendChild(cursorCanvas);
  }

  let isDrawing = false;
  let currentColor = colors[0];
  
  const insidePixels = new Set();
  const paintedInside = new Set();
  const paintedOutside = new Set();

  const centerX = width / 2 + x0;
  const centerY = height / 2 + y0;

	const shapes = {
	  square: (x, y, cfg) => {
		const { x: cx, y: cy, size } = cfg;
		const half = size / 2;
		const absX = centerX + cx;
		const absY = centerY + cy;
		return x >= absX - half && x < absX + half && y >= absY - half && y < absY + half;
	  },
	  circle: (x, y, cfg) => {
		const { x: cx, y: cy, radius } = cfg;
		const absX = centerX + cx;
		const absY = centerY + cy;
		const dx = x - absX, dy = y - absY;
		return dx * dx + dy * dy <= radius * radius;
	  },
	  voltorb: (x, y, cfg) => {
		  const { x: cx, y: cy, radius } = cfg;
		  const absX = centerX + cx;
		  const absY = centerY + cy;
		  const dx = x - absX, dy = y - absY;
		  
		  // Check if in circle
		  if (dx * dx + dy * dy > radius * radius) return false;
		  
		  // Top half of circle (red area)
		  if (y < absY) return true;
		  
		  // Bottom half - exclude eyes (Voltorb's angry slanted eyes)
		const eyeWidth = radius * 0.45;
		const eyeHeight = radius * 0.18;
		const eyeY = absY + radius * 0.05;   // place eyes higher
		const tilt = radius * 0.12;          // diagonal slant amount

		// LEFT EYE BOUNDING BOX
		let lx0 = absX - eyeWidth - tilt;
		let lx1 = absX - tilt * 0.2;
		let ly0 = eyeY - eyeHeight;
		let ly1 = eyeY + eyeHeight;

		// Slanted shape: y must be above the slanted line
		let leftSlopeY = eyeY + (x - (absX - eyeWidth)) * 0.25;
		if (x >= lx0 && x <= lx1 && y >= ly0 && y <= ly1 && y < leftSlopeY) {
			return false;
		}

		// RIGHT EYE BOUNDING BOX
		let rx0 = absX + tilt * 0.2;
		let rx1 = absX + eyeWidth + tilt;
		let ry0 = eyeY - eyeHeight;
		let ry1 = eyeY + eyeHeight;

		// Slanted shape: y must be above the slanted line (mirrored)
		let rightSlopeY = eyeY - (x - (absX + eyeWidth)) * 0.25;
		if (x >= rx0 && x <= rx1 && y >= ry0 && y <= ry1 && y < rightSlopeY) {
			return false;
		}

		  
		  // Mouth line (horizontal line in middle)
		  if (Math.abs(y - absY) < 2 && Math.abs(dx) < radius * 0.9) return false;
		  
		  return true;
		},
	  custom: config.customShapeFunction || (() => false),
	};

  const isInside = shapes[shape] || shapes.square;

  for (let x = x0; x < width+x0; x++) {
    for (let y = y0; y < height+y0; y++) {
      if (isInside(x, y, shapeConfig)) insidePixels.add(`${x},${y}`);
    }
  }

	const drawOutline = () => {
	  ctx.strokeStyle = '#00000040';
	  ctx.lineWidth = 1;
	  ctx.beginPath();
	  
	  if (shape === 'square') {
		const { x, y, size } = shapeConfig;
		const half = size / 2;
		const absX = centerX + x;
		const absY = centerY + y;
		ctx.rect(absX - half, absY - half, size, size);
	  } else if (shape === 'circle') {
		const { x, y, radius } = shapeConfig;
		const absX = centerX + x;
		const absY = centerY + y;
		ctx.arc(absX, absY, radius, 0, Math.PI * 2);
	  } else if (shape === 'voltorb') {
		const { x, y, radius } = shapeConfig;
		const absX = centerX + x;
		const absY = centerY + y;

		// Draw outer circle
		ctx.arc(absX, absY, radius, 0, Math.PI * 2);
		ctx.stroke();

		// Draw horizontal line in middle
		ctx.beginPath();
		ctx.moveTo(absX - radius * 0.9, absY);
		ctx.lineTo(absX + radius * 0.9, absY);
		ctx.stroke();

		// Draw eyes as angled segments
		const eyeWidth = radius * 0.45;
		const eyeHeight = radius * 0.18;
		const eyeY = absY + radius * 0.05;
		const tilt = radius * 0.12;

		// Left eye points
		ctx.beginPath();
		ctx.moveTo(absX - eyeWidth - tilt, eyeY - eyeHeight);  // top-left
		ctx.lineTo(absX - tilt * 0.2,   eyeY - eyeHeight);      // top-right
		ctx.lineTo(absX - tilt * 0.2,   eyeY);                  // mid-right
		ctx.lineTo(absX - eyeWidth,     eyeY + eyeHeight);      // bottom-left
		ctx.closePath();
		ctx.stroke();

		// Right eye points
		ctx.beginPath();
		ctx.moveTo(absX + tilt * 0.2,    eyeY - eyeHeight);      // top-left
		ctx.lineTo(absX + eyeWidth + tilt, eyeY - eyeHeight);    // top-right
		ctx.lineTo(absX + eyeWidth,      eyeY + eyeHeight);      // bottom-right
		ctx.lineTo(absX + tilt * 0.2,    eyeY);                  // mid-left
		ctx.closePath();
		ctx.stroke();

		return;
	}
	  
	  ctx.stroke();
	};


	const drawLine = (x1, y1, x2, y2) => {
	  const dx = x2 - x1;
	  const dy = y2 - y1;
	  const distance = Math.sqrt(dx * dx + dy * dy);
	  const steps = Math.ceil(distance);
	  
	  for (let i = 0; i <= steps; i++) {
		const t = steps > 0 ? i / steps : 0;
		const x = Math.round(x1 + dx * t);
		const y = Math.round(y1 + dy * t);
		drawPoint(x, y);
	  }
	};

	const drawPoint = (x, y) => {
		const half = Math.floor(brushSize / 2);

		// Boundary check
		if (x - half < x0 || x + half > x0 + width || 
		  y - half < y0 || y + half > y0 + height) return;

		ctx.fillStyle = currentColor;

		if (brushShape === 'circle') {
		// Draw circle
		ctx.beginPath();
		ctx.arc(x, y, brushSize / 2, 0, Math.PI * 2);
		ctx.fill();

		// Track painted pixels in circle
		for (let dx = -half; dx <= half; dx++) {
		  for (let dy = -half; dy <= half; dy++) {
			if (dx * dx + dy * dy <= (brushSize / 2) * (brushSize / 2)) {
			  const key = `${x + dx},${y + dy}`;
			  if (insidePixels.has(key)) paintedInside.add(key);
			  else paintedOutside.add(key);
			}
		  }
		}
		} else {
		// Draw square
		ctx.fillRect(x - half, y - half, brushSize, brushSize);

		// Track painted pixels in square
		for (let dx = 0; dx < brushSize; dx++) {
		  for (let dy = 0; dy < brushSize; dy++) {
			const key = `${x - half + dx},${y - half + dy}`;
			if (insidePixels.has(key)) paintedInside.add(key);
			else paintedOutside.add(key);
		  }
		}
		}
	};

  const redraw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x0, y0, width, height);
    drawOutline();
  };

	const draw = (clientX, clientY, perm = true) => {
	  const cvs = perm ? canvas : cursorCanvas;
	  const c = cvs.getContext('2d');
	  
	  if (!perm) c.clearRect(0, 0, cvs.width, cvs.height);
	  
	  const rect = cvs.getBoundingClientRect();
	  const x = Math.floor((clientX - rect.left) * cvs.width / rect.width);
	  const y = Math.floor((clientY - rect.top) * cvs.height / rect.height);

	  if (x < 0 || x >= cvs.width || y < 0 || y >= cvs.height) return;

	  const half = Math.floor(brushSize / 2);
	  
	  if (perm) {
		if (lastX !== null && lastY !== null) {
		  // Draw line from last position to current position
		  drawLine(lastX, lastY, x, y);
		} else {
		  // First point, just draw it
		  drawPoint(x, y);
		}
		lastX = x;
		lastY = y;
	  } else {
		// Cursor preview
		c.globalAlpha = 1.0;
		c.strokeStyle = '#000000';
		c.lineWidth = 1;
		
		// Draw depending on shape
		if (brushShape === 'circle') {
			c.beginPath();
			c.arc(x, y, brushSize / 2, 0, Math.PI * 2);
			c.stroke();
		} else {
			c.strokeRect(x - half, y - half, brushSize, brushSize);
		}
	  }
	};

  const checkResult = () => {
    const total = insidePixels.size;
    const inside = paintedInside.size;
    const outside = paintedOutside.size;
    const comp = inside / total;
    const outRatio = outside / inside;

    if (comp >= completenessThreshold && outRatio <= forgivenessRatio) {
      onWin({ completeness: comp, outsideRatio: outRatio, paintedInside: inside, paintedOutside: outside, totalInside: total, threshold: completenessThreshold });
    } else {
      onLose({ completeness: comp, outsideRatio: outRatio, paintedInside: inside, paintedOutside: outside, totalInside: total, threshold: completenessThreshold });
    }
  };

  canvas.addEventListener('mousedown', (e) => {
    isDrawing = true;
    draw(e.clientX, e.clientY);
  });

  canvas.addEventListener('mousemove', (e) => {
    draw(e.clientX, e.clientY, false);
    if (isDrawing) draw(e.clientX, e.clientY);
  });

	canvas.addEventListener('mouseup', () => {
	  isDrawing = false;
	  lastX = null;
	  lastY = null;
	});

	canvas.addEventListener('mouseleave', () => {
	  isDrawing = false;
	  lastX = null;
	  lastY = null;
	});

  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    e.stopPropagation();
    isDrawing = true;
    draw(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    e.stopPropagation();
    draw(e.touches[0].clientX, e.touches[0].clientY, false);
    if (isDrawing) draw(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: false });

	canvas.addEventListener('touchend', (e) => {
	  e.preventDefault();
	  e.stopPropagation();
	  isDrawing = false;
	  lastX = null;
	  lastY = null;
	}, { passive: false });

  let uiContainer = null;
  if (showBrushSizePicker || showDoneButton) {
    uiContainer = document.createElement('div');
    Object.assign(uiContainer.style, {
      position: 'absolute',
      bottom: '4px',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: '2000',
      backgroundColor: 'rgba(255,255,255,0.9)',
      padding: '10px',
      borderRadius: '5px',
      border: '2px solid black',
      display: 'flex',
      gap: '10px',
      alignItems: 'center'
    });
    
    if (showBrushSizePicker) {
      const brushDiv = document.createElement('div');
      brushDiv.innerHTML = `<label style="display:block;margin-bottom:3px;font-size:12px;font-weight:bold;color:black">Brush Size: <span id="brushSizeValue">${brushSize}</span></label><input type="range" id="brushSizeSlider" min="1" max="50" value="${brushSize}" style="width:120px;">`;
      uiContainer.appendChild(brushDiv);
      
      gameContainer.appendChild(uiContainer);
      
      document.getElementById('brushSizeSlider').addEventListener('input', (e) => {
        brushSize = parseInt(e.target.value);
		game.trigger(`mapvar[brush_size]=${brushSize}`);
        document.getElementById('brushSizeValue').textContent = brushSize;
      });
    }
	
	if (showBrushShapePicker) {
		const shapeDiv = document.createElement('div');
		shapeDiv.innerHTML = `
		<label style="display:block;margin-bottom:3px;font-size:12px;font-weight:bold;color:black">Brush Shape:</label>
		<select id="brushShapeSelect" style="padding:4px;font-size:12px;">
		  <option value="square" ${brushShape === 'square' ? 'selected' : ''}>Square</option>
		  <option value="circle" ${brushShape === 'circle' ? 'selected' : ''}>Circle</option>
		</select>
		`;
		uiContainer.appendChild(shapeDiv);

		document.getElementById('brushShapeSelect').addEventListener('change', (e) => {
		brushShape = e.target.value;
		game.trigger(`mapvar[brush_shape]=${BrushShapeMap[brushShape]}`);
		});
	}
    
    if (showDoneButton) {
      const doneBtn = document.createElement('button');
      doneBtn.textContent = 'Done';
      Object.assign(doneBtn.style, {
        padding: '8px 16px',
        fontSize: '14px',
        fontWeight: 'bold',
        backgroundColor: '#4CAF50',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer'
      });
      doneBtn.addEventListener('click', checkResult);
      uiContainer.appendChild(doneBtn);
    }
    
    gameContainer.appendChild(uiContainer);
  }

  redraw();
  
  const origZoom = game.setZoom.bind(game);
  game.setZoom = (zoom) => {
    origZoom(zoom);
    redraw();
  };

  return {
    canvas,
    ctx,
    setColor: (c) => { if (colors.includes(c)) currentColor = c; },
    setBrushSize: (s) => {
      brushSize = s;
      if (uiContainer && showBrushSizePicker) {
        document.getElementById('brushSizeSlider').value = s;
        document.getElementById('brushSizeValue').textContent = s;
      }
    },
	setBrushShape: (s) => {
		brushShape = s;
		if (uiContainer && showBrushShapePicker) {
		  document.getElementById('brushShapeSelect').value = s;
		}
	},
    reset: () => {
      paintedInside.clear();
      paintedOutside.clear();
      redraw();
    },
    getStats: () => ({
      completeness: paintedInside.size / insidePixels.size,
      outsideRatio: paintedOutside.size / (paintedInside.size || 1),
      paintedInside: paintedInside.size,
      paintedOutside: paintedOutside.size,
      totalInside: insidePixels.size
    }),
    destroy: () => {
      if (canvas.parentElement) canvas.parentElement.removeChild(canvas);
      if (cursorCanvas.parentElement) cursorCanvas.parentElement.removeChild(cursorCanvas);
      if (uiContainer?.parentElement) uiContainer.parentElement.removeChild(uiContainer);
    },
  };
};

if (game.map.mapVars["paint_square"]===1){
	
	game.trigger("mapvar[paint_square]=2&with&freeze");
	console.log("Started painting a square!");
	
	const painting = paintingGame(game, {
	width: 200,
	height: 246,
	shape: 'square',
	shapeConfig: { x: 0, y: 0, size: 69 },
	colors: ['#FF0000'],
	initialBrushSize: game.map.mapVars["brush_size"] && game.map.mapVars["brush_size"] > 0 ? game.map.mapVars["brush_size"] : 30,
	initialBrushShape: BrushShapeReverseMap[game.map.mapVars["brush_shape"]] || 'square',
	showBrushSizePicker: true,
	showDoneButton: true,
	completenessThreshold: 0.90,
	forgivenessRatio: 0.15,
	onWin: (stats) => {
	  console.log("Winner!", stats);
	  painting.destroy();
	  game.trigger("mapvar[paint_square]=100&unfreeze");
	},
	onLose: (stats) => {
		console.log("Too messy! You lose!", stats);
		painting.destroy();
		if (stats.completeness < stats.threshold){
			game.trigger("mapvar[paint_square]=50&unfreeze");
		} else {
			game.trigger("mapvar[paint_square]=60&unfreeze");
		}
	},
	});
	
}

if (game.map.mapVars["paint_voltorb"]===1){
	
	game.trigger("mapvar[paint_voltorb]=2&with&freeze");
	console.log("Started painting a Voltorb!");
	
	const painting = paintingGame(game, {
	width: 200,
	height: 246,
	shape: 'voltorb',
	shapeConfig: { x: 0, y: 0, radius: 80 },
	colors: ['#FF0000'],
	initialBrushSize: game.map.mapVars["brush_size"] && game.map.mapVars["brush_size"] > 0 ? game.map.mapVars["brush_size"] : 30,
	initialBrushShape: game.map.mapVars["brush_shape"] || 'square',
	showBrushSizePicker: true,
	showBrushShapePicker: true,
	showDoneButton: true,
	completenessThreshold: 0.90,
	forgivenessRatio: 0.15,
	onWin: (stats) => {
	  console.log("Winner!", stats);
	  painting.destroy();
	  game.trigger("mapvar[paint_voltorb]=100&unfreeze");
	},
	onLose: (stats) => {
		console.log("Too messy! You lose!", stats);
		painting.destroy();
		if (stats.completeness < stats.threshold){
			game.trigger("mapvar[paint_voltorb]=50&unfreeze");
		} else {
			game.trigger("mapvar[paint_voltorb]=60&unfreeze");
		}
	},
	});
	
}


