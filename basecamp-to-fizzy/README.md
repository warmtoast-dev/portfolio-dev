# Basecamp → Fizzy

A small, free, open-source community tool for importing a Basecamp Card Table into a brand-new Fizzy board.

The project is intentionally **self-hosted**. You run your own copy, connect your own Basecamp account, and provide your own Fizzy API token. No shared credentials or central database are required.

## What it does

1. Connect Basecamp with OAuth 2.0.
2. Choose one Basecamp Card Table.
3. Create a new Fizzy board with the same name.
4. Import the cards and preserve their important Card Table state.

### Mapping

| Basecamp | Fizzy |
| --- | --- |
| Card Table name | New board name |
| Triage | Maybe |
| Not Now | Not Now |
| Done | Done |
| Other columns | Same-named Fizzy workflow columns |
| On Hold card | Same column + `ON HOLD: ` title prefix |
| Due date | Appended to card description |

The importer does not currently migrate assignees, comments, attachments, or existing Fizzy boards.

## Why self-hosted?

Basecamp requires OAuth 2.0 for public integrations, so each person can authorize their own Basecamp account without sharing a password. https://github.com/basecamp/bc-api/blob/master/sections/authentication.md

Fizzy's current API uses personal access tokens. A public hosted version would therefore require a proper per-user credential architecture before it could safely accept other people's Fizzy tokens.

For this first public release, the safest model is:

```
your computer / your server
        |
        +-- your Basecamp OAuth credentials
        |
        +-- your Fizzy API token
        |
        +-- Basecamp → Fizzy importer
```

Your credentials stay in your own environment. The app keeps Basecamp OAuth tokens in memory for the current session and does not put them in browser storage. Restarting the server logs the session out.

## Requirements

- Node.js 20+
- A Basecamp account with access to the Card Table you want to import
- A Basecamp OAuth integration
- A Fizzy personal access token with the permissions required to create boards/cards

## Local setup

### 1. Clone the repository

```bash
git clone https://github.com/warmtoast-dev/portfolio-dev.git
cd portfolio-dev/basecamp-to-fizzy
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create a Basecamp integration

Register an integration through Basecamp's integration page:

https://launchpad.37signals.com/integrations

For local development, set the redirect URI to:

```
http://localhost:3000/auth/basecamp/callback
```

For a deployed self-hosted instance, use:

```
https://YOUR-DOMAIN/auth/basecamp/callback
```

### 4. Create your environment file

```bash
cp .env.example .env
```

Fill in:

```env
BASECAMP_CLIENT_ID=your_basecamp_client_id
BASECAMP_CLIENT_SECRET=your_basecamp_client_secret
BASECAMP_REDIRECT_URI=http://localhost:3000/auth/basecamp/callback
FIZZY_API_TOKEN=your_fizzy_api_token
PORT=3000
```

**Never commit `.env`.**

### 5. Start

For development:

```bash
npm run dev
```

For a normal deployment:

```bash
npm start
```

Open:

http://localhost:3000

## Deploying your own copy

You can run the app on any Node.js host that supports a long-running Node process.

Set these environment variables on the host:

- `BASECAMP_CLIENT_ID`
- `BASECAMP_CLIENT_SECRET`
- `BASECAMP_REDIRECT_URI`
- `FIZZY_API_TOKEN`
- `PORT` if your host requires a specific port

Then update the Basecamp integration's redirect URI to exactly match `BASECAMP_REDIRECT_URI`.

Use HTTPS for anything exposed to the public internet.

The current v1 deliberately has no database. Sessions are stored in memory, so a server restart signs users out. This also means there is no persistent credential database to maintain.

## Security notes

- Do not put `FIZZY_API_TOKEN` in frontend JavaScript.
- Do not commit `.env`.
- Do not log OAuth access or refresh tokens.
- The app uses an HttpOnly, SameSite session cookie.
- Basecamp access tokens expire; the server refreshes them when Basecamp returns an authentication failure.
- This project is not a "Login with Basecamp" identity provider. Basecamp itself warns against using OAuth as generic third-party login because the returned email address is not verified for that purpose. https://github.com/basecamp/bc-api/blob/master/sections/authentication.md

## Development

```bash
npm run dev
```

Before making API changes, check the official documentation:

- https://github.com/basecamp/bc-api
- https://github.com/basecamp/fizzy/tree/main/docs

The project has an `AGENTS.md` with the product and architectural constraints that should be preserved.

## Current limitations

- One Card Table per import.
- Every import creates a new Fizzy board.
- No existing-board import.
- No assignee migration.
- No comment migration.
- No attachment migration.
- No database.
- No hosted multi-user credential management.
- Basecamp collection pagination should be handled before relying on this for very large Card Tables.

## License

See the repository license. If you fork this project, keep the attribution and API terms required by Basecamp and Fizzy.
