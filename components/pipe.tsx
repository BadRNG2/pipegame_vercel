'use client';

import { PIPE_ANIMATION_DURATION, TURN_CURVATURE } from '@/lib/constants';
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Vector2D, Direction } from '@/lib/definitions';
import { bezierPoint, directionPoints, lerpPoint, randomColor, randomDirection } from '@/lib/utils';

function generatePipePoints(segments: number, directions: Direction[]): Vector2D[] {
  if (segments < 2) return [];

  const center = directionPoints['none'];
  const uniqueDirs = Array.from(new Set(directions));
  const anchors = uniqueDirs.map(d => directionPoints[d] ?? center);

  const sampleBezier = (p0: Vector2D, p2: Vector2D, n: number) => {
    const ctrl = directionPoints['none'];
    const pts: Vector2D[] = [];
    for (let k = 0; k < n; k++) {
      const t = n === 1 ? 0 : k / (n - 1);
      pts.push(bezierPoint(t, p0, ctrl, p2));
    }
    return pts;
  };

  const joinSpans = (spans: Array<[Vector2D, Vector2D]>) => {
    const total = spans.length;
    const per = Math.max(1, Math.floor(segments / total));
    const result: Vector2D[] = [];
    spans.forEach((span, idx) => {
      const count = idx === spans.length - 1 ? segments - result.length : per;
      const pts = sampleBezier(span[0], span[1], count);
      if (result.length > 0 && pts.length > 0) pts.shift(); // avoid duplicate join
      result.push(...pts);
    });
    return result;
  };

  if (anchors.length === 1) {
    // single arm -> straight to center
    return sampleBezier(anchors[0], center, segments);
  }

  if (anchors.length === 2) {
    // simple bezier from anchors[0] -> anchors[1]
    // bias control point slightly toward the midpoint/center so turns look reasonable
    const alpha = TURN_CURVATURE;
    const p0 = anchors[0];
    const p2 = anchors[1];
    const mid = lerpPoint(p0, p2, 0.5);
    const ctrl = lerpPoint(mid, center, alpha);
    const pts: Vector2D[] = [];
    for (let k = 0; k < segments; k++) {
      const t = segments === 1 ? 0 : k / (segments - 1);
      pts.push(bezierPoint(t, p0, ctrl, p2));
    }
    return pts;
  }

  if (anchors.length === 3) {
    // T: trace arm0 -> center -> arm1 -> center -> arm2
    const [a0, a1, a2] = anchors;
    const spans: Array<[Vector2D, Vector2D]> = [
      [a0, center],
      [center, a1],
      [a1, center],
      [center, a2],
    ];
    return joinSpans(spans);
  }

  // 4 or more -> treat as full cross (+). Use canonical order up,right,down,left
  const order: Direction[] = ['up', 'right', 'down', 'left'];
  const orderedAnchors: Vector2D[] = order.map(d => {
    const idx = uniqueDirs.indexOf(d);
    return idx >= 0 ? anchors[idx] : directionPoints[d];
  });

  const spans: Array<[Vector2D, Vector2D]> = [
    [orderedAnchors[0], center],
    [center, orderedAnchors[1]],
    [orderedAnchors[1], center],
    [center, orderedAnchors[2]],
    [orderedAnchors[2], center],
    [center, orderedAnchors[3]],
  ];

  return joinSpans(spans);
}

