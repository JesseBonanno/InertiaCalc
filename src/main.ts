import './style.css';
import { SMACalculator } from './calculator';
import { CanvasRenderer } from './canvas-renderer';
import { ShapeStorage } from './storage';

// Constants
const GRID_SIZE = 3000; // 3000mm x 3000mm
const ORIGIN_OFFSET = 1500; // Engineering origin at center of 3m grid

// State
let currentMode: 'add' | 'subtract' = 'add';
let currentShape: 'pen' | 'rect' | 'circle' | 'isection' = 'pen';
let isDrawing = false;
let isPanning = false;
let lastMousePos = { x: 0, y: 0 };
let currentStroke: { type: 'stroke', points: {x: number, y: number}[], size: number, active: boolean } | null = null;

// DOM Elements
const canvas = document.getElementById('main-canvas') as HTMLCanvasElement;
const btnModeAdd = document.getElementById('btn-mode-add') as HTMLButtonElement;
const btnModeSub = document.getElementById('btn-mode-sub') as HTMLButtonElement;
const btnPen = document.getElementById('btn-pen') as HTMLButtonElement;
const btnRect = document.getElementById('btn-rect') as HTMLButtonElement;
const btnCircle = document.getElementById('btn-circle') as HTMLButtonElement;
const btnISection = document.getElementById('btn-i-section') as HTMLButtonElement;

const thicknessSlider = document.getElementById('thickness-slider') as HTMLInputElement;
const thicknessValue = document.getElementById('thickness-value') as HTMLSpanElement;
const thicknessContainer = document.getElementById('thickness-container') as HTMLDivElement;
const thicknessLabel = document.getElementById('thickness-label') as HTMLLabelElement;
const snapSliderContainer = document.getElementById('snap-slider-container') as HTMLDivElement;

const rectDimensionsContainer = document.getElementById('rect-dimensions-container') as HTMLDivElement;
const rectWInput = document.getElementById('rect-w') as HTMLInputElement;
const rectHInput = document.getElementById('rect-h') as HTMLInputElement;

const circleDimensionsContainer = document.getElementById('circle-dimensions-container') as HTMLDivElement;
const circleRInput = document.getElementById('circle-r') as HTMLInputElement;

const iSectionDimensionsContainer = document.getElementById('i-section-dimensions-container') as HTMLDivElement;
const iWInput = document.getElementById('i-w') as HTMLInputElement;
const iHInput = document.getElementById('i-h') as HTMLInputElement;
const iTFInput = document.getElementById('i-tf') as HTMLInputElement;
const iTWInput = document.getElementById('i-tw') as HTMLInputElement;

const snapSizeSlider = document.getElementById('snap-size-slider') as HTMLInputElement;
const snapSizeValue = document.getElementById('snap-size-value') as HTMLSpanElement;
const btnClear = document.getElementById('btn-clear') as HTMLButtonElement;
const btnExportPng = document.getElementById('btn-export-png') as HTMLButtonElement;
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

// Mobile UI Elements
const btnToggleTools = document.getElementById('btn-toggle-tools') as HTMLButtonElement;
const btnToggleProps = document.getElementById('btn-toggle-props') as HTMLButtonElement;
const btnCloseTools = document.getElementById('btn-close-tools') as HTMLButtonElement;
const btnCloseProps = document.getElementById('btn-close-props') as HTMLButtonElement;
const mainToolbox = document.getElementById('main-toolbox') as HTMLDivElement;
const propertiesSidebar = document.getElementById('properties-sidebar') as HTMLDivElement;

function closeAllMobilePanels(): boolean {
  const wasToolboxOpen = mainToolbox.classList.contains('mobile-open');
  const wasSidebarOpen = propertiesSidebar.classList.contains('mobile-open');
  mainToolbox.classList.remove('mobile-open');
  propertiesSidebar.classList.remove('mobile-open');
  return wasToolboxOpen || wasSidebarOpen; // Returns true if anything was actually closed
}

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

let uiUpdateTimeout: number | undefined;
function requestUIUpdate() {
  if (uiUpdateTimeout) clearTimeout(uiUpdateTimeout);
  uiUpdateTimeout = setTimeout(() => {
    updateUI();
  }, 100) as unknown as number; // Debounce by 100ms
}

