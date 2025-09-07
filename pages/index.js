import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Chess } from 'chess.js';

// Dynamically import the chessboard component because it relies on browser APIs
const Chessboard = dynamic(
  () => import('react-chessboard').then((mod) => mod.Chessboard),
  { ssr: false }
);


/**
 * The main page renders a chess board and continuously pits two AI models
 * against each other.  A scoreboard and token display live in the header.
 */
export default function Home() {
  // Initialise a single Chess instance.  The object itself contains the
  // game state and is mutated as moves are applied.
  const gameRef = useRef(new Chess());

  // Represent the current board position using a FEN string.  Whenever
  // gameRef.current is mutated, updateFEN() should be called to refresh
  // the board displayed by react‑chessboard.
  const [fen, setFen] = useState(gameRef.current.fen());

  // Keep track of each engine's total wins.  These values are persisted
  // locally in the browser so they survive page refreshes.
  const [gptWins, setGptWins] = useState(0);
  const [claudeWins, setClaudeWins] = useState(0);

  // Token to show on the page.  Expose it via a public environment variable.
  const token = process.env.NEXT_PUBLIC_TOKEN ?? '';

  // A guard to avoid starting multiple overlapping game loops.
  const runningRef = useRef(false);

  /**
   * Persist win counters to localStorage whenever they change.  This effect
   * only runs in the browser because localStorage is undefined on the server.
   */
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('gptWins', gptWins.toString());
      localStorage.setItem('claudeWins', claudeWins.toString());
    }
  }, [gptWins, claudeWins]);

  /**
   * Load persisted win counters on initial mount.  Without this effect the
   * scoreboard would reset whenever the page reloads.
   */
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedGpt = parseInt(localStorage.getItem('gptWins') ?? '0', 10);
      const storedClaude = parseInt(localStorage.getItem('claudeWins') ?? '0', 10);
      if (!Number.isNaN(storedGpt)) setGptWins(storedGpt);
      if (!Number.isNaN(storedClaude)) setClaudeWins(storedClaude);
    }
  }, []);

  /**
   * Kick off the infinite game loop after the component mounts.  Because
   * Next.js invokes components both on the server and client, guard this
   * effect so it only runs once in the browser.
   */
  useEffect(() => {
    if (!runningRef.current) {
      runningRef.current = true;
      // Start the asynchronous loop without awaiting it.  It will continue
      // playing games forever in the background.
      void startGameLoop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Helper to copy the token value to the clipboard.  If the clipboard API
   * isn't available (e.g. older browsers), silently fail.
   */
  const copyToken = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(token).catch(() => {});
    }
  };

  /**
   * Call the serverless API to retrieve a move for the given engine.  The
   * backend hides your API keys and handles the prompt formatting.  This
   * function returns a string like "e2e4" or undefined on error.
   *
   * @param {string} fenStr Current position in FEN
   * @param {string} ai Which engine to query: 'gpt' or 'claude'
   */
  const requestMove = async (fenStr, ai) => {
    try {
      const res = await fetch('/api/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fen: fenStr, ai }),
      });
      if (!res.ok) return undefined;
      const data = await res.json();
      return typeof data.move === 'string' ? data.move.trim() : undefined;
    } catch (err) {
      console.error('Error calling move API:', err);
      return undefined;
    }
  };

  /**
   * The core loop: repeatedly plays games between the two AIs.  After each
   * game finishes it updates the win counters and immediately starts a new
   * game.  A small delay between moves makes the progression easier to
   * follow.  Because this function contains an infinite loop, it must not
   * block the main thread; hence the use of async/await and timeouts.
   */
  const startGameLoop = async () => {
    const game = gameRef.current;
    while (true) {
      // Reset game state at the start of each match
      game.reset();
      setFen(game.fen());

      // Play until a terminal state occurs
      while (!game.game_over()) {
        // GPT move
        const gptMove = await requestMove(game.fen(), 'gpt');
        if (!applyAIMove(game, gptMove)) break;
        setFen(game.fen());
        // brief pause to let the board render and the viewer follow along
        await new Promise(resolve => setTimeout(resolve, 500));
        if (game.game_over()) break;

        // Claude move
        const claudeMove = await requestMove(game.fen(), 'claude');
        if (!applyAIMove(game, claudeMove)) break;
        setFen(game.fen());
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Determine the winner and update counters.  In checkmate the side
      // whose turn it is to move is losing, so the previous mover won.
      let winner = '';
      if (game.in_checkmate()) {
        winner = game.turn() === 'b' ? 'gpt' : 'claude';
      }
      if (winner === 'gpt') {
        setGptWins(wins => wins + 1);
      } else if (winner === 'claude') {
        setClaudeWins(wins => wins + 1);
      }
      // Wait a moment before beginning the next match
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  };

  /**
   * Attempt to apply a move returned by an AI.  If the AI supplies an illegal
   * move or fails altogether, fall back to a random legal move so play can
   * continue.  Returns a boolean indicating whether a move was successfully
   * applied.  This helper never throws.
   *
   * @param {Chess} game The active Chess instance
   * @param {string|undefined} moveUci Move in UCI (e.g. "e2e4") or undefined
   */
  const applyAIMove = (game, moveUci) => {
  const moves = game.moves({ verbose: true });
  if (moves.length === 0) return false;

  // If the engine returned a string of at least four characters, try to
  // construct a move from it. Handle optional promotion correctly.
  const candidate = (typeof moveUci === 'string' && moveUci.length >= 4)
    ? {
        from: moveUci.slice(0, 2),
        to: moveUci.slice(2, 4),
        promotion: moveUci.length === 5 ? moveUci[4] : undefined,
      }
    : null;

  try {
    if (candidate) {
      game.move(candidate);
      return true;
    }
  } catch (err) {
    // fall through to random fallback
  }

  // Choose a random legal move when the AI fails or produces an illegal move
  const randomMove = moves[Math.floor(Math.random() * moves.length)];
  game.move(randomMove.san);
  return true;
};


  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      {/* Header containing the token display and the win tally */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <strong style={{ marginRight: '5px' }}>Token:</strong>
          <span style={{ fontFamily: 'monospace' }}>{token}</span>
          <button
            onClick={copyToken}
            style={{ marginLeft: '8px', padding: '4px 12px', cursor: 'pointer', border: '1px solid #ccc', borderRadius: '4px', backgroundColor: '#f5f5f5' }}
          >
            Copy
          </button>
        </div>
        <div style={{ fontSize: '14px' }}>
          <span style={{ marginRight: '15px' }}>GPT Wins: {gptWins}</span>
          <span>Claude Wins: {claudeWins}</span>
        </div>
      </div>
      {/* Chessboard container */}
      <div style={{ width: '100%', maxWidth: '500px', margin: '0 auto' }}>
        <Chessboard
          position={fen}
          arePiecesDraggable={false}
          boardWidth={500}
          boardOrientation="white"
        />
      </div>
    </div>
  );
}
