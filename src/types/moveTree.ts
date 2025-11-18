import { Move } from "chess.js"

export interface MoveNode {
  id: string
  move: Move
  fen: string
  parent: MoveNode | null
  children: MoveNode[]
  isMainLine: boolean
}

export function createMoveNode(
  move: Move,
  fen: string,
  parent: MoveNode | null,
  isMainLine: boolean = true
): MoveNode {
  return {
    id: Math.random().toString(36).substr(2, 9),
    move,
    fen,
    parent,
    children: [],
    isMainLine
  }
}

export function getPathToNode(node: MoveNode | null): MoveNode[] {
  if (!node) return []
  
  const path: MoveNode[] = []
  let current: MoveNode | null = node
  
  while (current) {
    path.unshift(current)
    current = current.parent
  }
  
  return path
}

export function getMainLine(root: MoveNode | null): MoveNode[] {
  if (!root) return []
  
  const mainLine: MoveNode[] = [root]
  let current = root
  
  while (current.children.length > 0) {
    const nextMainMove = current.children.find(child => child.isMainLine) || current.children[0]
    mainLine.push(nextMainMove)
    current = nextMainMove
  }
  
  return mainLine
}

export interface TreeLine {
  node: MoveNode | null
  moveNumber: number
  isWhite: boolean
  depth: number
  isLastInGroup: boolean
  hasMoreSiblings: boolean
}

export function buildTreeDisplay(rootNodes: MoveNode[], currentNode: MoveNode | null): TreeLine[] {
  const lines: TreeLine[] = []
  
  // Build tree structure recursively
  function processNode(node: MoveNode, depth: number, moveNumber: number, isWhite: boolean, isLastSibling: boolean) {
    lines.push({
      node,
      moveNumber,
      isWhite,
      depth,
      isLastInGroup: isLastSibling && node.children.length === 0,
      hasMoreSiblings: !isLastSibling
    })
    
    // Process children
    if (node.children.length > 0) {
      const mainLineChild = node.children.find(c => c.isMainLine) || node.children[0]
      const variations = node.children.filter(c => c !== mainLineChild)
      
      // Process main line first
      const nextMoveNumber = !isWhite ? moveNumber + 1 : moveNumber
      processNode(mainLineChild, depth, nextMoveNumber, !isWhite, variations.length === 0)
      
      // Process variations
      variations.forEach((variation, index) => {
        processNode(variation, depth + 1, nextMoveNumber, !isWhite, index === variations.length - 1)
      })
    }
  }
  
  // Process all root nodes
  rootNodes.forEach((root, index) => {
    processNode(root, 0, 1, true, index === rootNodes.length - 1)
  })
  
  return lines
}

