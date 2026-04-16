import DxfParser from 'dxf-parser';

export interface DXFEntity {
  type: string;
  [key: string]: any;
}

export class DXFImporter {
  private parser: DxfParser;

  constructor() {
    this.parser = new DxfParser();
  }

  public parse(text: string) {
    try {
      console.log('DXFImporter: Starting parse...');
      const result = this.parser.parseSync(text);
      console.log('DXFImporter: Parse successful.');
      return result;
    } catch (err) {
      console.error('DXF Parse Error:', err);
      throw new Error(`DXF Parser Failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  public resolveEntities(data: any): DXFEntity[] {
    console.log('DXFImporter: Resolving entities...');
    const rootEntities = data.entities || [];
    const flattened: DXFEntity[] = [];
    const blocks = data.blocks || {};
    const processedHashes = new Set<string>();

    const getHash = (ent: any): string => {
        try {
            if (ent.type === 'LINE') {
                if (!ent.vertices || ent.vertices.length < 2) return '';
                const p1 = ent.vertices[0];
                const p2 = ent.vertices[1];
                if (!p1 || !p2) return '';
                const pts = [p1, p2].sort((a, b) => (a.x - b.x) || (a.y - b.y));
                return `L:${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)},${pts[1].x.toFixed(2)},${pts[1].y.toFixed(2)}`;
            } else if (ent.type === 'LWPOLYLINE' || ent.type === 'POLYLINE') {
                if (!ent.vertices) return '';
                return `P:${ent.vertices.map((v: any) => `${(v.x || 0).toFixed(2)},${(v.y || 0).toFixed(2)},${(v.bulge || 0).toFixed(2)}`).join('|')}`;
            } else if (ent.type === 'CIRCLE') {
                if (!ent.center) return '';
                return `C:${ent.center.x.toFixed(2)},${ent.center.y.toFixed(2)},${(ent.radius || 0).toFixed(2)}`;
            } else if (ent.type === 'ARC') {
                if (!ent.center) return '';
                return `A:${ent.center.x.toFixed(2)},${ent.center.y.toFixed(2)},${(ent.radius || 0).toFixed(2)},${(ent.startAngle || 0).toFixed(2)},${(ent.endAngle || 0).toFixed(2)}`;
            }
        } catch (e) {
            console.warn('DXFImporter: Failed to hash entity', ent.type, e);
        }
        return '';
    };

    const process = (entities: any[], parentOffset = { x: 0, y: 0 }, parentScale = { x: 1, y: 1 }, parentRotation = 0) => {
      entities.forEach(ent => {
        try {
            if (ent.type === 'INSERT') {
                const block = blocks[ent.name];
                if (block && block.entities) {
                    const combinedRotation = parentRotation + (ent.rotation || 0) * (Math.PI / 180);
                    process(block.entities, 
                            { x: parentOffset.x + ent.position.x * parentScale.x, y: parentOffset.y + ent.position.y * parentScale.y },
                            { x: parentScale.x * (ent.xScale || 1), y: parentScale.y * (ent.yScale || 1) },
                            combinedRotation);
                }
            } else {
                if (ent.inPaperSpace) return;

                const resolved = JSON.parse(JSON.stringify(ent));
                const cos = Math.cos(parentRotation);
                const sin = Math.sin(parentRotation);

                const transformPoint = (p: { x: number, y: number }) => {
                    let x = p.x * parentScale.x;
                    let y = p.y * parentScale.y;
                    if (parentRotation !== 0) {
                        const rx = x * cos - y * sin;
                        const ry = x * sin + y * cos;
                        x = rx;
                        y = ry;
                    }
                    p.x = x + parentOffset.x;
                    p.y = y + parentOffset.y;
                };

                if (resolved.vertices) {
                    resolved.vertices.forEach(transformPoint);
                }
                if (resolved.center) {
                    transformPoint(resolved.center);
                }
                if (resolved.radius !== undefined) {
                    resolved.radius *= Math.abs(parentScale.x);
                }
                
                const hash = getHash(resolved);
                if (hash && processedHashes.has(hash)) return;
                if (hash) processedHashes.add(hash);

                flattened.push(resolved);
            }
        } catch (e) {
            console.error('DXFImporter: Error processing entity', ent.type, e);
        }
      });
    };

    process(rootEntities);
    console.log(`DXFImporter: Resolved ${flattened.length} entities and ${processedHashes.size} unique hashes.`);
    return flattened;
  }

  public getLayers(entities: DXFEntity[]): string[] {
    const layers = new Set<string>();
    entities.forEach(ent => {
      if (ent.layer) layers.add(ent.layer);
    });
    const result = Array.from(layers).sort();
    console.log(`DXFImporter: Found ${result.length} geometry-containing layers:`, result);
    return result;
  }

  public getBounds(entities: DXFEntity[]) {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    const update = (x: number, y: number) => {
      if (isNaN(x) || isNaN(y)) return;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    };

    entities.forEach(entity => {
      if (entity.type === 'LINE' && entity.vertices) {
        update(entity.vertices[0].x, entity.vertices[0].y);
        update(entity.vertices[1].x, entity.vertices[1].y);
      } else if ((entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') && entity.vertices) {
        entity.vertices.forEach((v: any) => update(v.x, v.y));
      } else if (entity.type === 'CIRCLE' && entity.center) {
        update(entity.center.x - entity.radius, entity.center.y - entity.radius);
        update(entity.center.x + entity.radius, entity.center.y + entity.radius);
      } else if (entity.type === 'ARC' && entity.center) {
        update(entity.center.x - entity.radius, entity.center.y - entity.radius);
        update(entity.center.x + entity.radius, entity.center.y + entity.radius);
      }
    });

    if (minX === Infinity) return null;
    return { 
        minX, minY, maxX, maxY, 
        width: maxX - minX, 
        height: maxY - minY,
        centerX: (minX + maxX) / 2,
        centerY: (minY + maxY) / 2
    };
  }

  public rasterize(entities: DXFEntity[], gridWidth: number, gridHeight: number, scale: number): Uint8Array | null {
    const bounds = this.getBounds(entities);
    if (!bounds) return null;

    const canvas = document.createElement('canvas');
    canvas.width = gridWidth;
    canvas.height = gridHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.clearRect(0, 0, gridWidth, gridHeight);
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1;

    const targetCenterX = gridWidth / 2;
    const targetCenterY = gridHeight / 2;
    
    const transformX = (x: number) => targetCenterX + (x - bounds.centerX) * scale;
    const transformY = (y: number) => targetCenterY - (y - bounds.centerY) * scale;

    const drawBulge = (p1: any, p2: any, bulge: number) => {
        const L = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
        if (L < 1e-6) return;

        const R = (L / 2) * (1 + bulge * bulge) / (2 * Math.abs(bulge));
        const h = (L / 2) * (1 - bulge * bulge) / (2 * bulge);

        const mx = (p1.x + p2.x) / 2;
        const my = (p1.y + p2.y) / 2;

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const ux = -dy / L;
        const uy = dx / L;

        const cx = mx + ux * h;
        const cy = my + uy * h;

        const startAngle = Math.atan2(p1.y - cy, p1.x - cx);
        const endAngle = Math.atan2(p2.y - cy, p2.x - cx);
        
        // Canvas coordinate flip: Standard atan2 is for Cartiesian (y up).
        // Since Y is flipped in transformY, we negate the angles.
        ctx.arc(transformX(cx), transformY(cy), R * scale, -startAngle, -endAngle, bulge > 0);
    };

    entities.forEach(entity => {
      ctx.beginPath();
      if (entity.type === 'LINE' && entity.vertices) {
        ctx.moveTo(transformX(entity.vertices[0].x), transformY(entity.vertices[0].y));
        ctx.lineTo(transformX(entity.vertices[1].x), transformY(entity.vertices[1].y));
        ctx.stroke();
      } else if ((entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') && entity.vertices) {
        const verts = entity.vertices;
        if (verts.length < 2) return;
        
        ctx.moveTo(transformX(verts[0].x), transformY(verts[0].y));
        for (let i = 0; i < verts.length - 1; i++) {
            const v1 = verts[i];
            const v2 = verts[i+1];
            if (v1.bulge && Math.abs(v1.bulge) > 1e-6) {
                drawBulge(v1, v2, v1.bulge);
            } else {
                ctx.lineTo(transformX(v2.x), transformY(v2.y));
            }
        }
        
        // Handle closed shape
        if (entity.shape) {
            const vLast = verts[verts.length - 1];
            const vFirst = verts[0];
            if (vLast.bulge && Math.abs(vLast.bulge) > 1e-6) {
                drawBulge(vLast, vFirst, vLast.bulge);
            } else {
                ctx.lineTo(transformX(vFirst.x), transformY(vFirst.y));
            }
            ctx.closePath();
            ctx.stroke();
            ctx.fill();
        } else {
            ctx.stroke();
        }
      } else if (entity.type === 'CIRCLE' && entity.center) {
        ctx.arc(transformX(entity.center.x), transformY(entity.center.y), (entity.radius || 0) * scale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fill();
      } else if (entity.type === 'ARC' && entity.center) {
        const startRad = ((entity.startAngle || 0) * Math.PI) / 180;
        const endRad = ((entity.endAngle || 0) * Math.PI) / 180;
        ctx.arc(transformX(entity.center.x), transformY(entity.center.y), (entity.radius || 0) * scale, -startRad, -endRad, true);
        ctx.stroke();
      }
    });

    const imgData = ctx.getImageData(0, 0, gridWidth, gridHeight);
    const pixels = new Uint8Array(gridWidth * gridHeight);
    for (let i = 0; i < imgData.data.length; i += 4) {
      if (imgData.data[i] > 128) {
        pixels[i / 4] = 1;
      }
    }

    return pixels;
  }
}