export default function Pipe({
  i,
  j,
  sizeX,
  sizeY,
  onClickHandler,
  name,
  entries = [],
  flow = false,
  incoming = null,
  savePipeDirections,
  turnCurvature,
}: {
  i: number;
  j: number;
  sizeX: number;
  sizeY: number;
  onClickHandler: () => void;
  name: string;
  entries?: Direction[];
  flow?: boolean;
  incoming?: Direction | null;
  savePipeDirections?: (dirs: Direction[]) => void;
  turnCurvature?: number;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<SVGPolylineElement | null>(null);
  const spanRefs = useRef<Array<SVGPolylineElement | null>>([]);

  const [left, setLeft] = useState(i);
  const [top, setTop] = useState(j);
  const [iState, setI] = useState(i);
  const [jState, setJ] = useState(j);
  const [color, setColor] = useState('rgb(200,200,200)');
  const [pipePoints, setPipePoints] = useState<Vector2D[]>([]);
  const [pathLen, setPathLen] = useState<number | null>(null);
  const [spans, setSpans] = useState<
    Array<{ points: Vector2D[]; start: Direction; end: Direction }>
  >([]);
  const [spanLens, setSpanLens] = useState<number[]>([]);
  const [isFlowing, setIsFlowing] = useState(false);
  const [centerFilled, setCenterFilled] = useState(false);
  const [markerFilled, setMarkerFilled] = useState<Record<string, boolean>>({});

  // initialization
  useEffect(() => {
    console.log('mount', name);
    let directions: Direction[] = [];
    if (entries.length > 0) {
      if (entries.length === 1) {
        directions.push(entries[0]);
        directions.push(randomDirection(entries[0]));
      } else {
        directions = entries.slice(0, 4);
      }
    } else {
      directions.push(randomDirection());
      directions.push(randomDirection(directions[0]));
      if (Math.random() < 0.3) {
        directions.push(randomDirection(directions));
        if (Math.random() < 0.3) {
          directions.push(randomDirection(directions));
        }
      }
    }
    // compute spans and flattened points
    const makeSpans = (segments: number, directions: Direction[]) => {
      const center = directionPoints['none'];
      const uniqueDirs = Array.from(new Set(directions));
      const anchors = uniqueDirs.map(d => directionPoints[d] ?? center);

      const sampleBezier = (p0: Vector2D, p2: Vector2D, n: number) => {
        const ctrl = directionPoints['none'];
        const pts: Vector2D[] = [];
        for (let k = 0; k < n; k++) {
          const t = n === 1 ? 0 : k / (n - 1);
          pts.push(bezierPoint(t, p0, ctrl, p2));
        }
        return pts;
      };

      const joinSpans = (spans: Array<[Vector2D, Vector2D]>) => {
        const total = spans.length;
        const per = Math.max(1, Math.floor(segments / total));
        const result: Array<Vector2D[]> = [];
        spans.forEach((span, idx) => {
          const count = idx === spans.length - 1 ? segments - result.flat().length : per;
          const pts = sampleBezier(span[0], span[1], count);
          result.push(pts);
        });
        return result;
      };

      if (anchors.length === 1) {
        return [
          {
            points: sampleBezier(anchors[0], center, segments),
            start: uniqueDirs[0],
            end: 'none' as Direction,
          },
        ];
      }

      if (anchors.length === 2) {
        const alpha = turnCurvature ?? TURN_CURVATURE;
        const p0 = anchors[0];
        const p2 = anchors[1];
        const mid = lerpPoint(p0, p2, 0.5);
        const ctrl = lerpPoint(mid, center, alpha);
        const pts: Vector2D[] = [];
        for (let k = 0; k < segments; k++) {
          const t = segments === 1 ? 0 : k / (segments - 1);
          pts.push(bezierPoint(t, p0, ctrl, p2));
        }
        return [{ points: pts, start: uniqueDirs[0], end: uniqueDirs[1] }];
      }

      if (anchors.length === 3) {
        const [a0, a1, a2] = anchors;
        const spansDef: Array<[Vector2D, Vector2D]> = [
          [a0, center],
          [center, a1],
          [a1, center],
          [center, a2],
        ];
        const pts = joinSpans(spansDef);
        return [
          { points: pts[0], start: uniqueDirs[0], end: 'none' as Direction },
          { points: pts[1], start: 'none' as Direction, end: uniqueDirs[1] },
          { points: pts[2], start: uniqueDirs[1], end: 'none' as Direction },
          { points: pts[3], start: 'none' as Direction, end: uniqueDirs[2] },
        ];
      }

      const order: Direction[] = ['up', 'right', 'down', 'left'];
      const orderedAnchors: Vector2D[] = order.map(d => {
        const idx = uniqueDirs.indexOf(d);
        return idx >= 0 ? anchors[idx] : directionPoints[d];
      });

      const spansDef: Array<[Vector2D, Vector2D]> = [
        [orderedAnchors[0], center],
        [center, orderedAnchors[1]],
        [orderedAnchors[1], center],
        [center, orderedAnchors[2]],
        [orderedAnchors[2], center],
        [center, orderedAnchors[3]],
      ];
      const pts = joinSpans(spansDef);
      return [
        { points: pts[0], start: order[0], end: 'none' as Direction },
        { points: pts[1], start: 'none' as Direction, end: order[1] },
        { points: pts[2], start: order[1], end: 'none' as Direction },
        { points: pts[3], start: 'none' as Direction, end: order[2] },
        { points: pts[4], start: order[2], end: 'none' as Direction },
        { points: pts[5], start: 'none' as Direction, end: order[3] },
      ];
    };

    const computedSpans = makeSpans(30, directions);
    setSpans(computedSpans);
    setPipePoints(computedSpans.flatMap(s => s.points));
    if (savePipeDirections) {
      savePipeDirections(directions);
    }
    setColor(randomColor());
    return () => console.log('unmount', name);
    // end useEffect init
  }, []);

  useEffect(() => {
    setLeft(iState);
  }, [iState]);

  useEffect(() => {
    setTop(jState);
  }, [jState]);

  useEffect(() => {
    setI(i);
  }, [i]);

  useEffect(() => {
    setJ(j);
  }, [j]);

  useEffect(() => {
    setIsFlowing(flow);
  }, [flow]);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.backgroundColor = color;
    }
  }, [color]);

  // prepare dash length when points change
  useEffect(() => {
    // compute lengths for base overlay and per-span overlays after the DOM has painted
    const computeEuclideanLength = (pts: Vector2D[]) => {
      let sum = 0;
      for (let k = 1; k < pts.length; k++) {
        const a = pts[k - 1];
        const b = pts[k];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        sum += Math.sqrt(dx * dx + dy * dy);
      }
      // convert unit space (0..1) length to SVG coordinate length (0..100)
      return sum * 100;
    };

    const measure = () => {
      const el = overlayRef.current;
      if (el) {
        try {
          const len = el.getTotalLength();
          setPathLen(len);
          el.style.strokeDasharray = `${len}`;
          el.style.strokeDashoffset = `${len}`;
        } catch {
          // ignore
        }
      }
      const lens: number[] = [];
      spans.forEach((s, idx) => {
        const sEl = spanRefs.current[idx];
        let l = 0;
        // prefer DOM-measured length when available, fallback to euclidean calc
        if (sEl) {
          try {
            l = sEl.getTotalLength();
          } catch {
            l = computeEuclideanLength(s.points);
          }
        } else {
          l = computeEuclideanLength(s.points);
        }
        lens[idx] = l;
        if (sEl) {
          sEl.style.strokeDasharray = `${l}`;
          sEl.style.strokeDashoffset = `${l}`;
        }
      });
      setSpanLens(lens);
    };

    const raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [pipePoints, spans]);

  useEffect(() => {
    // control per-span animations based on `incoming` prop or boolean `flow` fallback
    if (spans.length === 0) return;

    const D_total = PIPE_ANIMATION_DURATION; // total duration for the whole piece flood

    const hideAll = () => {
      spanRefs.current.forEach((sEl, idx) => {
        if (!sEl) return;
        sEl.style.transition = 'none';
        const len = spanLens[idx] ?? 0;
        sEl.style.strokeDashoffset = `${len}`;
      });
      setCenterFilled(false);
      setMarkerFilled({});
    };

    if (!flow && incoming == null) {
      // hide everything
      hideAll();
      return;
    }

    // helper: compute euclidean SVG length (points are 0..1, scale to 0..100)
    const computeSvgLengthFromPoints = (pts: Vector2D[]) => {
      let sum = 0;
      for (let k = 1; k < pts.length; k++) {
        const a = pts[k - 1];
        const b = pts[k];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        sum += Math.sqrt(dx * dx + dy * dy);
      }
      return sum * 100;
    };

    // helper to set span points orientation directly on the polyline element
    const setSpanOrientation = (idx: number, fromDir: Direction) => {
      const s = spans[idx];
      const el = spanRefs.current[idx];
      if (!el) return;
      const useReversed = s.start === fromDir ? false : s.end === fromDir ? true : false;
      const usedPoints = useReversed ? [...s.points].reverse() : s.points;
      const pts = usedPoints.map(p => `${p.x * 100},${p.y * 100}`).join(' ');
      el.setAttribute('points', pts);
      // recompute and set dasharray/offset so subsequent reveal uses correct length
      const len = computeSvgLengthFromPoints(usedPoints);
      try {
        el.style.strokeDasharray = `${len}`;
        el.style.strokeDashoffset = `${len}`;
      } catch {}
    };

    // reveal a span by index
    const revealSpan = (idx: number, duration = D_total) => {
      const el = spanRefs.current[idx];
      if (!el) return;
      let len = 0;
      // prefer precise DOM measurement when available
      try {
        len = el.getTotalLength();
      } catch {
        // fall through
      }
      if (!len || len === 0) {
        // try to read the element's points attribute and compute length from that
        try {
          const ptsAttr = el.getAttribute('points') || '';
          const pairs = ptsAttr
            .trim()
            .split(/\s+/)
            .map(p => p.split(',').map(Number));
          if (pairs.length > 1) {
            let sum = 0;
            for (let k = 1; k < pairs.length; k++) {
              const [ax, ay] = pairs[k - 1];
              const [bx, by] = pairs[k];
              const dx = ax - bx;
              const dy = ay - by;
              sum += Math.sqrt(dx * dx + dy * dy);
            }
            len = sum;
          }
        } catch {
          // last resort: compute from original span points
          const s = spans[idx];
          len = computeSvgLengthFromPoints(s.points);
        }
        try {
          el.style.strokeDasharray = `${len}`;
          el.style.strokeDashoffset = `${len}`;
        } catch {}
      }

      el.style.transition = 'none';
      el.style.strokeDashoffset = `${len}`;
      // force reflow
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      el.getBoundingClientRect();
      el.style.transition = `stroke-dashoffset ${duration}ms linear`;
      el.style.strokeDashoffset = '0';

      // determine destination marker key from the element's final point
      try {
        const ptsAttr = el.getAttribute('points') || '';
        const pairs = ptsAttr
          .trim()
          .split(/\s+/)
          .map(p => p.split(',').map(Number));
        if (pairs.length > 0) {
          const last = pairs[pairs.length - 1];
          const lx = Math.round(last[0]);
          const ly = Math.round(last[1]);
          const dirFor = (x: number, y: number): Direction => {
            if (x === 0) return 'left';
            if (x === 100) return 'right';
            if (y === 0) return 'up';
            if (y === 100) return 'down';
            return 'none';
          };
          const key = `${lx},${ly},${dirFor(lx, ly)}`;
          // schedule marker to light when the reveal reaches the destination
          timers.push(
            window.setTimeout(() => {
              setMarkerFilled(prev => ({ ...prev, [key]: true }));
            }, duration + 8)
          );
        }
      } catch {}
    };

    const timers: number[] = [];

    if (incoming != null) {
      // prefer a span that starts at the incoming dir (arm -> center). If not found,
      // fall back to a span that ends at incoming (center -> arm) and reverse it.
      let inboundIdx = spans.findIndex(s => s.start === incoming);
      if (inboundIdx === -1) inboundIdx = spans.findIndex(s => s.end === incoming);
      if (inboundIdx === -1) return;

      // Determine outbound spans (those connected to center, excluding the inbound side)
      const outboundIdxs = spans
        .map((s, idx) => ({ s, idx }))
        .filter(
          ({ s }) =>
            // center -> arm where arm !== incoming
            (s.start === 'none' && s.end !== incoming) ||
            // arm -> center where arm !== incoming (we'll reverse these)
            (s.end === 'none' && s.start !== incoming)
        )
        .map(({ idx }) => idx);

      // For 2-direction pieces there are no outbound center spans; use full duration
      // for the single inbound path. For 3+ directions split the total duration in half.
      let inboundDuration: number;
      let outboundDuration: number;
      if (outboundIdxs.length === 0) {
        inboundDuration = D_total;
        outboundDuration = 0;
      } else {
        inboundDuration = Math.round(D_total / 2);
        outboundDuration = D_total - inboundDuration;
      }

      // orient and reveal inbound
      // light the incoming cap immediately (water is coming from there)
      try {
        const s = spans[inboundIdx];
        let armPoint = s.points[0];
        if (s.start === incoming) armPoint = s.points[0];
        else if (s.end === incoming) armPoint = s.points[s.points.length - 1];
        else if (s.points && s.points.length > 0) armPoint = s.points[0];
        const ax = Math.round(armPoint.x * 100);
        const ay = Math.round(armPoint.y * 100);
        const armKey = `${ax},${ay},${incoming}`;
        timers.push(
          window.setTimeout(() => setMarkerFilled(prev => ({ ...prev, [armKey]: true })), 0)
        );
      } catch {}

      requestAnimationFrame(() => {
        setSpanOrientation(inboundIdx, incoming);
        requestAnimationFrame(() => revealSpan(inboundIdx, inboundDuration));
      });

      // mark center as filled when inbound finishes
      timers.push(window.setTimeout(() => setCenterFilled(true), inboundDuration + 4));

      // schedule outbound to start immediately after inboundDuration
      if (outboundIdxs.length > 0) {
        timers.push(
          window.setTimeout(() => {
            outboundIdxs.forEach(idx => {
              setSpanOrientation(idx, 'none');
              requestAnimationFrame(() => revealSpan(idx, outboundDuration));
            });
          }, inboundDuration + 8)
        );
      }
    } else if (flow) {
      // reveal all spans concurrently so total duration equals D_total
      spans.forEach((s, idx) => {
        setSpanOrientation(idx, s.start);
        requestAnimationFrame(() => revealSpan(idx, D_total));
      });
      // for full-flow fallback, mark center halfway through
      timers.push(window.setTimeout(() => setCenterFilled(true), Math.round(D_total / 2)));
    }
    return () => timers.forEach(t => clearTimeout(t));
  }, [incoming, flow, spans, spanLens]);

  const handleClick = () => {
    onClickHandler();
  };

  function startFlood(duration = 600) {
    const el = overlayRef.current;
    if (!el || pathLen == null) return;
    // reset
    el.style.transition = 'none';
    el.style.strokeDashoffset = `${pathLen}`;
    // force reflow so the transition will run
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    el.getBoundingClientRect();
    // animate reveal
    el.style.transition = `stroke-dashoffset ${duration}ms linear`;
    el.style.strokeDashoffset = '0';
  }

  // position relative to the center of the container
  return (
    <button
      ref={ref}
      type="button"
      onClick={handleClick}
      style={{
        transition: 'left 300ms ease-in-out, top 300ms ease-in-out',
        top: `${(top / sizeY) * 100}%`,
        left: `${(left / sizeX) * 100}%`,
        width: `${100 / sizeX}%`,
        height: `${100 / sizeY}%`,
      }}
      className={`aspect-square opacity-100 absolute rounded-md shadow-md border-1 border-black border-opacity-50 hover:opacity-80`}
      aria-label="Game piece"
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
        }}
      >
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
          }}
        >
          {/* base pipe border (black) */}
          <polyline
            points={pipePoints.map(p => `${p.x * 100},${p.y * 100}`).join(' ')}
            fill="none"
            stroke="black"
            strokeWidth="12"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ opacity: 0.5 }}
          />
          {/* base pipe (white) */}
          <polyline
            points={pipePoints.map(p => `${p.x * 100},${p.y * 100}`).join(' ')}
            fill="none"
            stroke="white"
            strokeWidth="10"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ opacity: 0.9 }}
          />
          {/* overlay water — per-span polylines so we can animate segments independently */}
          {spans.map((s, idx) => {
            const pts = s.points.map(p => `${p.x * 100},${p.y * 100}`).join(' ');
            return (
              <polyline
                key={`span-${idx}`}
                ref={el => {
                  spanRefs.current[idx] = el;
                }}
                points={pts}
                fill="none"
                stroke={pathLen == null ? 'transparent' : 'deepskyblue'}
                strokeWidth="10"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ mixBlendMode: 'normal' }}
              />
            );
          })}
          {/* junction markers: draw directional caps for arm endpoints and a prominent center node */}
          {(() => {
            const seen = new Set<string>();
            const markers: React.ReactElement[] = [];

            const pushMarker = (x: number, y: number, dir: Direction, keySuffix: string) => {
              const k = `${x},${y},${dir}`;
              if (seen.has(k)) return;
              seen.add(k);
              const isCenter = dir === 'none';
              if (isCenter) {
                const k = `${x},${y},none`;
                const lit = markerFilled[k] ?? centerFilled;
                const fill = lit ? '#29b6f6' : '#ffffff';
                markers.push(
                  <g key={`junction-center-${keySuffix}`}>
                    <rect
                      x={x - 8}
                      y={y - 8}
                      width={16}
                      height={16}
                      rx={3}
                      ry={3}
                      fill={fill}
                      stroke={lit ? '#0d47a1' : '#666'}
                      strokeWidth={1.4}
                    />
                    <rect
                      x={x - 5}
                      y={y - 5}
                      width={10}
                      height={10}
                      rx={2}
                      ry={2}
                      fill={lit ? '#b3e5fc' : '#ffffff'}
                      stroke="transparent"
                    />
                  </g>
                );
                return;
              }
              // directional cap sizes (in SVG units 0..100)
              const capLen = 8;
              const capThick = 14;
              const rx = 2;
              const mk = `${x},${y},${dir}`;
              const lit = markerFilled[mk] ?? false;
              const capFill = lit ? '#29b6f6' : '#ffffff';
              const capStroke = lit ? '#0d47a1' : '#666';
              if (dir === 'left') {
                markers.push(
                  <rect
                    key={`junction-${keySuffix}-left`}
                    x={x - capLen / 2}
                    y={y - capThick / 2}
                    width={capLen}
                    height={capThick}
                    rx={rx}
                    fill={capFill}
                    stroke={capStroke}
                    strokeWidth={1}
                  />
                );
              } else if (dir === 'right') {
                markers.push(
                  <rect
                    key={`junction-${keySuffix}-right`}
                    x={x - capLen / 2}
                    y={y - capThick / 2}
                    width={capLen}
                    height={capThick}
                    rx={rx}
                    fill={capFill}
                    stroke={capStroke}
                    strokeWidth={1}
                  />
                );
              } else if (dir === 'up') {
                markers.push(
                  <rect
                    key={`junction-${keySuffix}-up`}
                    x={x - capThick / 2}
                    y={y - capLen / 2}
                    width={capThick}
                    height={capLen}
                    rx={rx}
                    fill={capFill}
                    stroke={capStroke}
                    strokeWidth={1}
                  />
                );
              } else if (dir === 'down') {
                markers.push(
                  <rect
                    key={`junction-${keySuffix}-down`}
                    x={x - capThick / 2}
                    y={y - capLen / 2}
                    width={capThick}
                    height={capLen}
                    rx={rx}
                    fill={capFill}
                    stroke={capStroke}
                    strokeWidth={1}
                  />
                );
              }
            };

            spans.forEach((s, spanIdx) => {
              if (!s.points || s.points.length === 0) return;
              const a = s.points[0];
              const b = s.points[s.points.length - 1];
              const ax = Math.round(a.x * 100);
              const ay = Math.round(a.y * 100);
              const bx = Math.round(b.x * 100);
              const by = Math.round(b.y * 100);
              pushMarker(ax, ay, s.start, `s${spanIdx}a`);
              pushMarker(bx, by, s.end, `s${spanIdx}b`);
            });
            // also ensure true extremities (first/last of flattened pipePoints) have markers
            if (pipePoints && pipePoints.length > 0) {
              const p0 = pipePoints[0];
              const p1 = pipePoints[pipePoints.length - 1];
              const dirFor = (p: Vector2D): Direction => {
                if (p.x === 0) return 'left';
                if (p.x === 1) return 'right';
                if (p.y === 0) return 'up';
                if (p.y === 1) return 'down';
                return 'none';
              };
              pushMarker(Math.round(p0.x * 100), Math.round(p0.y * 100), dirFor(p0), 'ext-a');
              pushMarker(Math.round(p1.x * 100), Math.round(p1.y * 100), dirFor(p1), 'ext-b');
            }

            return markers;
          })()}
          {/* fallback single overlay for compatibility */}
          <polyline
            ref={el => {
              overlayRef.current = el;
            }}
            points={pipePoints.map(p => `${p.x * 100},${p.y * 100}`).join(' ')}
            fill="none"
            stroke={'transparent'}
            strokeWidth="10"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ mixBlendMode: 'normal' }}
          />
        </svg>
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            textAlign: 'center',
            fontSize: '0.75rem',
          }}
        >
          {/*{name}
          <br /> {i},{j}*/}
        </div>
      </div>
    </button>
  );
}
