// Root application component - renders chess interface
import ChessgroundBoard from "@/components/ChessgroundBoard"

export default function App() {
  return (
    <div style={{ 
      minHeight: "100dvh", 
      display: "grid", 
      placeItems: "center", 
      background: "#f7f7f7" 
    }}>
      <ChessgroundBoard />
    </div>
  )
}