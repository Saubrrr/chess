import { useState, useEffect } from "react"
import { Study, Chapter } from "@/types/study"
import { loadStudies, createStudy, addStudy, deleteStudy, MAX_STUDIES } from "@/utils/studyStorage"

interface StudyManagerProps {
  onSelectChapter: (studyId: string, chapterId: string) => void
  onClose: () => void
}

export default function StudyManager({ onSelectChapter, onClose }: StudyManagerProps) {
  const [studies, setStudies] = useState<Study[]>([])
  const [expandedStudy, setExpandedStudy] = useState<string | null>(null)
  const [showCreateStudy, setShowCreateStudy] = useState(false)
  const [newStudyName, setNewStudyName] = useState("")

  useEffect(() => {
    refreshStudies()
  }, [])

  const refreshStudies = () => {
    const loadedStudies = loadStudies()
    setStudies(loadedStudies)
  }

  const handleCreateStudy = () => {
    if (!newStudyName.trim()) {
      alert("Please enter a study name")
      return
    }

    if (studies.length >= MAX_STUDIES) {
      alert(`Maximum ${MAX_STUDIES} studies allowed. Please delete a study first.`)
      return
    }

    const newStudy = createStudy(newStudyName.trim())
    if (addStudy(newStudy)) {
      refreshStudies()
      setNewStudyName("")
      setShowCreateStudy(false)
    } else {
      alert("Failed to create study. Maximum limit reached.")
    }
  }

  const handleDeleteStudy = (studyId: string, studyName: string) => {
    if (confirm(`Are you sure you want to delete "${studyName}"? This will delete all chapters and games in this study.`)) {
      if (deleteStudy(studyId)) {
        refreshStudies()
        if (expandedStudy === studyId) {
          setExpandedStudy(null)
        }
      } else {
        alert("Failed to delete study")
      }
    }
  }

  const handleSelectChapter = (studyId: string, chapterId: string) => {
    onSelectChapter(studyId, chapterId)
    onClose()
  }

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: "#fff",
        borderRadius: "8px",
        padding: "24px",
        maxWidth: "600px",
        width: "90%",
        maxHeight: "80vh",
        overflowY: "auto",
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)"
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px"
        }}>
          <h2 style={{ margin: 0, fontSize: "24px", fontWeight: "600" }}>Saved Studies</h2>
          <button
            onClick={onClose}
            style={{
              padding: "6px 12px",
              backgroundColor: "#f0f0f0",
              border: "1px solid #ccc",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "14px"
            }}
          >
            Close
          </button>
        </div>

        {studies.length === 0 && !showCreateStudy && (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "#666" }}>
            <p>No studies yet. Create your first study!</p>
          </div>
        )}

        {/* Create Study Form */}
        {showCreateStudy && (
          <div style={{
            marginBottom: "20px",
            padding: "16px",
            backgroundColor: "#f9f9f9",
            borderRadius: "4px"
          }}>
            <input
              type="text"
              value={newStudyName}
              onChange={(e) => setNewStudyName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateStudy()
                if (e.key === "Escape") {
                  setShowCreateStudy(false)
                  setNewStudyName("")
                }
              }}
              placeholder="Enter study name"
              autoFocus
              style={{
                width: "100%",
                padding: "8px 12px",
                fontSize: "14px",
                border: "1px solid #ccc",
                borderRadius: "4px",
                marginBottom: "8px"
              }}
            />
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={handleCreateStudy}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#4a90e2",
                  color: "#fff",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "14px"
                }}
              >
                Create
              </button>
              <button
                onClick={() => {
                  setShowCreateStudy(false)
                  setNewStudyName("")
                }}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#f0f0f0",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "14px"
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Studies List */}
        <div style={{ marginBottom: "16px" }}>
          {studies.map((study) => (
            <div
              key={study.id}
              style={{
                border: "1px solid #ccc",
                borderRadius: "4px",
                marginBottom: "8px",
                overflow: "hidden"
              }}
            >
              <div
                style={{
                  padding: "12px",
                  backgroundColor: expandedStudy === study.id ? "#f0f0f0" : "#fff",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}
                onClick={() => setExpandedStudy(expandedStudy === study.id ? null : study.id)}
              >
                <div>
                  <div style={{ fontWeight: "600", fontSize: "16px" }}>{study.name}</div>
                  <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
                    {study.chapters.length} chapter{study.chapters.length !== 1 ? 's' : ''}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteStudy(study.id, study.name)
                    }}
                    style={{
                      padding: "4px 8px",
                      backgroundColor: "#dc3545",
                      color: "#fff",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "12px"
                    }}
                  >
                    Delete
                  </button>
                  <span style={{ fontSize: "18px" }}>
                    {expandedStudy === study.id ? "▼" : "▶"}
                  </span>
                </div>
              </div>

              {/* Chapters List */}
              {expandedStudy === study.id && (
                <div style={{
                  borderTop: "1px solid #ccc",
                  backgroundColor: "#fafafa",
                  padding: "8px"
                }}>
                  {study.chapters.length === 0 ? (
                    <div style={{ padding: "16px", textAlign: "center", color: "#666", fontSize: "14px" }}>
                      No chapters yet. Open this study to create chapters.
                    </div>
                  ) : (
                    study.chapters.map((chapter) => (
                      <div
                        key={chapter.id}
                        onClick={() => handleSelectChapter(study.id, chapter.id)}
                        style={{
                          padding: "10px",
                          marginBottom: "4px",
                          backgroundColor: "#fff",
                          border: "1px solid #ddd",
                          borderRadius: "4px",
                          cursor: "pointer",
                          transition: "background-color 0.15s"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#e9ecef"
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "#fff"
                        }}
                      >
                        <div style={{ fontWeight: "500", fontSize: "14px" }}>{chapter.name}</div>
                        <div style={{ fontSize: "12px", color: "#666", marginTop: "2px" }}>
                          {chapter.game.rootNodes.length > 0 ? "Has moves" : "Empty"}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Create Study Button */}
        {!showCreateStudy && studies.length < MAX_STUDIES && (
          <button
            onClick={() => setShowCreateStudy(true)}
            style={{
              width: "100%",
              padding: "12px",
              backgroundColor: "#28a745",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: "500"
            }}
          >
            Create New Study
          </button>
        )}

        {studies.length >= MAX_STUDIES && (
          <div style={{
            padding: "12px",
            backgroundColor: "#fff3cd",
            border: "1px solid #ffc107",
            borderRadius: "4px",
            color: "#856404",
            fontSize: "14px",
            textAlign: "center"
          }}>
            Maximum {MAX_STUDIES} studies reached. Delete a study to create a new one.
          </div>
        )}
      </div>
    </div>
  )
}

