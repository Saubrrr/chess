import { Link, useLocation } from "react-router-dom"

export default function Navigation() {
  const location = useLocation()

  const linkStyle = (path: string) => ({
    padding: "12px 24px",
    textDecoration: "none",
    color: location.pathname === path ? "#fff" : "#333",
    backgroundColor: location.pathname === path ? "#2c3e50" : "transparent",
    borderRadius: "4px",
    fontWeight: "500",
    fontSize: "16px",
    transition: "all 0.2s"
  })

  return (
    <nav style={{
      backgroundColor: "#fff",
      borderBottom: "2px solid #ccc",
      padding: "16px 32px",
      display: "flex",
      gap: "16px",
      alignItems: "center",
      boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
    }}>
      <h2 style={{ margin: 0, marginRight: "auto", fontSize: "24px", fontWeight: "700" }}>
        Opening Trainer
      </h2>
      <Link to="/" style={linkStyle("/")}>
        Home
      </Link>
      <Link to="/repertoire" style={linkStyle("/repertoire")}>
        Repertoire Randomizer
      </Link>
      <Link to="/practice" style={linkStyle("/practice")}>
        Practice vs Computer
      </Link>
    </nav>
  )
}

