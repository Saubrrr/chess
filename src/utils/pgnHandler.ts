import { Chess, Move } from "chess.js"
import { MoveNode, createMoveNode } from "@/types/moveTree"

// PGN metadata structure
export interface PGNMetadata {
  Event?: string
  Site?: string
  Date?: string
  Round?: string
  White?: string
  Black?: string
  Result?: string
  Opening?: string
  ECO?: string
  ChapterName?: string
  StudyName?: string
  [key: string]: string | undefined // Allow additional tags
}

// Import result containing both moves and metadata
export interface PGNImportResult {
  rootNodes: MoveNode[]
  metadata: PGNMetadata
  errors: string[]
  warnings: string[]
}

// Export move tree to PGN format
export function exportToPGN(rootNodes: MoveNode[], initialFen?: string, metadata?: PGNMetadata): string {
  if (rootNodes.length === 0) {
    return ""
  }

  // Find main line root
  const mainRoot = rootNodes.find(r => r.isMainLine) || rootNodes[0]
  
  // Build PGN by traversing the tree recursively
  const processNode = (
    node: MoveNode,
    moveNumber: number,
    isWhite: boolean,
    inVariation: boolean = false
  ): string => {
    let result = ""
    
    // Add move number
    if (inVariation && isWhite) {
      result += `${moveNumber}.`
    } else if (inVariation && !isWhite && node === (node.parent?.children.find(c => c !== node.parent.children.find(ch => ch.isMainLine)) || null)) {
      // First move in variation
      result += `${moveNumber}...`
    } else if (!inVariation && isWhite) {
      result += `${moveNumber}.`
    }

    // Add the move
    result += ` ${node.move.san}`

    // Add comment if exists
    if (node.comment) {
      const cleanComment = node.comment.replace(/}/g, '').replace(/\n/g, ' ')
      result += ` {${cleanComment}}`
    }

    // Process children
    if (node.children.length > 1) {
      // Multiple variations - process main line first, then variations
      const mainLineChild = node.children.find(c => c.isMainLine) || node.children[0]
      const variations = node.children.filter(c => c !== mainLineChild)

      // Continue with main line
      if (mainLineChild) {
        const nextMoveNumber = isWhite ? moveNumber : moveNumber + 1
        result += processNode(mainLineChild, nextMoveNumber, !isWhite, inVariation)
      }

      // Process variations
      variations.forEach((variation) => {
        result += " ("
        const nextMoveNumber = isWhite ? moveNumber : moveNumber + 1
        result += processNode(variation, nextMoveNumber, !isWhite, true)
        result += ")"
      })
    } else if (node.children.length === 1) {
      // Single continuation
      const nextMoveNumber = isWhite ? moveNumber : moveNumber + 1
      result += processNode(node.children[0], nextMoveNumber, !isWhite, inVariation)
    }

    return result
  }

  let pgn = ""

  // Start processing from main root
  if (mainRoot) {
    // Determine if we start with white or black
    const startGame = new Chess(initialFen)
    const startIsWhite = startGame.turn() === 'w'
    
    pgn += processNode(mainRoot, 1, startIsWhite, false)
    
    // Process other root nodes as variations
    rootNodes.filter(r => r !== mainRoot).forEach((root) => {
      pgn += " ("
      const startGame2 = new Chess(initialFen)
      const rootStartIsWhite = startGame2.turn() === 'w'
      pgn += processNode(root, 1, rootStartIsWhite, true)
      pgn += ")"
    })
  }

  const moveText = pgn.trim()
  
  // Build PGN with headers
  let fullPGN = ""
  
  // Add Seven Tag Roster (required fields)
  const tags: PGNMetadata = {
    Event: metadata?.Event || "?",
    Site: metadata?.Site || "?",
    Date: metadata?.Date || "????.??.??",
    Round: metadata?.Round || "?",
    White: metadata?.White || "?",
    Black: metadata?.Black || "?",
    Result: metadata?.Result || "*",
    ...metadata
  }
  
  // Always include Seven Tag Roster first
  fullPGN += `[Event "${tags.Event || "?"}"]\n`
  fullPGN += `[Site "${tags.Site || "?"}"]\n`
  fullPGN += `[Date "${tags.Date || "????.??.??"}"]\n`
  fullPGN += `[Round "${tags.Round || "?"}"]\n`
  fullPGN += `[White "${tags.White || "?"}"]\n`
  fullPGN += `[Black "${tags.Black || "?"}"]\n`
  fullPGN += `[Result "${tags.Result || "*"}"]\n`
  
  // Add any additional tags
  Object.keys(tags).forEach(key => {
    if (!['Event', 'Site', 'Date', 'Round', 'White', 'Black', 'Result'].includes(key)) {
      const value = tags[key]
      if (value) {
        fullPGN += `[${key} "${value}"]\n`
      }
    }
  })
  
  // Add empty line between headers and move text
  fullPGN += "\n"
  
  // Add move text
  fullPGN += moveText || "*"
  
  return fullPGN
}

