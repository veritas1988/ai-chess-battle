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
 * against each other. A scoreboard and token display live in the header.
 */
export default function Home() {
  // Initialize a single Chess instance. The object itself contains the
  // game state and is mutated as moves are applied.
  const gameRef = useRef(new Chess());

  // Represent the current board position using a FEN string. Whenever
  // gameRef.current is mutated, updateFEN() should be called to refresh
  // the board displayed by react-chessboard.
  const [fen, setFen] = useState(gameRef.current.fen());

  // Keep track of each engine's total wins. These values are persisted
  // locally in the browser so they survive page refreshes.
  const [gptWins, setGptWins] = useState(0);
  const [claudeWins, setClaudeWins] = useState(0);

  // Add game state tracking
  const [gameStatus, setGameStatus] = useState('Starting...');
  const [currentPlayer, setCurrentPlayer] = useState('');

  // Token to show on the page. Expose it via a public environment variable.
  const token = process.env.NEXT_PUBLIC_TOKEN ?? '';

  // A guard to avoid starting multiple overlapping game loops.
  const runningRef = useRef(false);

  /**
   * Persist win counters to localStorage whenever they change. This effect
   * only runs in the browser because localStorage is undefined on the server.
   */
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('gptWins', gptWins.toString());
      localStorage.setItem('claudeWins', claudeWins.toString());
    }
  }, [gptWins, claudeWins]);

  /**
   * Load persisted win counters on initial mount. Without this effect the
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
   * Kick off the infinite game loop after the component mounts. Because
   * Next.js invokes components both on the server and client, guard this
   * effect so it only runs once in the browser.
   */
  useEffect(() => {
    // Add additional guards to ensure we're in the browser and component is mounted
    if (typeof window !== 'undefined' && !runningRef.current) {
      runningRef.current = true;
      console.log('Starting game loop...');
      // Start the asynchronous loop without awaiting it. It will continue
      // playing games forever in the background.
      startGameLoop().catch(error => {
        console.error('Game loop error:', error);
        runningRef.current = false; // Reset so it can be restarted
      });
    }
  }, []); // Remove the exhaustive-deps disable comment

  /**
   * Helper to copy the token value to the clipboard. If the clipboard API
   * isn't available (e.g. older browsers), silently fail.
   */
  const copyToken = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(token).catch(() => {});
    }
  };

  /**
   * Call the serverless API to retrieve a move for the given engine. The
   * backend hides your API keys and handles the prompt formatting. This
   * function returns a string like "e2e4" or undefined on error.
   *
   * @param {string} fenStr Current position in FEN
   * @param {string} ai Which engine to query: 'gpt' or 'claude'
   */
  const requestMove = async (fenStr, ai) => {
    try {
      console.log(`Requesting move from ${ai} for position: ${fenStr}`);
      const res = await fetch('/api/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fen: fenStr, ai }),
      });
      
      if (!res.ok) {
        console.error(`API call failed with status: ${res.status}`);
        const errorText = await res.text();
        console.error('Error response:', errorText);
        return undefined;
      }
      
      const data = await res.json();
      console.log(`${ai} responded with:`, data);
      return typeof data.move === 'string' ? data.move.trim() : undefined;
    } catch (err) {
      console.error(`Error calling move API for ${ai}:`, err);
      return undefined;
    }
  };

  /**
   * The core loop: repeatedly plays games between the two AIs. After each
   * game finishes it updates the win counters and immediately starts a new
   * game. A small delay between moves makes the progression easier to
   * follow. Because this function contains an infinite loop, it must not
   * block the main thread; hence the use of async/await and timeouts.
   */
  const startGameLoop = async () => {
    const game = gameRef.current;
    let gameCount = 0;
    
    while (true) {
      try {
        gameCount++;
        console.log(`Starting game ${gameCount}`);
        
        // Reset game state at the start of each match
        game.reset();
        setFen(game.fen());
        setGameStatus(`Game ${gameCount} in progress`);
        setCurrentPlayer('GPT (White)');

        // Play until a terminal state occurs
        while (!game.game_over()) {
          // GPT move (white pieces)
          setCurrentPlayer('GPT (White)');
          const gptMove = await requestMove(game.fen(), 'gpt');
          if (!applyAIMove(game, gptMove, 'GPT')) {
            console.log('GPT failed to make a move, ending game');
            break;
          }
          setFen(game.fen());
          
          // Brief pause to let the board render and the viewer follow along
          await new Promise(resolve => setTimeout(resolve, 1000));
          if (game.game_over()) break;

          // Claude move (black pieces)
          setCurrentPlayer('Claude (Black)');
          const claudeMove = await requestMove(game.fen(), 'claude');
          if (!applyAIMove(game, claudeMove, 'Claude')) {
            console.log('Claude failed to make a move, ending game');
            break;
          }
          setFen(game.fen());
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Determine the winner and update counters
        let winner = '';
        let gameResult = '';
        
        if (game.isCheckmate()) {
          winner = game.turn() === 'b' ? 'gpt' : 'claude';
          gameResult = `Checkmate! ${winner === 'gpt' ? 'GPT' : 'Claude'} wins!`;
        } else if (game.isStalemate()) {
          gameResult = 'Stalemate - Draw!';
        } else if (game.isDraw()) {
          gameResult = 'Draw!';
        } else {
          gameResult = 'Game ended unexpectedly';
        }
        
        console.log(gameResult);
        setGameStatus(gameResult);
        setCurrentPlayer('');
        
        if (winner === 'gpt') {
          setGptWins(wins => wins + 1);
        } else if (winner === 'claude') {
          setClaudeWins(wins => wins + 1);
        }
        
        // Wait a moment before beginning the next match
        await new Promise(resolve => setTimeout(resolve, 3000));
        
      } catch (error) {
        console.error('Error in game loop:', error);
        setGameStatus('Error occurred, restarting...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  };

  /**
   * Attempt to apply a move returned by an AI. If the AI supplies an illegal
   * move or fails altogether, fall back to a random legal move so play can
   * continue. Returns a boolean indicating whether a move was successfully
   * applied. This helper never throws.
   *
   * @param {Chess} game The active Chess instance
   * @param {string|undefined} moveUci Move in UCI (e.g. "e2e4") or undefined
   * @param {string} playerName Name of the player for logging
   */
  const applyAIMove = (game, moveUci, playerName) => {
    const moves = game.moves({ verbose: true });
    if (moves.length === 0) {
      console.log('No legal moves available');
      return false;
    }

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
        const move = game.move(candidate);
        if (move) {
          console.log(`${playerName} played: ${moveUci} (${move.san})`);
          return true;
        }
      }
    } catch (err) {
      console.log(`${playerName}'s move ${moveUci} was invalid:`, err.message);
      // Fall through to random fallback
    }

    // Choose a random legal move when the AI fails or produces an illegal move
    const randomMove = moves[Math.floor(Math.random() * moves.length)];
    const move = game.move(randomMove.san);
    console.log(`${playerName} fallback to random move: ${move.san}`);
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
            style={{ 
              marginLeft: '8px', 
              padding: '4px 12px', 
              cursor: 'pointer', 
              border: '1px solid #ccc', 
              borderRadius: '4px', 
              backgroundColor: '#f5f5f5' 
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

      {/* Game status display */}
      <div style={{ textAlign: 'center', marginBottom: '10px' }}>
        <div style={{ fontSize: '16px', fontWeight: 'bold' }}>{gameStatus}</div>
        {currentPlayer && (
          <div style={{ fontSize: '14px', color: '#666' }}>
            Current turn: {currentPlayer}
          </div>
        )}
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
