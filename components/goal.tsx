import React from 'react';
import { Direction } from '@/lib/definitions';

export default function Goal({
  i,
  j,
  sizeX = 4,
  sizeY = 5,
  reached = false,
  incomingDir = null,
  side,
}: {
  i: number;
  j: number;
  sizeX?: number;
  sizeY?: number;
  reached?: boolean;
  incomingDir?: Direction | null;
  side?: Direction | null;
}) {
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

  // compute polyline for the stub based on incoming direction (where the water comes from)
  let pts: string[] = [];
  if (incomingDir === 'left') pts = ['0,50', '50,50'];
  else if (incomingDir === 'right') pts = ['100,50', '50,50'];
  else if (incomingDir === 'up') pts = ['50,0', '50,50'];
  else if (incomingDir === 'down') pts = ['50,100', '50,50'];
  else pts = ['50,50'];

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
        zIndex: 40,
      }}
    >
      <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none">
        {/* central flange / plug */}
        {(() => {
          const fill = reached ? activeStroke : '#ffffff';
          const stroke = reached ? '#0d47a1' : '#666';
          const commonStyle = {
            transition: 'all 240ms ease',
          } as React.CSSProperties;
          switch (side) {
            case 'left':
              return (
                <g>
                  <rect
                    x={50}
                    y={40}
                    width={32}
                    height={20}
                    rx={3}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={1.4}
                    style={commonStyle}
                  />
                  <rect
                    x={49}
                    y={37}
                    width={9}
                    height={26}
                    rx={4}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={1.4}
                    style={commonStyle}
                  />
                </g>
              );
            case 'right':
              return (
                <g>
                  <rect
                    x={22}
                    y={40}
                    width={32}
                    height={20}
                    rx={3}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={1.4}
                    style={commonStyle}
                  />
                  <rect
                    x={42}
                    y={37}
                    width={9}
                    height={26}
                    rx={4}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={1.4}
                    style={commonStyle}
                  />
                </g>
              );
            case 'up':
              return (
                <g>
                  <rect
                    x={40}
                    y={50}
                    width={20}
                    height={32}
                    rx={3}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={1.4}
                    style={commonStyle}
                  />
                  <rect
                    x={37}
                    y={49}
                    width={26}
                    height={9}
                    rx={4}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={1.4}
                    style={commonStyle}
                  />
                </g>
              );
            case 'down':
              return (
                <g>
                  <rect
                    x={40}
                    y={20}
                    width={20}
                    height={32}
                    rx={3}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={1.4}
                    style={commonStyle}
                  />
                  <rect
                    x={37}
                    y={42}
                    width={26}
                    height={9}
                    rx={4}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={1.4}
                    style={commonStyle}
                  />
                </g>
              );
            default:
              return (
                <circle
                  cx={50}
                  cy={50}
                  r={10}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={1.4}
                  style={commonStyle}
                />
              );
          }
        })()}
      </svg>
    </div>
  );
}
