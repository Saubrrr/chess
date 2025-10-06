import { useEffect, useRef } from "react"
import { Chess } from "chess.js"
import { Chessground } from "@lichess-org/chessground"

import "@lichess-org/chessground/assets/chessground.base.css"
import "@lichess-org/chessground/assets/chessground.cburnett.css"

export default function ChessgroundBoard() {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const apiRef = useRef<any>(null)

  useEffect(() => {
    if (!hostRef.current) return

    const game = new Chess()

    const cg = Chessground(hostRef.current, {
      orientation: "white",
      coordinates: true,
      highlight: { lastMove: true, check: true },
      animation: { enabled: true, duration: 200 },
      draggable: { autoDistance: true },
      movable: { free: false }
    })

    cg.set({ fen: game.fen() })
    apiRef.current = cg

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
