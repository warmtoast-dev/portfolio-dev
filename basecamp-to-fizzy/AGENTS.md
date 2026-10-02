# AGENTS.md

## Project

This directory contains the Basecamp → Fizzy community importer.

## Product rules

- The app imports a Basecamp Card Table into a brand-new Fizzy board.
- Never add a destination-board selector.
- The single Basecamp selector may display `Project — Card Table` to disambiguate duplicate names.
- Basecamp Triage maps to Fizzy Maybe.
- Basecamp Done maps to Fizzy Done.
- Basecamp Not Now maps to Fizzy Not Now.
- Basecamp On Hold cards remain in their source column and receive an `ON HOLD: ` title prefix.
- Basecamp due dates are appended to the Fizzy card description.
- Do not modify `public/styles.css` unless explicitly requested.

## Architecture

- Basecamp authentication is OAuth 2.0.
- Fizzy authentication uses a user-supplied personal access token stored server-side in the local `.env`.
- Basecamp and Fizzy credentials must never be sent to the browser or committed to Git.
- Browser authentication state uses the HttpOnly session cookie created by the server.
- Sessions are intentionally in-memory for the self-hosted v1. Restarting the process logs users out.

## API correctness

Before changing API calls, check the current official Basecamp or Fizzy API documentation. Do not infer endpoint names or response shapes from the UI.

## Scope

Keep v1 small. Do not introduce a database, hosted multi-user credential store, billing, analytics, tracking, or a hosted OAuth service unless explicitly requested.
