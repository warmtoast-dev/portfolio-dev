const BLUESKY_HANDLE = "warmtoast-dev.bsky.social";
const BLUESKY_PROFILE_URL = `https://bsky.app/profile/${BLUESKY_HANDLE}`;
const BLUESKY_API_URL = "https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed";
const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".panel");
const profileLink = document.querySelector(".bsky-profile");
const feed = document.querySelector(".feed");
const blueskyLink = document.querySelector(".bluesky-link");
const wordmark = document.querySelector(".wordmark");
const tabsContainer = document.querySelector(".tabs");

let activePanel = document.querySelector(".panel.is-active");
let transitionVersion = 0;


/* Tabs */

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    activateTab(tab.dataset.tab);
  });
});

blueskyLink?.addEventListener("click", (event) => {
  event.preventDefault();
  activateTab("notes");
  tabsContainer?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
});

wordmark?.addEventListener("click", (event) => {
  event.preventDefault();
  activateTab("about");
  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
});


function activateTab(target) {
  const nextPanel = document.getElementById(target);

  if (!nextPanel) {
    return;
  }

  tabs.forEach((tab) => {
    const isSelected = tab.dataset.tab === target;

    tab.classList.toggle("is-active", isSelected);
    tab.setAttribute("aria-selected", String(isSelected));
  });

  if (nextPanel !== activePanel) {
    transitionPanels(nextPanel);
  }

  if (target === "notes") {
    loadBlueskyFeed();
  }
}


/* Panel transitions */

function transitionPanels(nextPanel) {
  const previousPanel = activePanel;
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const version = ++transitionVersion;

  cancelPanelAnimations(nextPanel);
  cancelPanelAnimations(previousPanel);

  nextPanel.hidden = false;
  nextPanel.classList.add("is-active");
  activePanel = nextPanel;

  if (!previousPanel || reducedMotion) {
    hidePanel(previousPanel);
    return;
  }

  previousPanel.classList.remove("is-active");

  const leavingAnimation = previousPanel.animate(
    [
      {
        opacity: 1,
        transform: "translateY(0)",
      },
      {
        opacity: 0,
        transform: "translateY(-0.35rem)",
      },
    ],
    {
      duration: 140,
      easing: "ease-in",
      fill: "forwards",
    },
  );

  leavingAnimation.onfinish = () => {
    if (previousPanel.classList.contains("is-active")) {
      return;
    }

    hidePanel(previousPanel);
    leavingAnimation.cancel();
  };

  const enteringAnimation = nextPanel.animate(
    [
      {
        opacity: 0,
        transform: "translateY(0.45rem)",
      },
      {
        opacity: 1,
        transform: "translateY(0)",
      },
    ],
    {
      duration: 220,
      easing: "cubic-bezier(.2, .7, .2, 1)",
      fill: "both",
    },
  );

  enteringAnimation.onfinish = () => {
    if (version !== transitionVersion) {
      return;
    }

    resetPanelStyles(nextPanel);
    enteringAnimation.cancel();
  };
}

function cancelPanelAnimations(panel) {
  panel?.getAnimations().forEach((animation) => {
    animation.cancel();
  });
}

function hidePanel(panel) {
  if (!panel) {
    return;
  }

  panel.hidden = true;
  resetPanelStyles(panel);
}

function resetPanelStyles(panel) {
  panel.style.opacity = "";
  panel.style.transform = "";
}


/* Bluesky feed */

async function loadBlueskyFeed() {
  if (!BLUESKY_HANDLE || !feed) {
    return;
  }

  if (feed.dataset.loaded === "true") {
    return;
  }

  feed.dataset.loaded = "true";

  if (profileLink) {
    profileLink.href = BLUESKY_PROFILE_URL;
  }

  showFeedStatus("Loading latest notes…");

  try {
    const posts = await fetchBlueskyPosts();

    if (posts.length === 0) {
      showFeedStatus("No notes yet.");
      return;
    }

    feed.innerHTML = posts.map(renderPost).join("");
  } catch {
    feed.innerHTML = `
      <p class="feed-status">
        The feed couldn’t be loaded right now.
        <a class="external links"
          href="${BLUESKY_PROFILE_URL}"
        >
          Visit Bluesky instead
        </a>
      </p>
    `;
  }
}

async function fetchBlueskyPosts() {
  const url = new URL(BLUESKY_API_URL);

  url.searchParams.set("actor", BLUESKY_HANDLE);
  url.searchParams.set("limit", "3");

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Bluesky feed request failed: ${response.status}`);
  }

  const data = await response.json();

  return data.feed ?? [];
}

function showFeedStatus(message) {
  feed.innerHTML = `<p class="feed-status">${message}</p>`;
}


/* Post rendering */

function renderPost(item) {
  const post = item.post;
  const createdAt = post.record.createdAt;
  const date = formatPostDate(createdAt);
  const postUrl = getPostUrl(post);

  return `
    <article class="post">
    <div class="post-meta">
      <time datetime="${escapeHtml(createdAt)}">${date}</time>
    </div>
    <p>${escapeHtml(post.record.text ?? "")}</p>
    </article>
  `;
}

function formatPostDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

function getPostUrl(post) {
  const postId = post.uri.split("/").pop();

  return `https://bsky.app/profile/${post.author.handle}/post/${postId}`;
}


/* Utilities */

function escapeHtml(value) {
  return value.replace(
    /[&<>"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
      })[character],
  );
}

document.addEventListener("DOMContentLoaded", () => {
  setupExternalLinks();
});

function setupExternalLinks() {
  document.querySelectorAll("a[href]").forEach((link) => {
    const url = new URL(link.href, window.location.href);

    if (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.hostname !== window.location.hostname
    ) {
      // link.classList.add("external-link");
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
  });
}
