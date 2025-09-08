/*
 * API endpoint that returns the current global game state.
 * All users poll this endpoint to get synchronized game updates.
 */

import { Chess } from 'chess.js';  // Direct import for testing

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // For testing: Create a new chess instance (replace with your global state logic later)
    const chess = new Chess();
    const gameState = {
      fen: chess.fen(),
      turn: chess.turn(),
      moves: chess.history(),
      gameOver: chess.isGameOver(),
      // Add more fields as needed (e.g., players: { white: 'ChatGPT', black: 'Claude' })
    };
    
    res.status(200).json(gameState);
  } catch (error) {
    console.error('Error getting game state:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
