const params = new URLSearchParams(location.search);
const sessionId = params.get("session");

const $ = (id) => document.getElementById(id);
const state = {
  projects: [],
  cardTables: [],
  cardTable: null
};

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
  ["start", "workspace", "review", "done"].forEach((name) =>
    $(name).classList.toggle("hidden", name !== id)
  );
}

async function loadProjects() {
  if (!sessionId) return;

  $("start").classList.add("hidden");
  $("workspace").classList.remove("hidden");

  state.projects = await api("/api/projects");
  $("project").innerHTML = state.projects
    .map((project) => `<option value="${project.id}">${escapeHtml(project.name)}</option>`)
    .join("");

  await loadCardTables();
}

async function loadCardTables() {
  const projectId = $("project").value;
  state.cardTables = await api(`/api/projects/${projectId}/card-tables`);

  $("cardTable").innerHTML = state.cardTables
    .map((table) => `<option value="${table.id}">${escapeHtml(table.title || table.name)}</option>`)
    .join("");

  $("preview").disabled = !state.cardTables.length;
}

async function loadReview() {
  const id = $("cardTable").value;
  state.cardTable = await api(`/api/card-table/${id}`);

  $("boardName").textContent = state.cardTable.title;

  $("mapping").innerHTML = state.cardTable.columns.map((column) => {
    const destination = targetColumnName(column.title);
    return `
      <div class="mapping-row">
        <span>${escapeHtml(column.title)}</span>
        <span>→</span>
        <span>${escapeHtml(destination)}</span>
      </div>
    `;
  }).join("");

  show("review");
}

async function importPreview() {
  // The backend currently returns a safe preview rather than writing to Fizzy.
  // Once the exact current Fizzy write payload is smoke-tested, this becomes
  // the final import action.
  const data = await api("/api/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cardTable: state.cardTable,
      fizzyBaseUrl: "https://app.fizzy.do",
      fizzyToken: "not-yet-configured"
    })
  });

  show("done");
  $("result").textContent =
    `${data.cards.length} cards are mapped and ready. The write step is intentionally disabled until the live Fizzy API payload is smoke-tested.`;
}

function targetColumnName(name) {
  return name.trim().toLowerCase() === "triage" ? "Maybe" : name;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

$("project")?.addEventListener("change", loadCardTables);
$("preview")?.addEventListener("click", loadReview);
$("import")?.addEventListener("click", importPreview);
$("back")?.addEventListener("click", () => show("workspace"));

loadProjects().catch((error) => {
  console.error(error);
  alert(error.message);
});
