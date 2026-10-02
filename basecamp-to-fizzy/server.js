import "dotenv/config";
import express from "express";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const sessions = new Map();
const SESSION_COOKIE = "basecamp_fizzy_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24;

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/auth/logout", (req, res) => {
  const header = req.headers.cookie || "";
  const match = header.match(new RegExp("(?:^|;\\s*)" + SESSION_COOKIE + "=([^;]+)"));
  if (match) sessions.delete(match[1]);

  res.setHeader(
    "Set-Cookie",
    SESSION_COOKIE + "=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0"
  );
  res.status(204).end();
});

function setSessionCookie(res, id) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    SESSION_COOKIE + "=" + id + "; HttpOnly; SameSite=Lax; Path=/; Max-Age=" +
      Math.floor(SESSION_TTL_MS / 1000) +
      secure
  );
}

function sessionId() {
  return crypto.randomBytes(24).toString("hex");
}

function getSession(req) {
  const header = req.headers.cookie || "";
  const match = header.match(new RegExp("(?:^|;\\s*)" + SESSION_COOKIE + "=([^;]+)"));
  if (!match) return null;

  const id = match[1];
  const session = sessions.get(id);

  if (!session || Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessions.delete(id);
    return null;
  }

  return session;
}

async function basecampRequest(session, endpoint, options = {}) {
  async function request() {
    return fetch(endpoint, {
      ...options,
      headers: {
        Authorization: "Bearer " + session.basecamp.accessToken,
        Accept: "application/json",
        "User-Agent": "Basecamp → Fizzy community importer (https://github.com/warmtoast-dev/portfolio-dev)",
        ...(options.headers || {})
      }
    });
  }

  let response = await request();

  if (response.status === 401 && session.basecamp.refreshToken) {
    const refreshResponse = await fetch(
      "https://launchpad.37signals.com/authorization/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: session.basecamp.refreshToken,
          client_id: process.env.BASECAMP_CLIENT_ID,
          client_secret: process.env.BASECAMP_CLIENT_SECRET
        })
      }
    );

    if (refreshResponse.ok) {
      const refreshed = await refreshResponse.json();
      session.basecamp.accessToken = refreshed.access_token;
      session.basecamp.refreshToken =
        refreshed.refresh_token || session.basecamp.refreshToken;
      session.basecamp.expiresAt =
        Date.now() + Number(refreshed.expires_in || 1209600) * 1000;
      response = await request();
    }
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      "Basecamp API returned " + response.status + ": " + body.slice(0, 300)
    );
  }

  return response;
}

async function basecampFetch(session, endpoint, options = {}) {
  const response = await basecampRequest(session, endpoint, options);
  return response.json();
}

async function basecampFetchAll(session, endpoint) {
  const items = [];
  let nextUrl = endpoint;

  while (nextUrl) {
    const response = await basecampRequest(session, nextUrl);
    const page = await response.json();

    if (!Array.isArray(page)) {
      throw new Error("Basecamp returned a non-list response from " + nextUrl);
    }

    items.push(...page);

    const link = response.headers.get("link") || "";
    const nextMatch = link.match(/<([^>]+)>;\\s*rel="next"/i);
    nextUrl = nextMatch ? nextMatch[1] : null;
  }

  return items;
}

