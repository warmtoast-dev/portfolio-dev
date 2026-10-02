# Basecamp → Fizzy

A small community importer that turns a Basecamp Card Table into a new Fizzy board.

## MVP rules

- Every import creates a **new Fizzy board**.
- Basecamp Card Table name → Fizzy board name.
- Basecamp **Triage** → Fizzy **Maybe**.
- Every other Basecamp column keeps the same name.
- Basecamp card title → Fizzy card title.
- Basecamp card description → Fizzy card description.
- Basecamp due date → appended to the description.
- Basecamp On Hold cards → title prefixed with `ON HOLD: `.
- No existing-board import in v1.
- No assignee/comment migration in v1.
- No persistent storage of user data in the app.

## Architecture

This is a small Node/Express app:

- Basecamp OAuth is handled server-side because the OAuth client secret must not be exposed in browser code.
- Basecamp data is fetched server-side.
- Fizzy is accessed with a personal access token supplied for the import session.
- The frontend is deliberately plain HTML/CSS/JS and is styled in the visual spirit of Basecamp/Fizzy rather than using a generic SaaS component library.

## Local setup

1. Create a Basecamp integration at https://launchpad.37signals.com/integrations
2. Set its redirect URI to:
   `http://localhost:3000/auth/basecamp/callback`
3. Copy `.env.example` to `.env`.
4. Fill in the Basecamp OAuth values.
5. Install dependencies:

```bash
npm install
```

6. Start the app:

```bash
npm run dev
```

7. Open http://localhost:3000

## Current status

The project is intentionally scaffolded around the smallest useful flow. API calls and mapping logic are isolated so they can be tested independently before deployment.

## API references

- Basecamp API: https://github.com/basecamp/bc-api
- Fizzy API: https://github.com/basecamp/fizzy/tree/main/docs/api

## Not in v1

- Importing into an existing Fizzy board
- Assignee mapping
- Comment migration
- Attachments
- Steps/checklists
- Duplicate detection
- Two-way sync
- Automatic retries
