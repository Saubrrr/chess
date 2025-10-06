import { useEffect, useRef } from "react"
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

export default function ChessgroundBoard() {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const apiRef = useRef<ReturnType<typeof Chessground> | null>(null)
  const gameRef = useRef(new Chess())
  const lastMoveRef = useRef<[string, string] | undefined>(undefined)

  useEffect(() => {
    if (!hostRef.current) return

    const game = gameRef.current

    // Initialize Chessground instance
    const api = Chessground(hostRef.current, {
      orientation: "white",
      coordinates: true,
      animation: { enabled: true, duration: 200 },
      highlight: { lastMove: true, check: true },
      draggable: { enabled: true, autoDistance: true },
      movable: {
        free: false,
        color: game.turn() === "w" ? "white" : "black",
        dests: buildDests(game),
        showDests: true,
        events: {
          after: (orig: string, dest: string) => {
            const move = game.move({ from: orig, to: dest, promotion: "q" })
            if (!move) return

            lastMoveRef.current = [orig, dest]

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
        color: game.turn() === "w" ? "white" : "black",
        dests: buildDests(game),
      },
    })

    apiRef.current = api

    return () => {
      apiRef.current = null
      if (hostRef.current) hostRef.current.innerHTML = ""
    }
  }, [])

  return (
    <div style={{ width: 560, height: 560 }}>
      <div ref={hostRef} className="cg-wrap" style={{ width: "100%", height: "100%" }} />
    </div>
  )
}