/*
 * API endpoint that returns the current global game state.
 * All users poll this endpoint to get synchronized game updates.
 */

// Temporary simple game state (replace with proper game manager later)
const gameState = {
  fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  gptWins: 0,
  claudeWins: 0,
  gameStatus: 'Waiting for game to start...',
  currentPlayer: 'GPT',
  gameId: 1,
  viewers: 0
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {    
    res.status(200).json(gameState);
  } catch (error) {
    console.error('Error getting game state:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
