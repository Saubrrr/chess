import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import { Chessground } from "@lichess-org/chessground";
import type { MoveNode } from "@/types/move-tree";

import "@lichess-org/chessground/assets/chessground.base.css";
import "@lichess-org/chessground/assets/chessground.cburnett.css";

// helper: build destination squares map for Chessground
function buildDests(game: Chess): Map<string, string[]> {
  const dests = new Map<string, string[]>();
  for (const move of game.moves({ verbose: true })) {
    const list = dests.get(move.from) ?? [];
    list.push(move.to);
    dests.set(move.from, list);
  }
  return dests;
}

// helper: root node
function makeRoot(): MoveNode {
  const g = new Chess();
  const fen = g.fen();
  return {
    id: "root",
    fenBefore: fen,
    fenAfter: fen,
    ply: 0,
    moveNumber: 0,
    turnToMove: "white",
    children: [],
  };
}

let idCounter = 0;
const uid = () => `n_${++idCounter}`;

export default function ChessBoardWithMoves() {
  const [root, setRoot] = useState<MoveNode>(() => makeRoot());
  const [currentId, setCurrentId] = useState<string>("root");

  // Variation chooser UI state
  const [chooserOpen, setChooserOpen] = useState(false);
  const [chooserOptions, setChooserOptions] = useState<MoveNode[]>([]);

  const nodeMapRef = useRef<Map<string, MoveNode>>(new Map());
  const hostRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<ReturnType<typeof Chessground> | null>(null);
  const gameRef = useRef(new Chess());

  // build fast index for tree navigation
  const rebuildIndex = (r: MoveNode) => {
    const map = new Map<string, MoveNode>();
    const dfs = (n: MoveNode) => {
      map.set(n.id, n);
      n.children.forEach(dfs);
    };
    dfs(r);
    nodeMapRef.current = map;
  };
  useMemo(() => rebuildIndex(root), [root]);

  const currentNode = useMemo(
    () => nodeMapRef.current.get(currentId) ?? root,
    [currentId, root]
  );

  // init Chessground
  useEffect(() => {
    if (!hostRef.current) return;
    const api = Chessground(hostRef.current, {
      orientation: "white",
      coordinates: true,
      draggable: { enabled: true, autoDistance: true },
      highlight: { lastMove: true, check: true },
      animation: { enabled: true, duration: 200 },
      movable: { free: false, color: "white", dests: buildDests(gameRef.current) },
    });
    apiRef.current = api;
    return () => {
      apiRef.current = null;
      hostRef.current && (hostRef.current.innerHTML = "");
    };
  }, []);

  // always sync board with current node
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    const game = new Chess(currentNode.fenAfter);
    gameRef.current = game;
    api.set({
      fen: game.fen(),
      turnColor: game.turn() === "w" ? "white" : "black",
      movable: {
        color: game.turn() === "w" ? "white" : "black",
        dests: buildDests(game),
      },
      check: game.inCheck() ? (game.turn() === "w" ? "white" : "black") : undefined,
    });
  }, [currentNode]);

  // play a move and add it to the tree
  const addMoveFrom = (from: string, to: string, promotion = "q") => {
    const base = currentNode;
    const game = new Chess(base.fenAfter);
    const res = game.move({ from, to, promotion });
    if (!res) return;

    const san = res.san;
    const fenBefore = base.fenAfter;
    const fenAfter = game.fen();
    const ply = base.ply + 1;
    const moveNumber = Math.ceil(ply / 2);
    const turnToMove = game.turn() === "w" ? "white" : "black";

    // If the same SAN already exists, jump there
    const existing = base.children.find((c) => c.san === san);
    if (existing) {
      setCurrentId(existing.id);
      return;
    }

    const newNode: MoveNode = {
      id: uid(),
      parentId: base.id,
      san,
      fenBefore,
      fenAfter,
      ply,
      moveNumber,
      turnToMove,
      children: [],
    };

    // addç into tree
    const graft = (n: MoveNode): MoveNode => {
      if (n.id === base.id) return { ...n, children: [...n.children, newNode] };
      return { ...n, children: n.children.map(graft) };
    };
    const nextRoot = graft(root);
    setRoot(nextRoot);
    setCurrentId(newNode.id);
  };

  // handle move on board (drag-drop)
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;

    api.set({
      movable: {
        color: gameRef.current.turn() === "w" ? "white" : "black",
        dests: buildDests(gameRef.current),
        events: {
          after: (orig: string, dest: string) => addMoveFrom(orig, dest),
        },
      },
    });
  }, [currentNode]);

  // Navigation helpers
  const goBack = () => {
    const node = nodeMapRef.current.get(currentId);
    if (node?.parentId) {
      setChooserOpen(false);
      setCurrentId(node.parentId);
    }
  };

  const goForward = () => {
    const node = nodeMapRef.current.get(currentId);
    if (!node) return;
    if (node.children.length === 0) {
      setChooserOpen(false);
      return;
    }
    if (node.children.length === 1) {
      setChooserOpen(false);
      setCurrentId(node.children[0].id);
      return;
    }
    // multiple continuations → open chooser
    setChooserOptions(node.children);
    setChooserOpen(true);
  };

  const jumpTo = (id: string) => {
    setChooserOpen(false);
    setCurrentId(id);
  };

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // avoid when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goBack();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (chooserOpen) return; // already open; wait for user to choose
        goForward();
      } else if (e.key === "Escape") {
        if (chooserOpen) {
          e.preventDefault();
          setChooserOpen(false);
        }
      } else if (chooserOpen && /^[1-9]$/.test(e.key)) {
        const idx = Number(e.key) - 1;
        const pick = chooserOptions[idx];
        if (pick) {
          e.preventDefault();
          jumpTo(pick.id);
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chooserOpen, chooserOptions, currentId]);

  // --- render ------------------------------------------------------------
  return (
    <div
      style={{
        display: "flex",
        gap: "20px",
        alignItems: "flex-start",
        width: "100%",
      }}
    >
      {/* Board + controls */}
      <div>
        <div ref={hostRef} style={{ width: 560, height: 560 }} />
        <div style={{ marginTop: "8px", display: "flex", gap: "8px" }}>
          <button onClick={goBack}>← Back</button>
          <button onClick={goForward}>→ Forward</button>
          <button
            onClick={() => {
              setChooserOpen(false);
              setRoot(makeRoot());
              setCurrentId("root");
            }}
          >
            Reset Tree
          </button>
        </div>
      </div>

      {/* Side panel */}
      <div
        style={{
          position: "relative",
          flex: 1,
          height: 560,
          background: "#1f2937",
          color: "#e5e7eb",
          border: "1px solid #374151",
          borderRadius: "8px",
          padding: "16px",
          overflowY: "auto",
        }}
      >
        <h3 style={{ margin: "0 0 12px 0", fontSize: 18, fontWeight: 600 }}>
          Lines & Variations
        </h3>

        <VariationList root={root} currentId={currentId} onJump={jumpTo} />

        {/* Variation chooser overlay (opens on → if multiple) */}
        {chooserOpen && (
          <div
            style={{
              position: "absolute",
              bottom: 12,
              left: 12,
              background: "#111827",
              border: "1px solid #374151",
              borderRadius: 8,
              padding: 8,
              boxShadow: "0 8px 24px rgba(0,0,0,.45)",
              minWidth: 260,
              zIndex: 10,
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {chooserOptions.map((opt, i) => (
                <button
                  key={opt.id}
                  onClick={() => jumpTo(opt.id)}
                  style={{
                    textAlign: "left",
                    background: i === 0 ? "#3b82f6" : "#1f2937",
                    color: i === 0 ? "white" : "#e5e7eb",
                    border: "1px solid #374151",
                    borderRadius: 6,
                    padding: "8px 10px",
                  }}
                >
                  {`${opt.ply % 2 === 1 ? opt.moveNumber + ". " : opt.moveNumber + "... "}${opt.san}`}
                  <span style={{ opacity: 0.6, marginLeft: 6 }}>({i + 1})</span>
                </button>
              ))}
            </div>
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
              Press 1–9 to choose • Esc to close
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// nested move list
function VariationList({
  root,
  currentId,
  onJump,
}: {
  root: MoveNode;
  currentId: string;
  onJump: (id: string) => void;
}) {
  const NodeRow = ({ node }: { node: MoveNode }) => {
    const isActive = node.id === currentId;
    const prefix =
      node.ply === 0
        ? ""
        : node.ply % 2 === 1
        ? `${node.moveNumber}. `
        : `${node.moveNumber}... `;

    return (
      <div style={{ padding: "2px 0" }}>
        {node.ply > 0 && (
          <button
            onClick={() => onJump(node.id)}
            style={{
              background: isActive ? "#4ade80" : "transparent",
              color: isActive ? "#111827" : "#e5e7eb",
              border: "none",
              cursor: "pointer",
              padding: "2px 4px",
              borderRadius: 4,
            }}
            title={node.fenAfter}
          >
            {prefix}
            {node.san}
          </button>
        )}
        {node.children.length > 0 && (
          <div style={{ paddingLeft: 12, borderLeft: "1px solid #374151" }}>
            {node.children.map((child) => (
              <NodeRow key={child.id} node={child} />
            ))}
          </div>
        )}
      </div>
    );
  };

  return <NodeRow node={root} />;
}
