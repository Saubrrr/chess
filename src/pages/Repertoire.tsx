import ChessBoardWithMoves from "@/components/ChessBoardWithMoves"

export default function Repertoire() {
  return (
    <div style={{
      minHeight: "100vh",
      padding: "40px 20px"
    }}>
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        <h1 style={{ fontSize: "36px", marginBottom: "24px", fontWeight: "700" }}>
          Repertoire Randomiser
        </h1>

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

