import type { SMAResults } from "./calculator";

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private offCanvas: HTMLCanvasElement;
  private offCtx: CanvasRenderingContext2D;
  
  private zoom: number = 1.0;
  private offsetX: number = 0;
  private offsetY: number = 0;
  
  private width: number;
  private height: number;

  constructor(canvas: HTMLCanvasElement, width: number, height: number) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.width = width;
    this.height = height;

    // Offscreen canvas for the 1000x1000 grid pixels
    this.offCanvas = document.createElement("canvas");
    this.offCanvas.width = width;
    this.offCanvas.height = height;
    this.offCtx = this.offCanvas.getContext("2d", { alpha: true })!;
    
    this.resize();
    this.centerView();
  }

  public resize() {
    this.canvas.width = this.canvas.clientWidth * window.devicePixelRatio;
    this.canvas.height = this.canvas.clientHeight * window.devicePixelRatio;
  }

  public centerView() {
    const canvasW = this.canvas.width;
    const canvasH = this.canvas.height;
    
    // Set zoom so that 500mm of height is visible
    this.zoom = canvasH / 500;

    // Center engineering origin (1500, 1500)
    this.offsetX = canvasW / 2 - (this.width / 2) * this.zoom;
    this.offsetY = canvasH / 2 - (this.height / 2) * this.zoom;
  }

  public worldToScreen(worldX: number, worldY: number) {
    return {
      x: worldX * this.zoom + this.offsetX,
      y: worldY * this.zoom + this.offsetY
    };
  }

  public screenToWorld(screenX: number, screenY: number) {
    return {
      x: (screenX * window.devicePixelRatio - this.offsetX) / this.zoom,
      y: (screenY * window.devicePixelRatio - this.offsetY) / this.zoom
    };
  }

  public handleZoom(delta: number, mouseX: number, mouseY: number) {
    const worldBefore = this.screenToWorld(mouseX, mouseY);
    
    const zoomFactor = delta > 0 ? 0.9 : 1.1;
    this.zoom *= zoomFactor;
    
    // Limits
    this.zoom = Math.max(0.1, Math.min(this.zoom, 100));

    const worldAfter = this.screenToWorld(mouseX, mouseY);
    
    // Adjust offset to zoom relative to mouse
    this.offsetX += (worldAfter.x - worldBefore.x) * this.zoom;
    this.offsetY += (worldAfter.y - worldBefore.y) * this.zoom;
  }

  public handlePan(dx: number, dy: number) {
    this.offsetX += dx * window.devicePixelRatio;
    this.offsetY += dy * window.devicePixelRatio;
  }

  public updatePixel(x: number, y: number, active: boolean) {
    if (active) {
      this.offCtx.fillStyle = "#38bdf8";
      this.offCtx.fillRect(x, y, 1, 1);
    } else {
      this.offCtx.clearRect(x, y, 1, 1);
    }
  }

  public drawRect(x: number, y: number, w: number, h: number, active: boolean) {
    const startX = Math.floor(x - w / 2);
    const startY = Math.floor(y - h / 2);
    if (active) {
      this.offCtx.fillStyle = "#38bdf8";
      this.offCtx.fillRect(startX, startY, w, h);
    } else {
      this.offCtx.clearRect(startX, startY, w, h);
    }
  }

  public drawCircle(cx: number, cy: number, r: number, active: boolean) {
    if (active) {
      this.offCtx.fillStyle = "#38bdf8";
      this.offCtx.beginPath();
      this.offCtx.arc(cx, cy, r, 0, Math.PI * 2);
      this.offCtx.fill();
    } else {
      this.offCtx.save();
      this.offCtx.globalCompositeOperation = 'destination-out';
      this.offCtx.beginPath();
      this.offCtx.arc(cx, cy, r, 0, Math.PI * 2);
      this.offCtx.fill();
      this.offCtx.restore();
    }
  }

  public drawLine(x1: number, y1: number, x2: number, y2: number, size: number, active: boolean) {
    this.offCtx.beginPath();
    this.offCtx.lineWidth = size;
    this.offCtx.lineCap = 'square';
    this.offCtx.lineJoin = 'round';
    
    if (active) {
      this.offCtx.strokeStyle = "#38bdf8";
      this.offCtx.globalCompositeOperation = 'source-over';
    } else {
      this.offCtx.strokeStyle = "black"; // Not used but for reference
      this.offCtx.globalCompositeOperation = 'destination-out';
    }
    
    this.offCtx.moveTo(x1, y1);
    this.offCtx.lineTo(x2, y2);
    this.offCtx.stroke();
    
    // Reset composite operation
    this.offCtx.globalCompositeOperation = 'source-over';
  }

  public drawISection(x: number, y: number, w: number, h: number, tf: number, tw: number, active: boolean) {
    const startX = Math.floor(x - w / 2);
    const startY = Math.floor(y - h / 2);
    const webX = Math.floor(x - tw / 2);

    if (active) {
      this.offCtx.fillStyle = "#38bdf8";
      this.offCtx.fillRect(startX, startY, w, tf); // Top
      this.offCtx.fillRect(startX, Math.floor(y + h / 2 - tf), w, tf); // Bottom
      this.offCtx.fillRect(webX, startY, tw, h); // Web
    } else {
      this.offCtx.clearRect(startX, startY, w, tf);
      this.offCtx.clearRect(startX, Math.floor(y + h / 2 - tf), w, tf);
      this.offCtx.clearRect(webX, startY, tw, h);
    }
  }

  public syncFromData(data: Uint8Array) {
    this.offCtx.clearRect(0, 0, this.width, this.height);
    this.offCtx.fillStyle = "#38bdf8";
    for (let i = 0; i < data.length; i++) {
      if (data[i] === 1) {
        const x = i % this.width;
        const y = Math.floor(i / this.width);
        this.offCtx.fillRect(x, y, 1, 1);
      }
    }
  }

  public clear() {
    this.offCtx.clearRect(0, 0, this.width, this.height);
  }

  public getAxisStep(): number {
    const potentialSteps = [500, 200, 100, 50, 20, 10, 5, 2, 1];
    let step = 100;
    for (const s of potentialSteps) {
      if (s * this.zoom >= 60) {
        step = s;
      } else {
        break;
      }
    }
    return step;
  }

  public redraw(results: SMAResults, snapPos: {x: number, y: number} | null, mouseWorld: {x: number, y: number} | null, brushSize: number, ghostRect?: {w: number, h: number}, ghostCircle?: {r: number}, ghostISection?: {w: number, h: number, tf: number, tw: number}) {
    const { ctx, canvas, offCanvas, zoom, offsetX, offsetY, width, height } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    
    // 1. Draw Grid Lines
    this.drawGrid();

    // 2. Draw Grid Border
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 2;
    ctx.strokeRect(offsetX, offsetY, width * zoom, height * zoom);

    // 4. Draw Offscreen Content (the pixels)
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(offCanvas, offsetX, offsetY, width * zoom, height * zoom);

    // 5. Draw Brush/Rect Preview (if mouse is inside)
    if (mouseWorld && mouseWorld.x >= 0 && mouseWorld.x < width && mouseWorld.y >= 0 && mouseWorld.y < height) {
      const px = (snapPos ? snapPos.x : mouseWorld.x) * zoom + offsetX;
      const py = (snapPos ? snapPos.y : mouseWorld.y) * zoom + offsetY;

      ctx.beginPath();
      ctx.strokeStyle = "rgba(56, 189, 248, 0.5)";
      ctx.setLineDash([5, 5]);

      if (ghostRect) {
        ctx.strokeRect(px - (ghostRect.w/2)*zoom, py - (ghostRect.h/2)*zoom, ghostRect.w*zoom, ghostRect.h*zoom);
      } else if (ghostCircle) {
        ctx.beginPath();
        ctx.arc(px, py, ghostCircle.r * zoom, 0, Math.PI * 2);
        ctx.stroke();
      } else if (ghostISection) {
        const { w, h, tf, tw } = ghostISection;
        // Top Flange
        ctx.strokeRect(px - (w/2)*zoom, py - (h/2)*zoom, w*zoom, tf*zoom);
        // Bottom Flange
        ctx.strokeRect(px - (w/2)*zoom, py + (h/2 - tf)*zoom, w*zoom, tf*zoom);
        // Web
        ctx.strokeRect(px - (tw/2)*zoom, py - (h/2 - tf)*zoom, tw*zoom, (h - 2*tf)*zoom);
      } else {
        // Pixel-perfect brush alignment matching main.ts
        const bx = Math.floor((snapPos ? snapPos.x : mouseWorld.x) - (brushSize - 1) / 2);
        const by = Math.floor((snapPos ? snapPos.y : mouseWorld.y) - (brushSize - 1) / 2);
        ctx.strokeRect(bx * zoom + offsetX, by * zoom + offsetY, brushSize * zoom, brushSize * zoom);
      }
      
      ctx.setLineDash([]);
    }

    // 6. Draw Centroid
    if (results.count > 0) {
      const cx = results.centroidX * zoom + offsetX;
      const cy = results.centroidY * zoom + offsetY;

      // Faint circle
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Crosshair
      ctx.beginPath();
      ctx.moveTo(cx - 15, cy);
      ctx.lineTo(cx + 15, cy);
      ctx.moveTo(cx, cy - 15);
      ctx.lineTo(cx, cy + 15);
      ctx.stroke();
    }

    // 7. Draw Axis Rulers (Always on top)
    this.drawAxis();

    ctx.restore();
  }

  private drawGrid() {
    const { ctx, zoom, offsetX, offsetY, width, height } = this;
    const step = this.getAxisStep();
    
    ctx.beginPath();
    ctx.strokeStyle = `rgba(255, 255, 255, 0.15)`;
    ctx.lineWidth = 1;

    // Vertical lines
    for (let x = 0; x <= width; x += step) {
      const sx = x * zoom + offsetX;
      if (sx < 0 || sx > this.canvas.width) continue;
      ctx.moveTo(sx, Math.max(0, offsetY));
      ctx.lineTo(sx, Math.min(this.canvas.height, offsetY + height * zoom));
    }

    // Horizontal lines
    for (let y = 0; y <= height; y += step) {
      const sy = y * zoom + offsetY;
      if (sy < 0 || sy > this.canvas.height) continue;
      ctx.moveTo(Math.max(0, offsetX), sy);
      ctx.lineTo(Math.min(this.canvas.width, offsetX + width * zoom), sy);
    }
    ctx.stroke();

    // 2. Draw Origin Lines (0,0)
    ctx.beginPath();
    ctx.strokeStyle = "rgba(56, 189, 248, 0.4)"; // Faint accent blue
    ctx.lineWidth = 2;

    const ox = (width / 2) * zoom + offsetX;
    if (ox >= 0 && ox <= this.canvas.width) {
      ctx.moveTo(ox, Math.max(0, offsetY));
      ctx.lineTo(ox, Math.min(this.canvas.height, offsetY + height * zoom));
    }

    const oy = (height / 2) * zoom + offsetY;
    if (oy >= 0 && oy <= this.canvas.height) {
      ctx.moveTo(Math.max(0, offsetX), oy);
      ctx.lineTo(Math.min(this.canvas.width, offsetX + width * zoom), oy);
    }
    ctx.stroke();
  }

  private drawAxis() {
    const { ctx, zoom, offsetX, offsetY, width, height, canvas } = this;
    
    const rulerSize = 30; // 30px ruler track
    const bgColor = "rgba(15, 23, 42, 0.8)";
    const textColor = "rgba(256, 256, 256, 0.6)";
    const tickColor = "rgba(256, 256, 256, 0.3)";

    // 1. Draw Ruler Backgrounds
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, rulerSize); // Top ruler
    ctx.fillRect(0, 0, rulerSize, canvas.height); // Left ruler

    // 2. Determine Dynamic Step
    const step = this.getAxisStep();

    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // 3. Draw Horizontal Ruler (Top)
    const xMin = -offsetX / zoom;
    const xMax = (canvas.width - offsetX) / zoom;
    const startX = Math.ceil(xMin / step) * step;

    for (let x = startX; x <= xMax; x += step) {
      if (x < 0 || x > width) continue;
      const sx = x * zoom + offsetX;
      
      // Tick
      ctx.beginPath();
      ctx.moveTo(sx, rulerSize - 5);
      ctx.lineTo(sx, rulerSize);
      ctx.strokeStyle = tickColor;
      ctx.stroke();

      // Label (centered origin)
      ctx.fillStyle = textColor;
      ctx.fillText(`${x - width/2}`, sx, rulerSize / 2);
    }

    // 4. Draw Vertical Ruler (Left)
    ctx.textAlign = "right";
    const yMin = -offsetY / zoom;
    const yMax = (canvas.height - offsetY) / zoom;
    const startY = Math.ceil(yMin / step) * step;

    for (let y = startY; y <= yMax; y += step) {
      if (y < 0 || y > height) continue;
      const sy = y * zoom + offsetY;
      
      // Tick
      ctx.beginPath();
      ctx.moveTo(rulerSize - 5, sy);
      ctx.lineTo(rulerSize, sy);
      ctx.strokeStyle = tickColor;
      ctx.stroke();

      // Label (centered origin)
      ctx.fillStyle = textColor;
      ctx.fillText(`${y - height/2}`, rulerSize - 8, sy);
    }

    // 5. Unit Label in the Corner (0,0 of ruler)
    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 9px Inter";
    ctx.textAlign = "center";
    ctx.fillText("mm", rulerSize / 2, rulerSize / 2);
  }

  public getCanvas() {
    return this.canvas;
  }
}
