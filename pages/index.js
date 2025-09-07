import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Chess } from 'chess.js';

// Dynamically import the chessboard component because it relies on browser APIs
const Chessboard = dynamic(() => import('react-chessboard'), { ssr: false });

/**
 * The main page renders a chess board and continuously pits two AI models
 * against each other.  A scoreboard and token display live in the header.
 */
export default function Home() {
  // Initialise a single Chess instance.  The object itself contains the
  // game state and is mutated as moves are applied.
  const gameRef = useRef(new Chess());

  // Represent the current board position using a FEN string.  Whenever
  // gameRef.current is mutated, updateFEN() should be called to refresh
  // the board displayed by react-chessboard.
  const [fen, setFen] = useState(gameRef.current.fen());

  // Keep track of each engine's total wins.  These values are persisted
  // locally in the browser so they survive page refreshes.
  const [gptWins, setGptWins] = useState(0);
  const [claudeWins, setClaudeWins] = useState(0);

  // Token to show on the page.  Expose it via a public environment variable.
  const token = process.env.NEXT_PUBLIC_TOKEN ?? '';

  /**
   * Persist win counters to localStorage whenever they change.  This effect
   * only runs in the browser because localStorage is undefined on the server.
   */

  conso
    useEffect(() => {

});
le.log('persist');

// t// persist
est

  // A guard to avoid starting multiple overlapping game loops.
  const runningRef = useRef(false);
