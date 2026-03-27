import './style.css';
import { SMACalculator } from './calculator';
import { CanvasRenderer } from './canvas-renderer';
import { ShapeStorage } from './storage';

// Constants
const GRID_SIZE = 3000; // 3000mm x 3000mm
const ORIGIN_OFFSET = 1500; // Engineering origin at center of 3m grid

// State
let currentTool: 'pen' | 'eraser' | 'rect' | 'isection' = 'pen';
let isDrawing = false;
let isPanning = false;
let lastMousePos = { x: 0, y: 0 };
let snapEnabled = true;
let currentStroke: { type: 'stroke', points: {x: number, y: number}[], size: number, active: boolean } | null = null;

// DOM Elements
const canvas = document.getElementById('main-canvas') as HTMLCanvasElement;
const btnPen = document.getElementById('btn-pen') as HTMLButtonElement;
const btnEraser = document.getElementById('btn-eraser') as HTMLButtonElement;
const thicknessSlider = document.getElementById('thickness-slider') as HTMLInputElement;
const thicknessValue = document.getElementById('thickness-value') as HTMLSpanElement;
const thicknessContainer = document.getElementById('thickness-container') as HTMLDivElement;
const eraserSlider = document.getElementById('eraser-slider') as HTMLInputElement;
const eraserValue = document.getElementById('eraser-value') as HTMLSpanElement;
const eraserContainer = document.getElementById('eraser-slider-container') as HTMLDivElement;
const btnRect = document.getElementById('btn-rect') as HTMLButtonElement;
const rectDimensionsContainer = document.getElementById('rect-dimensions-container') as HTMLDivElement;
const rectWInput = document.getElementById('rect-w') as HTMLInputElement;
const rectHInput = document.getElementById('rect-h') as HTMLInputElement;
const btnISection = document.getElementById('btn-i-section') as HTMLButtonElement;
const iSectionDimensionsContainer = document.getElementById('i-section-dimensions-container') as HTMLDivElement;
const iWInput = document.getElementById('i-w') as HTMLInputElement;
const iHInput = document.getElementById('i-h') as HTMLInputElement;
const iTFInput = document.getElementById('i-tf') as HTMLInputElement;
const iTWInput = document.getElementById('i-tw') as HTMLInputElement;
const btnSnap = document.getElementById('btn-snap') as HTMLButtonElement;
const snapSliderContainer = document.getElementById('snap-slider-container') as HTMLDivElement;
const snapDivider = document.getElementById('snap-divider') as HTMLDivElement;
const snapSizeSlider = document.getElementById('snap-size-slider') as HTMLInputElement;
const snapSizeValue = document.getElementById('snap-size-value') as HTMLSpanElement;
const btnClear = document.getElementById('btn-clear') as HTMLButtonElement;
const btnReset = document.getElementById('btn-reset-view') as HTMLButtonElement;
const btnUndo = document.getElementById('btn-undo') as HTMLButtonElement;
const btnRedo = document.getElementById('btn-redo') as HTMLButtonElement;
const coordDisplay = document.getElementById('coordinate-display') as HTMLDivElement;
const valCentroid = document.getElementById('val-centroid') as HTMLSpanElement;
const valArea = document.getElementById('val-area') as HTMLSpanElement;
const valDims = document.getElementById('val-dims') as HTMLSpanElement;
const valIx = document.getElementById('val-ix') as HTMLSpanElement;
const valIy = document.getElementById('val-iy') as HTMLSpanElement;
const valZx = document.getElementById('val-zx') as HTMLSpanElement;
const valZy = document.getElementById('val-zy') as HTMLSpanElement;
const valKx = document.getElementById('val-kx') as HTMLSpanElement;
const valKy = document.getElementById('val-ky') as HTMLSpanElement;
const valIxy = document.getElementById('val-ixy') as HTMLSpanElement;
const valPolar = document.getElementById('val-polar') as HTMLSpanElement;
const valImax = document.getElementById('val-imax') as HTMLSpanElement;
const valImin = document.getElementById('val-imin') as HTMLSpanElement;
const valTheta = document.getElementById('val-theta') as HTMLSpanElement;
const globalTooltip = document.getElementById('global-tooltip') as HTMLDivElement;

// Instances
const calculator = new SMACalculator(GRID_SIZE, GRID_SIZE);
const renderer = new CanvasRenderer(canvas, GRID_SIZE, GRID_SIZE);
const storage = new ShapeStorage();

