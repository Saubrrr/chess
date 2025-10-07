export default function Home() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px"
    }}>
      <h1 style={{ fontSize: "48px", marginBottom: "24px", fontWeight: "700" }}>
        Opening Trainer
      </h1>
      <p style={{ fontSize: "20px", color: "#666", textAlign: "center", maxWidth: "600px" }}>
        Master your chess openings with personalized training based on your PGN repertoire.
      </p>
    </div>
  )
}

