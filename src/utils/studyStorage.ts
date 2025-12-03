import { Study, StudyDatabase, MAX_STUDIES, Chapter, Game } from "@/types/study"
import { MoveNode } from "@/types/moveTree"

const STORAGE_KEY = "chess_studies"

// Load all studies from localStorage
export function loadStudies(): Study[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) return []
    
    const database: StudyDatabase = JSON.parse(data)
    return database.studies || []
  } catch (error) {
    console.error("Error loading studies:", error)
    return []
  }
}

// Save all studies to localStorage
export function saveStudies(studies: Study[]): boolean {
  try {
    // Enforce maximum studies limit
    if (studies.length > MAX_STUDIES) {
      console.warn(`Maximum ${MAX_STUDIES} studies allowed. Truncating...`)
      studies = studies.slice(0, MAX_STUDIES)
    }
    
    const database: StudyDatabase = { studies }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(database))
    return true
  } catch (error) {
    console.error("Error saving studies:", error)
    return false
  }
}

// Create a new study
export function createStudy(name: string): Study {
  const now = new Date().toISOString()
  return {
    id: Math.random().toString(36).substr(2, 9),
    name,
    chapters: [],
    createdAt: now,
    updatedAt: now
  }
}

// Create a new chapter
export function createChapter(name: string): Chapter {
  const now = new Date().toISOString()
  return {
    id: Math.random().toString(36).substr(2, 9),
    name,
    game: {
      id: Math.random().toString(36).substr(2, 9),
      name: name,
      rootNodes: [],
      initialFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      createdAt: now,
      updatedAt: now
    },
    createdAt: now,
    updatedAt: now
  }
}

// Get a study by ID
export function getStudyById(studyId: string): Study | null {
  const studies = loadStudies()
  return studies.find(s => s.id === studyId) || null
}

// Update a study
export function updateStudy(updatedStudy: Study): boolean {
  const studies = loadStudies()
  const index = studies.findIndex(s => s.id === updatedStudy.id)
  
  if (index === -1) return false
  
  updatedStudy.updatedAt = new Date().toISOString()
  studies[index] = updatedStudy
  return saveStudies(studies)
}

// Delete a study
export function deleteStudy(studyId: string): boolean {
  const studies = loadStudies()
  const filtered = studies.filter(s => s.id !== studyId)
  
  if (filtered.length === studies.length) return false
  
  return saveStudies(filtered)
}

// Add a study
export function addStudy(study: Study): boolean {
  const studies = loadStudies()
  
  if (studies.length >= MAX_STUDIES) {
    return false
  }
  
  studies.push(study)
  return saveStudies(studies)
}

// Update a chapter in a study
export function updateChapterInStudy(studyId: string, chapterId: string, updatedChapter: Chapter): boolean {
  const study = getStudyById(studyId)
  if (!study) return false
  
  const index = study.chapters.findIndex(c => c.id === chapterId)
  if (index === -1) return false
  
  updatedChapter.updatedAt = new Date().toISOString()
  updatedChapter.game.updatedAt = new Date().toISOString()
  study.chapters[index] = updatedChapter
  study.updatedAt = new Date().toISOString()
  
  return updateStudy(study)
}

// Add a chapter to a study
export function addChapterToStudy(studyId: string, chapter: Chapter): boolean {
  const study = getStudyById(studyId)
  if (!study) return false
  
  study.chapters.push(chapter)
  study.updatedAt = new Date().toISOString()
  
  return updateStudy(study)
}

// Delete a chapter from a study
export function deleteChapterFromStudy(studyId: string, chapterId: string): boolean {
  const study = getStudyById(studyId)
  if (!study) return false
  
  study.chapters = study.chapters.filter(c => c.id !== chapterId)
  study.updatedAt = new Date().toISOString()
  
  return updateStudy(study)
}

// Get a chapter by ID
export function getChapterById(studyId: string, chapterId: string): Chapter | null {
  const study = getStudyById(studyId)
  if (!study) return null
  
  return study.chapters.find(c => c.id === chapterId) || null
}

// Helper to serialize MoveNode for storage (since it has circular references)
export function serializeGameForStorage(rootNodes: MoveNode[], initialFen: string): any {
  // Simple serialization - we'll store the PGN string representation
  // For now, we'll store a simplified version
  return {
    rootNodes: rootNodes.map(node => serializeNode(node)),
    initialFen
  }
}

// Helper to serialize a single node
function serializeNode(node: MoveNode): any {
  return {
    id: node.id,
    move: {
      san: node.move.san,
      from: node.move.from,
      to: node.move.to,
      color: node.move.color,
      flags: node.move.flags,
      piece: node.move.piece,
      captured: node.move.captured,
      promotion: node.move.promotion
    },
    fen: node.fen,
    isMainLine: node.isMainLine,
    comment: node.comment,
    children: node.children.map(child => serializeNode(child))
  }
}

// Helper to deserialize nodes from storage
export function deserializeGameFromStorage(data: any): { rootNodes: MoveNode[], initialFen: string } {
  if (!data || !data.rootNodes) {
    return { rootNodes: [], initialFen: data?.initialFen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" }
  }
  
  return {
    rootNodes: data.rootNodes.map((nodeData: any) => deserializeNode(nodeData, null)),
    initialFen: data.initialFen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
  }
}

// Helper to deserialize a single node
function deserializeNode(nodeData: any, parent: MoveNode | null): MoveNode {
  const node: MoveNode = {
    id: nodeData.id,
    move: nodeData.move,
    fen: nodeData.fen,
    parent: parent,
    children: [],
    isMainLine: nodeData.isMainLine || false,
    comment: nodeData.comment
  }
  
  // Recursively deserialize children
  if (nodeData.children && Array.isArray(nodeData.children)) {
    node.children = nodeData.children.map((childData: any) => deserializeNode(childData, node))
  }
  
  return node
}

