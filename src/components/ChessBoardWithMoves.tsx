import { useEffect, useRef, useState } from "react"
import { Chess, Move } from "chess.js"
import { Chessground } from "@lichess-org/chessground"

// Chessground CSS assets
import "@lichess-org/chessground/assets/chessground.base.css"
import "@lichess-org/chessground/assets/chessground.cburnett.css"

// Generate Chessground destinations map from chess.js legal moves
function buildDests(game: Chess): Map<string, string[]> {
  const dests = new Map<string, string[]>()
  const moves = game.moves({ verbose: true }) as Move[]
  
  for (const move of moves) {
    const targets = dests.get(move.from) ?? []
    targets.push(move.to)
    dests.set(move.from, targets)
  }
  return dests
}

interface GamePosition {
  move: Move
  fen: string
}

interface ChessBoardWithMovesProps {
  onMove?: (move: Move) => void
  initialFen?: string
  movable?: boolean
}

export default function ChessBoardWithMoves({ 
  onMove, 
  initialFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  movable = true 
}: ChessBoardWithMovesProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const apiRef = useRef<ReturnType<typeof Chessground> | null>(null)
  const gameRef = useRef(new Chess(initialFen))
  const lastMoveRef = useRef<[string, string] | undefined>(undefined)
  
  const [positions, setPositions] = useState<GamePosition[]>([])
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1)

  // Update board to specific position
  const updateBoard = (position: GamePosition | null, moveIdx: number) => {
    const api = apiRef.current
    if (!api) return

    const fen = position ? position.fen : initialFen
    const tempGame = new Chess(fen)
    gameRef.current = tempGame

    api.set({
      fen: fen,
      turnColor: tempGame.turn() === "w" ? "white" : "black",
      lastMove: position ? [position.move.from, position.move.to] : undefined,
      check: tempGame.inCheck() ? (tempGame.turn() === "w" ? "white" : "black") : undefined,
      movable: {
        color: movable && moveIdx === positions.length - 1 ? (tempGame.turn() === "w" ? "white" : "black") : undefined,
        dests: movable && moveIdx === positions.length - 1 ? buildDests(tempGame) : new Map(),
      },
    })
  }

  useEffect(() => {
    if (!hostRef.current) return

    const game = gameRef.current

    // Initialize Chessground instance
    const api = Chessground(hostRef.current, {
      orientation: "white",
      coordinates: true,
      animation: { enabled: true, duration: 200 },
      highlight: { lastMove: true, check: true },
      draggable: { enabled: movable, autoDistance: true },
      movable: {
        free: false,
        color: movable ? (game.turn() === "w" ? "white" : "black") : undefined,
        dests: movable ? buildDests(game) : new Map(),
        showDests: movable,
        events: {
          after: (orig: string, dest: string) => {
            const move = game.move({ from: orig, to: dest, promotion: "q" })
            if (!move) return

            lastMoveRef.current = [orig, dest]

            // Add move to positions
            const newPosition: GamePosition = {
              move,
              fen: game.fen()
            }
            
            setPositions(prev => [...prev, newPosition])
            setCurrentMoveIndex(prev => prev + 1)

            // Update board
            api.set({
              fen: game.fen(),
              turnColor: game.turn() === "w" ? "white" : "black",
              lastMove: lastMoveRef.current,
              check: game.inCheck() ? (game.turn() === "w" ? "white" : "black") : undefined,
              movable: {
                color: game.turn() === "w" ? "white" : "black",
                dests: buildDests(game),
              },
            })

            // Call callback if provided
            if (onMove) onMove(move)
          },
        },
      },
    })

    // Set initial position
    api.set({
      fen: game.fen(),
      movable: {
        color: movable ? (game.turn() === "w" ? "white" : "black") : undefined,
        dests: movable ? buildDests(game) : new Map(),
      },
    })

    apiRef.current = api

    return () => {
      apiRef.current = null
      if (hostRef.current) hostRef.current.innerHTML = ""
    }
  }, [initialFen, movable, onMove])

  // Navigation functions
  const goToPrevious = () => {
    if (currentMoveIndex < 0) return
    const newIndex = currentMoveIndex - 1
    setCurrentMoveIndex(newIndex)
    const position = newIndex >= 0 ? positions[newIndex] : null
    updateBoard(position, newIndex)
  }

  const goToNext = () => {
    if (currentMoveIndex >= positions.length - 1) return
    const newIndex = currentMoveIndex + 1
    setCurrentMoveIndex(newIndex)
    updateBoard(positions[newIndex], newIndex)
  }

  const goToStart = () => {
    setCurrentMoveIndex(-1)
    updateBoard(null, -1)
  }

  const goToEnd = () => {
    if (positions.length === 0) return
    const newIndex = positions.length - 1
    setCurrentMoveIndex(newIndex)
    updateBoard(positions[newIndex], newIndex)
  }

  const navigateToMove = (index: number) => {
    setCurrentMoveIndex(index)
    updateBoard(positions[index], index)
  }

  // Format moves for display
  const formattedMoves: Array<{
    moveNum: number
    white: GamePosition | null
    black: GamePosition | null
  }> = []
  
  for (let i = 0; i < positions.length; i += 2) {
    const whiteMove = positions[i]
    const blackMove = positions[i + 1] || null
    
    formattedMoves.push({
      moveNum: Math.floor(i / 2) + 1,
      white: whiteMove,
      black: blackMove
    })
  }

  return (
    <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
      {/* Chess Board */}
      <div style={{ width: 560, height: 560 }}>
        <div ref={hostRef} className="cg-wrap" style={{ width: "100%", height: "100%" }} />
      </div>

      {/* Move List Panel */}
      <div style={{
        width: "280px",
        display: "flex",
        flexDirection: "column",
        gap: "8px"
      }}>
        {/* Move List */}
        <div style={{
          height: "460px",
          backgroundColor: "#fff",
          border: "2px solid #ccc",
          borderRadius: "8px",
          padding: "16px",
          overflowY: "auto",
          fontFamily: "monospace"
        }}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: "18px", fontWeight: "600" }}>Move List</h3>
          {formattedMoves.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {formattedMoves.map((movePair, index) => {
                const whiteIndex = index * 2
                const blackIndex = index * 2 + 1
                return (
                  <div key={index} style={{ 
                    display: "grid", 
                    gridTemplateColumns: "40px 80px 80px",
                    padding: "4px", 
                    fontSize: "14px"
                  }}>
                    <span>{movePair.moveNum}.</span>
                    <span 
                      style={{ 
                        fontWeight: currentMoveIndex === whiteIndex ? "bold" : "normal",
                        backgroundColor: currentMoveIndex === whiteIndex ? "#e3f2fd" : "transparent",
                        cursor: "pointer",
                        padding: "2px 4px",
                        borderRadius: "2px"
                      }}
                      onClick={() => navigateToMove(whiteIndex)}
                    >
                      {movePair.white?.move.san}
                    </span>
                    <span 
                      style={{ 
                        fontWeight: currentMoveIndex === blackIndex ? "bold" : "normal",
                        backgroundColor: currentMoveIndex === blackIndex ? "#e3f2fd" : "transparent",
                        cursor: movePair.black ? "pointer" : "default",
                        padding: "2px 4px",
                        borderRadius: "2px"
                      }}
                      onClick={() => movePair.black && navigateToMove(blackIndex)}
                    >
                      {movePair.black?.move.san || ""}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p style={{ color: "#999", fontSize: "14px" }}>No moves yet</p>
          )}
        </div>

        {/* Navigation Controls */}
        <div style={{
          backgroundColor: "#fff",
          border: "2px solid #ccc",
          borderRadius: "8px",
          padding: "12px",
          display: "flex",
          justifyContent: "center",
          gap: "8px"
        }}>
          <button onClick={goToStart} style={{
            padding: "8px 12px",
            fontSize: "16px",
            cursor: "pointer",
            backgroundColor: "#f0f0f0",
            border: "1px solid #ccc",
            borderRadius: "4px"
          }}>⏮</button>
          <button onClick={goToPrevious} style={{
            padding: "8px 12px",
            fontSize: "16px",
            cursor: "pointer",
            backgroundColor: "#f0f0f0",
            border: "1px solid #ccc",
            borderRadius: "4px"
          }}>◀</button>
          <button onClick={goToNext} style={{
            padding: "8px 12px",
            fontSize: "16px",
            cursor: "pointer",
            backgroundColor: "#f0f0f0",
            border: "1px solid #ccc",
            borderRadius: "4px"
          }}>▶</button>
          <button onClick={goToEnd} style={{
            padding: "8px 12px",
            fontSize: "16px",
            cursor: "pointer",
            backgroundColor: "#f0f0f0",
            border: "1px solid #ccc",
            borderRadius: "4px"
          }}>⏭</button>
        </div>
      </div>
    </div>
  )
}

