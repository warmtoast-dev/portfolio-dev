const params = new URLSearchParams(location.search);
const sessionId = params.get("session");
const $ = (id) => document.getElementById(id);
const state = { cardTables: [] };

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(sessionId ? { "X-Session-Id": sessionId } : {})
    }
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
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

  // Keep the original working Basecamp API flow:
  // 1. fetch projects
  // 2. fetch Card Table for each project
  const projects = await api("/api/projects");

  const results = await Promise.all(
    projects.map(async (project) => {
      const tables = await api(
        "/api/projects/" + project.id + "/card-tables"
      );

      return tables.map((table) => ({
        ...table,
        projectName: project.name
      }));
    })
  );

  state.cardTables = results.flat();

  $("cardTable").innerHTML = state.cardTables
    .map((table) =>
      '<option value="' + table.id + '">' +
      escapeHtml(table.projectName + " — " + (table.title || table.name)) +
      "</option>"
    )
    .join("");

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
