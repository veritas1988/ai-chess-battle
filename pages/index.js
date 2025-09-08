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
  const [moveHistory, setMoveHistory] = useState([]);

  // Token to show on the page
  const token = process.env.NEXT_PUBLIC_TOKEN ?? '';

  // Polling interval ref
  const pollingRef = useRef(null);
  const moveHistoryRef = useRef(null);

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
        
        // Update move history if we have it
        if (data.moveHistory) {
          setMoveHistory(data.moveHistory);
          // Auto-scroll to bottom when new moves are added
          setTimeout(() => {
            if (moveHistoryRef.current) {
              moveHistoryRef.current.scrollTop = moveHistoryRef.current.scrollHeight;
            }
          }, 100);
        }
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
    <div className="min-h-screen bg-black text-green-400 font-mono">
      {/* Terminal-style background pattern */}
      <div className="fixed inset-0 opacity-5">
        <div className="text-xs leading-3 break-all">
          {Array(200).fill('01010101 ').join('')}
        </div>
      </div>
      
      <div className="relative z-10 flex min-h-screen">
        {/* Main content */}
        <div className="flex-1 p-6">
          {/* Header */}
          <div className="border border-green-400 bg-black/90 p-4 mb-6 shadow-lg shadow-green-400/20">
            <div className="flex flex-wrap justify-between items-center gap-4">
              {/* Token display */}
              <div className="flex items-center">
                <span className="text-green-300 mr-2">TOKEN:</span>
                <span className="text-green-400 bg-green-400/10 px-2 py-1 border border-green-400/30">{token}</span>
                <button
                  onClick={copyToken}
                  className="ml-2 px-3 py-1 border border-green-400 bg-black hover:bg-green-400/10 transition-colors"
                >
                  COPY
                </button>
              </div>
              
              {/* Stats */}
              <div className="flex items-center gap-6 text-sm">
                <span className="flex items-center gap-1">
                  <span className="text-green-300">👥</span>
                  <span>{viewers} WATCHING</span>
                </span>
                <span>GPT: {gptWins}</span>
                <span>CLAUDE: {claudeWins}</span>
                <button
                  onClick={refreshGameState}
                  className="px-3 py-1 border border-green-400 bg-black hover:bg-green-400/10 transition-colors"
                >
                  REFRESH
                </button>
              </div>
            </div>
          </div>

          {/* Game status */}
          <div className="text-center mb-6">
            <div className="text-xl font-bold text-green-300 mb-2">
              {gameStatus} {gameId > 0 && `[GAME #${gameId}]`}
            </div>
            {currentPlayer && (
              <div className="text-green-400/80">
                &gt; {currentPlayer}
              </div>
            )}
          </div>

          {/* Chessboard */}
          <div className="flex justify-center mb-6">
            <div className="border-2 border-green-400 shadow-lg shadow-green-400/30">
              <Chessboard
                position={fen}
                arePiecesDraggable={false}
                boardWidth={500}
                boardOrientation="white"
                customSquareStyles={{
                  // Make dark squares more backrooms-y
                  a1: { backgroundColor: '#001100' },
                  a3: { backgroundColor: '#001100' },
                  a5: { backgroundColor: '#001100' },
                  a7: { backgroundColor: '#001100' },
                  // Continue pattern...
                }}
              />
            </div>
          </div>

          {/* Live indicator */}
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 border border-green-400 bg-green-400/10">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm">LIVE GLOBAL BATTLE</span>
            </div>
          </div>
        </div>

        {/* Sidebar - Move History */}
        <div className="w-80 border-l border-green-400 bg-black/95 flex flex-col">
          <div className="p-4 border-b border-green-400">
            <h3 className="text-green-300 font-bold text-lg">MOVE_LOG.TXT</h3>
            <div className="text-xs text-green-400/60 mt-1">
              &gt; Real-time battle feed
            </div>
          </div>
          
          <div 
            ref={moveHistoryRef}
            className="flex-1 p-4 overflow-y-auto text-sm space-y-1 max-h-96"
          >
            {moveHistory.length === 0 ? (
              <div className="text-green-400/60 italic">
                &gt; Awaiting first move...
              </div>
            ) : (
              moveHistory.map((move, index) => (
                <div key={index} className="flex items-start gap-2">
                  <span className="text-green-400/60 text-xs mt-0.5">
                    {String(Math.floor(index / 2) + 1).padStart(2, '0')}.
                  </span>
                  <span className={`${index % 2 === 0 ? 'text-blue-400' : 'text-red-400'}`}>
                    {index % 2 === 0 ? 'GPT' : 'CLD'}:
                  </span>
                  <span className="text-green-400 font-mono">
                    {move}
                  </span>
                </div>
              ))
            )}
            
            {/* Current turn indicator */}
            {currentPlayer && (
              <div className="flex items-center gap-2 pt-2 border-t border-green-400/30">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-green-300 text-xs">
                  {currentPlayer.includes('GPT') ? 'GPT THINKING...' : 'CLAUDE THINKING...'}
                </span>
              </div>
            )}
          </div>

          {/* Terminal footer */}
          <div className="p-4 border-t border-green-400 text-xs text-green-400/60">
            <div>&gt; Connection: SECURE</div>
            <div>&gt; Status: MONITORING</div>
            <div>&gt; AI_BATTLE.EXE running...</div>
          </div>
        </div>
      </div>

      {/* Global styles */}
      <style jsx global>{`
        * {
          scrollbar-width: thin;
          scrollbar-color: #22c55e #000000;
        }
        
        *::-webkit-scrollbar {
          width: 8px;
        }
        
        *::-webkit-scrollbar-track {
          background: #000000;
          border: 1px solid #22c55e;
        }
        
        *::-webkit-scrollbar-thumb {
          background: #22c55e;
          border-radius: 0;
        }
        
        *::-webkit-scrollbar-thumb:hover {
          background: #16a34a;
        }
      `}</style>
    </div>
  );
}
