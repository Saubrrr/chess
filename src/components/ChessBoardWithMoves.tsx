import { useEffect, useRef, useState } from "react"
import { Chess, Move, Square, PieceSymbol, Color } from "chess.js"
import PieceImage from "./PieceImage"

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
  const gameRef = useRef(new Chess(initialFen))
  const [boardKey, setBoardKey] = useState(0)
  
  const [positions, setPositions] = useState<GamePosition[]>([])
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1)
  const [orientation, setOrientation] = useState<"white" | "black">("white")

  // Board interaction states
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null)
  const [legalMoves, setLegalMoves] = useState<Square[]>([])
  const [lastMove, setLastMove] = useState<[Square, Square] | null>(null)
  const [draggedPiece, setDraggedPiece] = useState<{
    square: Square
    piece: string
    startX: number
    startY: number
  } | null>(null)
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null)
  const [promotionState, setPromotionState] = useState<{
    from: Square
    to: Square
  } | null>(null)

  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1']
  
  const displayFiles = orientation === 'white' ? files : [...files].reverse()
  const displayRanks = orientation === 'white' ? ranks : [...ranks].reverse()

  // Get current game state
  const getCurrentGame = () => {
    if (currentMoveIndex === -1) {
      const game = new Chess(initialFen)
      return game
    } else if (currentMoveIndex < positions.length) {
      const game = new Chess(positions[currentMoveIndex].fen)
      return game
    }
    return gameRef.current
  }

  const isAtLatestMove = currentMoveIndex === positions.length - 1 || (positions.length === 0 && currentMoveIndex === -1)

  // Handle piece selection
  const handleSquareClick = (square: Square) => {
    if (!movable || !isAtLatestMove) return

    const game = getCurrentGame()
    const piece = game.get(square)
    
    // If promoting, ignore clicks
    if (promotionState) return
    
    // If a square is selected and we click a legal destination
    if (selectedSquare && legalMoves.includes(square)) {
      makeMove(selectedSquare, square)
    }
    // Select a new piece if it's the current player's turn
    else if (piece && piece.color === game.turn()) {
      setSelectedSquare(square)
      const moves = game.moves({ square, verbose: true })
      setLegalMoves(moves.map(m => m.to as Square))
    }
    // Deselect if clicking empty square or wrong color piece
    else {
      setSelectedSquare(null)
      setLegalMoves([])
    }
  }

  // Make a move
  const makeMove = (from: Square, to: Square, promotion?: PieceSymbol) => {
    const game = getCurrentGame()
    
    // Check if this is a pawn promotion
    const piece = game.get(from)
    const isPromotion = piece?.type === 'p' && 
      ((piece.color === 'w' && to[1] === '8') || (piece.color === 'b' && to[1] === '1'))
    
    if (isPromotion && !promotion) {
      // Show promotion dialog
      setPromotionState({ from, to })
      return
    }

    const move = game.move({ from, to, promotion: promotion || 'q' })
    if (move) {
      gameRef.current = game
      setLastMove([move.from as Square, move.to as Square])
      setSelectedSquare(null)
      setLegalMoves([])
      setPromotionState(null)

            // Add move to positions
            const newPosition: GamePosition = {
              move,
              fen: game.fen()
            }
            
            setPositions(prev => [...prev, newPosition])
            setCurrentMoveIndex(prev => prev + 1)
      setBoardKey(prev => prev + 1)

            // Call callback if provided
            if (onMove) onMove(move)
    }
  }

  // Handle promotion selection
  const handlePromotion = (piece: PieceSymbol) => {
    if (promotionState) {
      makeMove(promotionState.from, promotionState.to, piece)
    }
  }

  // Drag and drop handlers
  const handleMouseDown = (e: React.MouseEvent, square: Square) => {
    if (!movable || !isAtLatestMove) return

    const game = getCurrentGame()
    const piece = game.get(square)
    
    if (piece && piece.color === game.turn()) {
      const pieceKey = `${piece.color}${piece.type}`
      setDraggedPiece({
        square,
        piece: pieceKey,
        startX: e.clientX,
        startY: e.clientY
      })
      setDragPosition({ x: e.clientX, y: e.clientY })
      
      // Set legal moves for this piece
      const moves = game.moves({ square, verbose: true })
      setLegalMoves(moves.map(m => m.to as Square))
      setSelectedSquare(square)
      
      e.preventDefault()
    }
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (draggedPiece) {
      setDragPosition({ x: e.clientX, y: e.clientY })
    }
  }

  const handleMouseUp = (e: MouseEvent) => {
    if (draggedPiece) {
      // Find which square we dropped on
      const element = document.elementFromPoint(e.clientX, e.clientY)
      const square = element?.getAttribute('data-square') as Square | null
      
      if (square && legalMoves.includes(square)) {
        makeMove(draggedPiece.square, square)
      } else {
        // Reset if invalid move
        setSelectedSquare(null)
        setLegalMoves([])
      }
      
      setDraggedPiece(null)
      setDragPosition(null)
    }
  }

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [draggedPiece, legalMoves])

  // Update board to specific position
  const updateBoard = (position: GamePosition | null, moveIdx: number) => {
    if (position) {
      setLastMove([position.move.from as Square, position.move.to as Square])
    } else {
      setLastMove(null)
    }
    setSelectedSquare(null)
    setLegalMoves([])
    setBoardKey(prev => prev + 1)
  }

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

  const flipBoard = () => {
    setOrientation(prev => prev === "white" ? "black" : "white")
  }

  // Helper functions for square styling
  const isSquareLight = (file: string, rank: string) => {
    return (files.indexOf(file) + ranks.indexOf(rank)) % 2 === 0
  }

  const isSquareHighlighted = (square: Square) => {
    return legalMoves.includes(square)
  }

  const isSquareSelected = (square: Square) => {
    return selectedSquare === square
  }

  const isSquareLastMove = (square: Square) => {
    return lastMove && (lastMove[0] === square || lastMove[1] === square)
  }

  const isKingInCheck = (square: Square) => {
    const game = getCurrentGame()
    const piece = game.get(square)
    return game.inCheck() && piece?.type === 'k' && piece.color === game.turn()
  }

  // Render the board
  const renderBoard = () => {
    const game = getCurrentGame()
    
    return (
      <div style={{ 
        display: 'inline-block',
        border: '3px solid #333',
        boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
        borderRadius: '4px',
        overflow: 'hidden'
      }}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(8, 70px)',
          gridTemplateRows: 'repeat(8, 70px)',
          gap: 0,
          position: 'relative'
        }}>
          {displayRanks.map(rank => 
            displayFiles.map(file => {
              const square = `${file}${rank}` as Square
              const piece = game.get(square)
              const pieceKey = piece ? `${piece.color}${piece.type}` : null
              const isDragging = draggedPiece?.square === square
              
              return (
                <div
                  key={square}
                  data-square={square}
                  onClick={() => handleSquareClick(square)}
                  onMouseDown={(e) => handleMouseDown(e, square)}
                  style={{
                    backgroundColor: 
                      isSquareSelected(square) ? '#7fb3d5' :
                      isKingInCheck(square) ? '#ff6b6b' :
                      isSquareLastMove(square) ? '#baca44' :
                      isSquareLight(file, rank) ? '#f0d9b5' : '#b58863',
                    cursor: movable && isAtLatestMove ? 'pointer' : 'default',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '52px',
                    userSelect: 'none',
                    transition: 'background-color 0.15s'
                  }}
                >
                  {/* Piece */}
                  {pieceKey && !isDragging && (
                    <PieceImage piece={pieceKey} size={60} />
                  )}
                  
                  {/* Legal move indicator */}
                  {isSquareHighlighted(square) && (
                    <div style={{
                      position: 'absolute',
                      width: piece ? '80%' : '25%',
                      height: piece ? '80%' : '25%',
                      border: piece ? '3px solid rgba(20, 85, 30, 0.5)' : 'none',
                      backgroundColor: piece ? 'transparent' : 'rgba(20, 85, 30, 0.3)',
                      borderRadius: '50%',
                      pointerEvents: 'none'
                    }} />
                  )}
                  
                  {/* Coordinates */}
                  {file === displayFiles[0] && (
                    <span style={{
                      position: 'absolute',
                      top: '2px',
                      left: '4px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      color: isSquareLight(file, rank) ? '#b58863' : '#f0d9b5',
                      pointerEvents: 'none'
                    }}>
                      {rank}
                    </span>
                  )}
                  {rank === displayRanks[displayRanks.length - 1] && (
                    <span style={{
                      position: 'absolute',
                      bottom: '2px',
                      right: '4px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      color: isSquareLight(file, rank) ? '#b58863' : '#f0d9b5',
                      pointerEvents: 'none'
                    }}>
                      {file}
                    </span>
                  )}
                </div>
              )
            })
          )}
        </div>
        
        {/* Dragged piece */}
        {draggedPiece && dragPosition && (
          <div style={{
            position: 'fixed',
            left: dragPosition.x - 30,
            top: dragPosition.y - 30,
            pointerEvents: 'none',
            zIndex: 1000,
            opacity: 0.9
          }}>
            <PieceImage piece={draggedPiece.piece} size={60} />
          </div>
        )}
        
        {/* Promotion dialog */}
        {promotionState && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100
          }}>
            <div style={{
              backgroundColor: '#fff',
              padding: '20px',
              borderRadius: '8px',
              display: 'flex',
              gap: '10px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
            }}>
              {(['q', 'r', 'b', 'n'] as PieceSymbol[]).map(piece => {
                const game = getCurrentGame()
                const color = game.turn()
                const pieceKey = `${color}${piece}`
                return (
                  <button
                    key={piece}
                    onClick={() => handlePromotion(piece)}
                    style={{
                      padding: '10px',
                      cursor: 'pointer',
                      backgroundColor: '#f0f0f0',
                      border: '2px solid #333',
                      borderRadius: '4px',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e0e0e0'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f0f0f0'}
                  >
                    <PieceImage piece={pieceKey} size={48} />
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
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
      <div key={boardKey} style={{ width: 560, height: 560 }}>
        {renderBoard()}
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
          <button onClick={flipBoard} style={{
            padding: "8px 12px",
            fontSize: "16px",
            cursor: "pointer",
            backgroundColor: "#f0f0f0",
            border: "1px solid #ccc",
            borderRadius: "4px"
          }}>🔄</button>
        </div>
      </div>
    </div>
  )
}
