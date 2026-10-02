const params = new URLSearchParams(location.search);
const sessionId = params.get("session");
const $ = (id) => document.getElementById(id);
const state = { projects: [], cardTables: [] };

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { ...(options.headers || {}), ...(sessionId ? { "X-Session-Id": sessionId } : {}) }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

function show(id) {
  ["start", "workspace", "done"].forEach((name) => $(name).classList.toggle("hidden", name !== id));
}

async function loadProjects() {
  if (!sessionId) return;
  $("start").classList.add("hidden");
  $("workspace").classList.remove("hidden");
  state.projects = await api("/api/projects");
  $("project").innerHTML = state.projects.map((project) =>
    '<option value="' + project.id + '">' + escapeHtml(project.name) + "</option>"
  ).join("");
  await loadCardTables();
}

async function loadCardTables() {
  const projectId = $("project").value;
  state.cardTables = await api("/api/projects/" + projectId + "/card-tables");
  $("cardTable").innerHTML = state.cardTables.map((table) =>
    '<option value="' + table.id + '">' + escapeHtml(table.title || table.name) + "</option>"
  ).join("");
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
      '<a href="' + escapeHtml(data.boardUrl) + '" target="_blank" rel="noreferrer">Open the new Fizzy board →</a>';
  } catch (error) {
    button.disabled = false;
    button.textContent = "Import to Fizzy";
    alert(error.message);
  }
}

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

$("project")?.addEventListener("change", loadCardTables);
$("import")?.addEventListener("click", importSelected);
loadProjects().catch((error) => { console.error(error); alert(error.message); });
