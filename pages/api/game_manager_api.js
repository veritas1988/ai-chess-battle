/*
 * Global game manager that maintains a single chess game state.
 * This runs on the server and ensures only one game is active at a time.
 */

import { Chess } from 'chess.js';

class GameManager {
  constructor() {
    this.game = new Chess();
    this.gptWins = 0;
    this.claudeWins = 0;
    this.gameId = 1;
    this.gameStatus = 'Starting...';
    this.currentPlayer = '';
    this.viewers = 0;
    this.isRunning = false;
    this.moveInProgress = false;
    
    // Start the game loop
    this.startGameLoop();
  }

  getGameState() {
    return {
      fen: this.game.fen(),
      gptWins: this.gptWins,
      claudeWins: this.claudeWins,
      gameId: this.gameId,
      gameStatus: this.gameStatus,
      currentPlayer: this.currentPlayer,
      viewers: this.viewers
    };
  }

  addViewer() {
    this.viewers++;
  }

  removeViewer() {
    this.viewers = Math.max(0, this.viewers - 1);
  }

  async requestMove(ai) {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fen: this.game.fen(), 
          ai 
        }),
      });
      
      if (!response.ok) {
        console.error(`AI API call failed for ${ai}:`, response.status);
        return undefined;
      }
      
      const data = await response.json();
      return typeof data.move === 'string' ? data.move.trim() : undefined;
    } catch (error) {
      console.error(`Error calling AI API for ${ai}:`, error);
      return undefined;
    }
  }

  applyAIMove(moveUci, playerName) {
    if (!this.game || typeof this.game.moves !== 'function') {
      console.error('Invalid game object');
      return false;
    }

    const moves = this.game.moves({ verbose: true });
    if (moves.length === 0) {
      console.log('No legal moves available');
      return false;
    }

    // Try to apply the AI's move
    const candidate = (typeof moveUci === 'string' && moveUci.length >= 4)
      ? {
          from: moveUci.slice(0, 2),
          to: moveUci.slice(2, 4),
          promotion: moveUci.length === 5 ? moveUci[4] : undefined,
        }
      : null;

    try {
      if (candidate) {
        const move = this.game.move(candidate);
        if (move) {
          console.log(`${playerName} played: ${moveUci} (${move.san})`);
          return true;
        }
      }
    } catch (err) {
      console.log(`${playerName}'s move ${moveUci} was invalid:`, err.message);
    }

    // Fallback to random move
    const randomMove = moves[Math.floor(Math.random() * moves.length)];
    try {
      const move = this.game.move(randomMove.san);
      console.log(`${playerName} fallback to random move: ${move.san}`);
      return true;
    } catch (err) {
      console.error(`Failed to apply fallback move: ${err.message}`);
      return false;
    }
  }

  async startGameLoop() {
    if (this.isRunning) return;
    this.isRunning = true;
    
    console.log('Starting global game loop...');

    while (this.isRunning) {
      try {
        console.log(`Starting game ${this.gameId}`);
        
        // Reset game
        this.game = new Chess();
        this.gameStatus = `Game ${this.gameId} in progress`;
        this.currentPlayer = 'GPT (White)';
        
        // Play the game
        while (!this.game.isGameOver() && this.isRunning) {
          // GPT move
          this.currentPlayer = 'GPT (White)';
          this.moveInProgress = true;
          
          const gptMove = await this.requestMove('gpt');
          if (!this.applyAIMove(gptMove, 'GPT')) {
            console.log('GPT failed to make a move, ending game');
            break;
          }
          
          this.moveInProgress = false;
          await this.sleep(2000); // Pause between moves
          
          if (this.game.isGameOver()) break;

          // Claude move
          this.currentPlayer = 'Claude (Black)';
          this.moveInProgress = true;
          
          const claudeMove = await this.requestMove('claude');
          if (!this.applyAIMove(claudeMove, 'Claude')) {
            console.log('Claude failed to make a move, ending game');
            break;
          }
          
          this.moveInProgress = false;
          await this.sleep(2000); // Pause between moves
        }

        // Determine winner
        let winner = '';
        if (this.game.isCheckmate()) {
          winner = this.game.turn() === 'b' ? 'gpt' : 'claude';
          this.gameStatus = `Checkmate! ${winner === 'gpt' ? 'GPT' : 'Claude'} wins!`;
        } else if (this.game.isStalemate()) {
          this.gameStatus = 'Stalemate - Draw!';
        } else if (this.game.isDraw()) {
          this.gameStatus = 'Draw!';
        } else {
          this.gameStatus = 'Game ended';
        }

        if (winner === 'gpt') {
          this.gptWins++;
        } else if (winner === 'claude') {
          this.claudeWins++;
        }

        this.currentPlayer = '';
        console.log(`Game ${this.gameId} finished: ${this.gameStatus}`);

        // Wait before next game
        await this.sleep(5000);
        this.gameId++;
        
      } catch (error) {
        console.error('Error in game loop:', error);
        this.gameStatus = 'Error occurred, restarting...';
        await this.sleep(3000);
      }
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  stop() {
    this.isRunning = false;
  }
}

// Global singleton instance
let gameManager = null;

export function getGameManager() {
  if (!gameManager) {
    gameManager = new GameManager();
  }
  return gameManager;
}

// Initialize on first import
if (typeof window === 'undefined') {
  // Only run on server
  getGameManager();
}