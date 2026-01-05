'use client';
import Pipe from "@/components/pipe";
import Faucet from "@/components/faucet";
import Goal from "@/components/goal";
import { useEffect, useState, useRef } from "react";
import { GridPiece, Direction, Vector2D } from "@/lib/definitions";
import { PIPE_ANIMATION_DURATION } from "@/lib/constants";
import { neighboringOffsets, pairings } from "@/lib/utils";
import Confetti  from 'react-confetti';

export default function PipeGame({ sizeX = 4, sizeY = 5, levelString: levelStringProp = '' } : { sizeX?: number; sizeY?: number; levelString?: string; }) {
  const [faucetX, setFaucetX] = useState(0);
  const [faucetY, setFaucetY] = useState(0);
  const [faucetSide, setFaucetSide] = useState<Direction>('left');
  const [endingX, setEndingX] = useState(sizeX - 1);
  const [endingY, setEndingY] = useState(0);
  const [endingSide, setEndingSide] = useState<Direction>('right');

  const flowTimerRef = useRef<number | null>(null);
  const showPopupTimerRef = useRef<number | null>(null);

  const [gridSizeX, setGridSizeX] = useState(sizeX);
  const [gridSizeY, setGridSizeY] = useState(sizeY);

  // build row-major grid: defaultGrid[row][col]
  const makeDefaultGrid = (gx: number, gy: number) => {
    const g: number[][] = [];
    for (let j = 0; j < gy; j++) {
      g[j] = [];
      for (let i = 0; i < gx; i++) {
        g[j][i] = j * gx + i + 1;
      }
    }
    g[gy - 1][gx - 1] = 0; // empty space
    return g;
  };

  const [grid, setGrid] = useState<number[][]>(() => makeDefaultGrid(sizeX, sizeY));
  const [pipeDirections, setPipeDirections] = useState<Record<number, Direction[]>>({});
  const [flowStatus, setFlowStatus] = useState<Record<number, boolean>>({});
  const [flowIncoming, setFlowIncoming] = useState<Record<number, Direction | null>>({});

  const [currentLevelString, setCurrentLevelString] = useState(levelStringProp);
  const [goalReached, setGoalReached] = useState(false);
  const [lost, setLost] = useState(false);
  const [showPopup, setShowPopup] = useState(false);

  function initializeBoard() {
    setGoalReached(false);
    setLost(false);
    setShowPopup(false);
    if (flowTimerRef.current !== null) {
      clearTimeout(flowTimerRef.current);
      flowTimerRef.current = null;
    }
    if (showPopupTimerRef.current !== null) {
      clearTimeout(showPopupTimerRef.current);
      showPopupTimerRef.current = null;
    }

    for (let i = 0; i < gridSizeX * gridSizeY; i++) {
      flowStatus[i] = false;
      flowIncoming[i] = null;
    }
  }

  useEffect(() => {
    if (currentLevelString && currentLevelString.trim().length > 0) {
      parseLevelString(currentLevelString);
    } else {
      setGrid(makeDefaultGrid(gridSizeX, gridSizeY));
    }

    initializeBoard();
  }, []);

  useEffect(() => {
    showPopupTimerRef.current = window.setTimeout(() => {
      if (goalReached) {
        setShowPopup(true);
      }
    }, 3000);
  }, [goalReached]);

  // parse level string input and apply to grid + pipeDirections
  function parseLevelString(ls: string) {
    const toks = ls.trim().split(/[\s,]+/).filter(Boolean);
    if (toks.length < 3) {
      console.warn('level string too short');
      return;
    }
    const gx = Number(toks[0]);
    const gy = Number(toks[1]);
    // support two formats for faucet specification:
    // old: gx gy fY [endX endY] data...
    // new: gx gy fX fY [endX endY] data...
    let fX: number | null = null;
    let fY: number | null = null;
    let endX: number | null = null;
    let endY: number | null = null;
    const expected = gx * gy;
    let dataStart = 3;
    const rem = toks.length - 2; // remaining after gx,gy
    const isNumber = (s: string) => !Number.isNaN(Number(s));
    if (rem >= 2 && isNumber(toks[2]) && isNumber(toks[3]) && rem >= 2 + expected) {
      // treat toks[2],toks[3] as faucet X,Y
      fX = Number(toks[2]);
      fY = Number(toks[3]);
      dataStart = 4;
      // optional end coords
      if (rem >= 4 + expected && isNumber(toks[4]) && isNumber(toks[5])) {
        endX = Number(toks[4]);
        endY = Number(toks[5]);
        dataStart = 6;
      }
    } else {
      // fallback: single token faucet Y (left edge)
      fY = Number(toks[2]);
      dataStart = 3;
      if (rem >= 2 + expected && isNumber(toks[3]) && isNumber(toks[4])) {
        endX = Number(toks[3]);
        endY = Number(toks[4]);
        dataStart = 5;
      }
    }
    const data = toks.slice(dataStart);
    if (data.length < expected) {
      console.warn('level string missing cells', { expected, got: data.length });
      return;
    }

    // validate exactly one empty cell token (0)
    const zeroCount = data.reduce((acc, t) => acc + ((t === '0' || parseInt(t, 16) === 0) ? 1 : 0), 0);
    if (zeroCount !== 1) {
      console.warn('level string must contain exactly one 0 (empty cell)', { zeroCount });
      return;
    }

    const newGrid: number[][] = [];
    const newPipeDirs: Record<number, Direction[]> = {};
    let idx = 0;
    for (let j = 0; j < gy; j++) {
      newGrid[j] = [];
      for (let i = 0; i < gx; i++) {
        const token = data[idx] ?? '0';
        const cellId = j * gx + i + 1;
        if (token === '0') {
          newGrid[j][i] = 0;
        } else {
          const val = parseInt(token, 16) || 0;
          // disallow single-arm pipes (popcount === 1)
          if (val > 0 && (val & (val - 1)) === 0) {
            console.warn('invalid token: single-sided pipes are not allowed', { token, cellId });
            return;
          }
          newGrid[j][i] = cellId;
          const dirs: Direction[] = [];
          if (val & 8) dirs.push('left');
          if (val & 4) dirs.push('right');
          if (val & 2) dirs.push('up');
          if (val & 1) dirs.push('down');
          newPipeDirs[cellId] = dirs;
        }
        idx++;
      }
    }

    setGridSizeX(gx);
    setGridSizeY(gy);
    // faucet coords: if fX present use it, otherwise default to left edge (x=0)
    if (fX != null && !Number.isNaN(fX)) setFaucetX(fX);
    else setFaucetX(0);
    if (fY != null && !Number.isNaN(fY)) setFaucetY(fY);
    else setFaucetY(0);
    // derive faucetSide from coordinates (edge)
    const deriveSide = (x: number, y: number, gx2: number, gy2: number) : Direction => {
      if (x === 0) return 'left';
      if (x === gx2 - 1) return 'right';
      if (y === 0) return 'up';
      if (y === gy2 - 1) return 'down';
      return 'left';
    };
    setFaucetSide(deriveSide(fX ?? 0, fY ?? 0, gx, gy));
    setGrid(newGrid);
    setPipeDirections(newPipeDirs);
    // clear running flows
    for (let i = 0; i < gx * gy; i++) {
      flowStatus[i] = false;
      flowIncoming[i] = null;
    }
    setFaucetStatus('closed');
    // ending/goal coords
    if (endX != null && endY != null && !Number.isNaN(endX) && !Number.isNaN(endY)) {
      setEndingX(endX);
      setEndingY(endY);
      setEndingSide(deriveSide(endX, endY, gx, gy));
    } else {
      // default to right edge at y=0
      setEndingX(gx - 1);
      setEndingY(0);
      setEndingSide('right');
    }
    setCurrentLevelString(ls);
    initializeBoard();
  }

  const sampleLevels: { name: string; s: string }[] = [
    { name: 'Small L-shape (3x3)', s: '3 3 0 A 6 9 3 5 3 0 9 A' },
    { name: 'Top Row Line (4x3)', s: '4 3 0 C C C C 3 3 3 3 0 9 A 3' },
    { name: 'Demo 4x4', s: '4 4 1 C 6 6 C 3 5 9 3 A 9 B 6 3 0 3 A' },
  ];

  function resetBoard() {
    // restore default grid and clear flow-related state
    if (flowTimerRef.current !== null) {
      clearTimeout(flowTimerRef.current);
      flowTimerRef.current = null;
    }
    setGrid(makeDefaultGrid(gridSizeX, gridSizeY));
    initializeBoard();
    setFaucetStatus('closed');
    lockMovement = false;
  }

  function newBoard() {
    if (flowTimerRef.current !== null) {
      clearTimeout(flowTimerRef.current);
      flowTimerRef.current = null;
    }
    // create a shuffled board of the same size (include one empty slot = 0)
    const total = gridSizeX * gridSizeY;
    const vals: number[] = [];
    for (let k = 1; k <= total; k++) vals.push(k);
    // replace last with 0 to represent empty
    vals[total - 1] = 0;
    // Fisher-Yates shuffle
    for (let k = vals.length - 1; k > 0; k--) {
      const r = Math.floor(Math.random() * (k + 1));
      const tmp = vals[k]; vals[k] = vals[r]; vals[r] = tmp;
    }
    const newGrid: number[][] = [];
    let idx = 0;
    for (let j = 0; j < gridSizeY; j++) {
      newGrid[j] = [];
      for (let i = 0; i < gridSizeX; i++) {
        newGrid[j][i] = vals[idx++];
      }
    }
    forceGridRebuild();
    setTimeout(() => {
      setGrid(newGrid);
      setTimeout(() => {
        // choose random faucet and goal on any board edge
        const pickEdge = () => {
          const sides: Direction[] = ['left','right','up','down'];
          const side = sides[Math.floor(Math.random() * sides.length)];
          let x = 0; let y = 0;
          if (side === 'left') { x = 0; y = Math.floor(Math.random() * gridSizeY); }
          else if (side === 'right') { x = gridSizeX - 1; y = Math.floor(Math.random() * gridSizeY); }
          else if (side === 'up') { y = 0; x = Math.floor(Math.random() * gridSizeX); }
          else { y = gridSizeY - 1; x = Math.floor(Math.random() * gridSizeX); }
          return { x, y, side };
        };
        const f = pickEdge();
        setFaucetX(f.x); setFaucetY(f.y); setFaucetSide(f.side);
        // ensure goal is on a different edge/position
        let g = pickEdge();
        let attempts = 0;
        while (g.x === f.x && g.y === f.y && attempts < 8) { g = pickEdge(); attempts++; }
        setEndingX(g.x); setEndingY(g.y); setEndingSide(g.side);
        updateFaucetStatus();
        resetBoard();
      }, 1);
    }, 1);
    
    //setPipeDirections({});
    for (let i = 0; i < gridSizeX * gridSizeY; i++) {
      savePipeDirections(i, []);
      flowStatus[i] = false;
      flowIncoming[i] = null;
    }
    //setFlowStatus({});
    //setFlowIncoming({});
    //setFaucetStatus('closed');
    lockMovement = false;
  }

  function forceGridRebuild() {
    const newGrid2: number[][] = [];
    let idx2 = 0;
    for (let j = 0; j < gridSizeY; j++) {
      newGrid2[j] = [];
      for (let i = 0; i < gridSizeX; i++) {
        newGrid2[j][i] = 10000 + idx2++; // dummy values to force React to rebuild all pieces
      }
    }
    setGrid(newGrid2);
  }

  function loadLevel(ls: string) {
    forceGridRebuild();
    setTimeout(() => {
      parseLevelString(ls);
    }, 1);
  }

  useEffect(() => {
    if (faucetStatus !== 'open') {
      console.log("Checking faucet status");
      updateFaucetStatus();
    }
  }, [grid]);

  function checkEnding() {
    console.log('Checking goal status', { endingX, endingY, endingSide, flowStatus, goalReached });
    const lastPiecePosition : Vector2D = { x: endingX, y: endingY };
    const lastPieceValue = grid[lastPiecePosition.y] && grid[lastPiecePosition.y][lastPiecePosition.x];
    if (!lastPieceValue) return;
    // check if last piece has an exit facing the goal side and is flowing
    const lastPieceDirs = pipeDirections[lastPieceValue] || [];
    if (lastPieceDirs.includes(endingSide) && flowStatus[lastPieceValue]) {
      if (!goalReached) {
        console.log('Goal reached!');
        setGoalReached(true);
      }
    } else {
      if (goalReached) {
        console.log('Goal no longer reached');
        setGoalReached(false);
      }
    }
  }

  function savePipeDirections(id: number, directions: Direction[]) {
    setPipeDirections(prev => ({ ...prev, [id]: directions }));
    console.log(`Piece ${id} directions: ${directions.join(', ')}`);
  }

  let lockMovement = false;

  // swap by (col,row) coordinates but grid is row-major -> grid[row][col]
  function swapPieces(i1: number, j1: number, i2: number, j2: number) {
    const newGrid = grid.map(row => row.slice());
    const temp = newGrid[j1][i1];
    newGrid[j1][i1] = newGrid[j2][i2];
    newGrid[j2][i2] = temp;
    setGrid(newGrid);
    console.log(JSON.stringify(newGrid));
    lockMovement = true;
    setTimeout(() => {
      lockMovement = false;
    }, 300);
  }

  const [faucetStatus, setFaucetStatus] = useState('closed');
  function handleFaucetClick() {
    console.log("Faucet clicked");
    if (faucetStatus === 'closed') {
      console.log("Starting flow");
      lockMovement = true;
      setFaucetStatus('open');
      const adj = grid[faucetY] && grid[faucetY][faucetX];
      if (adj) {
        flowStatus[adj] = true;
        flowIncoming[adj] = faucetSide;
      }
      //setFlowStatus({ ...flowStatus });
      flowTimerRef.current = window.setTimeout(() => {
        progressFlow();
      }, PIPE_ANIMATION_DURATION) as unknown as number;
    }
  }

  function progressFlow() {
    checkEnding();
    const newFlows : number[] = [];
    // for each piece that is flowing, set neighboring pieces to flow if they have matching entry/exits
    console.log('progressFlow start', { flowStatus, pipeDirections });
    
    const newFlowStatus = { ...flowStatus };
    let anyNewFlow = false;
    for (let j = 0; j < gridSizeY; j++) {
      for (let i = 0; i < gridSizeX; i++) {
        const pieceValue = grid[j][i];
        if (flowStatus[pieceValue]) {
          const directions = pipeDirections[pieceValue] || [];
          for (const dir of directions) {
            const [di, dj] = neighboringOffsets[dir];
            const ni = i + di;
            const nj = j + dj;
            if (ni >= 0 && ni < gridSizeX && nj >= 0 && nj < gridSizeY) {
              const neighborValue = grid[nj][ni];
              const neighborDirections = pipeDirections[neighborValue] || [];
              if (neighborDirections.includes(pairings[dir]) && !newFlowStatus[neighborValue]) {
                newFlowStatus[neighborValue] = true;
                newFlows.push(neighborValue);
                flowIncoming[neighborValue] = pairings[dir] as Direction;
                anyNewFlow = true;
                console.log(`Piece ${neighborValue} at (${ni},${nj}) now flowing due to piece ${pieceValue} at (${i},${j})`);
              }
            }
          }
        }
      }
    }
    console.log('progressFlow result anyNewFlow=', anyNewFlow, 'newFlowStatus=', newFlowStatus);
    setFlowStatus(newFlowStatus);
    if (anyNewFlow) {
      for (const nf of newFlows) {
        flowStatus[nf] = true;
      }
      flowTimerRef.current = window.setTimeout(() => {
        console.log('FlowStatus after timeout:', flowStatus);
        progressFlow();
      }, PIPE_ANIMATION_DURATION) as unknown as number;
    } else {
      console.log('Flow complete with goalReached=', goalReached);
      lockMovement = false;
      // if the goal wasn't reached by the end of propagation, mark as lost
      if (!goalReached) {
        console.log('Flow finished without reaching goal — you lost');
        setLost(true);
        if (showPopupTimerRef.current !== null) {
          clearTimeout(showPopupTimerRef.current);
          showPopupTimerRef.current = null;
        }
        showPopupTimerRef.current = window.setTimeout(() => setShowPopup(true), 400) as unknown as number;
      }
    }
  }

  function handlePieceClick(i: number, j: number) {
    if (lockMovement || faucetStatus === 'open') {
      console.log("Movement locked");
      return;
    }
    // check if i,j has a neighboring empty space
    const directions = [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
    ];
    for (const [di, dj] of directions) {
      const ni = i + di; // column
      const nj = j + dj; // row
      if (ni >= 0 && ni < gridSizeX && nj >= 0 && nj < gridSizeY) {
        if (grid[nj][ni] === 0) {
          swapPieces(i, j, ni, nj);
          return;
        }
      }
    }
  }

  function updateFaucetStatus() {
    // check if the adjacent to faucet has an entry on the faucet side
    const adjacentPieceValue = grid[faucetY] && grid[faucetY][faucetX]; // piece with the faucet
    console.log("PipeDirections:", pipeDirections);
    console.log("Adjacent piece to faucet:", adjacentPieceValue);
    const directions = pipeDirections[adjacentPieceValue] || [];
    if (directions.length === 0) {
      console.log("No directions found for piece", adjacentPieceValue);
      setFaucetStatus('blocked');
      return;
    }
    if (directions.includes(faucetSide)) {
      console.log("Faucet can flow");
      setFaucetStatus('closed');
    } else {
      console.log("Faucet blocked");
      setFaucetStatus('blocked');
    }
  }

  const orderedPieces: GridPiece[] = [];
    for (let j = 0; j < gridSizeY; j++) {
      for (let i = 0; i < gridSizeX; i++) {
      orderedPieces.push({ i, j, value: grid[j][i] });
    }
  }
  orderedPieces.sort((a, b) => a.value - b.value);

  return (
    <div className="flex items-center justify-center w-full h-full">
      {goalReached && (
        <div className="absolute inset-0 pointer-events-none z-60">
          <Confetti />
        </div>
      )}
      {showPopup && (
        <>
              <div
                onClick={() => setShowPopup(false)}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'auto',
                  backgroundColor: 'rgba(0,0,0,0.8)',
                  zIndex: 50,
                }}
              >
                <div onClick={(e) => e.stopPropagation()} className="rounded-lg p-6 shadow-lg text-center text-white" style={{ zIndex: 60, backgroundColor: lost ? 'rgba(200,30,45,0.95)' : 'rgba(250,204,21,0.95)' }}>
                  {lost ? (
                    <>
                      <h2 className="text-3xl font-bold mb-4">You lost</h2>
                      <p className="text-lg">The flow finished without reaching the goal.</p>
                    </>
                  ) : (
                    <>
                      <h2 className="text-3xl font-bold mb-4">Congratulations!</h2>
                      <p className="text-lg">You've reached the goal!</p>
                    </>
                  )}
                </div>
              </div>
        </>
      )}
      {/* game board */}
      <div
      className="m-4 p-0 bg-gray-800 rounded-lg shadow-lg relative items-center justify-center w-100"
      style={{ aspectRatio: `${gridSizeX} / ${gridSizeY}` }}
      >
        {/* controls positioned close to the board, horizontally centered */}
        <div style={{ position: 'absolute', left: '50%', top: '-4.5rem', transform: 'translateX(-50%)', backgroundColor: 'rgba(31,41,55,0.95)', padding: '6px 8px', borderRadius: '8px', boxShadow: '0 8px 20px rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.04)' }} className="pointer-events-auto z-40">
          <div className="flex gap-2 items-center">
            <button
              type="button"
              onClick={resetBoard}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm"
              style={{ width: '84px', whiteSpace: 'nowrap', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              Reset
            </button>
              <button
                type="button"
                onClick={newBoard}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-white text-sm"
                style={{ width: '84px', whiteSpace: 'nowrap', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                New Board
              </button>
              <button
                type="button"
                onClick={handleFaucetClick}
                aria-label="Play"
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-sm font-medium shadow-sm"
                style={{ width: '84px', whiteSpace: 'nowrap', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                Play
              </button>
          </div>
        </div>

        <div className="relative w-full h-full">
          {orderedPieces.map(({ i, j, value }) =>{
            const pieceNumber = value;
            return pieceNumber !== 0 ? (
              <Pipe
                key={`${pieceNumber}`}
                name={`piece-${pieceNumber}`}
                i={i}
                j={j}
                sizeX={gridSizeX}
                sizeY={gridSizeY}
                entries={pipeDirections[pieceNumber] ?? (pieceNumber === 1 ? ['left'] : [])}
                flow={flowStatus[pieceNumber] || false}
                incoming={flowIncoming[pieceNumber] || null}
                onClickHandler={() => handlePieceClick(i, j)}
                savePipeDirections={(x) => savePipeDirections(pieceNumber, x)}
              />
            ) : null;
          })}
          {/* render Goal component if present */}
          {(() => {
            const opposite = (d: Direction) : Direction => {
              if (d === 'left') return 'right';
              if (d === 'right') return 'left';
              if (d === 'up') return 'down';
              return 'up';
            };
            const gx = endingX + (endingSide === 'right' ? 1 : (endingSide === 'left' ? -1 : 0));
            const gy = endingY + (endingSide === 'down' ? 1 : (endingSide === 'up' ? -1 : 0));
            const incoming: Direction | null = (() => {
              const val = grid[endingY] && grid[endingY][endingX];
              return val ? (flowIncoming[val] || null) : null;
            })();
            const sideProp: Direction = opposite(endingSide);
            return <Goal i={gx} j={gy} sizeX={gridSizeX} sizeY={gridSizeY} reached={goalReached} incomingDir={incoming} side={sideProp} />;
          })()}
          {/* faucet positioned at chosen edge */}
          {(() => {
            const fx = faucetX + (faucetSide === 'right' ? 0 : (faucetSide === 'left' ? -0 : 0));
            const fy = faucetY + (faucetSide === 'down' ? 0 : (faucetSide === 'up' ? -0 : 0));
            return (
              <Faucet 
                i={fx} j={fy} sizeX={gridSizeX} sizeY={gridSizeY} side={faucetSide} sizeRatio={1} 
                onClickHandler={handleFaucetClick} status={faucetStatus} 
              />
            );
          })()}
        </div>
        
      </div>
    </div>
  );
}