// Functions
function updateUI() {
  const results = calculator.getResults();
  
  valCentroid.textContent = results.count > 0 
    ? `(${ (results.centroidX - ORIGIN_OFFSET).toFixed(1) }, ${ (results.centroidY - ORIGIN_OFFSET).toFixed(1) }) mm`
    : '(0.0, 0.0) mm';
    
  valArea.innerHTML = `${results.area.toLocaleString()} <small>mm&sup2;</small>`;
  valDims.innerHTML = `${results.width} x ${results.height} <small>mm</small>`;

  // Bending & Buckling
  valIx.innerHTML = `${results.Ix.toExponential(3)} <small>mm<sup>4</sup></small>`;
  valIy.innerHTML = `${results.Iy.toExponential(3)} <small>mm<sup>4</sup></small>`;
  valZx.innerHTML = `${results.Zx.toExponential(3)} <small>mm&sup3;</small>`;
  valZy.innerHTML = `${results.Zy.toExponential(3)} <small>mm&sup3;</small>`;
  valKx.innerHTML = `${results.kx.toFixed(1)} <small>mm</small>`;
  valKy.innerHTML = `${results.ky.toFixed(1)} <small>mm</small>`;

  // Principal Axes
  valIxy.innerHTML = `${results.Ixy.toExponential(3)} <small>mm<sup>4</sup></small>`;
  valPolar.innerHTML = `${results.J.toExponential(3)} <small>mm<sup>4</sup></small>`;
  valImax.innerHTML = `${results.Imax.toExponential(3)} <small>mm<sup>4</sup></small>`;
  valImin.innerHTML = `${results.Imin.toExponential(3)} <small>mm<sup>4</sup></small>`;
  valTheta.innerHTML = `${results.theta.toFixed(1)}&deg;`;

  // Update Tooltip Listeners (since new icons might exist or just to be safe)
  document.querySelectorAll('.info-icon').forEach(icon => {
    (icon as HTMLElement).onmouseenter = (e) => {
      const target = e.target as HTMLElement;
      const rect = target.getBoundingClientRect();
      const tipText = target.getAttribute('data-tip') || '';
      
      globalTooltip.textContent = tipText;
      globalTooltip.style.top = `${rect.top + rect.height / 2}px`;
      globalTooltip.style.left = `${rect.left - 250}px`; // Pop to the left of the icon
      globalTooltip.classList.add('visible');
    };
    (icon as HTMLElement).onmouseleave = () => {
      globalTooltip.classList.remove('visible');
    };
  });
}

function getSnapPos(worldX: number, worldY: number) {
  if (!snapEnabled) return { x: Math.floor(worldX), y: Math.floor(worldY) };
  
  let snap = parseInt(snapSizeSlider.value, 10);
  if (snap === 0) snap = 1; // Treat 0 as 1mm (no-snap/fine-mode)

  const snappedX = Math.round(worldX / snap) * snap;
  const snappedY = Math.round(worldY / snap) * snap;
  
  return { x: snappedX, y: snappedY };
}

function drawAt(worldX: number, worldY: number) {
  const snapPos = getSnapPos(worldX, worldY);
  let changed = false;

  if (currentTool === 'rect') {
    const w = parseInt(rectWInput.value, 10);
    const h = parseInt(rectHInput.value, 10);
    
    calculator.addAction({
      type: 'rect',
      x: snapPos.x,
      y: snapPos.y,
      w: w,
      h: h,
      active: true
    });
    calculator.executeAction(calculator.history[calculator.history.length - 1]);
    renderer.syncFromData(calculator.getGrid());
    changed = true;
    isDrawing = false; // Discrete action
  } else if (currentTool === 'isection') {
    const W = parseInt(iWInput.value, 10);
    const H = parseInt(iHInput.value, 10);
    const tf = parseInt(iTFInput.value, 10);
    const tw = parseInt(iTWInput.value, 10);
    
    calculator.addAction({
      type: 'isection',
      x: snapPos.x,
      y: snapPos.y,
      w: W,
      h: H,
      tf: tf,
      tw: tw,
      active: true
    });
    calculator.executeAction(calculator.history[calculator.history.length - 1]);
    renderer.syncFromData(calculator.getGrid());
    changed = true;
    isDrawing = false; // Discrete action
  } else {
    // Pen or Eraser (Stroke)
    const thickness = currentTool === 'pen' 
      ? parseInt(thicknessSlider.value, 10) 
      : parseInt(eraserSlider.value, 10);
    const active = currentTool === 'pen';

    if (!currentStroke) {
      currentStroke = {
        type: 'stroke',
        points: [],
        size: thickness,
        active: active
      };
    }

    // Only add if point is different from last
    const lastPoint = currentStroke.points[currentStroke.points.length - 1];
    if (!lastPoint || lastPoint.x !== snapPos.x || lastPoint.y !== snapPos.y) {
      currentStroke.points.push({ x: snapPos.x, y: snapPos.y });
    }

    // Still execute immediately for real-time feedback
    const startX = Math.floor(snapPos.x - (thickness - 1) / 2);
    const startY = Math.floor(snapPos.y - (thickness - 1) / 2);

    for (let y = startY; y < startY + thickness; y++) {
      for (let x = startX; x < startX + thickness; x++) {
        if (calculator.setPixel(x, y, active)) {
          renderer.updatePixel(x, y, active);
          changed = true;
        }
      }
    }
  }

  if (changed) updateUI();
}