// Generate chapter name from PGN metadata
export function generateChapterNameFromMetadata(metadata: PGNMetadata, defaultName: string = "Untitled Chapter"): string {
  if (metadata.ChapterName) {
    return metadata.ChapterName
  }
  
  if (metadata.Opening) {
    return metadata.Opening
  }
  
  if (metadata.Event && metadata.Event !== "?") {
    return metadata.Event
  }
  
  return defaultName
}

// Parse PGN headers (tag pairs)
function parsePGNHeaders(pgn: string): { moveText: string; headers: PGNMetadata; errors: string[] } {
  const headers: PGNMetadata = {}
  let moveText = ""
  const errors: string[] = []
  
  // Split by lines
  const lines = pgn.split(/\r?\n/)
  let inHeaderSection = true
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    
    // Skip empty lines in header section
    if (inHeaderSection && line === "") {
      continue
    }
    
    // Check if this is a tag pair
    const tagMatch = line.match(/^\[(\w+)\s+"([^"]*)"\]$/)
    if (tagMatch) {
      const tagName = tagMatch[1]
      const tagValue = tagMatch[2]
      headers[tagName] = tagValue
    } else if (inHeaderSection && line !== "") {
      // First non-empty, non-tag line starts move text
      inHeaderSection = false
      moveText = lines.slice(i).join("\n")
      break
    }
  }
  
  // If no move text was found, try parsing the whole thing as move text
  if (moveText === "") {
    moveText = pgn
  }
  
  return { moveText: moveText.trim(), headers, errors }
}

// Improved move parser that handles concatenated moves
function parseMoveNumber(pgn: string, i: number): { moveNumber: number | null; newIndex: number } {
  let num = ""
  let j = i
  
  // Skip whitespace
  while (j < pgn.length && /\s/.test(pgn[j])) j++
  if (j >= pgn.length) return { moveNumber: null, newIndex: j }
  
  // Read digits
  while (j < pgn.length && /\d/.test(pgn[j])) {
    num += pgn[j]
    j++
  }
  
  // Check for dots
  if (j < pgn.length && pgn[j] === '.') {
    j++
    // Check for additional dots (for black moves like "1...")
    if (j < pgn.length && pgn[j] === '.') {
      j++
      if (j < pgn.length && pgn[j] === '.') {
        j++
      }
    }
  }
  
  return { moveNumber: num ? parseInt(num, 10) : null, newIndex: j }
}

// Improved move reader that handles concatenated moves like "e52."
function readMoveImproved(pgn: string, i: number): { move: string | null; newIndex: number } {
  let idx = i
  
  // Skip whitespace
  while (idx < pgn.length && /\s/.test(pgn[idx])) idx++
  if (idx >= pgn.length) return { move: null, newIndex: idx }
  
  // Check for result markers first
  const resultMarkers = ['1-0', '0-1', '1/2-1/2', '*']
  for (const marker of resultMarkers) {
    if (pgn.substring(idx, idx + marker.length) === marker) {
      return { move: null, newIndex: idx + marker.length } // Result marker, not a move
    }
  }
  
  // Try to parse move number first
  const { moveNumber, newIndex: afterNumber } = parseMoveNumber(pgn, idx)
  idx = afterNumber
  
  // Skip whitespace after move number
  while (idx < pgn.length && /\s/.test(pgn[idx])) idx++
  if (idx >= pgn.length) return { move: null, newIndex: idx }
  
  // Read the actual move notation
  let move = ""
  const moveStart = idx
  
  // Move notation can contain: letters, numbers, =, +, #, x, -
  // But we need to stop at whitespace, comments, variations, or when we hit another move number
  while (idx < pgn.length) {
    const char = pgn[idx]
    
    // Stop conditions
    if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
      // Whitespace - stop
      break
    }
    if (char === '{' || char === '(' || char === ')') {
      // Comment or variation - stop
      break
    }
    
    // Check if we've hit another move number pattern (digit followed by dot)
    if (/\d/.test(char) && idx + 1 < pgn.length && pgn[idx + 1] === '.') {
      // This might be the start of a new move number
      // But first check if it's part of the current move (like promotion "e8=Q")
      // Look back a bit to see if we're in the middle of a valid move notation
      if (move.length > 0 && /[a-h1-8]/.test(char)) {
        // Might be part of move, continue
        move += char
        idx++
        continue
      }
      // Otherwise, this is likely a new move number, stop
      break
    }
    
    // Valid move character
    if (/[a-h1-8NBRQKx+#=-]/.test(char) || char === 'O') {
      move += char
      idx++
    } else {
      // Unexpected character, stop
      break
    }
  }
  
  return { move: move.trim() || null, newIndex: idx }
}

