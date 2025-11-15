const paintingGame = (game, config = {}) => {
  const {
    width = 356,
    height = 288,
    shape = 'square',
    shapeConfig = { x: 100, y: 100, size: 200 },
    colors = ['#FF0000'],
    initialBrushSize = 10,
    showBrushSizePicker = true,
    showDoneButton = true,
    completenessThreshold = 0.95,
    forgivenessRatio = 0.1,
    onWin = () => console.log('You win!'),
    onLose = () => console.log('Too much outside the lines!'),
  } = config;

  let brushSize = initialBrushSize;
  let x0 = (game.width - width)/2;
  let y0 = (game.height - height)/2;

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
    }
    ctx.stroke();
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
		
	  // Make sure we're within the canvas bounds (white)
	  if (x - half < x0 || x + half >= x0 + width || y - half < y0 || y + half >= y0 + height) return;
		
      c.fillStyle = currentColor;
      c.fillRect(x - half, y - half, brushSize, brushSize);
      
      for (let dx = 0; dx < brushSize; dx++) {
        for (let dy = 0; dy < brushSize; dy++) {
          const key = `${x - half + dx},${y - half + dy}`;
          if (insidePixels.has(key)) paintedInside.add(key);
          else paintedOutside.add(key);
        }
      }
    } else {
      c.globalAlpha = 1.0;
      c.strokeStyle = '#000000';
      c.lineWidth = 1;
      c.strokeRect(x - half, y - half, brushSize, brushSize);
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

  canvas.addEventListener('mouseup', () => isDrawing = false);
  canvas.addEventListener('mouseleave', () => isDrawing = false);

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