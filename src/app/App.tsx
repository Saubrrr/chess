// Root application component - renders chess interface
import ChessBoardWithMoves from "@/components/ChessBoardWithMoves"
import "@/styles/globals.css"

export default function App() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "40px 20px"
    }}>
      <h1 style={{ fontSize: "48px", marginBottom: "12px", fontWeight: "700" }}>
        Opening Trainer
      </h1>
      <p style={{ fontSize: "20px", color: "#666", textAlign: "center", maxWidth: "600px", marginBottom: "32px" }}>
        Master your chess openings with personalized training.
      </p>
      
      <div style={{
        backgroundColor: "#f9f9f9",
        border: "2px solid #ccc",
        borderRadius: "8px",
        padding: "24px"
      }}>
        <h2 style={{ fontSize: "24px", marginBottom: "16px", fontWeight: "600", textAlign: "center" }}>
          Chess Study
        </h2>
        <p style={{ fontSize: "16px", color: "#666", textAlign: "center", marginBottom: "16px", maxWidth: "800px" }}>
          Make moves on the board, then click back to previous positions and make different moves to create variations!
        </p>
        <ChessBoardWithMoves />
      </div>
    </div>
  )
}