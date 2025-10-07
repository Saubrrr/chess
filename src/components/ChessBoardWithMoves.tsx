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
  const [moveHistory, setMoveHistory] = useState<string[]>([])

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

            // Update move history
            const history = game.history()
            setMoveHistory(history)

            // Call callback if provided
            if (onMove) onMove(move)

            // Update board state post-move
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

  // Format moves in pairs for display (1. e4 e5, 2. Nf3 Nc6, etc.)
  const formattedMoves: string[] = []
  for (let i = 0; i < moveHistory.length; i += 2) {
    const moveNum = Math.floor(i / 2) + 1
    const whiteMove = moveHistory[i]
    const blackMove = moveHistory[i + 1] || ""
    formattedMoves.push(`${moveNum}. ${whiteMove}${blackMove ? " " + blackMove : ""}`)
  }

  return (
    <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
      {/* Chess Board */}
      <div style={{ width: 560, height: 560 }}>
        <div ref={hostRef} className="cg-wrap" style={{ width: "100%", height: "100%" }} />
      </div>

      {/* Move List */}
      <div style={{
        width: "280px",
        height: "560px",
        backgroundColor: "#fff",
        border: "2px solid #ccc",
        borderRadius: "8px",
        padding: "16px",
        overflowY: "auto",
        fontFamily: "monospace"
      }}>
        <h3 style={{ margin: "0 0 12px 0", fontSize: "18px", fontWeight: "600" }}>Move List</h3>
        {formattedMoves.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {formattedMoves.map((move, index) => (
              <div key={index} style={{ padding: "4px", fontSize: "14px" }}>
                {move}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: "#999", fontSize: "14px" }}>No moves yet</p>
        )}
      </div>
    </div>
  )
}