// Event Listeners
window.addEventListener('resize', () => {
  renderer.resize();
});

canvas.addEventListener('mousedown', (e) => {
  if (e.button === 0) { // Left click
    isDrawing = true;
    const world = renderer.screenToWorld(e.clientX, e.clientY);
    drawAt(world.x, world.y);
  } else if (e.button === 1 || e.button === 2) { // Middle or Right click
    isPanning = true;
    lastMousePos = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  }
});

window.addEventListener('mousemove', (e) => {
  lastMouseWorld = renderer.screenToWorld(e.clientX, e.clientY);
  
  if (lastMouseWorld) {
    // Update coordinate display (relative to origin)
    coordDisplay.textContent = `X: ${Math.round(lastMouseWorld.x - ORIGIN_OFFSET)}mm, Y: ${Math.round(lastMouseWorld.y - ORIGIN_OFFSET)}mm`;

    if (isDrawing) {
      drawAt(lastMouseWorld.x, lastMouseWorld.y);
    }
  }

  if (isPanning) {
    const dx = e.clientX - lastMousePos.x;
    const dy = e.clientY - lastMousePos.y;
    renderer.handlePan(dx, dy);
    lastMousePos = { x: e.clientX, y: e.clientY };
  }
});

window.addEventListener('mouseup', async () => {
  if (isDrawing && currentStroke) {
    calculator.addAction(currentStroke);
    currentStroke = null;
    
    // Auto-save history to IndexedDB
    try {
      await storage.save('last-session-history', calculator.history);
    } catch (err) {
      console.warn('Failed to auto-save:', err);
    }
  }
  isDrawing = false;
  isPanning = false;
});

canvas.addEventListener('wheel', (e) => {
  renderer.handleZoom(e.deltaY, e.clientX, e.clientY);
  e.preventDefault();
}, { passive: false });

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// Tool UI
btnPen.addEventListener('click', () => {
  currentTool = 'pen';
  btnPen.classList.add('active');
  btnEraser.classList.remove('active');
  btnRect.classList.remove('active');
  btnISection.classList.remove('active');
  thicknessContainer.style.display = 'flex';
  eraserContainer.style.display = 'none';
  rectDimensionsContainer.style.display = 'none';
  iSectionDimensionsContainer.style.display = 'none';
});

btnEraser.addEventListener('click', () => {
  currentTool = 'eraser';
  btnEraser.classList.add('active');
  btnPen.classList.remove('active');
  btnRect.classList.remove('active');
  btnISection.classList.remove('active');
  thicknessContainer.style.display = 'none';
  eraserContainer.style.display = 'flex';
  rectDimensionsContainer.style.display = 'none';
  iSectionDimensionsContainer.style.display = 'none';
});

btnRect.addEventListener('click', () => {
  currentTool = 'rect';
  btnRect.classList.add('active');
  btnPen.classList.remove('active');
  btnEraser.classList.remove('active');
  btnISection.classList.remove('active');
  thicknessContainer.style.display = 'none';
  eraserContainer.style.display = 'none';
  rectDimensionsContainer.style.display = 'block';
  iSectionDimensionsContainer.style.display = 'none';
});

btnISection.addEventListener('click', () => {
  currentTool = 'isection';
  btnISection.classList.add('active');
  btnPen.classList.remove('active');
  btnEraser.classList.remove('active');
  btnRect.classList.remove('active');
  thicknessContainer.style.display = 'none';
  eraserContainer.style.display = 'none';
  rectDimensionsContainer.style.display = 'none';
  iSectionDimensionsContainer.style.display = 'block';
});