function getSnapPos(worldX: number, worldY: number) {
  const snap = parseInt(snapSizeSlider.value, 10);
  if (snap === 0) return { x: Math.floor(worldX), y: Math.floor(worldY) };

  const snappedX = Math.round(worldX / snap) * snap;
  const snappedY = Math.round(worldY / snap) * snap;
  
  return { x: snappedX, y: snappedY };
}

function drawAt(worldX: number, worldY: number) {
  const snapPos = getSnapPos(worldX, worldY);
  const active = currentMode === 'add';
  let changed = false;

  if (currentShape === 'rect') {
    const w = parseInt(rectWInput.value, 10);
    const h = parseInt(rectHInput.value, 10);
    
    calculator.addAction({
      type: 'rect',
      x: snapPos.x,
      y: snapPos.y,
      w: w,
      h: h,
      active
    });
    calculator.executeAction(calculator.history[calculator.history.length - 1]);
    renderer.drawRect(snapPos.x, snapPos.y, w, h, active);
    changed = true;
    isDrawing = false; // Discrete action
  } else if (currentShape === 'circle') {
    const r = parseInt(circleRInput.value, 10);
    
    calculator.addAction({
      type: 'circle',
      x: snapPos.x,
      y: snapPos.y,
      r: r,
      active
    });
    calculator.executeAction(calculator.history[calculator.history.length - 1]);
    renderer.drawCircle(snapPos.x, snapPos.y, r, active);
    changed = true;
    isDrawing = false; // Discrete action
  } else if (currentShape === 'isection') {
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
      active
    });
    calculator.executeAction(calculator.history[calculator.history.length - 1]);
    renderer.drawISection(snapPos.x, snapPos.y, W, H, tf, tw, active);
    changed = true;
    isDrawing = false; // Discrete action
  } else {
    // Pen (Stroke)
    const thickness = parseInt(thicknessSlider.value, 10);

    if (!currentStroke) {
      currentStroke = {
        type: 'stroke',
        points: [],
        size: thickness,
        active: active
      };
    }

    const lastPoint = currentStroke.points[currentStroke.points.length - 1];
    if (!lastPoint || lastPoint.x !== snapPos.x || lastPoint.y !== snapPos.y) {
      const p1 = lastPoint || { x: snapPos.x, y: snapPos.y };
      const p2 = { x: snapPos.x, y: snapPos.y };

      // Update Calculator (Pixel Grid)
      calculator.drawStrokeSegment(p1.x, p1.y, p2.x, p2.y, thickness, active);
      
      // Update Renderer (Visual)
      renderer.drawLine(p1.x, p1.y, p2.x, p2.y, thickness, active);
      
      currentStroke.points.push(p2);
      changed = true;
    }
  }

  if (changed) requestUIUpdate();
}

// Event Listeners
window.addEventListener('resize', () => {
  renderer.resize();
});

canvas.addEventListener('pointerdown', (e) => {
  // Always close mobile panels if interaction with canvas begins
  const closedPanel = closeAllMobilePanels();

  // If a menu was closed, don't draw or pan. Just focus the grid.
  if (closedPanel) {
    return;
  }

  // Set pointer capture to ensure smooth tracking off-canvas and to unify touch/mouse
  canvas.setPointerCapture(e.pointerId);

  if (e.button === 0) { // Left click / primary touch
    // Always start a fresh stroke state
    currentStroke = null;
    isDrawing = true;
    const world = renderer.screenToWorld(e.clientX, e.clientY);
    drawAt(world.x, world.y);
  } else if (e.button === 1 || e.button === 2) { // Middle or Right click
    isPanning = true;
    lastMousePos = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  }
});

