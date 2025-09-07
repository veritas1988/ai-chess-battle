import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Chess } from 'chess.js';

// Correct dynamic import for react-chessboard v4 (named export)
const Chessboard = dynamic(
  () => import('react-chessboard').then((mod) => mod.Chessboard),
  { ssr: false }
);

/**
 * The main page renders a chess board and continuously pits two AI models
 * against each other. A scoreboard and token display live in the header.
 */
export default function Home() {
  // Single Chess instance to hold the game state
  const gameRef = useRef(new Chess());

  // Board position (FEN) for the UI
  const [fen, setFen] = useState(gameRef.current.fen());

  // Tally of wins; persisted in localStorage
  const [gptWins, setGptWins] = useState(0);
  const [claudeWins, setClaudeWins] = useState(0);

  // Public token (e.g., CA) shown in the header
  const token = process.env.NEXT_PUBLIC_TOKEN ?? '';

  // Prevents multiple loops from starting
  const runningRef = useRef(false);

  // Persist tallies
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('gptWins', gptWins.toString());
      localStorage.setItem('claudeWins', claudeWins.toString());
    }
  }, [gptWins, claudeWins]);

  // Load tallies
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedGpt = parseInt(localStorage.getItem('gptWins') ?? '0', 10);
      const storedClaude = parseInt(localStorage.getItem('claudeWins') ?? '0', 10);
      if (!Number.isNaN(storedGpt)) setGptWins(storedGpt);
      if (!Number.isNaN(storedClaude)) setClaudeWins(storedClaude);
    }
  }, []);

  // Start the infinite game loop once
  useEffect(() => {
    if (!runningRef.current) {
      runningRef.current = true;
      void startGameLoop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Copy token helper
  const copyToken = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(token).catch(() => {});
    }
  };

  /**
   * Proxy call to our serverless API to get a move from GPT or Claude.
   * Returns a UCI string like "e2e4" or undefined on error.
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
      console.error('[api] move error:', err);
      return undefined;
    }
  };

  /**
   * Core loop: plays games forever. Uses 8s pacing between moves and between games.
   * Logs each step to help diagnose if anything stalls.
   */
  const startGameLoop = async () => {
    const game = gameRef.current;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    while (true) {
      console.log('[loop] NEW GAME');
      game.reset();
      setFen(game.fen());

      // Play until terminal state
      while (!game.game_over()) {
        // GPT (White)
        console.log('[loop] GPT turn (white). FEN:', game.fen());
        const gptMove = await requestMove(game.fen(), 'gpt');
        console.log('[loop] GPT returned:', gptMove);
        if (!applyAIMove(game, gptMove)) {
          console.log('[loop] GPT move failed; breaking game.');
          break;
        }
        setFen(game.fen());
        console.log('[loop] After GPT move, FEN:', game.fen());
        await sleep(8000);
        if (game.game_over()) break;

        // Claude (Black)
        console.log('[loop] Claude turn (black). FEN:', game.fen());
        const claudeMove = await requestMove(game.fen(), 'claude');
        console.log('[loop] Claude returned:', claudeMove);
        if (!applyAIMove(game, claudeMove)) {
          console.log('[loop] Claude move failed; breaking game.');
          break;
        }
        setFen(game.fen());
        console.log('[loop] After Claude move, FEN:', game.fen());
        await sleep(8000);
      }

      // Determine winner (in checkmate, the side to move is the loser)
      let winner = '';
      if (game.in_checkmate()) {
        winner = game.turn() === 'b' ? 'gpt' : 'claude';
      }
      if (winner === 'gpt') {
        setGptWins((w) => w + 1);
        console.log('[loop] GPT wins');
      } else if (winner === 'claude') {
        setClaudeWins((w) => w + 1);
        console.log('[loop] Claude wins');
      } else {
        console.log('[loop] Draw or early break');
      }

      await sleep(8000);
    }
  };

  /**
   * Apply a UCI move ("e2e4") to chess.js; fallback to a random legal move
   * if the engine returns nothing or an illegal move.
   */
  const applyAIMove = (game, moveUci) => {
    const moves = game.moves({ verbose: true });
    if (moves.length === 0) return false;

    const candidate =
      typeof moveUci === 'string' && moveUci.length >= 4
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

    const randomMove = moves[Math.floor(Math.random() * moves.length)];
    game.move(randomMove.san);
    return true;
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      {/* Header: token + win tally */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <strong style={{ marginRight: '5px' }}>Token:</strong>
          <span style={{ fontFamily: 'monospace' }}>{token}</span>
          <button
            onClick={copyToken}
            style={{
              marginLeft: '8px',
              padding: '4px 12px',
              cursor: 'pointer',
              border: '1px solid #ccc',
              borderRadius: '4px',
              backgroundColor: '#f5f5f5',
            }}
          >
            Copy
          </button>
        </div>
        <div style={{ fontSize: '14px' }}>
          <span style={{ marginRight: '15px' }}>GPT Wins: {gptWins}</span>
          <span>Claude Wins: {claudeWins}</span>
        </div>
      </div>

      {/* Chessboard */}
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
