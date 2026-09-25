// Set this to your Bluesky handle before publishing, e.g. "your-name.bsky.social".
const BLUESKY_HANDLE = "warmtoast-dev.bsky.social";

const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".panel");
const profileLink = document.querySelector(".bsky-profile");
const feed = document.querySelector(".feed");
const blueskyLink = document.querySelector(".bluesky-link");
const wordmark = document.querySelector(".wordmark");
let activePanel = document.querySelector(".panel.is-active");
let transitionVersion = 0;

tabs.forEach((tab) => {
  tab.addEventListener("click", () => activateTab(tab.dataset.tab));
});

blueskyLink?.addEventListener("click", (event) => {
  event.preventDefault();
  activateTab("notes");
  document.querySelector(".tabs").scrollIntoView({ behavior: "smooth", block: "start" });
});

wordmark.addEventListener("click", (event) => {
  event.preventDefault();
  activateTab("about");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

function activateTab(target) {
  tabs.forEach((tab) => {
    const selected = tab.dataset.tab === target;
    tab.classList.toggle("is-active", selected);
    tab.setAttribute("aria-selected", selected);
  });
  const nextPanel = document.getElementById(target);
  if (nextPanel !== activePanel) transitionPanels(nextPanel);
  if (target === "notes") loadBlueskyFeed();
}

function transitionPanels(nextPanel) {
  const previousPanel = activePanel;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const version = ++transitionVersion;

  // Remove completed fill-mode animations before either panel is reused.
  nextPanel.getAnimations().forEach((animation) => animation.cancel());
  if (previousPanel) previousPanel.getAnimations().forEach((animation) => animation.cancel());

  nextPanel.hidden = false;
  nextPanel.classList.add("is-active");
  activePanel = nextPanel;

  if (!previousPanel || reducedMotion) {
    if (previousPanel) {
      previousPanel.classList.remove("is-active");
      previousPanel.hidden = true;
    }
    return;
  }

  previousPanel.classList.remove("is-active");
  const leaving = previousPanel.animate(
    [
      { opacity: 1, transform: "translateY(0)" },
      { opacity: 0, transform: "translateY(-0.35rem)" },
    ],
    { duration: 140, easing: "ease-in", fill: "forwards" },
  );
  leaving.onfinish = () => {
    if (previousPanel.classList.contains("is-active")) return;
    previousPanel.hidden = true;
    previousPanel.style.opacity = "";
    previousPanel.style.transform = "";
    leaving.cancel();
  };

  const entering = nextPanel.animate(
    [
      { opacity: 0, transform: "translateY(0.45rem)" },
      { opacity: 1, transform: "translateY(0)" },
    ],
    { duration: 220, easing: "cubic-bezier(.2, .7, .2, 1)", fill: "both" },
  );
  entering.onfinish = () => {
    if (version !== transitionVersion) return;
    nextPanel.style.opacity = "";
    nextPanel.style.transform = "";
    entering.cancel();
  };
}

function escapeHtml(value) {
  return value.replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
}

async function loadBlueskyFeed() {
  if (!BLUESKY_HANDLE) return;
  if (feed.dataset.loaded) return;
  feed.dataset.loaded = "true";
  profileLink.href = `https://bsky.app/profile/${BLUESKY_HANDLE}`;
  feed.innerHTML = '<p class="feed-status">Loading latest notes…</p>';
  try {
    const endpoint = `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(BLUESKY_HANDLE)}&limit=12`;
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error("Feed unavailable");
    const { feed: items } = await response.json();
    feed.innerHTML = items.length ? items.map(renderPost).join("") : '<p class="feed-status">No notes yet.</p>';
  } catch {
    feed.innerHTML = `<p class="feed-status">The feed couldn’t be loaded right now. <a href="https://bsky.app/profile/${BLUESKY_HANDLE}" target="_blank" rel="noopener noreferrer">Visit Bluesky instead ↗</a></p>`;
  }
}

function renderPost(item) {
  const post = item.post;
  const date = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(post.record.createdAt));
  return `<article class="post"><p>${escapeHtml(post.record.text || "")}</p><div class="post-meta"><time datetime="${post.record.createdAt}">${date}</time><a href="https://bsky.app/profile/${post.author.handle}/post/${post.uri.split("/").pop()}" target="_blank" rel="noopener noreferrer">view ↗</a></div></article>`;
}
