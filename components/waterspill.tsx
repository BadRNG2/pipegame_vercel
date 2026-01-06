import React from 'react';
import { Direction, Vector2D } from '@/lib/definitions';

export type WaterSpillProps = {
  i: number;
  j: number;
  sizeX?: number;
  sizeY?: number;
  incomingDir?: Direction | null;
  side?: Direction | null;
};

export default function WaterSpill({
  i,
  j,
  sizeX = 4,
  sizeY = 5,
  incomingDir = null,
  side,
}: WaterSpillProps) {
  const cellW = 100 / sizeX;
  const cellH = 100 / sizeY;
  const pieceLeft = i * cellW;
  const pieceTop = j * cellH;
  const goalRatio = 0.5;
  const elemW = cellW * goalRatio;
  const elemH = cellH * goalRatio;
  let left = pieceLeft + (cellW - elemW) / 2;
  let top = pieceTop + (cellH - elemH) / 2;
  if (side === 'left') left = pieceLeft - elemW * 0.5;
  else if (side === 'right') left = pieceLeft + cellW - elemW * 0.5;
  else if (side === 'up') top = pieceTop - elemH * 0.5;
  else if (side === 'down') top = pieceTop + cellH - elemH * 0.5;

  let center : Vector2D = { x: 50, y: 50 };
  if (incomingDir === 'left') center = { x: 50, y: 50 };
  else if (incomingDir === 'right') center = { x: 50, y: 50 };
  else if (incomingDir === 'up') center = { x: 50, y: 50 };
  else if (incomingDir === 'down') center = { x: 50, y: 50 };

  const baseStroke = '#efefef';
  const activeStroke = '#29b6f6';

  return (
    <div
      style={{
        position: 'absolute',
        top: `${top}%`,
        left: `${left}%`,
        width: `${elemW}%`,
        height: `${elemH}%`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 30,
      }}
        className='fade-in duration-1000'
    >
        <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none">
          <defs>
            <radialGradient id={`spillGrad-${i}-${j}`} cx="50%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#b3e5fc" stopOpacity="0.95" />
              <stop offset="50%" stopColor="#29b6f6" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#0288d1" stopOpacity="0.75" />
            </radialGradient>
            <filter id={`spillTurb-${i}-${j}`} x="-20%" y="-20%" width="140%" height="140%">
              <feTurbulence baseFrequency="0.8" numOctaves="1" seed="${i}${j}" result="turb" />
              <feDisplacementMap in="SourceGraphic" in2="turb" scale="6" xChannelSelector="R" yChannelSelector="G" />
            </filter>
            <filter id={`spillBlur-${i}-${j}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" />
            </filter>
          </defs>

          <style>{`
            @keyframes spill-appear-${i}-${j} {
              from { opacity: 0; transform: scale(0.7); }
              to { opacity: 1; transform: scale(1.4); }
            }
          `}</style>

          <g style={{ transformOrigin: '50% 50%', animation: `spill-appear-${i}-${j} 700ms ease-out forwards` }}>
            {/* soft outer halo */}
            <circle cx={center.x} cy={center.y} r={36} fill="#29b6f6" opacity={0.5} filter={`url(#spillBlur-${i}-${j})`} />
            
            {/* inner bright sheen */}
            <ellipse cx={center.x - 6} cy={center.y - 8} rx={16} ry={10} fill="#ffffff16" opacity={0.5} />
          </g>
        </svg>
    </div>
  );
}
