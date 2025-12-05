// src/utils/pgnUtils.ts
/**
 * PGN Import/Export Utilities for MoveNode DFS Tree Structure
 *
 * Features:
 * - Robust tokenizer that handles edge cases (comments with punctuation, NAGs, variations)
 * - Proper handling of comments appearing before moves (like Lichess study annotations)
 * - chess.js integration for FEN calculation and move validation
 * - Full export support with proper variation formatting
 *
 * Compatible with Lichess Study PGNs and chess.com formats
 */

import { Chess, Move } from "chess.js"
import { MoveNode, createMoveNode } from "@/types/moveTree"

// ============================================================================
// TYPES
// ============================================================================

/** PGN metadata structure */
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
  FEN?: string
  [key: string]: string | undefined
}

/** Import result containing both moves and metadata */
export interface PGNImportResult {
  rootNodes: MoveNode[]
  metadata: PGNMetadata
  errors: string[]
  warnings: string[]
}

/** Token types for lexer */
type TokenType =
  | "MOVE"
  | "MOVE_NUMBER"
  | "COMMENT"
  | "NAG"
  | "VARIATION_START"
  | "VARIATION_END"
  | "RESULT"

interface Token {
  type: TokenType
  value: string
}

// ============================================================================
// TOKENIZER
// ============================================================================

/**
 * Robust PGN tokenizer that properly handles:
 * - Comments with moves and punctuation inside (e.g., "{ e4. e5. Vienna Game }")
 * - NAGs in both symbolic (!, ??, !?) and numeric ($1, $2) forms
 * - Nested variations
 * - Move numbers with dots
 * - Castling (O-O, O-O-O)
 * - Check/checkmate symbols (+, #)
 * - Promotion (e8=Q)
 */
function tokenizePgn(pgn: string): { tags: PGNMetadata; tokens: Token[] } {
  const tags: PGNMetadata = {}
  const tokens: Token[] = []

  // First, extract header tags
  const tagRegex = /\[(\w+)\s+"([^"]*)"\]/g
  let tagMatch: RegExpExecArray | null
  let lastTagEnd = 0

  while ((tagMatch = tagRegex.exec(pgn)) !== null) {
    tags[tagMatch[1]] = tagMatch[2]
    lastTagEnd = tagMatch.index + tagMatch[0].length
  }

  // Get the movetext portion (after all tags)
  const movetext = pgn.slice(lastTagEnd).trim()

  let i = 0

  while (i < movetext.length) {
    const char = movetext[i]

    // Skip whitespace
    if (/\s/.test(char)) {
      i++
      continue
    }

    // Comment: { ... }
    if (char === "{") {
      const endBrace = movetext.indexOf("}", i + 1)
      if (endBrace === -1) {
        // Unclosed comment - take rest of string
        const commentText = movetext.slice(i + 1).trim()
        tokens.push({ type: "COMMENT", value: filterComment(commentText) })
        break
      }
      const commentText = movetext.slice(i + 1, endBrace).trim()
      if (commentText) {
        tokens.push({ type: "COMMENT", value: filterComment(commentText) })
      }
      i = endBrace + 1
      continue
    }

    // Line comment: ; ... (until newline)
    if (char === ";") {
      const endLine = movetext.indexOf("\n", i + 1)
      const commentEnd = endLine === -1 ? movetext.length : endLine
      const commentText = movetext.slice(i + 1, commentEnd).trim()
      if (commentText) {
        tokens.push({ type: "COMMENT", value: filterComment(commentText) })
      }
      i = commentEnd + 1
      continue
    }

    // Variation start
    if (char === "(") {
      tokens.push({ type: "VARIATION_START", value: "(" })
      i++
      continue
    }

    // Variation end
    if (char === ")") {
      tokens.push({ type: "VARIATION_END", value: ")" })
      i++
      continue
    }

    // NAG: $N format
    if (char === "$") {
      let j = i + 1
      while (j < movetext.length && /\d/.test(movetext[j])) {
        j++
      }
      if (j > i + 1) {
        tokens.push({ type: "NAG", value: movetext.slice(i, j) })
        i = j
        continue
      }
    }

    // Result: 1-0, 0-1, 1/2-1/2, *
    const resultMatch = movetext.slice(i).match(/^(1-0|0-1|1\/2-1\/2|\*)(?:\s|$|[)\s])/)
    if (resultMatch) {
      tokens.push({ type: "RESULT", value: resultMatch[1] })
      i += resultMatch[1].length
      continue
    }

    // Move number: N. or N...
    const moveNumMatch = movetext.slice(i).match(/^(\d+)(\.\.\.|\.)/)
    if (moveNumMatch) {
      tokens.push({ type: "MOVE_NUMBER", value: moveNumMatch[1] })
      i += moveNumMatch[0].length
      continue
    }

    // Symbolic NAGs: !!, !?, ?!, ??, !, ?
    const symbolicNagMatch = movetext.slice(i).match(/^(\?\?|\?!|!\?|!!|\?|!)/)
    if (symbolicNagMatch) {
      tokens.push({ type: "NAG", value: symbolicNagMatch[1] })
      i += symbolicNagMatch[1].length
      continue
    }

    // SAN Move
    // This regex handles:
    // - Pawn moves: e4, d5, exd5, e8=Q
    // - Piece moves: Nf3, Bxc6, Qh4+, Rfe1
    // - Castling: O-O, O-O-O (also handles 0-0, 0-0-0)
    // - With check/checkmate: +, #
    // - With capture: x
    // - With disambiguation: Nbd2, R1e1, Qh4e1
    const sanRegex =
      /^(O-O-O|O-O|0-0-0|0-0|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?)/i
    const sanMatch = movetext.slice(i).match(sanRegex)

    if (sanMatch && sanMatch[1]) {
      let san = sanMatch[1]
      // Normalize castling notation (0-0 -> O-O)
      san = san.replace(/0-0-0/g, "O-O-O").replace(/0-0/g, "O-O")
      tokens.push({ type: "MOVE", value: san })
      i += sanMatch[1].length
      continue
    }

    // Skip unknown characters (be lenient)
    i++
  }

  return { tags, tokens }
}

