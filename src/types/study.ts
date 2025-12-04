import { MoveNode } from "./moveTree"
import { PGNMetadata } from "@/utils/pgnHandler"

// A Game represents a single chess game with moves and variations
export interface Game {
  id: string
  name: string
  rootNodes: MoveNode[]
  initialFen: string
  metadata?: PGNMetadata
  createdAt: string
  updatedAt: string
}

// A Chapter contains a single game
export interface Chapter {
  id: string
  name: string
  game: Game
  createdAt: string
  updatedAt: string
}

// A Study contains multiple chapters
export interface Study {
  id: string
  name: string
  chapters: Chapter[]
  createdAt: string
  updatedAt: string
}

// Storage structure containing all studies
export interface StudyDatabase {
  studies: Study[]
}

// Maximum number of studies allowed
export const MAX_STUDIES = 20

