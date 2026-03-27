export interface SMAResults {
  count: number;
  area: number;
  width: number;
  height: number;
  centroidX: number;
  centroidY: number;
  Ix: number;
  Iy: number;
  Ixy: number;
  J: number;
  Imax: number;
  Imin: number;
  theta: number; // Principal Angle
  kx: number; // Radius of Gyration
  ky: number;
  Zx: number; // Elastic Section Modulus
  Zy: number;
  perimeter: number;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export type Action = 
  | { type: 'rect'; x: number; y: number; w: number; h: number; active: boolean }
  | { type: 'isection'; x: number; y: number; w: number; h: number; tf: number; tw: number; active: boolean }
  | { type: 'stroke'; points: {x: number, y: number}[]; size: number; active: boolean }
  | { type: 'clear' };

export class SMACalculator {
  private n: number = 0;
  private sumX: number = 0;
  private sumY: number = 0;
  private sumXY: number = 0;
  private sumX2: number = 0;
  private sumY2: number = 0;

  private xMin: number = Infinity;
  private xMax: number = -Infinity;
  private yMin: number = Infinity;
  private yMax: number = -Infinity;

  // We store the grid state to avoid double-counting
  private grid: Uint8Array;
  private width: number;
  private height: number;

  public history: Action[] = [];
  private redoStack: Action[] = [];
  private isReplaying = false;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.grid = new Uint8Array(width * height);
  }

  public setPixel(x: number, y: number, active: boolean): boolean {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
    
    const index = y * this.width + x;
    const currentState = this.grid[index] === 1;

    if (currentState === active) return false; // No change

    this.grid[index] = active ? 1 : 0;

    const dx = x;
    const dy = y;

    if (active) {
      this.n++;
      this.sumX += dx;
      this.sumY += dy;
      this.sumXY += dx * dy;
      this.sumX2 += dx * dx;
      this.sumY2 += dy * dy;

      // Expand bounds
      if (dx < this.xMin) this.xMin = dx;
      if (dx > this.xMax) this.xMax = dx;
      if (dy < this.yMin) this.yMin = dy;
      if (dy > this.yMax) this.yMax = dy;
    } else {
      this.n--;
      this.sumX -= dx;
      this.sumY -= dy;
      this.sumXY -= dx * dy;
      this.sumX2 -= dx * dx;
      this.sumY2 -= dy * dy;

      // Shrink bounds check
      if (this.n === 0) {
        this.clearBounds();
      } else if (dx === this.xMin || dx === this.xMax || dy === this.yMin || dy === this.yMax) {
        this.recomputeBounds();
      }
    }

    return true;
  }

  private clearBounds() {
    this.xMin = Infinity;
    this.xMax = -Infinity;
    this.yMin = Infinity;
    this.yMax = -Infinity;
  }

  private recomputeBounds() {
    this.clearBounds();
    for (let i = 0; i < this.grid.length; i++) {
        if (this.grid[i] === 1) {
            const x = i % this.width;
            const y = Math.floor(i / this.width);
            if (x < this.xMin) this.xMin = x;
            if (x > this.xMax) this.xMax = x;
            if (y < this.yMin) this.yMin = y;
            if (y > this.yMax) this.yMax = y;
        }
    }
  }

  public getResults(): SMAResults {
    if (this.n === 0) {
      return { 
        count: 0, area: 0, width: 0, height: 0, centroidX: 0, centroidY: 0, 
        Ix: 0, Iy: 0, Ixy: 0, J: 0, Imax: 0, Imin: 0, theta: 0, 
        kx: 0, ky: 0, Zx: 0, Zy: 0, perimeter: 0,
        xMin: 0, xMax: 0, yMin: 0, yMax: 0
      };
    }

    const cx = this.sumX / this.n;
    const cy = this.sumY / this.n;

    // Second Moments
    const Ix = (this.n / 12) + (this.sumY2 - this.n * cy * cy);
    const Iy = (this.n / 12) + (this.sumX2 - this.n * cx * cx);
    const Ixy = this.sumXY - this.n * cx * cy;
    const J = Ix + Iy;

    // Principal Axis calculation
    const Iavg = (Ix + Iy) / 2;
    const R = Math.sqrt(Math.pow((Ix - Iy) / 2, 2) + Math.pow(Ixy, 2));
    const Imax = Iavg + R;
    const Imin = Iavg - R;
    const theta = 0.5 * Math.atan2(-2 * Ixy, Ix - Iy) * (180 / Math.PI);

    // Radii of Gyration
    const kx = Math.sqrt(Math.max(0, Ix / this.n));
    const ky = Math.sqrt(Math.max(0, Iy / this.n));

    // Section Moduli (using extreme fiber distances)
    const yMaxDist = Math.max(Math.abs((cy + 0.5) - this.yMin), Math.abs(this.yMax - (cy - 0.5)));
    const xMaxDist = Math.max(Math.abs((cx + 0.5) - this.xMin), Math.abs(this.xMax - (cx - 0.5)));
    const Zx = yMaxDist > 0 ? Ix / yMaxDist : 0;
    const Zy = xMaxDist > 0 ? Iy / xMaxDist : 0;

    // Perimeter calculation (Edge counting)
    let p = 0;
    for (let i = 0; i < this.grid.length; i++) {
      if (this.grid[i] === 1) {
        const x = i % this.width;
        const y = Math.floor(i / this.width);
        // Neighbors (Top, Bottom, Left, Right)
        if (y === 0 || this.grid[i - this.width] === 0) p++;
        if (y === this.height - 1 || this.grid[i + this.width] === 0) p++;
        if (x === 0 || this.grid[i - 1] === 0) p++;
        if (x === this.width - 1 || this.grid[i + 1] === 0) p++;
      }
    }

    return {
      count: this.n,
      area: this.n,
      width: this.xMax - this.xMin + 1,
      height: this.yMax - this.yMin + 1,
      centroidX: cx + 0.5,
      centroidY: cy + 0.5,
      Ix: Math.max(0, Ix),
      Iy: Math.max(0, Iy),
      Ixy,
      J: Math.max(0, J),
      Imax,
      Imin,
      theta,
      kx,
      ky,
      Zx,
      Zy,
      perimeter: p,
      xMin: this.xMin,
      xMax: this.xMax,
      yMin: this.yMin,
      yMax: this.yMax
    };
  }

  public getGrid(): Uint8Array {
    return this.grid;
  }

  public clear(): void {
    this.grid.fill(0);
    this.n = 0;
    this.sumX = 0;
    this.sumY = 0;
    this.sumXY = 0;
    this.sumX2 = 0;
    this.sumY2 = 0;
    this.clearBounds();
  }

  // --- History Management (Undo/Redo) ---
  
  public addAction(action: Action): void {
    if (this.isReplaying) return;
    this.history.push(action);
    this.redoStack = []; // Clear redo on new action
  }

  public undo(): boolean {
    if (this.history.length === 0) return false;
    const action = this.history.pop()!;
    this.redoStack.push(action);
    this.rebuild();
    return true;
  }

  public redo(): boolean {
    if (this.redoStack.length === 0) return false;
    const action = this.redoStack.pop()!;
    this.history.push(action);
    this.rebuild();
    return true;
  }

  public rebuild(): void {
    this.isReplaying = true;
    this.clear(); // Reset core logic but not history
    for (const action of this.history) {
      this.executeAction(action);
    }
    this.isReplaying = false;
  }

  public executeAction(action: Action): void {
    switch (action.type) {
      case 'rect':
        this.drawRectInternal(action.x, action.y, action.w, action.h, action.active);
        break;
      case 'isection':
        this.drawISectionInternal(action.x, action.y, action.w, action.h, action.tf, action.tw, action.active);
        break;
      case 'stroke':
        this.drawStrokeInternal(action.points, action.size, action.active);
        break;
      case 'clear':
        this.clear();
        break;
    }
  }

  private drawRectInternal(xPos: number, yPos: number, w: number, h: number, active: boolean) {
    const startX = Math.floor(xPos - w/2);
    const endX = startX + w;
    const startY = Math.floor(yPos - h/2);
    const endY = startY + h;
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        this.setPixel(x, y, active);
      }
    }
  }

  private drawISectionInternal(xPos: number, yPos: number, W: number, H: number, tf: number, tw: number, active: boolean) {
    // Top Flange
    this.drawRectInternal(xPos, yPos - H/2 + tf/2, W, tf, active);
    // Bottom Flange
    this.drawRectInternal(xPos, yPos + H/2 - tf/2, W, tf, active);
    // Web
    this.drawRectInternal(xPos, yPos, tw, H - 2*tf, active);
  }

  private drawStrokeInternal(points: {x: number, y: number}[], size: number, active: boolean) {
    for (const p of points) {
      const startX = Math.floor(p.x - (size - 1) / 2);
      const startY = Math.floor(p.y - (size - 1) / 2);
      for (let y = startY; y < startY + size; y++) {
        for (let x = startX; x < startX + size; x++) {
          this.setPixel(x, y, active);
        }
      }
    }
  }
}