// Import PGN to move tree structure with metadata
export function importFromPGN(pgn: string, initialFen?: string): PGNImportResult {
  const rootNodes: MoveNode[] = []
  const metadata: PGNMetadata = {}
  const errors: string[] = []
  const warnings: string[] = []
  
  if (!pgn || pgn.trim().length === 0) {
    errors.push("PGN text is empty")
    return { rootNodes, metadata, errors, warnings }
  }

  try {
    // Parse headers first
    const { moveText, headers, errors: headerErrors } = parsePGNHeaders(pgn)
    errors.push(...headerErrors)
    
    // Store all headers in metadata
    Object.assign(metadata, headers)
    
    // Parse moves from move text
    const parsed = parsePGNWithVariations(moveText, initialFen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", errors, warnings)
    
    if (parsed.length === 0 && moveText.trim().length > 0) {
      errors.push("No valid moves found in PGN. Please check the format.")
    }
    
    return { rootNodes: parsed, metadata, errors, warnings }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    errors.push(`Failed to parse PGN: ${errorMessage}`)
    console.error("Error parsing PGN:", error)
    return { rootNodes, metadata, errors, warnings }
  }
}

function parsePGNWithVariations(
  pgn: string, 
  startFen: string,
  errors: string[],
  warnings: string[]
): MoveNode[] {
  const rootNodes: MoveNode[] = []
  const game = new Chess(startFen)
  const startIsWhite = game.turn() === 'w'
  
  let i = 0
  let moveNumber = 1
  let isWhite = startIsWhite

  const skipWhitespace = () => {
    while (i < pgn.length && /\s/.test(pgn[i])) i++
  }

  const readComment = (): string | undefined => {
    skipWhitespace()
    if (i < pgn.length && pgn[i] === '{') {
      i++ // skip {
      let comment = ""
      let depth = 1
      while (i < pgn.length && depth > 0) {
        if (pgn[i] === '{') depth++
        else if (pgn[i] === '}') depth--
        else if (depth === 1) comment += pgn[i]
        i++
      }
      // Filter out annotations like [%cal ...], [%csl ...], etc.
      const filtered = comment
        .replace(/\[\%cal[^\]]*\]/gi, '') // Remove [%cal ...] annotations
        .replace(/\[\%csl[^\]]*\]/gi, '') // Remove [%csl ...] annotations
        .replace(/\[\%[^\]]*\]/g, '') // Remove any other [%...] annotations
        .trim()
      return filtered || undefined
    }
    return undefined
  }

  const readMove = (): string | null => {
    const { move, newIndex } = readMoveImproved(pgn, i)
    i = newIndex
    return move
  }

  // Parse a line (main line or variation)
  const parseLine = (parent: MoveNode | null, parentGame: Chess, lineIsMainLine: boolean): MoveNode | null => {
    let currentNode: MoveNode | null = null
    let currentGame = new Chess(parentGame.fen())
    let currentMoveNumber = moveNumber
    let currentIsWhite = isWhite

    skipWhitespace()

    while (i < pgn.length) {
      skipWhitespace()
      
      // Check for result markers
      if (i < pgn.length) {
        const remaining = pgn.substring(i)
        if (remaining.startsWith('1-0') || remaining.startsWith('0-1') || remaining.startsWith('1/2-1/2') || remaining.startsWith('*')) {
          // End of game
          break
        }
      }
      
      // Check for end of variation
      if (pgn[i] === ')') {
        break
      }

      // Check for start of variation (nested)
      if (pgn[i] === '(') {
        // Process nested variations
        i++ // skip (
        skipWhitespace()
        
        while (i < pgn.length && pgn[i] !== ')') {
          const variationGame = new Chess(currentGame.fen())
          const varMove = readMove()
          
          if (!varMove) {
            // Skip malformed variation
            warnings.push(`Skipping malformed variation at position ${i}`)
            while (i < pgn.length && pgn[i] !== ')') {
              if (pgn[i] === '(') {
                let depth = 1
                i++
                while (i < pgn.length && depth > 0) {
                  if (pgn[i] === '(') depth++
                  if (pgn[i] === ')') depth--
                  i++
                }
              } else {
                i++
              }
            }
            break
          }

          try {
            const moveObj = variationGame.move(varMove)
            if (moveObj) {
              const comment = readComment()
              const varNode = createMoveNode(moveObj, variationGame.fen(), currentNode || parent, false)
              if (comment) {
                varNode.comment = comment
              }
              
              if (currentNode) {
                currentNode.children.push(varNode)
              } else if (parent) {
                parent.children.push(varNode)
              }

              // Recursively parse variation
              const varMoveNum = currentIsWhite ? currentMoveNumber : currentMoveNumber + 1
              const varIsWhite = !currentIsWhite
              const savedI = i
              const savedMoveNum = moveNumber
              const savedIsWhite = isWhite
              moveNumber = varMoveNum
              isWhite = varIsWhite
              
              parseLine(varNode, variationGame, false)
              
              i = savedI
              moveNumber = savedMoveNum
              isWhite = savedIsWhite
              skipWhitespace()
              
              if (pgn[i] === ')') {
                i++
                break
              }
            }
          } catch (e) {
            warnings.push(`Invalid move in variation: ${varMove} - ${e instanceof Error ? e.message : String(e)}`)
            break
          }
        }
        
        if (pgn[i] === ')') {
          i++
          skipWhitespace()
        }
        continue
      }

      // Skip any leading comments before trying to read a move
      if (pgn[i] === '{') {
        readComment() // This will skip the comment
        skipWhitespace()
        continue // Try again to read a move after skipping the comment
      }

      const move = readMove()
      if (!move) {
        // Check if there's a comment we missed
        skipWhitespace()
        if (i < pgn.length && pgn[i] === '{') {
          readComment() // Skip this comment and try again
          skipWhitespace()
          continue
        }
        // Check if it's a result marker
        const remaining = pgn.substring(i)
        if (remaining.startsWith('1-0') || remaining.startsWith('0-1') || remaining.startsWith('1/2-1/2') || remaining.startsWith('*')) {
          break
        }
        break
      }

      const comment = readComment()

      try {
        const moveObj = currentGame.move(move)
        if (moveObj) {
          const newNode = createMoveNode(
            moveObj,
            currentGame.fen(),
            currentNode || parent,
            lineIsMainLine && (currentNode === null || (currentNode.parent === parent && lineIsMainLine))
          )
          
          if (comment) {
            newNode.comment = comment
          }

          if (currentNode) {
            currentNode.children.push(newNode)
          } else if (parent) {
            parent.children.push(newNode)
          } else {
            rootNodes.push(newNode)
          }

          currentNode = newNode
          currentMoveNumber = currentIsWhite ? currentMoveNumber : currentMoveNumber + 1
          currentIsWhite = !currentIsWhite
        } else {
          errors.push(`Invalid move: ${move}`)
          break
        }
      } catch (e) {
        errors.push(`Failed to parse move "${move}": ${e instanceof Error ? e.message : String(e)}`)
        break
      }

      skipWhitespace()
    }

    moveNumber = currentMoveNumber
    isWhite = currentIsWhite
    return currentNode
  }

  // Parse main line
  const mainRoot = parseLine(null, game, true)
  
  // Parse other root variations
  skipWhitespace()
  while (i < pgn.length && pgn[i] === '(') {
    i++ // skip (
    const rootGame = new Chess(startFen)
    const varMove = readMove()
    
    if (varMove) {
      try {
        const moveObj = rootGame.move(varMove)
        if (moveObj) {
          const comment = readComment()
          const varRootNode = createMoveNode(moveObj, rootGame.fen(), null, false)
          if (comment) {
            varRootNode.comment = comment
          }
          rootNodes.push(varRootNode)
          
          const varMoveNum = startIsWhite ? 1 : 1
          const varIsWhite = !startIsWhite
          moveNumber = varMoveNum
          isWhite = varIsWhite
          
          parseLine(varRootNode, rootGame, false)
          
          skipWhitespace()
          if (pgn[i] === ')') i++
        }
      } catch (e) {
        warnings.push(`Skipping invalid root variation: ${e instanceof Error ? e.message : String(e)}`)
        while (i < pgn.length && pgn[i] !== ')') i++
        if (i < pgn.length) i++
      }
    } else {
      while (i < pgn.length && pgn[i] !== ')') i++
      if (i < pgn.length) i++
    }
    skipWhitespace()
  }

  // If we have a main root, put it first
  if (mainRoot && !rootNodes.includes(mainRoot)) {
    rootNodes.unshift(mainRoot)
  }

  return rootNodes
}

