# AI Chess Battle

This project implements a simple web application where two AI models (GPT and Claude) continuously play games of chess against each other.  The application tracks the number of wins for each engine and shows them in a scoreboard at the top of the page.  A configurable token string (for example, a cryptocurrency contract address) is displayed with a convenient copy button.

The frontend is built with **Next.js** and **React**, using the [`chess.js`](https://www.npmjs.com/package/chess.js) library to validate moves and [`react-chessboard`](https://www.npmjs.com/package/react-chessboard) to render the board.  The backend exposes a single API route that proxies calls to OpenAI and Anthropic so your API keys remain secret.

## Getting started

1. Clone the repository and install dependencies:

   ```bash
   git clone https://github.com/yourusername/ai-chess-battle.git
   cd ai-chess-battle
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in the required keys and model names.  At a minimum you must provide:

   - `OPENAI_API_KEY` – a valid OpenAI API key.
   - `OPENAI_MODEL` – the name of the OpenAI chat model to use (e.g. `gpt-4o`).
   - `ANTHROPIC_API_KEY` – your Anthropic key.
   - `ANTHROPIC_MODEL` – the Anthropic model name (e.g. `claude-3-haiku-20240307`).
   - `NEXT_PUBLIC_TOKEN` – the token string to display at the top of the site.

3. Run the development server:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser to watch the engines battle it out.

## Deployment

This project is Vercel‑ready out of the box.  To deploy:

1. Push the code to a GitHub repository (see below for a manual approach if needed).
2. Sign in to [Vercel](https://vercel.com/) and create a new project linked to your repository.
3. In the Vercel dashboard, set the same environment variables you defined in `.env.local` (without the `NEXT_PUBLIC_` prefix for private keys).  Vercel automatically exposes variables prefixed with `NEXT_PUBLIC_` to the browser.
4. Deploy the project.  Vercel will build and host your site.

## Manually creating a GitHub repository

If you need to create the repository through the GitHub web interface, follow these steps:

1. Visit [https://github.com/new](https://github.com/new) while logged in.
2. Enter a repository name (e.g. `ai-chess-battle`) and description.
3. Leave it as a private or public repository as desired, and click **Create repository**.
4. In the new repository, click **Add file → Upload files**.  Drag the contents of this folder (not the folder itself) into the upload area.  Alternatively, click **Add file → Create new file** to create each file manually and paste the contents.
5. Commit the files to the `main` branch.

After the files are committed, you can proceed with the Vercel deployment.

## Caveats

- The AI engines sometimes produce illegal or malformed moves.  When that happens, the app falls back to a random legal move to keep the game flowing.
- The win counters persist in `localStorage` and will reset if you clear your browser data.
- Long‑running games can consume API credits from both OpenAI and Anthropic.  Monitor your usage accordingly.
