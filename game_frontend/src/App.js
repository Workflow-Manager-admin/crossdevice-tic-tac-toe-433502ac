import React, { useState, useEffect, useCallback } from "react";
import "./App.css";

// Color scheme from requirements
const COLORS = {
  primary: "#1976d2",
  accent: "#ffb300",
  secondary: "#fff",
  boardLine: "#bbbbbb",
  success: "#2e7d32",
  error: "#d32f2f",
};
const API_BASE = "http://localhost:3001";

function getSessionCookie() {
  // Get session cookie used for tracking player identity
  const key = "tic_tac_toe_session";
  const equal = key + "=";
  const ca = document.cookie.split(";");
  for (let c of ca) {
    while (c.charAt(0) === " ") c = c.substring(1);
    if (c.indexOf(equal) === 0) return c.substring(equal.length, c.length);
  }
  return null;
}

// PUBLIC_INTERFACE
function App() {
  const [gameId, setGameId] = useState(null);            // Current game UUID
  const [session, setSession] = useState(getSessionCookie());
  const [board, setBoard] = useState([[" ", " ", " "], [" ", " ", " "], [" ", " ", " "]]);
  const [nextTurn, setNextTurn] = useState("X");
  const [role, setRole] = useState(null);                // "X" or "O"
  const [status, setStatus] = useState(null);            // in_progress / X_won / O_won / draw
  const [winner, setWinner] = useState(null);            // "X", "O", or null
  const [moveCount, setMoveCount] = useState(0);
  const [history, setHistory] = useState([]);            // Current game move history
  const [allGames, setAllGames] = useState([]);          // All finished game records
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);                  // Status message
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);

  // Polling for real-time status
  useEffect(() => {
    let interval = null;
    if (gameId) {
      fetchAndUpdateGame();
      interval = setInterval(() => fetchAndUpdateGame(), 2000);
    }
    return () => { interval && clearInterval(interval); };
    // eslint-disable-next-line
  }, [gameId]);

  // Poll for overall history
  useEffect(() => {
    fetchAllGames();
    const interval = setInterval(fetchAllGames, 4000);
    return () => clearInterval(interval);
  }, []);

  const fetchAndUpdateGame = useCallback(async () => {
    if (!gameId) return;
    try {
      const [stRes, histRes, roleRes] = await Promise.all([
        fetch(`${API_BASE}/games/${gameId}/status`, { credentials: "include" }),
        fetch(`${API_BASE}/games/${gameId}/moves`, { credentials: "include" }),
        fetch(`${API_BASE}/games/${gameId}/role`,   { credentials: "include" }),
      ]);
      if (stRes.ok && histRes.ok && roleRes.ok) {
        const state = await stRes.json();
        setBoard(state.board);
        setNextTurn(state.next_turn);
        setStatus(state.status);
        setWinner(state.winner);
        setMoveCount(state.move_count);
        setHistory(state.history || []);
        const roleValue = await roleRes.json();
        setRole(roleValue);
      }
    } catch (err) {
      setMsg({ type: "error", text: "Connection error." });
    }
  }, [gameId]);
  
  const fetchAllGames = async () => {
    try {
      const res = await fetch(`${API_BASE}/games/history`);
      if (res.ok) {
        setAllGames(await res.json());
      }
    } catch (e) { /* fail silently */ }
  };

  // Start a new game
  const startGame = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`${API_BASE}/games/`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const json = await res.json();
        setGameId(json.game_id);
        setRole("X");
        setBoard([[" ", " ", " "], [" ", " ", " "], [" ", " ", " "]]);
        setStatus("in_progress");
        setWinner(null);
        setMoveCount(0);
        setHistory([]);
        setMsg({ type: "success", text: "Game started! You are X." });
      } else {
        setMsg({ type: "error", text: "Could not start game." });
      }
    } catch (e) {
      setMsg({ type: "error", text: "Network error." });
    }
    setLoading(false);
  };

  // Make a move
  const makeMove = async (row, col) => {
    if (loading) return;
    if (!gameId || status !== "in_progress") return;
    if (board[row][col] !== " ") return;
    if (role !== nextTurn) {
      setMsg({ type: "error", text: `It's ${nextTurn}'s turn.` });
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`${API_BASE}/games/${gameId}/moves`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ row, col, player: role }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.move_applied) {
          fetchAndUpdateGame();
          setMsg(null);
        } else {
          setMsg({ type: "error", text: json.reason || "Invalid move." });
        }
      }
    } catch (e) {
      setMsg({ type: "error", text: "Network error." });
    }
    setLoading(false);
  };

  // Helper: status banner
  function GameStatusBanner({ status, winner, nextTurn }) {
    let text = "";
    let color = COLORS.primary;
    if (!status) return null;
    if (status === "in_progress") {
      text = `Next Move: Player ${nextTurn}`;
      color = COLORS.primary;
    } else if (status === "draw") {
      text = "Draw Game!";
      color = COLORS.error;
    } else if (status === "X_won" || status === "O_won") {
      text = `Player ${winner} Won!`;
      color = COLORS.success;
    }
    return (
      <div style={{
        fontWeight: "bold",
        background: color,
        color: COLORS.secondary,
        borderRadius: 8,
        padding: "8px 16px",
        margin: "8px 0"
      }}>
        {text}
      </div>
    );
  }

  // Helper: Board Rendering
  function GameBoard() {
    return (
      <div className="ttt-board-container">
        <div className="ttt-board-grid" aria-label="Tic Tac Toe Board">
          {board.map((row, r) =>
            row.map((cell, c) => (
              <button
                key={r + "-" + c}
                className="ttt-board-cell"
                style={{
                  color: cell === "X" ? COLORS.primary : cell === "O" ? COLORS.accent : "#888",
                }}
                aria-label={`row ${r + 1} column ${c + 1}`}
                disabled={cell !== " " || status !== "in_progress" || role !== nextTurn}
                onClick={() => makeMove(r, c)}
              >
                {cell !== " " ? cell : ""}
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  // Helper: Current game move history
  function GameHistoryPanel() {
    return (
      <div className="ttt-history-panel" data-testid="ttt-history-panel">
        <div className="ttt-history-title">Move History</div>
        {history.length === 0 && <div className="ttt-history-empty">No moves yet.</div>}
        <ol className="ttt-history-list">
          {history.map((mv, i) => (
            <li key={i}>
              <span style={{ fontWeight: "bold", color: mv.player === "X" ? COLORS.primary : COLORS.accent }}>
                {mv.player}
              </span>
              : ({mv.row + 1}, {mv.col + 1})
            </li>
          ))}
        </ol>
      </div>
    );
  }

  // Helper: Finished game record history
  function AllGamesList() {
    return (
      <div className="ttt-allgames-panel">
        <div className="ttt-history-title">All Game Results</div>
        {allGames.length === 0 && <div className="ttt-history-empty">No history yet.</div>}
        <ul className="ttt-game-records-list">
          {allGames.map((g, idx) => (
            <li key={g.game_id} className="ttt-game-record">
              <span className="ttt-game-id">#{g.game_id.slice(0, 7)}</span>
              <span className="ttt-game-status" style={{
                color:
                  g.status === "X_won"
                    ? COLORS.primary
                    : g.status === "O_won"
                      ? COLORS.accent
                      : g.status === "draw"
                        ? COLORS.error
                        : "#666"
              }}>
                {g.status.includes("won") ? `Winner: ${g.winner}` : g.status}
              </span>
              <span className="ttt-game-times">
                {new Date(g.started_at).toLocaleTimeString()}
                {" ↦ "}
                {g.finished_at ? new Date(g.finished_at).toLocaleTimeString() : "-"}
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // Responsive: show history as drawer on mobile
  function isMobile() {
    return window.innerWidth < 700;
  }

  // Always keep session up-to-date for requests
  useEffect(() => {
    setSession(getSessionCookie());
  }, []);

  return (
    <div className="ttt-root">
      {/* Navigation Bar */}
      <nav className="ttt-navbar">
        <span className="ttt-title" style={{ color: COLORS.primary }}>
          <span role="img" aria-label="tic tac toe">🎮</span>&nbsp;Tic Tac Toe
        </span>
        <button className="ttt-navbar-btn" onClick={() => setShowHistoryDrawer(s => !s)}>
          <span role="img" aria-label="history">📜</span>
          <span className="ttt-navbar-btn-text">{isMobile() ? "" : "History"}</span>
        </button>
      </nav>
      {/* Main Content Layout */}
      <main className="ttt-main">
        <div className="ttt-main-content">
          {/* Action Row */}
          <div className="ttt-actions-row">
            <button className="ttt-action-btn" style={{
              background: COLORS.primary,
              color: COLORS.secondary,
              borderRadius: 8,
              marginRight: 8,
              fontWeight: 600,
            }} disabled={loading} onClick={startGame}>
              <span role="img" aria-label="new game">➕</span>&nbsp;New Game
            </button>
            {!!role && !!gameId &&
              <span className="ttt-role-label">
                You are: <b style={{ color: role === "X" ? COLORS.primary : COLORS.accent }}>{role}</b>
              </span>
            }
          </div>
          {/* Status message */}
          {msg && (
            <div className="ttt-msg-banner" style={{
              background: msg.type === "error" ? COLORS.error : COLORS.success,
              color: COLORS.secondary
            }}>
              {msg.text}
            </div>
          )}
          {/* Game Status Banner */}
          <GameStatusBanner status={status} winner={winner} nextTurn={nextTurn} />
          {/* Board */}
          <GameBoard />
          {/* Move History */}
          <GameHistoryPanel />
        </div>
        {/* History Drawer (side or inline) */}
        {isMobile() ? (
          <div className={`ttt-drawer ${showHistoryDrawer ? "ttt-drawer-open" : ""}`}>
            <button
              className="ttt-navbar-btn ttt-drawer-close"
              onClick={() => setShowHistoryDrawer(false)}
              aria-label="Close history"
              style={{ background: COLORS.accent }}
            >✕</button>
            <AllGamesList />
          </div>
        ) : (
          <aside className="ttt-sidebar">
            <AllGamesList />
          </aside>
        )}
      </main>
      {/* Drawer background */}
      {showHistoryDrawer && isMobile() && <div className="ttt-drawer-bg" onClick={() => setShowHistoryDrawer(false)} />}
      <footer className="ttt-footer">
        <span>
          &copy; {new Date().getFullYear()} Simple Tic Tac Toe &mdash; Powered by React + FastAPI
        </span>
      </footer>
    </div>
  );
}
export default App;
