/*
 * API endpoint that returns the current global game state.
 * All users poll this endpoint to get synchronized game updates.
 */

import { getGameManager } from './game-manager';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const gameManager = getGameManager();
    const gameState = gameManager.getGameState();
    
    res.status(200).json(gameState);
  } catch (error) {
    console.error('Error getting game state:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
