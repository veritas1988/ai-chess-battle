/*
 * API route that proxies requests to OpenAI and Anthropic to fetch the next
 * chess move. Because API keys are stored server-side, this endpoint
 * protects them from being exposed to the client. It accepts POST
 * requests containing a FEN string and an engine identifier ('gpt' or
 * 'claude') and returns a JSON object with a single `move` property.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  
  const { fen, ai } = req.body || {};
  if (typeof fen !== 'string' || typeof ai !== 'string') {
    return res.status(400).json({ error: 'Invalid request payload' });
  }
  
  const prompt =
    `You are a chess engine playing strictly according to FIDE rules. Given the board position represented by the following FEN string: "${fen}", you must output the best legal move for the side to move. Respond with exactly one move in plain UCI notation, such as e2e4 or b8c6. Do not include any additional text or commentary.`;

  try {
    let resultMove;
    
    if (ai === 'gpt') {
      // Check for API key
      if (!process.env.OPENAI_API_KEY) {
        console.error('OPENAI_API_KEY not found in environment variables');
        return res.status(500).json({ error: 'OpenAI API key not configured' });
      }
      
      // Compose request body for OpenAI's chat completion API. We keep the
      // maximum number of tokens low because a move is only four or five
      // characters long. Temperature is set low to encourage deterministic
      // responses.
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-4o',
          messages: [
            { role: 'system', content: 'You are a chess engine that always returns legal moves in UCI format.' },
            { role: 'user', content: prompt },
          ],
          max_tokens: 10,
          temperature: 0.2,
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI API error:', response.status, errorText);
        return res.status(500).json({ error: `OpenAI API error: ${response.status}` });
      }
      
      const data = await response.json();
      console.log('OpenAI response:', JSON.stringify(data, null, 2));
      resultMove = data?.choices?.[0]?.message?.content?.trim();
      
    } else if (ai === 'claude') {
      // Check for API key
      if (!process.env.ANTHROPIC_API_KEY) {
        console.error('ANTHROPIC_API_KEY not found in environment variables');
        return res.status(500).json({ error: 'Anthropic API key not configured' });
      }
      
      // Anthropic's messages API requires a version header and expects
      // different field names. See https://docs.anthropic.com/ for details.
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307',
          max_tokens: 10,
          temperature: 0.2,
          messages: [
            { role: 'user', content: prompt },
          ],
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Anthropic API error:', response.status, errorText);
        return res.status(500).json({ error: `Anthropic API error: ${response.status}` });
      }
      
      const data = await response.json();
      console.log('Anthropic response:', JSON.stringify(data, null, 2));
      // Anthropic returns an array of content blocks; the first block contains
      // the assistant's response text.
      resultMove = data?.content?.[0]?.text?.trim();
      
    } else {
      return res.status(400).json({ error: 'Unknown engine' });
    }
    
    console.log(`Raw response from ${ai}:`, resultMove);
    
    // Extract the first contiguous sequence of non-whitespace characters
    // because some models may include trailing punctuation or commentary.
    if (typeof resultMove === 'string' && resultMove.length > 0) {
      // Improved regex to match UCI notation more precisely
      const match = resultMove.match(/\b[a-h][1-8][a-h][1-8][qrnb]?\b/i);
      if (match) {
        const move = match[0].toLowerCase();
        console.log(`Extracted move from ${ai}: ${move}`);
        return res.status(200).json({ move });
      } else {
        console.log(`Could not extract valid UCI move from ${ai} response: "${resultMove}"`);
        // Try to extract any sequence that looks like a move
        const fallbackMatch = resultMove.match(/[a-h][1-8][a-h][1-8][qrnb]?/i);
        if (fallbackMatch) {
          const move = fallbackMatch[0].toLowerCase();
          console.log(`Fallback extracted move from ${ai}: ${move}`);
          return res.status(200).json({ move });
        }
      }
    }
    
    console.log(`No valid move found from ${ai}, returning null`);
    return res.status(200).json({ move: null });
    
  } catch (err) {
    console.error(`AI move error for ${ai}:`, err);
    return res.status(500).json({ 
      error: 'Internal server error',
      move: null 
    });
  }
}
