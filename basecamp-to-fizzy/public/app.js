const $ = (id) => document.getElementById(id);
const state = { cardTables: [] };

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.headers || {})
    }
  });

  const text = await response.text();

  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(
      "Server returned invalid JSON (" +
      response.status +
      " " +
      response.statusText +
      ") from " +
      path +
      ": " +
      text.slice(0, 200)
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.error ||
      "Request failed (" + response.status + " " + response.statusText + ")"
    );
  }

  if (data === null) {
    throw new Error(
      "Server returned an empty response (" +
      response.status +
      " " +
      response.statusText +
      ") from " +
      path
    );
  }

  return data;
}

function show(id) {
  ["start", "workspace", "done"].forEach((name) =>
    $(name).classList.toggle("hidden", name !== id)
  );
}

async function loadCardTables() {
  if (!sessionId) return;

  $("start").classList.add("hidden");
  $("workspace").classList.remove("hidden");

  // Use the original Basecamp request flow, but load projects one at a time.
  // This avoids firing a request for every project simultaneously.
  const projects = await api("/api/projects");

  state.cardTables = [];
  $("cardTable").innerHTML = '<option value="">Loading Card Tables…</option>';
  $("import").disabled = true;

  for (const project of projects) {
    const tables = await api(
      "/api/projects/" + project.id + "/card-tables"
    );

    for (const table of tables) {
      state.cardTables.push({
        ...table,
        projectName: project.name
      });
    }
  }

  $("cardTable").innerHTML = state.cardTables.length
    ? state.cardTables
        .map((table) =>
          '<option value="' + table.id + '">' +
          escapeHtml(table.projectName + " — " + (table.title || table.name)) +
          "</option>"
        )
        .join("")
    : '<option value="">No Card Tables found</option>';

  $("import").disabled = !state.cardTables.length;
}

async function importSelected() {
  const cardTableId = $("cardTable").value;
  if (!cardTableId) return;

  const button = $("import");
  button.disabled = true;
  button.textContent = "Importing…";

  try {
    const data = await api("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardTableId })
    });

    show("done");

    $("result").innerHTML =
      "<strong>" + data.cardsCreated + " cards imported.</strong> " +
      '<a href="' + escapeHtml(data.boardUrl) +
      '" target="_blank" rel="noreferrer">Open the new Fizzy board →</a>';
  } catch (error) {
    button.disabled = false;
    button.textContent = "Import to Fizzy";
    alert(error.message);
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

$("import")?.addEventListener("click", importSelected);

loadCardTables().catch((error) => {
  console.error(error);
  alert(error.message);
});