async function fizzyFetch(endpoint, options = {}) {
  if (!process.env.FIZZY_API_TOKEN) {
    throw new Error("Fizzy API token is not configured on this server yet.");
  }

  const response = await fetch("https://app.fizzy.do" + endpoint, {
    ...options,
    headers: {
      Authorization: "Bearer " + process.env.FIZZY_API_TOKEN,
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "Basecamp to Fizzy (community importer)",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error("Fizzy API returned " + response.status + ": " + body.slice(0, 300));
  }

  return response.status === 204 ? null : response.json();
}

async function fizzyAccount() {
  const identity = await fizzyFetch("/my/identity");
  const account = identity.accounts?.[0];
  if (!account) throw new Error("No Fizzy account is available for this token.");
  return account;
}

function buildDescription(card) {
  const description = card.content || "";
  if (!card.due_on) return description;

  return [
    description,
    "",
    "---",
    "Basecamp due date: " + card.due_on
  ].join("\n");
}

function buildTitle(card) {
  return card.on_hold ? "ON HOLD: " + card.title : card.title;
}

function targetColumnName(basecampColumnName) {
  return basecampColumnName.trim().toLowerCase() === "triage"
    ? "Maybe"
    : basecampColumnName;
}

app.get("/auth/basecamp", (req, res) => {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.BASECAMP_CLIENT_ID,
    redirect_uri: process.env.BASECAMP_REDIRECT_URI
  });

  res.redirect("https://launchpad.37signals.com/authorization/new?" + params);
});

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

    if (!tokenResponse.ok) return res.status(502).send("Basecamp token exchange failed.");

    const token = await tokenResponse.json();

    const authResponse = await fetch(
      "https://launchpad.37signals.com/authorization.json",
      {
        headers: {
          Authorization: "Bearer " + token.access_token,
          Accept: "application/json"
        }
      }
    );

    const authorization = await authResponse.json();
    const account = authorization.accounts.find((item) => item.product === "bc3");

    if (!account) return res.status(400).send("No Basecamp account available.");

    const id = sessionId();
    sessions.set(id, {
      createdAt: Date.now(),
      basecamp: {
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt: Date.now() + (Number(token.expires_in || 1209600) * 1000),
        account
      }
    });

    setSessionCookie(res, id);
    res.redirect("/");
  } catch (error) {
    console.error(error);
    res.status(500).send("Basecamp authentication failed.");
  }
});

app.get("/api/projects", async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: "Not authenticated." });

    const data = await basecampFetchAll(
      session,
      session.basecamp.account.href + "/projects.json"
    );
    res.json(data);
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

function findCardTableTool(dock = []) {
  return dock.find((item) => {
    if (item.enabled === false) return false;

    const name = String(item.name || "").trim().toLowerCase();

    return (
      name === "kanban_board" ||
      name === "card_table" ||
      name === "card table" ||
      name === "kanban board"
    );
  });
}

async function getCardTablesForProject(session, project) {
  const projectData = await basecampFetch(
    session,
    session.basecamp.account.href + "/projects/" + project.id + ".json"
  );

  const tool = findCardTableTool(projectData.dock);

  if (!tool?.url) return [];

  const table = await basecampFetch(session, tool.url);

  return [{
    ...table,
    projectName: project.name,
    projectId: project.id
  }];
}

app.get("/api/card-tables", async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: "Not authenticated." });

    const projects = await basecampFetch(
      session,
      session.basecamp.account.href + "/projects.json"
    );

    const cardTables = [];
    for (const project of projects) {
      const tables = await getCardTablesForProject(session, project);
      cardTables.push(...tables);
    }

    res.json(cardTables);
  } catch (error) {
    console.error(error);
    res.status(502).json({ error: error.message });
  }
});

app.get("/api/projects/:projectId/card-tables", async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: "Not authenticated." });

    const project = await basecampFetch(
      session,
      session.basecamp.account.href + "/projects/" + req.params.projectId + ".json"
    );

    const tool = findCardTableTool(project.dock);

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
      session.basecamp.account.href + "/card_tables/" + req.params.id + ".json"
    );

    const enrichedColumns = [];

    for (const column of table.lists || []) {
      const cards = await basecampFetchAll(session, column.cards_url);

      enrichedColumns.push({ ...column, cards });
    }

    res.json({ ...table, columns: enrichedColumns });
  } catch (error) {
    console.error(error);
    res.status(502).json({ error: error.message });
  }
});

