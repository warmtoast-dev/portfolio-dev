# Basecamp → Fizzy

A small community importer that turns a Basecamp Card Table into a new Fizzy board.

## MVP flow

1. Connect Basecamp.
2. Choose a Basecamp project.
3. Choose a Basecamp Card Table.
4. Click **Import to Fizzy**.

That's it. There is deliberately no destination-board selector: every import creates a new Fizzy board with the same name as the Basecamp Card Table.

## Mapping rules

- Basecamp Card Table name → Fizzy board name.
- Basecamp **Triage** → Fizzy **Maybe?** by leaving the card untriaged.
- Every other Basecamp column → Fizzy column with the exact same name.
- Basecamp card title → Fizzy card title.
- Basecamp card description → Fizzy card description.
- Basecamp due date → appended to the description.
- Basecamp On Hold cards → title prefixed with `ON HOLD: `.
- No existing-board import in v1.
- No assignee/comment migration in v1.

## Authentication

Basecamp uses OAuth 2.0. The app handles that server-side.

Fizzy currently exposes API authentication through personal access tokens. For the local MVP, the token is kept server-side in `.env` as `FIZZY_API_TOKEN`; it is never sent to the browser.

The official Fizzy API documents personal access tokens as the integration mechanism and warns that they must be kept secret.

## Local setup

1. Create a Basecamp integration at https://launchpad.37signals.com/integrations
2. Set its redirect URI to:
   `http://localhost:3000/auth/basecamp/callback`
3. Generate a Fizzy personal access token with **Read + Write** permission.
4. Copy `.env.example` to `.env`.
5. Fill in the Basecamp OAuth values and Fizzy token.
6. Install dependencies:

```bash
npm install
```

7. Start the app:

```bash
npm run dev
```

8. Open http://localhost:3000

## Current status

The UI now matches the intended one-click flow. The backend contains the real board/column/card write path using the current Fizzy API.

The next architectural step before making this a public hosted service is replacing the server-wide Fizzy token with per-user Fizzy authentication. Fizzy's current public API documents personal access tokens and magic-link session authentication rather than an OAuth-style third-party integration.

## API references

- Basecamp API: https://github.com/basecamp/bc-api
- Fizzy API: https://github.com/basecamp/fizzy/blob/main/docs/API.md
