import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import the chessboard component because it relies on browser APIs
const Chessboard = dynamic(
  () => import('react-chessboard').then((mod) => mod.Chessboard),
  { ssr: false }
);

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

  const terminalStyles = {
    container: {
      minHeight: '100vh',
      backgroundColor: '#000000',
      color: '#00ff00',
      fontFamily: 'monospace',
      position: 'relative',
      overflow: 'hidden'
    },
    background: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      opacity: 0.03,
      fontSize: '8px',
      lineHeight: '8px',
      wordBreak: 'break-all',
      pointerEvents: 'none',
      zIndex: 1
    },
    mainContent: {
      position: 'relative',
      zIndex: 10,
      display: 'flex',
      minHeight: '100vh'
    },
    leftPanel: {
      flex: 1,
      padding: '20px'
    },
    header: {
      border: '1px solid #00ff00',
      backgroundColor: 'rgba(0, 0, 0, 0.95)',
      padding: '15px',
      marginBottom: '20px',
      boxShadow: '0 0 20px rgba(0, 255, 0, 0.3)'
    },
    headerTop: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '15px'
    },
    tokenSection: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px'
    },
    token: {
      color: '#00ff00',
      backgroundColor: 'rgba(0, 255, 0, 0.1)',
      padding: '5px 10px',
      border: '1px solid rgba(0, 255, 0, 0.3)',
      fontFamily: 'monospace'
    },
    button: {
      padding: '5px 15px',
      border: '1px solid #00ff00',
      backgroundColor: '#000000',
      color: '#00ff00',
      cursor: 'pointer',
      fontFamily: 'monospace',
      transition: 'all 0.2s'
    },
    statsSection: {
      display: 'flex',
      alignItems: 'center',
      gap: '20px',
      fontSize: '14px'
    },
    gameStatus: {
      textAlign: 'center',
      marginBottom: '20px'
    },
    gameTitle: {
      fontSize: '24px',
      fontWeight: 'bold',
      color: '#00ff00',
      marginBottom: '10px'
    },
    currentTurn: {
      color: 'rgba(0, 255, 0, 0.8)',
      fontSize: '14px'
    },
    chessboardContainer: {
      display: 'flex',
      justifyContent: 'center',
      marginBottom: '20px'
    },
    chessboardWrapper: {
      border: '2px solid #00ff00',
      boxShadow: '0 0 30px rgba(0, 255, 0, 0.4)'
    },
    liveIndicator: {
      textAlign: 'center'
    },
    liveButton: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      padding: '10px 20px',
      border: '1px solid #00ff00',
      backgroundColor: 'rgba(0, 255, 0, 0.1)',
      color: '#00ff00',
      fontSize: '12px'
    },
    pulsingDot: {
      width: '8px',
      height: '8px',
      backgroundColor: '#00ff00',
      borderRadius: '50%',
      animation: 'pulse 2s infinite'
    },
    sidebar: {
      width: '350px',
      borderLeft: '1px solid #00ff00',
      backgroundColor: 'rgba(0, 0, 0, 0.98)',
      display: 'flex',
      flexDirection: 'column'
    },
    sidebarHeader: {
      padding: '20px',
      borderBottom: '1px solid #00ff00'
    },
    sidebarTitle: {
      color: '#00ff00',
      fontWeight: 'bold',
      fontSize: '18px',
      marginBottom: '5px'
    },
    sidebarSubtitle: {
      fontSize: '12px',
      color: 'rgba(0, 255, 0, 0.6)'
    },
    moveHistoryContainer: {
      flex: 1,
      padding: '20px',
      overflowY: 'auto',
      maxHeight: '400px'
    },
    moveEntry: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: '8px',
      marginBottom: '8px',
      fontSize: '14px'
    },
    moveNumber: {
      color: 'rgba(0, 255, 0, 0.6)',
      fontSize: '12px',
      minWidth: '25px'
    },
    playerName: {
      minWidth: '40px',
      fontSize: '12px'
    },
    gptMove: {
      color: '#4FC3F7'
    },
    claudeMove: {
      color: '#FF5722'
    },
    moveNotation: {
      color: '#00ff00',
      fontFamily: 'monospace'
    },
    thinkingIndicator: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      paddingTop: '15px',
      borderTop: '1px solid rgba(0, 255, 0, 0.3)',
      marginTop: '15px'
    },
    sidebarFooter: {
      padding: '20px',
      borderTop: '1px solid #00ff00',
      fontSize: '12px',
      color: 'rgba(0, 255, 0, 0.6)'
    },
    emptyState: {
      color: 'rgba(0, 255, 0, 0.6)',
      fontStyle: 'italic',
      fontSize: '14px'
    }
  };

  return (
    <div style={terminalStyles.container}>
      {/* Terminal background pattern */}
      <div style={terminalStyles.background}>
        {Array(300).fill('01010101 ').join('')}
      </div>
      
      <div style={terminalStyles.mainContent}>
        {/* Main content */}
        <div style={terminalStyles.leftPanel}>
          {/* Header */}
          <div style={terminalStyles.header}>
            <div style={terminalStyles.headerTop}>
              {/* Token display */}
              <div style={terminalStyles.tokenSection}>
                <span>TOKEN:</span>
                <span style={terminalStyles.token}>{token}</span>
                <button
                  onClick={copyToken}
                  style={terminalStyles.button}
                  onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(0, 255, 0, 0.1)'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = '#000000'}
                >
                  COPY
                </button>
              </div>
              
              {/* Stats */}
              <div style={terminalStyles.statsSection}>
                <span>👥 {viewers} WATCHING</span>
                <span>GPT: {gptWins}</span>
                <span>CLAUDE: {claudeWins}</span>
                <button
                  onClick={refreshGameState}
                  style={terminalStyles.button}
                  onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(0, 255, 0, 0.1)'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = '#000000'}
                >
                  REFRESH
                </button>
              </div>
            </div>
          </div>

          {/* Game status */}
          <div style={terminalStyles.gameStatus}>
            <div style={terminalStyles.gameTitle}>
              TERMINAL OF CHESS
            </div>
            <div style={terminalStyles.gameTitle}>
              {gameStatus} {gameId > 0 && `[GAME #${gameId}]`}
            </div>
            {currentPlayer && (
              <div style={terminalStyles.currentTurn}>
                &gt; {currentPlayer}
              </div>
            )}
          </div>

          {/* Chessboard */}
          <div style={terminalStyles.chessboardContainer}>
            <div style={terminalStyles.chessboardWrapper}>
              <Chessboard
                position={fen}
                arePiecesDraggable={false}
                boardWidth={500}
                boardOrientation="white"
              />
            </div>
          </div>

          {/* Live indicator */}
          <div style={terminalStyles.liveIndicator}>
            <div style={terminalStyles.liveButton}>
              <div style={terminalStyles.pulsingDot}></div>
              <span>LIVE GLOBAL BATTLE</span>
            </div>
          </div>
        </div>

        {/* Sidebar - Move History */}
        <div style={terminalStyles.sidebar}>
          <div style={terminalStyles.sidebarHeader}>
            <h3 style={terminalStyles.sidebarTitle}>MOVE_LOG.TXT</h3>
            <div style={terminalStyles.sidebarSubtitle}>
              &gt; Real-time battle feed
            </div>
          </div>
          
          <div 
            ref={moveHistoryRef}
            style={terminalStyles.moveHistoryContainer}
          >
            {moveHistory.length === 0 ? (
              <div style={terminalStyles.emptyState}>
                &gt; Awaiting first move...
              </div>
            ) : (
              moveHistory.map((move, index) => (
                <div key={index} style={terminalStyles.moveEntry}>
                  <span style={terminalStyles.moveNumber}>
                    {String(Math.floor(index / 2) + 1).padStart(2, '0')}.
                  </span>
                  <span style={{
                    ...terminalStyles.playerName,
                    ...(index % 2 === 0 ? terminalStyles.gptMove : terminalStyles.claudeMove)
                  }}>
                    {index % 2 === 0 ? 'GPT' : 'CLD'}:
                  </span>
                  <span style={terminalStyles.moveNotation}>
                    {move}
                  </span>
                </div>
              ))
            )}
            
            {/* Current turn indicator */}
            {currentPlayer && (
              <div style={terminalStyles.thinkingIndicator}>
                <div style={terminalStyles.pulsingDot}></div>
                <span style={{ fontSize: '12px', color: '#00ff00' }}>
                  {currentPlayer.includes('GPT') ? 'GPT THINKING...' : 'CLAUDE THINKING...'}
                </span>
              </div>
            )}
          </div>

          {/* Terminal footer */}
          <div style={terminalStyles.sidebarFooter}>
            <div>&gt; Connection: SECURE</div>
            <div>&gt; Status: MONITORING</div>
            <div>&gt; CHESS_BATTLE.EXE running...</div>
          </div>
        </div>
      </div>

      {/* CSS for animations */}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        /* Custom scrollbar */
        ::-webkit-scrollbar {
          width: 8px;
        }
        
        ::-webkit-scrollbar-track {
          background: #000000;
          border: 1px solid #00ff00;
        }
        
        ::-webkit-scrollbar-thumb {
          background: #00ff00;
          border-radius: 0;
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background: #00cc00;
        }
      `}</style>
    </div>
  );
}