app.post("/api/import", async (req, res) => {
  try {
    const session = getSession(req);
    if (!session) return res.status(401).json({ error: "Not authenticated." });

    const { cardTableId } = req.body;
    if (!cardTableId) return res.status(400).json({ error: "Choose a Basecamp Card Table." });

    const table = await basecampFetch(
      session,
      session.basecamp.account.href + "/card_tables/" + cardTableId + ".json"
    );

    const enrichedColumns = [];

    for (const column of table.lists || []) {
      const cards = await basecampFetch(session, column.cards_url);

      const onHoldCards = column.on_hold?.cards_url
        ? await basecampFetchAll(session, column.on_hold.cards_url)
        : [];

      enrichedColumns.push({
        ...column,
        cards: [
          ...cards,
          ...onHoldCards.map((card) => ({ ...card, on_hold: true }))
        ]
      });
    }

    const cardTable = { ...table, lists: enrichedColumns };
    const account = await fizzyAccount();
    const accountSlug = account.slug;

    const board = await fizzyFetch(accountSlug + "/boards", {
      method: "POST",
      body: JSON.stringify({ board: { name: cardTable.title } })
    });

    const boardId = board?.id;
    if (!boardId) throw new Error("Fizzy created the board but did not return its ID.");

    const existingColumns = await fizzyFetch(
      accountSlug + "/boards/" + boardId + "/columns"
    );

    const existingByName = new Map(
      existingColumns.map((column) => [String(column.name).trim().toLowerCase(), column])
    );

    const columnMap = new Map();

    for (const basecampColumn of cardTable.lists) {
      const destination = targetColumnName(basecampColumn.title);
      const key = destination.trim().toLowerCase();

      // Fizzy's Maybe, Not Now, and Done are card states, not workflow
      // columns. Only create/reuse actual workflow columns here.
      if (["maybe", "not now", "done"].includes(key)) {
        columnMap.set(basecampColumn.id, {
          id: null,
          name: destination
        });
        continue;
      }

      let fizzyColumn = existingByName.get(key);

      if (!fizzyColumn) {
        const created = await fizzyFetch(
          accountSlug + "/boards/" + boardId + "/columns",
          {
            method: "POST",
            body: JSON.stringify({ column: { name: destination } })
          }
        );

        fizzyColumn = created?.id
          ? created
          : await findFizzyColumn(accountSlug, boardId, destination);
      }

      if (!fizzyColumn?.id) {
        throw new Error("Could not find or create Fizzy column: " + destination);
      }

      columnMap.set(basecampColumn.id, {
        id: fizzyColumn.id,
        name: destination
      });
    }

    let cardsCreated = 0;

    for (const basecampColumn of cardTable.lists) {
      const destination = targetColumnName(basecampColumn.title).trim().toLowerCase();

      for (const card of basecampColumn.cards || []) {
        const createdCard = await fizzyFetch(
          accountSlug + "/boards/" + boardId + "/cards",
          {
            method: "POST",
            body: JSON.stringify({
              card: {
                title: buildTitle(card),
                description: buildDescription(card)
              }
            })
          }
        );

        cardsCreated += 1;

        const cardNumber = createdCard?.number;
        if (!cardNumber) {
          throw new Error("Fizzy created a card without returning its card number.");
        }

        const target = columnMap.get(basecampColumn.id);

        if (destination === "done") {
          await fizzyFetch(
            accountSlug + "/cards/" + cardNumber + "/closure",
            { method: "POST" }
          );
        } else if (destination === "not now") {
          await fizzyFetch(
            accountSlug + "/cards/" + cardNumber + "/not_now",
            { method: "POST" }
          );
        } else if (target?.id) {
          await fizzyFetch(
            accountSlug + "/cards/" + cardNumber + "/triage",
            {
              method: "POST",
              body: JSON.stringify({ column_id: target.id })
            }
          );
        }
      }
    }

    res.json({
      status: "imported",
      boardTitle: cardTable.title,
      cardsCreated,
      boardUrl: "https://app.fizzy.do" + accountSlug + "/boards/" + boardId
    });
  } catch (error) {
    console.error(error);
    res.status(502).json({ error: error.message });
  }
});

async function findFizzyColumn(accountSlug, boardId, name) {
  const columns = await fizzyFetch(accountSlug + "/boards/" + boardId + "/columns");
  return columns.find((column) => column.name === name);
}

const requiredConfig = [
  "BASECAMP_CLIENT_ID",
  "BASECAMP_CLIENT_SECRET",
  "BASECAMP_REDIRECT_URI",
  "FIZZY_API_TOKEN"
];

const missingConfig = requiredConfig.filter((name) => !process.env[name]);

if (missingConfig.length) {
  console.error("Missing required environment variables: " + missingConfig.join(", "));
  process.exit(1);
}

app.listen(PORT, () => {
  console.log("Basecamp → Fizzy running at http://localhost:" + PORT);
});