function enforceThicknessConstraint() {
  let snap = parseInt(snapSizeSlider.value, 10);
  if (snap === 0) snap = 1;

  const thickness = parseInt(thicknessSlider.value, 10);
  const eraser = parseInt(eraserSlider.value, 10);
  
  if (thickness < snap) {
    thicknessSlider.value = snap.toString();
    thicknessValue.textContent = snap.toString();
  }
  if (eraser < snap) {
    eraserSlider.value = snap.toString();
    eraserValue.textContent = snap.toString();
  }
}

function enforceSnapConstraint() {
  const currentSnap = parseInt(snapSizeSlider.value, 10);
  const activeSize = currentTool === 'pen' ? parseInt(thicknessSlider.value, 10) : parseInt(eraserSlider.value, 10);
  
  if (currentSnap > activeSize) {
    const snap = Math.max(0, Math.floor(activeSize / 5) * 5);
    snapSizeSlider.value = snap.toString();
    snapSizeValue.textContent = snap === 0 ? '0' : snap.toString();
  }
}

thicknessSlider.addEventListener('input', () => {
  thicknessValue.textContent = thicknessSlider.value;
  enforceSnapConstraint();
});

eraserSlider.addEventListener('input', () => {
  eraserValue.textContent = eraserSlider.value;
  enforceSnapConstraint();
});

snapSizeSlider.addEventListener('input', () => {
  enforceThicknessConstraint();
  const val = parseInt(snapSizeSlider.value, 10);
  snapSizeValue.textContent = val === 0 ? '0' : val.toString();
});

btnSnap.addEventListener('click', () => {
  snapEnabled = !snapEnabled;
  if (snapEnabled) {
    btnSnap.classList.add('active');
    snapSliderContainer.style.display = 'flex';
    snapDivider.style.display = 'block';
  } else {
    btnSnap.classList.remove('active');
    snapSliderContainer.style.display = 'none';
    snapDivider.style.display = 'none';
  }
});

btnClear.addEventListener('click', () => {
  calculator.addAction({ type: 'clear' });
  calculator.executeAction({ type: 'clear' });
  renderer.clear();
  updateUI();
});

btnReset.addEventListener('click', () => {
  renderer.centerView();
});

btnUndo.addEventListener('click', () => {
  if (calculator.undo()) {
    renderer.syncFromData(calculator.getGrid());
    updateUI();
  }
});

btnRedo.addEventListener('click', () => {
  if (calculator.redo()) {
    renderer.syncFromData(calculator.getGrid());
    updateUI();
  }
});

// Shortcuts
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'p') btnPen.click();
  if (e.key.toLowerCase() === 'e') btnEraser.click();
  if (e.key.toLowerCase() === 'r') btnRect.click();
  if (e.key.toLowerCase() === 'i') btnISection.click();
  if (e.key.toLowerCase() === 'v') btnReset.click();
  
  if (e.ctrlKey && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    btnUndo.click();
  }
  if (e.ctrlKey && e.key.toLowerCase() === 'y') {
    e.preventDefault();
    btnRedo.click();
  }
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    btnRedo.click();
  }
});

// Render Loop
let lastMouseWorld: {x: number, y: number} | null = null;

function loop() {
  const results = calculator.getResults();
  const snapPos = lastMouseWorld ? getSnapPos(lastMouseWorld.x, lastMouseWorld.y) : null;
  const brushSize = currentTool === 'rect' ? 0 : (currentTool === 'pen' 
    ? parseInt(thicknessSlider.value, 10) 
    : parseInt(eraserSlider.value, 10));

  const ghostRect = currentTool === 'rect' ? {
    w: parseInt(rectWInput.value, 10),
    h: parseInt(rectHInput.value, 10)
  } : undefined;

  const ghostISection = currentTool === 'isection' ? {
    w: parseInt(iWInput.value, 10),
    h: parseInt(iHInput.value, 10),
    tf: parseInt(iTFInput.value, 10),
    tw: parseInt(iTWInput.value, 10),
  } : undefined;
  
  renderer.redraw(results, snapPos, lastMouseWorld, brushSize, ghostRect, ghostISection);
  requestAnimationFrame(loop);
}

// Start
async function initApp() {
  updateUI();
  
  try {
    const savedHistory = await storage.load('last-session-history');
    if (Array.isArray(savedHistory)) {
      calculator.history = savedHistory;
      calculator.rebuild();
      renderer.syncFromData(calculator.getGrid());
      updateUI();
    }
  } catch (err) {
    console.warn('Failed to restore session:', err);
  }
  
  requestAnimationFrame(loop);
}

initApp();