/**
 * Filter Lichess-specific annotations from comments
 */
function filterComment(comment: string): string {
  return comment
    .replace(/\[\%cal[^\]]*\]/gi, "")
    .replace(/\[\%csl[^\]]*\]/gi, "")
    .replace(/\[\%[^\]]*\]/g, "")
    .trim()
}

// ============================================================================
// AST BUILDER
// ============================================================================

interface AstNode {
  type: "MOVE" | "VARIATION"
  san?: string
  nags?: string[]
  comment?: string
  children?: AstNode[]
}

/**
 * Build an AST from tokens, properly handling nested variations.
 *
 * PGN variation semantics:
 * - A variation `(...)` appears AFTER a move and represents alternatives to that move
 * - Example: `1. e4 e5 2. Nf3 Nc6 (2... Nf6 3. Nxe5)`
 *   - The variation `(2... Nf6...)` is an ALTERNATIVE to `Nc6`
 *   - Both `Nc6` and `Nf6` branch from the position after `Nf3`
 */
function buildAst(tokens: Token[]): { ast: AstNode[]; result?: string } {
  const ast: AstNode[] = []
  let result: string | undefined
  let i = 0

  // Pending comment/NAGs to attach to next move
  let pendingComment: string | undefined
  let pendingNags: string[] = []

  function parseSequence(nodes: AstNode[]): void {
    while (i < tokens.length) {
      const token = tokens[i]

      if (token.type === "VARIATION_END") {
        return
      }

      if (token.type === "COMMENT") {
        if (nodes.length > 0 && nodes[nodes.length - 1].type === "MOVE") {
          // Attach to previous move
          nodes[nodes.length - 1].comment = token.value
        } else {
          // Comment before any move - save as pending
          pendingComment = token.value
        }
        i++
        continue
      }

      if (token.type === "NAG") {
        if (nodes.length > 0 && nodes[nodes.length - 1].type === "MOVE") {
          const lastMove = nodes[nodes.length - 1]
          if (!lastMove.nags) lastMove.nags = []
          lastMove.nags.push(token.value)
        } else {
          pendingNags.push(token.value)
        }
        i++
        continue
      }

      if (token.type === "MOVE_NUMBER") {
        i++
        continue
      }

      if (token.type === "RESULT") {
        result = token.value
        i++
        continue
      }

      if (token.type === "MOVE") {
        const moveNode: AstNode = {
          type: "MOVE",
          san: token.value,
          children: []
        }

        if (pendingComment) {
          moveNode.comment = pendingComment
          pendingComment = undefined
        }
        if (pendingNags.length > 0) {
          moveNode.nags = pendingNags
          pendingNags = []
        }

        nodes.push(moveNode)
        i++
        continue
      }

      if (token.type === "VARIATION_START") {
        i++ // consume '('

        const variationNodes: AstNode[] = []
        parseSequence(variationNodes)

        // Attach variation to the PREVIOUS move
        // The variation represents an alternative to what comes AFTER that move
        if (nodes.length > 0 && nodes[nodes.length - 1].type === "MOVE") {
          if (!nodes[nodes.length - 1].children) {
            nodes[nodes.length - 1].children = []
          }
          nodes[nodes.length - 1].children!.push({
            type: "VARIATION",
            children: variationNodes
          })
        }

        if (i < tokens.length && tokens[i].type === "VARIATION_END") {
          i++
        }
        continue
      }

      i++
    }
  }

  parseSequence(ast)

  return { ast, result }
}

