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