window.addEventListener('pointermove', (e) => {
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

window.addEventListener('pointerup', async (e) => {
  try {
    canvas.releasePointerCapture(e.pointerId);
  } catch (err) { /* ignore if already released */ }

  if (isDrawing && currentStroke) {
    calculator.addAction(currentStroke);
    
    // Auto-save history to IndexedDB
    try {
      await storage.save('last-session-history', calculator.history);
      updateUI(); // Final update after stroke
    } catch (err) {
      console.warn('Failed to auto-save:', err);
    }
  }
  
  // ALWAYS reset these, regardless of currentTool or isDrawing
  currentStroke = null;
  isDrawing = false;
  isPanning = false;
});

canvas.addEventListener('wheel', (e) => {
  renderer.handleZoom(e.deltaY, e.clientX, e.clientY);
  e.preventDefault();
}, { passive: false });

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// Mobile UI Links
btnToggleTools.addEventListener('click', () => {
  const isCurrentlyOpen = mainToolbox.classList.contains('mobile-open');
  closeAllMobilePanels();
  if (!isCurrentlyOpen) {
    mainToolbox.classList.add('mobile-open');
  }
});

btnToggleProps.addEventListener('click', () => {
  const isCurrentlyOpen = propertiesSidebar.classList.contains('mobile-open');
  closeAllMobilePanels();
  if (!isCurrentlyOpen) {
    propertiesSidebar.classList.add('mobile-open');
  }
});

btnCloseTools.addEventListener('click', () => {
  mainToolbox.classList.toggle('minimized');
  closeAllMobilePanels();
});
btnCloseProps.addEventListener('click', () => {
  propertiesSidebar.classList.toggle('minimized');
  closeAllMobilePanels();
});

// Mode UI
btnModeAdd.addEventListener('click', () => {
  currentMode = 'add';
  btnModeAdd.classList.add('active');
  btnModeSub.classList.remove('active');
  thicknessLabel.textContent = 'Pen Size';
});

btnModeSub.addEventListener('click', () => {
  currentMode = 'subtract';
  btnModeSub.classList.add('active');
  btnModeAdd.classList.remove('active');
  thicknessLabel.textContent = 'Eraser Size';
});

// Shape UI
btnPen.addEventListener('click', () => {
  currentShape = 'pen';
  btnPen.classList.add('active');
  btnRect.classList.remove('active');
  btnCircle.classList.remove('active');
  btnISection.classList.remove('active');
  thicknessContainer.style.display = 'flex';
  snapSliderContainer.style.display = 'flex';
  rectDimensionsContainer.style.display = 'none';
  circleDimensionsContainer.style.display = 'none';
  iSectionDimensionsContainer.style.display = 'none';
});

btnRect.addEventListener('click', () => {
  currentShape = 'rect';
  btnRect.classList.add('active');
  btnPen.classList.remove('active');
  btnCircle.classList.remove('active');
  btnISection.classList.remove('active');
  thicknessContainer.style.display = 'none';
  snapSliderContainer.style.display = 'none';
  rectDimensionsContainer.style.display = 'block';
  circleDimensionsContainer.style.display = 'none';
  iSectionDimensionsContainer.style.display = 'none';
});

btnCircle.addEventListener('click', () => {
  currentShape = 'circle';
  btnCircle.classList.add('active');
  btnPen.classList.remove('active');
  btnRect.classList.remove('active');
  btnISection.classList.remove('active');
  thicknessContainer.style.display = 'none';
  snapSliderContainer.style.display = 'none';
  rectDimensionsContainer.style.display = 'none';
  circleDimensionsContainer.style.display = 'block';
  iSectionDimensionsContainer.style.display = 'none';
});

btnISection.addEventListener('click', () => {
  currentShape = 'isection';
  btnISection.classList.add('active');
  btnPen.classList.remove('active');
  btnRect.classList.remove('active');
  btnCircle.classList.remove('active');
  thicknessContainer.style.display = 'none';
  snapSliderContainer.style.display = 'none';
  rectDimensionsContainer.style.display = 'none';
  circleDimensionsContainer.style.display = 'none';
  iSectionDimensionsContainer.style.display = 'grid';
});

thicknessSlider.addEventListener('input', () => {
  thicknessValue.textContent = thicknessSlider.value;
});

snapSizeSlider.addEventListener('input', () => {
  const val = parseInt(snapSizeSlider.value, 10);
  snapSizeValue.textContent = val === 0 ? '0' : val.toString();
});

btnClear.addEventListener('click', async () => {
  calculator.addAction({ type: 'clear' });
  calculator.executeAction({ type: 'clear' });
  renderer.clear();
  updateUI();
  
  // Auto-save history to IndexedDB
  try {
    await storage.save('last-session-history', calculator.history);
  } catch (err) {
    console.warn('Failed to auto-save:', err);
  }
});

btnExportPng.addEventListener('click', () => {
  const results = calculator.getResults();
  if (results.count === 0) {
    alert("No shape to export.");
    return;
  }

  const canvasWidth = 1600;
  const canvasHeight = 1200;
  
  const expCanvas = document.createElement('canvas');
  expCanvas.width = canvasWidth;
  expCanvas.height = canvasHeight;
  const ctx = expCanvas.getContext('2d')!;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const leftWidth = 1000;
  const padding = 60;

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 44px sans-serif";
  ctx.fillText("InertiaCalc Output Report", padding, padding + 40);

  const xMin = results.xMin;
  const xMax = results.xMax;
  const yMin = results.yMin;
  const yMax = results.yMax;
  const w = results.width;
  const h = results.height;
  
  const availableW = leftWidth - 2 * padding;
  const availableH = canvasHeight - 200;
  const scale = Math.min(availableW / w, availableH / h) * 0.9;

  const grid = calculator.getGrid();
  
  const startX = padding + (availableW - w * scale) / 2;
  const startY = 160 + (availableH - h * scale) / 2;

  ctx.fillStyle = "#0f172a";
  
  const drawScale = Math.max(scale, 1.0); 

  for (let y = yMin; y <= yMax; y++) {
    for (let x = xMin; x <= xMax; x++) {
      const idx = y * GRID_SIZE + x;
      if (grid[idx] === 1) {
        ctx.fillRect(Math.floor(startX + (x - xMin) * scale), Math.floor(startY + (y - yMin) * scale), Math.ceil(drawScale), Math.ceil(drawScale));
      }
    }
  }

  const cxRaw = results.centroidX;
  const cyRaw = results.centroidY;
  const cxDraw = startX + (cxRaw - 0.5 - xMin) * scale;
  const cyDraw = startY + (cyRaw - 0.5 - yMin) * scale;
  
  ctx.strokeStyle = "#e11d48";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cxDraw - 40, cyDraw); ctx.lineTo(cxDraw + 40, cyDraw);
  ctx.moveTo(cxDraw, cyDraw - 40); ctx.lineTo(cxDraw, cyDraw + 40);
  ctx.stroke();

  // Annotations
  ctx.strokeStyle = "#475569";
  ctx.fillStyle = "#475569";
  ctx.lineWidth = 1.5;
  ctx.font = "italic 20px sans-serif";

  const bY = startY + (h * scale) + 25;
  ctx.beginPath();
  ctx.moveTo(startX, bY);
  ctx.lineTo(startX + w * scale, bY);
  ctx.moveTo(startX, bY - 8); ctx.lineTo(startX, bY + 8);
  ctx.moveTo(startX + w * scale, bY - 8); ctx.lineTo(startX + w * scale, bY + 8);
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.fillText(`b = ${w} mm`, startX + (w * scale) / 2, bY + 22);

  const dX = startX - 35;
  ctx.beginPath();
  ctx.moveTo(dX, startY);
  ctx.lineTo(dX, startY + h * scale);
  ctx.moveTo(dX - 8, startY); ctx.lineTo(dX + 8, startY);
  ctx.moveTo(dX - 8, startY + h * scale); ctx.lineTo(dX + 8, startY + h * scale);
  ctx.stroke();
  ctx.save();
  ctx.translate(dX - 10, startY + (h * scale) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.fillText(`d = ${h} mm`, 0, 0);
  ctx.restore();
  ctx.textAlign = "left";

  const scaleRefCandidates = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000];
  let scaleRef = 1;
  for (const c of scaleRefCandidates) {
    if (c <= Math.max(w, h) / 3) scaleRef = c;
    else break;
  }
  const scaleBarWidth = scaleRef * scale;
  const barX = startX;
  const barY = canvasHeight - padding - 20;
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(barX, barY, scaleBarWidth, 4);
  ctx.fillRect(barX, barY - 10, 4, 14);
  ctx.fillRect(barX + scaleBarWidth - 4, barY - 10, 4, 14);
  ctx.font = "bold 22px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${scaleRef} mm`, barX + scaleBarWidth / 2, barY - 15);
  ctx.textAlign = "left";

  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(leftWidth, padding);
  ctx.lineTo(leftWidth, canvasHeight - padding);
  ctx.stroke();

  let textY = padding + 40;
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 34px sans-serif";
  ctx.fillText("Geometric Properties", leftWidth + padding, textY);
  textY += 60;

  const addLine = (label: string, value: string) => {
    ctx.font = "bold 22px sans-serif";
    ctx.fillStyle = "#475569";
    ctx.fillText(label, leftWidth + padding, textY);
    ctx.font = "22px monospace";
    ctx.fillStyle = "#0f172a";
    ctx.textAlign = "right";
    ctx.fillText(value, canvasWidth - padding, textY);
    ctx.textAlign = "left";
    ctx.beginPath();
    ctx.strokeStyle = "#f1f5f9";
    ctx.setLineDash([4, 4]);
    const labelW = ctx.measureText(label).width;
    ctx.moveTo(leftWidth + padding + labelW + 15, textY - 6);
    ctx.lineTo(canvasWidth - padding - 180, textY - 6);
    ctx.stroke();
    ctx.setLineDash([]);
    textY += 45;
  };

  addLine("Centroid X", `${(results.centroidX - ORIGIN_OFFSET).toFixed(1)} mm`);
  addLine("Centroid Y", `${(results.centroidY - ORIGIN_OFFSET).toFixed(1)} mm`);
  addLine("Area", `${results.area.toLocaleString()} mm²`);
  addLine("Width", `${results.width} mm`);
  addLine("Height", `${results.height} mm`);
  textY += 20;
  addLine("Moment Ix", `${results.Ix.toExponential(4)} mm⁴`);
  addLine("Moment Iy", `${results.Iy.toExponential(4)} mm⁴`);
  addLine("Product Ixy", `${results.Ixy.toExponential(4)} mm⁴`);
  addLine("Polar Moment J", `${results.J.toExponential(4)} mm⁴`);
  textY += 20;
  addLine("Principal Imax", `${results.Imax.toExponential(4)} mm⁴`);
  addLine("Principal Imin", `${results.Imin.toExponential(4)} mm⁴`);
  addLine("Principal Angle", `${results.theta.toFixed(2)}°`);
  textY += 20;
  addLine("Elastic Zx", `${results.Zx.toExponential(4)} mm³`);
  addLine("Elastic Zy", `${results.Zy.toExponential(4)} mm³`);
  textY += 20;
  addLine("Gyration kx", `${results.kx.toFixed(2)} mm`);
  addLine("Gyration ky", `${results.ky.toFixed(2)} mm`);

  const dataUrl = expCanvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = "InertiaCalc_Report.png";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
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
  if (e.key.toLowerCase() === 'a') btnModeAdd.click();
  if (e.key.toLowerCase() === 's' && !e.ctrlKey) btnModeSub.click();
  if (e.key.toLowerCase() === 'p') btnPen.click();
  if (e.key.toLowerCase() === 'r') btnRect.click();
  if (e.key.toLowerCase() === 'c') btnCircle.click();
  if (e.key.toLowerCase() === 'i') btnISection.click();
  
  if (e.ctrlKey && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    btnUndo.click();
  }
  if (e.ctrlKey && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
    e.preventDefault();
    btnRedo.click();
  }
});

// Render Loop
let lastMouseWorld: {x: number, y: number} | null = null;

function loop() {
  const results = calculator.getResults();
  const snapPos = lastMouseWorld ? getSnapPos(lastMouseWorld.x, lastMouseWorld.y) : null;
  const brushSize = currentShape === 'pen' ? parseInt(thicknessSlider.value, 10) : 0;

  const ghostRect = currentShape === 'rect' ? {
    w: parseInt(rectWInput.value, 10),
    h: parseInt(rectHInput.value, 10)
  } : undefined;

  const ghostCircle = currentShape === 'circle' ? {
    r: parseInt(circleRInput.value, 10)
  } : undefined;

  const ghostISection = currentShape === 'isection' ? {
    w: parseInt(iWInput.value, 10),
    h: parseInt(iHInput.value, 10),
    tf: parseInt(iTFInput.value, 10),
    tw: parseInt(iTWInput.value, 10),
  } : undefined;
  
  renderer.redraw(results, snapPos, lastMouseWorld, brushSize, ghostRect, ghostCircle, ghostISection);
  requestAnimationFrame(loop);
}

// Start
async function initApp() {
  // Accordion Logic
  document.querySelectorAll('.sidebar-sub-header').forEach(header => {
    header.addEventListener('click', (e) => {
      const section = (e.currentTarget as HTMLElement).closest('.collapsible-section');
      if (section) section.classList.toggle('collapsed');
    });
  });

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