// ============================================================================
// MOVE NODE TREE BUILDER
// ============================================================================

/**
 * Convert parsed PGN AST to MoveNode DFS tree structure.
 * Uses chess.js for move validation and FEN calculation.
 */
function astToMoveTree(
  ast: AstNode[],
  startFen: string,
  errors: string[],
  warnings: string[]
): MoveNode[] {
  const roots: MoveNode[] = []

  function processSequence(
    astNodes: AstNode[],
    parentNode: MoveNode | null,
    startingFen: string,
    isMainLine: boolean
  ): MoveNode | null {
    let currentParent: MoveNode | null = parentNode
    let currentFen = startingFen

    for (const node of astNodes) {
      if (node.type === "MOVE" && node.san) {
        const chess = new Chess(currentFen)
        let move: Move | null = null

        try {
          move = chess.move(node.san)
        } catch {
          // Try without check/checkmate symbols
          try {
            const cleanSan = node.san.replace(/[+#]$/, "")
            move = chess.move(cleanSan)
          } catch {
            // Give up
          }
        }

        if (!move) {
          errors.push(`Invalid move: ${node.san} at position`)
          continue
        }

        const newFen = chess.fen()

        const moveNode = createMoveNode(move, newFen, currentParent, isMainLine)

        if (node.comment) {
          moveNode.comment = node.comment
        }

        // Attach to parent or roots
        if (currentParent) {
          currentParent.children.push(moveNode)
        } else {
          roots.push(moveNode)
        }

        // Process variations attached to this AST node
        // These variations branch from currentFen (BEFORE this move was made)
        // They are alternatives to THIS move
        if (node.children && node.children.length > 0) {
          for (const variation of node.children) {
            if (variation.type === "VARIATION" && variation.children) {
              processSequence(
                variation.children,
                currentParent, // Same parent - sibling of this move
                currentFen, // Same starting position
                false // Not main line
              )
            }
          }
        }

        currentParent = moveNode
        currentFen = newFen
      } else if (node.type === "VARIATION" && node.children) {
        processSequence(node.children, currentParent, currentFen, false)
      }
    }

    return currentParent
  }

  processSequence(ast, null, startFen, true)

  return roots
}

// ============================================================================
// PGN IMPORT
// ============================================================================

/**
 * Import PGN to move tree structure with metadata
 */
export function importFromPGN(
  pgn: string,
  initialFen?: string
): PGNImportResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (!pgn || pgn.trim().length === 0) {
    errors.push("PGN text is empty")
    return { rootNodes: [], metadata: {}, errors, warnings }
  }

  try {
    // Tokenize
    const { tags, tokens } = tokenizePgn(pgn)

    // Build AST
    const { ast, result } = buildAst(tokens)

    // Determine starting FEN
    const defaultStartFen =
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    const headerFen = (tags.FEN || "").trim()
    const startFen = headerFen || initialFen || defaultStartFen

    // Convert to MoveNode tree
    const rootNodes = astToMoveTree(ast, startFen, errors, warnings)

    // Build metadata
    const metadata: PGNMetadata = { ...tags }
    if (result) {
      metadata.Result = result
    }

    if (rootNodes.length === 0 && tokens.some(t => t.type === "MOVE")) {
      errors.push("No valid moves found in PGN. Please check the format.")
    }

    return { rootNodes, metadata, errors, warnings }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    errors.push(`Failed to parse PGN: ${msg}`)
    console.error("Error parsing PGN:", err)
    return { rootNodes: [], metadata: {}, errors, warnings }
  }
}

// ============================================================================
// PGN EXPORT
// ============================================================================

/**
 * Convert NAG to symbolic form for export
 */
function nagToSymbol(nag: string): string {
  const nagMap: Record<string, string> = {
    $1: "!",
    $2: "?",
    $3: "!!",
    $4: "??",
    $5: "!?",
    $6: "?!"
  }
  return nagMap[nag] || nag
}

/**
 * Export move tree to PGN format
 */
export function exportToPGN(
  rootNodes: MoveNode[],
  initialFen?: string,
  metadata?: PGNMetadata
): string {
  if (rootNodes.length === 0) {
    return ""
  }

  const defaultFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
  const startFen = initialFen || defaultFen

  // Find main line root
  const mainRoot = rootNodes.find(r => r.isMainLine) || rootNodes[0]

  const parts: string[] = []

  /**
   * Get move info from parent FEN
   */
  function getMoveInfo(node: MoveNode): { moveNum: number; isWhite: boolean } {
    const parentFen = node.parent?.fen || startFen
    const fenParts = parentFen.split(" ")
    const turnBefore = fenParts[1] || "w"
    const fullMoves = parseInt(fenParts[5]) || 1

    return {
      moveNum: fullMoves,
      isWhite: turnBefore === "w"
    }
  }

  /**
   * Format a single move with optional move number
   */
  function formatMove(node: MoveNode, forceNumber: boolean = false): string {
    const { moveNum, isWhite } = getMoveInfo(node)
    let result = ""

    if (isWhite) {
      result = `${moveNum}. `
    } else if (forceNumber) {
      result = `${moveNum}... `
    }

    result += node.move.san

    return result
  }

  /**
   * Export a complete line recursively (used for variations)
   */
  function exportLineRecursive(node: MoveNode, needsMoveNumber: boolean): void {
    parts.push(formatMove(node, needsMoveNumber))

    if (node.comment) {
      const cleanComment = node.comment.replace(/}/g, "").replace(/\n/g, " ")
      parts.push(`{ ${cleanComment} }`)
    }

    if (node.children.length === 0) {
      return
    }

    const mainChild =
      node.children.find(c => c.isMainLine) || node.children[0]
    const variations = node.children.filter(c => c !== mainChild)

    // Handle nested variations
    for (const variation of variations) {
      parts.push("(")
      exportLineRecursive(variation, true)
      parts.push(")")
    }

    // Continue the line
    exportLineRecursive(mainChild, variations.length > 0)
  }

  /**
   * Export from a node, handling its children properly
   */
  function exportFromNode(
    node: MoveNode,
    forceNextMoveNumber: boolean = false
  ): void {
    if (node.children.length === 0) {
      return
    }

    const mainChild =
      node.children.find(c => c.isMainLine) || node.children[0]
    const variations = node.children.filter(c => c !== mainChild)

    const needsNumber = forceNextMoveNumber || variations.length > 0

    parts.push(formatMove(mainChild, needsNumber))

    if (mainChild.comment) {
      const cleanComment = mainChild.comment
        .replace(/}/g, "")
        .replace(/\n/g, " ")
      parts.push(`{ ${cleanComment} }`)
    }

    // Output variations
    for (const variation of variations) {
      parts.push("(")
      exportLineRecursive(variation, true)
      parts.push(")")
    }

    // Continue
    exportFromNode(mainChild, variations.length > 0)
  }

  // Export from roots
  if (rootNodes.length > 0) {
    const altRoots = rootNodes.filter(r => r !== mainRoot)

    // Export main root
    parts.push(formatMove(mainRoot, true))

    if (mainRoot.comment) {
      const cleanComment = mainRoot.comment
        .replace(/}/g, "")
        .replace(/\n/g, " ")
      parts.push(`{ ${cleanComment} }`)
    }

    // Export alternative first moves as variations
    for (const alt of altRoots) {
      parts.push("(")
      exportLineRecursive(alt, true)
      parts.push(")")
    }

    // Continue main line from root
    exportFromNode(mainRoot)
  }

  // Add result
  const resultValue = metadata?.Result || "*"
  parts.push(resultValue)

  // Format movetext
  const moveText = parts
    .join(" ")
    .replace(/\(\s+/g, "( ")
    .replace(/\s+\)/g, " )")
    .replace(/\s+/g, " ")
    .trim()

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
    Result: resultValue,
    ...metadata
  }

  fullPGN += `[Event "${tags.Event || "?"}"]\n`
  fullPGN += `[Site "${tags.Site || "?"}"]\n`
  fullPGN += `[Date "${tags.Date || "????.??.??"}"]\n`
  fullPGN += `[Round "${tags.Round || "?"}"]\n`
  fullPGN += `[White "${tags.White || "?"}"]\n`
  fullPGN += `[Black "${tags.Black || "?"}"]\n`
  fullPGN += `[Result "${tags.Result || "*"}"]\n`

  // Add any additional tags
  Object.keys(tags).forEach(key => {
    if (
      !["Event", "Site", "Date", "Round", "White", "Black", "Result"].includes(
        key
      )
    ) {
      const value = tags[key]
      if (value) {
        fullPGN += `[${key} "${value}"]\n`
      }
    }
  })

  fullPGN += "\n"
  fullPGN += moveText

  return fullPGN
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate chapter name from PGN metadata
 */
export function generateChapterNameFromMetadata(
  metadata: PGNMetadata,
  defaultName: string = "Untitled Chapter"
): string {
  if (metadata.ChapterName) return metadata.ChapterName
  if (metadata.Opening) return metadata.Opening
  if (metadata.Event && metadata.Event !== "?") return metadata.Event
  return defaultName
}