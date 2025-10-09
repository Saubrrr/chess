interface PieceImageProps {
  piece: string  // e.g., 'wk', 'bp', etc.
  size?: number
}

export default function PieceImage({ piece, size = 52 }: PieceImageProps) {
  // Fallback Unicode symbols in case images aren't loaded
  const fallbackSymbols: Record<string, string> = {
    'wp': '♙', 'wn': '♘', 'wb': '♗', 'wr': '♖', 'wq': '♕', 'wk': '♔',
    'bp': '♟', 'bn': '♞', 'bb': '♝', 'br': '♜', 'bq': '♛', 'bk': '♚'
  }

  return (
    <img
      src={`/pieces/${piece}.png`}
      alt={piece}
      style={{
        width: size,
        height: size,
        pointerEvents: 'none',
        userSelect: 'none'
      }}
      onError={(e) => {
        // If image fails to load, replace with Unicode fallback
        const target = e.currentTarget
        const fallback = document.createElement('span')
        fallback.textContent = fallbackSymbols[piece] || '?'
        fallback.style.fontSize = `${size}px`
        fallback.style.pointerEvents = 'none'
        fallback.style.userSelect = 'none'
        fallback.style.textShadow = '0 1px 2px rgba(0,0,0,0.3)'
        target.parentNode?.replaceChild(fallback, target)
      }}
    />
  )
}

