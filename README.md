# OFM-AGENT (Chatter Desk)

Private web tool for chatters. Paste a subscriber message, get a ready to send reply in the creator's texting voice. You read every reply and send it yourself. Nothing here logs into or posts to any platform.

## What is in the repo

- `index.html` the page (no build step)
- `api/generate.js` serverless function that calls the Claude API
- `lib/systemPrompt.js` the voice, scripts, ban list and honesty rules. Edit this file to change how replies sound
- `.env.example` the environment variables you need

## Deploy on Vercel

1. Push this repo to GitHub.
2. In Vercel choose Add New > Project and import the repo. No build settings are needed.
3. Under Settings > Environment Variables add:
   - `ANTHROPIC_API_KEY` your key from console.anthropic.com
   - `APP_PASSWORD` a long shared password for your chatters
4. Deploy, open the site, tap **password** at the top and enter the same `APP_PASSWORD`.

Netlify or any host that runs Node serverless functions works too, but the function would need a small wrapper there.

## Using it

- Paste the sub's message, optionally add context and objective, then **Get reply**.
- Fill **PPV content** and **Price** only with real details. If they are empty the assistant will not invent them and will add a NOTE line.
- Use the revise buttons (3 options, why, shorter, more flirty, more casual, less salesy) on the last reply.
- **new sub** clears the conversation so one sub's context does not leak into the next.
- Tap a line to copy it. Each line is meant to be sent as its own message.

## Adding the rest of the ban list

Your list was cut off after M. Add the missing words to the `BAN LIST` section in `lib/systemPrompt.js`.

## Keep it private

The API key never reaches the browser, but anyone who knows the URL and the password can spend your credits. Keep `APP_PASSWORD` long and only share it with your team.
