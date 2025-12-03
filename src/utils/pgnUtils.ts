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
  [key: string]: string | undefined // Allow additional tags
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

// Import result containing both moves and metadata
export interface PGNImportResult {
  rootNodes: MoveNode[]
  metadata: PGNMetadata
}

// Import PGN to move tree structure with metadata
export function importFromPGN(pgn: string, initialFen?: string): PGNImportResult {
  const rootNodes: MoveNode[] = []
  const metadata: PGNMetadata = {}
  
  if (!pgn || pgn.trim().length === 0) {
    return { rootNodes, metadata }
  }

  try {
    // Parse headers first
    const { moveText, headers } = parsePGNHeaders(pgn)
    
    // Store all headers in metadata
    Object.assign(metadata, headers)
    
    // Parse moves from move text
    const parsed = parsePGNWithVariations(moveText, initialFen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")
    
    return { rootNodes: parsed, metadata }
  } catch (error) {
    console.error("Error parsing PGN:", error)
    return { rootNodes, metadata }
  }
}

// Parse PGN headers (tag pairs)
function parsePGNHeaders(pgn: string): { moveText: string; headers: PGNMetadata } {
  const headers: PGNMetadata = {}
  let moveText = ""
  
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
  
  return { moveText: moveText.trim(), headers }
}

interface ParsedMove {
  moveNumber: number
  isWhite: boolean
  san: string
  comment?: string
  variations?: ParsedMove[][]
}

function parsePGNWithVariations(pgn: string, startFen: string): MoveNode[] {
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
      return comment.trim()
    }
    return undefined
  }

  const readMove = (): string | null => {
    skipWhitespace()
    if (i >= pgn.length) return null

    // Skip move number (e.g., "1." or "1...")
    while (i < pgn.length && /[\d.]/.test(pgn[i])) i++
    skipWhitespace()
    if (i >= pgn.length) return null

    // Read move notation (until space, comment, variation, or end)
    let move = ""
    while (i < pgn.length && !/\s/.test(pgn[i]) && pgn[i] !== '{' && pgn[i] !== '(' && pgn[i] !== ')') {
      move += pgn[i]
      i++
    }
    
    return move.trim() || null
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
            // Invalid move, skip
            break
          }
        }
        
        if (pgn[i] === ')') {
          i++
          skipWhitespace()
        }
        continue
      }

      const move = readMove()
      if (!move) break

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
          break
        }
      } catch (e) {
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
        // Skip invalid variation
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

