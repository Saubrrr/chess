import { useEffect, useRef, useState } from "react"
import { Chess, Move, Square, PieceSymbol, Color } from "chess.js"
import PieceImage from "./PieceImage"
import { MoveNode, createMoveNode, getPathToNode, buildTreeDisplay, TreeLine } from "@/types/moveTree"
import { exportToPGN, importFromPGN, PGNMetadata } from "@/utils/pgnUtils"

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
  
  // Move tree state - now supports multiple root nodes
  const [rootNodes, setRootNodes] = useState<MoveNode[]>([])
  const [currentNode, setCurrentNode] = useState<MoveNode | null>(null)
  const [orientation, setOrientation] = useState<"white" | "black">("white")
  
  // Dropdown menu state
  const [dropdownMenu, setDropdownMenu] = useState<{
    node: MoveNode
    x: number
    y: number
  } | null>(null)
  
  // Comment editing state
  const [editingComment, setEditingComment] = useState<{
    node: MoveNode
  } | null>(null)
 
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
    if (!currentNode) {
      const game = new Chess(initialFen)
      return game
    } else {
      const game = new Chess(currentNode.fen)
      return game
    }
  }

  // Check if we're at a leaf node (can add new moves)
  const isAtLeafNode = !currentNode || currentNode.children.length === 0

  // Handle piece selection
  const handleSquareClick = (square: Square) => {
    if (!movable) return

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
      const newFen = game.fen()
      
      if (!currentNode) {
        // This is a first move - check if it already exists in root nodes
        const existingRoot = rootNodes.find(
          root => root.move.san === move.san && root.move.from === move.from && root.move.to === move.to
        )
        
        if (existingRoot) {
          // Navigate to existing first move
          setCurrentNode(existingRoot)
          setLastMove([existingRoot.move.from as Square, existingRoot.move.to as Square])
        } else {
          // Create new root node
          const isMainLine = rootNodes.length === 0
          const newNode = createMoveNode(move, newFen, null, isMainLine)
          setRootNodes(prev => [...prev, newNode])
          setCurrentNode(newNode)
          setLastMove([move.from as Square, move.to as Square])
        }
      } else {
      // Check if this move already exists as a child
        const existingChild = currentNode.children.find(
        child => child.move.san === move.san && child.move.from === move.from && child.move.to === move.to
      )
      
      if (existingChild) {
        // Navigate to existing variation
        setCurrentNode(existingChild)
        setLastMove([existingChild.move.from as Square, existingChild.move.to as Square])
      } else {
        // Create new node
          const isMainLine = currentNode.children.length === 0
        const newNode = createMoveNode(move, newFen, currentNode, isMainLine)
          currentNode.children.push(newNode)
          setCurrentNode(newNode)
          setLastMove([move.from as Square, move.to as Square])
        }
      }
      
      gameRef.current = game
      setSelectedSquare(null)
      setLegalMoves([])
      setPromotionState(null)
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
    if (!movable) return

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

  // Keyboard navigation with arrow keys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input or textarea
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      // Close dropdown on Escape
      if (e.key === 'Escape' && dropdownMenu) {
        setDropdownMenu(null)
        return
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (!currentNode) return
        if (currentNode.parent) {
          setCurrentNode(currentNode.parent)
          updateBoard(currentNode.parent)
        } else {
          setCurrentNode(null)
          updateBoard(null)
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        if (!currentNode && rootNodes.length > 0) {
          const firstRoot = rootNodes.find(r => r.isMainLine) || rootNodes[0]
          setCurrentNode(firstRoot)
          updateBoard(firstRoot)
        } else if (currentNode && currentNode.children.length > 0) {
          const nextNode = currentNode.children.find(child => child.isMainLine) || currentNode.children[0]
          setCurrentNode(nextNode)
          updateBoard(nextNode)
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [currentNode, rootNodes, dropdownMenu])

  // Update board to specific node
  const updateBoard = (node: MoveNode | null) => {
    if (node) {
      setLastMove([node.move.from as Square, node.move.to as Square])
    } else {
      setLastMove(null)
    }
    setSelectedSquare(null)
    setLegalMoves([])
    setBoardKey(prev => prev + 1)
  }

  // Navigation functions
  const goToPrevious = () => {
    if (!currentNode) return
    if (currentNode.parent) {
      setCurrentNode(currentNode.parent)
      updateBoard(currentNode.parent)
    } else {
      // Go to start
      setCurrentNode(null)
      updateBoard(null)
    }
  }

  const goToNext = () => {
    if (!currentNode && rootNodes.length > 0) {
      // From start, go to first move (main line root)
      const firstRoot = rootNodes.find(r => r.isMainLine) || rootNodes[0]
      setCurrentNode(firstRoot)
      updateBoard(firstRoot)
    } else if (currentNode && currentNode.children.length > 0) {
      // Go to first child (main line)
      const nextNode = currentNode.children.find(child => child.isMainLine) || currentNode.children[0]
      setCurrentNode(nextNode)
      updateBoard(nextNode)
    }
  }

  // Collect all nodes with branching paths (multiple children)
  const collectBranchingNodes = (nodes: MoveNode[]): Array<{ node: MoveNode; children: MoveNode[] }> => {
    const branches: Array<{ node: MoveNode; children: MoveNode[] }> = []
    
    const traverse = (node: MoveNode) => {
      if (node.children.length > 1) {
        branches.push({ node, children: node.children })
      }
      node.children.forEach(child => traverse(child))
    }
    
    nodes.forEach(root => traverse(root))
    return branches
  }

  const goToStart = () => {
    setCurrentNode(null)
    updateBoard(null)
  }

  const goToEnd = () => {
    if (rootNodes.length === 0) return
    
    // Start from main line root
    let node = rootNodes.find(r => r.isMainLine) || rootNodes[0]
    
    // Follow main line to the end
    while (node.children.length > 0) {
      const nextMainMove = node.children.find(child => child.isMainLine) || node.children[0]
      node = nextMainMove
    }
    
    setCurrentNode(node)
    updateBoard(node)
  }

  const navigateToNode = (node: MoveNode) => {
    setCurrentNode(node)
    updateBoard(node)
  }

  // Check if a node is the ancestor node or a descendant of it
  const isDescendant = (node: MoveNode, ancestor: MoveNode): boolean => {
    // First check if it's the node itself
    if (node === ancestor) {
      return true
    }
    
    // Then traverse up the tree to see if ancestor is in the path
    let current: MoveNode | null = node
    while (current && current.parent) {
      current = current.parent
      if (current === ancestor) {
        return true
      }
    }
    return false
  }

  // Remove a move and all its descendants
  const removeMove = (nodeToRemove: MoveNode) => {
    // Check if current node is the one being removed or a descendant
    const isRemovingCurrent = currentNode && isDescendant(currentNode, nodeToRemove)
    
    if (nodeToRemove.parent) {
      // Remove from parent's children
      const parent = nodeToRemove.parent
      const index = parent.children.indexOf(nodeToRemove)
      if (index !== -1) {
        // Create new array without the removed node
        const newChildren = parent.children.filter(n => n !== nodeToRemove)
        parent.children = newChildren
        
        // If we removed the main line and there are other children, make the first one the main line
        if (nodeToRemove.isMainLine && newChildren.length > 0) {
          newChildren[0].isMainLine = true
        }
        
        // Update state to trigger re-render
        setRootNodes([...rootNodes])
        
        // Navigate safely if needed
        if (isRemovingCurrent) {
          setCurrentNode(parent)
          updateBoard(parent)
        }
      }
    } else {
      // Remove from root nodes
      const newRootNodes = rootNodes.filter(n => n !== nodeToRemove)
      
      // If we removed the main line root and there are other roots, make the first one the main line
      if (nodeToRemove.isMainLine && newRootNodes.length > 0) {
        newRootNodes[0].isMainLine = true
      }
      
      setRootNodes(newRootNodes)
      
      // Navigate safely if needed
      if (isRemovingCurrent) {
        setCurrentNode(null)
        updateBoard(null)
      }
    }
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
          gridTemplateColumns: 'repeat(8, 100px)',
          gridTemplateRows: 'repeat(8, 100px)',
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
                    cursor: movable ? 'pointer' : 'default',
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
                    <PieceImage piece={pieceKey} size={85} />
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
            left: dragPosition.x - 42,
            top: dragPosition.y - 42,
            pointerEvents: 'none',
            zIndex: 1000,
            opacity: 0.9
          }}>
            <PieceImage piece={draggedPiece.piece} size={85} />
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
                    <PieceImage piece={pieceKey} size={60} />
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Get current path for display
  const currentPath = getPathToNode(currentNode)
  
  // Get available variations at current position
  const availableVariations = currentNode ? currentNode.children : rootNodes
  
  // Get move number and color for a position
  const getMoveNumberForPosition = (node: MoveNode | null): { number: number; isWhite: boolean } => {
    if (!node) {
      const game = new Chess(initialFen)
      return { number: 1, isWhite: game.turn() === 'w' }
    }
    
    // Count moves by traversing up to root
    let moveCount = 0
    let current: MoveNode | null = node
    
    // Build path to root
    const path: MoveNode[] = []
    while (current) {
      path.push(current)
      current = current.parent
    }
    
    // Count white and black moves
    let whiteMoves = 0
    let blackMoves = 0
    
    // Check starting position
    const startGame = new Chess(initialFen)
    const startIsWhite = startGame.turn() === 'w'
    
    path.reverse().forEach((n, idx) => {
      if (idx === 0 && !startIsWhite) {
        // First move is black
        blackMoves++
      } else {
        // Alternate moves
        if ((idx + (startIsWhite ? 0 : 1)) % 2 === 0) {
          whiteMoves++
        } else {
          blackMoves++
        }
      }
    })
    
    // The move number is white moves, and next move is white if whiteMoves === blackMoves
    const moveNumber = Math.max(whiteMoves, blackMoves)
    const isWhite = whiteMoves === blackMoves
    
    return { number: moveNumber, isWhite }
  }

  // Render tree display for moves
  const renderTreeDisplay = () => {
    if (rootNodes.length === 0) {
      return <p style={{ color: "#999", fontSize: "14px" }}>No moves yet</p>
    }

    // Check if a variation is simple (no complex branching)
    const isSimpleVariation = (node: MoveNode): boolean => {
      let current: MoveNode | null = node
      while (current) {
        // If any node in the line has 2+ children, it's not simple
        if (current.children.length >= 2) {
          return false
        }
        current = current.children.length === 1 ? current.children[0] : null
      }
      return true
    }

    const renderMoveLine = (node: MoveNode, depth: number, moveNumber: number, isWhite: boolean, showMoveNumber: boolean = true): JSX.Element[] => {
      const elements: JSX.Element[] = []
      const isCurrentNode = node === currentNode
      const isEditingComment = editingComment?.node === node
      
      // Render this move
      elements.push(
        <span key={node.id} style={{ display: "inline-flex", alignItems: "center", gap: "2px" }}>
          {/* Move number - show for white moves or when starting a new line */}
          {showMoveNumber && (
            <span style={{ color: "#666", fontSize: "13px", fontWeight: "500", marginLeft: "4px" }}>
              {isWhite ? `${moveNumber}.` : `${moveNumber}...`}
            </span>
          )}
          {/* Move itself */}
          <span
            onClick={(e) => {
              if (e.detail === 1) {
                // Single click - navigate
                navigateToNode(node)
              } else if (e.detail === 2) {
                // Double click - do nothing or could open dropdown
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault()
              setDropdownMenu({
                node,
                x: e.clientX,
                y: e.clientY
              })
            }}
            style={{
              cursor: "pointer",
              padding: "2px 6px",
              backgroundColor: isCurrentNode ? "#4a90e2" : "transparent",
              color: isCurrentNode ? "#fff" : "#000",
              borderRadius: "3px",
              fontSize: "14px",
              fontWeight: isCurrentNode ? "bold" : "normal",
              fontFamily: "monospace",
              transition: "background-color 0.15s"
            }}
            onMouseEnter={(e) => {
              if (!isCurrentNode) {
                e.currentTarget.style.backgroundColor = "#e0e0e0"
              }
            }}
            onMouseLeave={(e) => {
              if (!isCurrentNode) {
                e.currentTarget.style.backgroundColor = "transparent"
              }
            }}
          >
            {node.move.san}
          </span>
          {/* Comment inline after move */}
          {isEditingComment ? (
            <textarea
              autoFocus
              defaultValue={node.comment || ""}
              onBlur={(e) => {
                const newComment = e.target.value.trim()
                node.comment = newComment || undefined
                setRootNodes([...rootNodes])
                setEditingComment(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.currentTarget.blur()
                } else if (e.key === 'Escape') {
                  setEditingComment(null)
                }
              }}
              onClick={(e) => e.stopPropagation()}
              style={{
                marginLeft: "4px",
                padding: "2px 4px",
                fontSize: "13px",
                fontFamily: "Arial, sans-serif",
                border: "1px solid #ccc",
                borderRadius: "3px",
                resize: "none",
                minHeight: "18px",
                width: "150px",
                backgroundColor: "#fff",
                display: "inline-block",
                verticalAlign: "middle"
              }}
            />
          ) : node.comment ? (
            <span
              onClick={(e) => {
                e.stopPropagation()
                setEditingComment({ node })
              }}
              style={{
                marginLeft: "4px",
                padding: "2px 4px",
                fontSize: "13px",
                fontFamily: "Arial, sans-serif",
                color: "#333",
                cursor: "text",
                display: "inline"
              }}
            >
              {node.comment}
            </span>
          ) : null}
        </span>
      )

      // Process children
      if (node.children.length > 0) {
        const nextMoveNumber = !isWhite ? moveNumber + 1 : moveNumber
        const nextIsWhite = !isWhite
        
        if (node.children.length === 1) {
          // Only one continuation - keep it on the same line
          const child = node.children[0]
          elements.push(...renderMoveLine(child, depth, nextMoveNumber, nextIsWhite, nextIsWhite))
        } else if (node.children.length === 2) {
          // Two variations - check if variation is simple enough for inline display
          const mainLineChild = node.children.find(c => c.isMainLine) || node.children[0]
          const variation = node.children.find(c => c !== mainLineChild)!
          
          // Only use inline parentheses if the variation is simple (no further branching)
          if (isSimpleVariation(variation)) {
            // Add variation in parentheses inline
            elements.push(
              <span key={`paren-${variation.id}`} style={{ display: "inline-flex", alignItems: "center", gap: "2px" }}>
                <span style={{ color: "#888", marginLeft: "4px", marginRight: "2px" }}>(</span>
                {renderMoveLine(variation, depth, nextMoveNumber, nextIsWhite, true)}
                <span style={{ color: "#888", marginLeft: "2px", marginRight: "4px" }}>)</span>
              </span>
            )
            
            // Continue with main line
            elements.push(...renderMoveLine(mainLineChild, depth, nextMoveNumber, nextIsWhite, nextIsWhite))
          } else {
            // If variation is complex, show both on separate lines
            node.children.forEach((child) => {
              elements.push(
                <div key={`var-${child.id}`} style={{
                  display: "block",
                  paddingLeft: `${20}px`,
                  borderLeft: "2px solid #ccc",
                  marginLeft: "4px",
                  marginTop: "4px",
                  marginBottom: "4px",
                  paddingTop: "2px",
                  paddingBottom: "2px"
                }}>
                  {renderMoveLine(child, depth + 1, nextMoveNumber, nextIsWhite, true)}
                </div>
              )
            })
          }
        } else {
          // 3+ variations - show all on separate indented lines
          node.children.forEach((child) => {
            elements.push(
              <div key={`var-${child.id}`} style={{
                display: "block",
                paddingLeft: `${20}px`,
                borderLeft: "2px solid #ccc",
                marginLeft: "4px",
                marginTop: "4px",
                marginBottom: "4px",
                paddingTop: "2px",
                paddingBottom: "2px"
              }}>
                {/* Always show move number when starting a new variation line */}
                {renderMoveLine(child, depth + 1, nextMoveNumber, nextIsWhite, true)}
              </div>
            )
          })
        }
      }

      return elements
    }

    return (
      <div style={{ lineHeight: "1.8" }}>
        {rootNodes.map((rootNode, index) => {
          if (index === 0 || rootNode.isMainLine) {
            // Main line root - always starts with 1.
            return (
              <div key={rootNode.id} style={{ marginBottom: "8px" }}>
                {renderMoveLine(rootNode, 0, 1, true, true)}
              </div>
            )
          } else {
            // Alternative first move - show as 1... if black's turn
            return (
              <div key={rootNode.id} style={{
                marginBottom: "8px",
                paddingLeft: "20px",
                borderLeft: "2px solid #ccc",
                marginLeft: "4px",
                paddingTop: "2px",
                paddingBottom: "2px"
              }}>
                {renderMoveLine(rootNode, 1, 1, true, true)}
              </div>
            )
          }
        })}
      </div>
    )
  }

  return (
    <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
      {/* Chess Board */}
      <div key={boardKey} style={{ width: 800, height: 800 }}>
        {renderBoard()}
      </div>

      {/* Move List Panel */}
      <div style={{
        width: "450px",
        display: "flex",
        flexDirection: "column",
        gap: "8px"
      }}>
        {/* PGN Import/Export Controls */}
        <div style={{
          backgroundColor: "#fff",
          border: "2px solid #ccc",
          borderRadius: "8px",
          padding: "12px",
          display: "flex",
          gap: "8px",
          flexWrap: "wrap"
        }}>
          <button
            onClick={() => {
              const input = document.createElement('input')
              input.type = 'file'
              input.accept = '.pgn,.txt'
              input.onchange = (e) => {
                const file = (e.target as HTMLInputElement).files?.[0]
                if (file) {
                  const reader = new FileReader()
                  reader.onload = (event) => {
                    const pgn = event.target?.result as string
                    try {
                      const { rootNodes: importedNodes, metadata } = importFromPGN(pgn, initialFen)
                      if (importedNodes.length > 0) {
                        setRootNodes(importedNodes)
                        setCurrentNode(importedNodes.find(n => n.isMainLine) || importedNodes[0])
                        setBoardKey(prev => prev + 1)
                        // Reset to first move if there are moves
                        if (importedNodes[0]) {
                          const path = getPathToNode(importedNodes[0])
                          if (path.length > 0) {
                            const firstMove = path[path.length - 1]
                            const game = new Chess(initialFen)
                            path.forEach(n => {
                              game.move(n.move.san)
                            })
                            setLastMove([firstMove.move.from as Square, firstMove.move.to as Square])
                          }
                        }
                        // Log metadata for now (will be used for study management later)
                        console.log("Imported PGN metadata:", metadata)
                        alert("PGN imported successfully!")
                      } else {
                        alert("Failed to import PGN. Please check the format.")
                      }
                    } catch (error) {
                      console.error("Import error:", error)
                      alert("Error importing PGN. Please check the format.")
                    }
                  }
                  reader.readAsText(file)
                }
              }
              input.click()
            }}
            style={{
              padding: "8px 16px",
              backgroundColor: "#4a90e2",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500"
            }}
          >
            Import PGN
          </button>
          <button
            onClick={() => {
              const pgn = exportToPGN(rootNodes, initialFen)
              if (pgn) {
                // Create download link
                const blob = new Blob([pgn], { type: 'text/plain' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'chess_study.pgn'
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(url)
                alert("PGN exported successfully!")
              } else {
                alert("No moves to export.")
              }
            }}
            style={{
              padding: "8px 16px",
              backgroundColor: "#28a745",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500"
            }}
          >
            Export PGN
          </button>
          <button
            onClick={() => {
              const pgn = exportToPGN(rootNodes, initialFen)
              if (pgn) {
                // Copy to clipboard
                navigator.clipboard.writeText(pgn).then(() => {
                  alert("PGN copied to clipboard!")
                }).catch(() => {
                  alert("Failed to copy to clipboard.")
                })
              } else {
                alert("No moves to export.")
              }
            }}
            style={{
              padding: "8px 16px",
              backgroundColor: "#6c757d",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500"
            }}
          >
            Copy PGN
          </button>
        </div>

        {/* Move Tree Display */}
        <div style={{
          height: "700px",
          backgroundColor: "#fff",
          border: "2px solid #ccc",
          borderRadius: "8px",
          padding: "16px",
          overflowY: "auto",
          overflowX: "auto",
          fontFamily: "monospace",
          display: "flex",
          flexDirection: "column"
        }}>
          <h3 style={{ margin: "0 0 12px 0", fontSize: "18px", fontWeight: "600" }}>Move Tree</h3>
          <div style={{ flex: "1", overflowY: "auto" }}>
            {renderTreeDisplay()}
          </div>
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
      
      {/* Dropdown Menu */}
      {dropdownMenu && (
        <>
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 999
            }}
            onClick={() => setDropdownMenu(null)}
          />
          <div
            style={{
              position: "fixed",
              top: dropdownMenu.y,
              left: dropdownMenu.x,
              backgroundColor: "#fff",
              border: "1px solid #ccc",
              borderRadius: "4px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              zIndex: 1000,
              minWidth: "150px",
              padding: "4px 0"
            }}
          >
            <button
              onClick={() => {
                setDropdownMenu(null)
                setEditingComment({ node: dropdownMenu.node })
              }}
              style={{
                width: "100%",
                padding: "8px 16px",
                textAlign: "left",
                backgroundColor: "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: "14px"
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f0f0f0"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
            >
              {dropdownMenu.node.comment ? "Edit Comment" : "Add Comment"}
            </button>
            <button
              onClick={() => {
                removeMove(dropdownMenu.node)
                setDropdownMenu(null)
              }}
              style={{
                width: "100%",
                padding: "8px 16px",
                textAlign: "left",
                backgroundColor: "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: "14px",
                color: "#d32f2f"
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#ffebee"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
            >
              Delete from here
            </button>
          </div>
        </>
      )}

    </div>
  )
}
