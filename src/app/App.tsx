// Root application component - renders chess interface
import { Routes, Route } from "react-router-dom"
import Navigation from "@/components/Navigation"
import Home from "@/pages/Home"
import Repertoire from "@/pages/Repertoire"
import Practice from "@/pages/Practice"
import "@/styles/globals.css"

export default function App() {
  return (
    <div>
      <Navigation />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/repertoire" element={<Repertoire />} />
        <Route path="/practice" element={<Practice />} />
      </Routes>
    </div>
  )
}