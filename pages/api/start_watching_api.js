/*
 * API endpoint to increment the viewer count when someone starts watching.
 */

import { getGameManager } from './game-manager';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const gameManager = getGameManager();
    gameManager.addViewer();
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error adding viewer:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}