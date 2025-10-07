import { useState } from "react"
import ChessBoardWithMoves from "@/components/ChessBoardWithMoves"

export default function Repertoire() {
  const [uploadedPGNs, setUploadedPGNs] = useState<string[]>([])

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    const filePromises = Array.from(files).map(file => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          resolve(e.target?.result as string)
        }
        reader.readAsText(file)
      })
    })

    Promise.all(filePromises).then(contents => {
      setUploadedPGNs(prev => [...prev, ...contents])
    })
  }

  return (
    <div style={{
      minHeight: "100vh",
      padding: "40px 20px"
    }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "36px", marginBottom: "24px", fontWeight: "700" }}>
          Repertoire Randomizer
        </h1>

        {/* Upload Section */}
        <div style={{
          backgroundColor: "#fff",
          border: "2px solid #ccc",
          borderRadius: "8px",
          padding: "24px",
          marginBottom: "32px"
        }}>
          <h2 style={{ fontSize: "24px", marginBottom: "16px", fontWeight: "600" }}>
            Upload PGN Files
          </h2>
          <input
            type="file"
            accept=".pgn"
            multiple
            onChange={handleFileUpload}
            style={{
              padding: "8px",
              fontSize: "16px",
              cursor: "pointer"
            }}
          />
          <p style={{ marginTop: "12px", color: "#666", fontSize: "14px" }}>
            Uploaded PGNs: {uploadedPGNs.length}
          </p>
        </div>

        {/* PGN Library */}
        <div style={{
          backgroundColor: "#fff",
          border: "2px solid #ccc",
          borderRadius: "8px",
          padding: "24px",
          marginBottom: "32px"
        }}>
          <h2 style={{ fontSize: "24px", marginBottom: "16px", fontWeight: "600" }}>
            PGN Library
          </h2>
          {uploadedPGNs.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {uploadedPGNs.map((pgn, index) => (
                <div key={index} style={{
                  padding: "12px",
                  backgroundColor: "#f5f5f5",
                  borderRadius: "4px",
                  fontSize: "14px",
                  fontFamily: "monospace",
                  maxHeight: "100px",
                  overflow: "hidden"
                }}>
                  {pgn.substring(0, 200)}...
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "#999" }}>No PGNs uploaded yet</p>
          )}
        </div>

        {/* Training Board */}
        <div style={{
          backgroundColor: "#f9f9f9",
          border: "2px solid #ccc",
          borderRadius: "8px",
          padding: "24px",
          display: "flex",
          justifyContent: "center"
        }}>
          <ChessBoardWithMoves />
        </div>
      </div>
    </div>
  )
}

