import ChessBoardWithMoves from "@/components/ChessBoardWithMoves"

export default function Practice() {
  return (
    <div style={{
      minHeight: "100vh",
      padding: "40px 20px"
    }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "36px", marginBottom: "24px", fontWeight: "700" }}>
          Practice vs Computer
        </h1>

        {/* Settings Panel */}
        <div style={{
          backgroundColor: "#fff",
          border: "2px solid #ccc",
          borderRadius: "8px",
          padding: "24px",
          marginBottom: "32px"
        }}>
          <h2 style={{ fontSize: "24px", marginBottom: "16px", fontWeight: "600" }}>
            Settings
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <label style={{ display: "block", marginBottom: "4px", fontWeight: "500" }}>
                Computer Difficulty:
              </label>
              <select style={{
                padding: "8px",
                fontSize: "16px",
                borderRadius: "4px",
                border: "1px solid #ccc"
              }}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", marginBottom: "4px", fontWeight: "500" }}>
                Your Color:
              </label>
              <select style={{
                padding: "8px",
                fontSize: "16px",
                borderRadius: "4px",
                border: "1px solid #ccc"
              }}>
                <option value="white">White</option>
                <option value="black">Black</option>
              </select>
            </div>
          </div>
        </div>

        {/* Practice Board */}
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

