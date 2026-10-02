import "dotenv/config";
import express from "express";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const sessions = new Map();

function sessionId() {
  return crypto.randomBytes(24).toString("hex");
}

function getSession(req) {
  const id = req.headers["x-session-id"];
  return id ? sessions.get(id) : null;
}

async function basecampFetch(session, endpoint, options = {}) {
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      Authorization: `Bearer ${session.basecamp.accessToken}`,
      Accept: "application/json",
      "User-Agent": "Basecamp to Fizzy (community importer)",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    throw new Error(`Basecamp API returned ${response.status}`);
  }

  return response.json();
}

async function fizzyFetch(token, endpoint, options = {}) {
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Fizzy API returned ${response.status}: ${body.slice(0, 300)}`);
  }

  return response.status === 204 ? null : response.json();
}

function buildDescription(card) {
  const description = card.content || "";
  if (!card.due_on) return description;

  return [
    description,
    "",
    "---",
    `Basecamp due date: ${card.due_on}`
  ].join("\n");
}

function buildTitle(card) {
  return card.on_hold ? `ON HOLD: ${card.title}` : card.title;
}

function targetColumnName(basecampColumnName) {
  return basecampColumnName.trim().toLowerCase() === "triage"
    ? "Maybe"
    : basecampColumnName;
}

// Start Basecamp OAuth.
app.get("/auth/basecamp", (req, res) => {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.BASECAMP_CLIENT_ID,
    redirect_uri: process.env.BASECAMP_REDIRECT_URI
  });

  res.redirect(`https://launchpad.37signals.com/authorization/new?${params}`);
});

// OAuth callback.
app.get("/auth/basecamp/callback", async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).send("Missing Basecamp authorization code.");

    const tokenResponse = await fetch(
      "https://launchpad.37signals.com/authorization/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: process.env.BASECAMP_CLIENT_ID,
          client_secret: process.env.BASECAMP_CLIENT_SECRET,
          redirect_uri: process.env.BASECAMP_REDIRECT_URI,
          code
        })
      }
    );

    if (!tokenResponse.ok) {
      return res.status(502).send("Basecamp token exchange failed.");
    }

    const token = await tokenResponse.json();

    const authResponse = await fetch(
      "https://launchpad.37signals.com/authorization.json",
      {
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          Accept: "application/json"
        }
      }
    );

    const authorization = await authResponse.json();
    const account = authorization.accounts.find(
      (item) => item.product === "bc3"
    );

    if (!account) return res.status(400).send("No Basecamp account available.");

    const id = sessionId();

    sessions.set(id, {
      basecamp: {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        account
      }
    });

    res.redirect(`/?session=${id}`);
  } catch (error) {
    console.error(error);
    res.status(500).send("Basecamp authentication failed.");
  }
});

app.get("/api/projects", async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: "Not authenticated." });

    const data = await basecampFetch(
      session,
      `${session.basecamp.account.href}/projects.json`
    );

    res.json(data);
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.get("/api/projects/:projectId/card-tables", async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: "Not authenticated." });

    const project = await basecampFetch(
      session,
      `${session.basecamp.account.href}/projects/${req.params.projectId}.json`
    );

    const tool = project.dock?.find(
      (item) => item.name === "Card Table" || item.name === "Kanban Board"
    );

    if (!tool?.url) return res.json([]);

    const table = await basecampFetch(session, tool.url);
    res.json([table]);
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.get("/api/card-table/:id", async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: "Not authenticated." });

    const table = await basecampFetch(
      session,
      `${session.basecamp.account.href}/card_tables/${req.params.id}.json`
    );

    const columns = await basecampFetch(
      session,
      `${session.basecamp.account.href}/card_tables/${req.params.id}/columns.json`
    );

    const enrichedColumns = [];

    for (const column of columns) {
      const cards = await basecampFetch(
        session,
        `${session.basecamp.account.href}/card_tables/columns/${column.id}/cards.json`
      );

      enrichedColumns.push({
        ...column,
        cards
      });
    }

    res.json({ ...table, columns: enrichedColumns });
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

// The actual Fizzy import endpoint will be wired to the exact current
// board/column/card payloads after the first authenticated API smoke test.
app.post("/api/import", async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: "Not authenticated." });

    const { fizzyBaseUrl, fizzyToken, cardTable } = req.body;

    if (!fizzyBaseUrl || !fizzyToken || !cardTable) {
      return res.status(400).json({ error: "Missing import details." });
    }

    const preview = cardTable.columns.flatMap((column) =>
      column.cards.map((card) => ({
        title: buildTitle(card),
        description: buildDescription(card),
        column: targetColumnName(column.title)
      }))
    );

    // Deliberately keep this response in preview mode until the exact
    // production Fizzy write payload is smoke-tested against a real board.
    // This prevents an early public build from accidentally creating
    // malformed or duplicate cards.
    res.json({
      status: "preview",
      boardTitle: cardTable.title,
      columns: [...new Set(cardTable.columns.map((c) => targetColumnName(c.title)))],
      cards: preview
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Basecamp → Fizzy running at http://localhost:${PORT}`);
});
