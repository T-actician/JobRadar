import { useEffect, useRef } from 'react';
import { geoGraticule10, geoOrthographic, geoPath } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import world from 'world-atlas/countries-110m.json';
import { COUNTY_COORDS } from '../data/countyCoords';

const topo = world as unknown as Topology;
const countries = feature(topo, topo.objects.countries as GeometryCollection);
const borders = mesh(topo, topo.objects.countries as GeometryCollection, (a, b) => a !== b);
const graticule = geoGraticule10();

const SIZE = 340;
const HOME: [number, number] = [-37, -4]; // rotation that centres Kenya
const rgb = (name: string, a = 1) => `rgb(${getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim().replace(/ /g, ',')},${a})`;

export function Globe({ counties }: { counties: string[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const counts = useRef<Map<string, number>>(new Map());
  counts.current = counties.reduce((m, c) => m.set(c, (m.get(c) ?? 0) + 1), new Map<string, number>());

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.height = SIZE * dpr;
    ctx.scale(dpr, dpr);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const R = SIZE / 2 - 26;
    const proj = geoOrthographic().scale(R).translate([SIZE / 2, SIZE / 2]).clipAngle(90);
    const path = geoPath(proj, ctx);
    let lon = HOME[0], lat = HOME[1], drag: [number, number] | null = null, hover = true, raf = 0, t0 = performance.now();

    const draw = (now: number) => {
      const t = (now - t0) / 1000;
      if (!drag && !reduced) lon += 0.08 + (hover ? 0 : 0);
      proj.rotate([lon, lat]);
      ctx.clearRect(0, 0, SIZE, SIZE);
      const c = SIZE / 2;
      // outer dashed ring + solid rings
      ctx.lineWidth = 1; ctx.strokeStyle = rgb('cyan', 0.35); ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.arc(c, c, R + 20, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      ctx.lineWidth = 3; ctx.strokeStyle = rgb('cyan', 0.95);
      ctx.beginPath(); ctx.arc(c, c, R + 9, 0, 7); ctx.stroke();
      ctx.lineWidth = 1; ctx.strokeStyle = rgb('cyan', 0.6);
      ctx.beginPath(); ctx.arc(c, c, R + 3, 0, 7); ctx.stroke();
      // sphere body
      const g = ctx.createRadialGradient(c - R * 0.3, c - R * 0.3, R * 0.1, c, c, R);
      g.addColorStop(0, rgb('cyan', 0.16)); g.addColorStop(1, rgb('bg', 0.9));
      ctx.beginPath(); path({ type: 'Sphere' }); ctx.fillStyle = g; ctx.fill();
      // graticule
      ctx.beginPath(); path(graticule); ctx.strokeStyle = rgb('cyan', 0.16); ctx.lineWidth = 0.6; ctx.stroke();
      // land
      ctx.beginPath(); path(countries); ctx.fillStyle = rgb('cyan', 0.28); ctx.fill();
      ctx.beginPath(); path(borders); ctx.strokeStyle = rgb('cyan', 0.85); ctx.lineWidth = 0.7; ctx.stroke();
      ctx.beginPath(); path(countries); ctx.strokeStyle = rgb('cyan', 0.9); ctx.lineWidth = 0.9; ctx.stroke();
      // crosshair
      ctx.strokeStyle = rgb('cyan', 0.55); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(c, c - R - 9); ctx.lineTo(c, c + R + 9); ctx.moveTo(c - R - 9, c); ctx.lineTo(c + R + 9, c); ctx.stroke();
      // sweep
      if (!reduced) {
        const a = (t / 4) * Math.PI * 2;
        const sw = ctx.createConicGradient(a, c, c);
        sw.addColorStop(0, rgb('cyan', 0)); sw.addColorStop(0.8, rgb('cyan', 0)); sw.addColorStop(1, rgb('cyan', 0.28));
        ctx.save(); ctx.beginPath(); ctx.arc(c, c, R, 0, 7); ctx.clip(); ctx.fillStyle = sw; ctx.fillRect(0, 0, SIZE, SIZE); ctx.restore();
      }
      // job blips (only the visible hemisphere)
      for (const [county, n] of counts.current) {
        const ll = COUNTY_COORDS[county]; if (!ll) continue;
        const p = proj(ll); if (!p) continue;
        const pulse = reduced ? 0.5 : (Math.sin(t * 3 + ll[0]) + 1) / 2;
        ctx.beginPath(); ctx.arc(p[0], p[1], 6 + pulse * 6 + Math.min(n, 5), 0, 7);
        ctx.strokeStyle = rgb('orange', 0.6 - pulse * 0.45); ctx.lineWidth = 1.2; ctx.stroke();
        ctx.beginPath(); ctx.arc(p[0], p[1], 3 + Math.min(n, 4) * 0.4, 0, 7); ctx.fillStyle = rgb('orange'); ctx.fill();
      }
      // scanlines
      ctx.fillStyle = rgb('bg', 0.18);
      for (let y = 0; y < SIZE; y += 3) ctx.fillRect(0, y, SIZE, 1);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    const down = (e: PointerEvent) => { drag = [e.clientX, e.clientY]; canvas.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      lon += (e.clientX - drag[0]) * 0.4; lat = Math.max(-80, Math.min(80, lat - (e.clientY - drag[1]) * 0.4));
      drag = [e.clientX, e.clientY];
    };
    const up = () => { drag = null; };
    const dbl = () => { lon = HOME[0]; lat = HOME[1]; };
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up); canvas.addEventListener('dblclick', dbl);
    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up); canvas.removeEventListener('dblclick', dbl);
    };
  }, []);

  return <canvas ref={ref} style={{ width: SIZE, height: SIZE }} className="mx-auto block max-w-full cursor-grab touch-none active:cursor-grabbing" aria-label="Globe showing where jobs were collected. Drag to rotate, double-click to reset." role="img" />;
}
