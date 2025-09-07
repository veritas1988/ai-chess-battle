import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import the chessboard component because it relies on browser APIs
const Chessboard = dynamic(
  () => import('react-chessboard').then((mod) => mod.Chessboard),
  { ssr: false }
);

/**
 * Client-side component that watches a server-managed chess game.
 * All users see the same game state, and only the server makes API calls to AI services.
 */
export default function Home() {
  // Game state received from server
  const [fen, setFen] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const [gptWins, setGptWins] = useState(0);
  const [claudeWins, setClaudeWins] = useState(0);
  const [gameStatus, setGameStatus] = useState('Loading...');
  const [currentPlayer, setCurrentPlayer] = useState('');
  const [gameId, setGameId] = useState(0);
  const [viewers, setViewers] = useState(0);

  // Token to show on the page
  const token = process.env.NEXT_PUBLIC_TOKEN ?? '';

  // Polling interval ref
  const pollingRef = useRef(null);

  /**
   * Fetch the current game state from the server
   */
  const fetchGameState = async () => {
    try {
      const response = await fetch('/api/game-state');
      if (response.ok) {
        const data = await response.json();
        setFen(data.fen);
        setGptWins(data.gptWins);
        setClaudeWins(data.claudeWins);
        setGameStatus(data.gameStatus);
        setCurrentPlayer(data.currentPlayer);
        setGameId(data.gameId);
        setViewers(data.viewers);
      } else {
        console.error('Failed to fetch game state:', response.status);
      }
    } catch (error) {
      console.error('Error fetching game state:', error);
    }
  };

  /**
   * Start watching the game (increments viewer count)
   */
  const startWatching = async () => {
    try {
      await fetch('/api/start-watching', { method: 'POST' });
    } catch (error) {
      console.error('Error starting to watch:', error);
    }
  };

  /**
   * Stop watching the game (decrements viewer count)
   */
  const stopWatching = async () => {
    try {
      await fetch('/api/stop-watching', { method: 'POST' });
    } catch (error) {
      console.error('Error stopping watching:', error);
    }
  };

  /**
   * Initialize game watching when component mounts
   */
  useEffect(() => {
    // Start watching and fetch initial state
    startWatching();
    fetchGameState();

    // Set up polling to get updates every 2 seconds
    pollingRef.current = setInterval(fetchGameState, 2000);

    // Cleanup when component unmounts
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
      stopWatching();
    };
  }, []);

  /**
   * Handle page visibility changes to pause/resume polling
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden, stop polling
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
        stopWatching();
      } else {
        // Page is visible, resume polling
        if (!pollingRef.current) {
          startWatching();
          fetchGameState();
          pollingRef.current = setInterval(fetchGameState, 2000);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  /**
   * Helper to copy the token value to the clipboard
   */
  const copyToken = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(token).catch(() => {});
    }
  };

  /**
   * Force refresh the game state
   */
  const refreshGameState = () => {
    fetchGameState();
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      {/* Header containing the token display, viewer count, and win tally */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', fontSize: '14px' }}>
          <span>👥 {viewers} viewers</span>
          <span>GPT Wins: {gptWins}</span>
          <span>Claude Wins: {claudeWins}</span>
          <button
            onClick={refreshGameState}
            style={{ 
              padding: '4px 12px', 
              cursor: 'pointer', 
              border: '1px solid #ccc', 
              borderRadius: '4px', 
              backgroundColor: '#f5f5f5' 
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Game status display */}
      <div style={{ textAlign: 'center', marginBottom: '10px' }}>
        <div style={{ fontSize: '16px', fontWeight: 'bold' }}>
          {gameStatus} {gameId > 0 && `(Game #${gameId})`}
        </div>
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

      {/* Live indicator */}
      <div style={{ textAlign: 'center', marginTop: '10px' }}>
        <div style={{ 
          display: 'inline-block', 
          padding: '5px 15px', 
          backgroundColor: '#e8f5e8', 
          border: '1px solid #4CAF50', 
          borderRadius: '15px',
          fontSize: '12px',
          color: '#2E7D32'
        }}>
          🔴 Live Global Game
        </div>
      </div>
    </div>
  );
}
