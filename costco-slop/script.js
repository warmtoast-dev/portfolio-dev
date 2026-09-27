const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

let currentSort = "latest";
let currentSearch = "";


// ─────────────────────────────────────────────
// Formatting
// ─────────────────────────────────────────────

function fmtViews(n) {
  n = Number(n) || 0;

  if (n >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) {
    return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1) + "K";
  }

  return n.toLocaleString();
}


function fmtDate(iso) {
  if (!iso) return "";

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}


function escapeHtml(str) {
  return String(str ?? "").replace(
    /[&<>"']/g,
    c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[c])
  );
}


// ─────────────────────────────────────────────
// Filters
// ─────────────────────────────────────────────

function setupFilters() {

  const yearFilter = $("#yearFilter");
  const creatorFilter = $("#creatorFilter");

  if (!yearFilter || !creatorFilter) {
    console.warn("Year or creator filter not found.");
    return;
  }

  const years = [
    ...new Set(
      videos
        .map(v => v.publishedAt)
        .filter(Boolean)
        .map(date => date.slice(0, 4))
    )
  ].sort((a, b) => b - a);


  const creators = [
    ...new Set(
      videos
        .map(v => v.creator)
        .filter(Boolean)
    )
  ].sort();


  years.forEach(year => {
    yearFilter.insertAdjacentHTML(
      "beforeend",
      `<option value="${escapeHtml(year)}">${escapeHtml(year)}</option>`
    );
  });


  creators.forEach(creator => {
    creatorFilter.insertAdjacentHTML(
      "beforeend",
      `<option value="${escapeHtml(creator)}">${escapeHtml(creator)}</option>`
    );
  });
}


// ─────────────────────────────────────────────
// Filtering + sorting
// ─────────────────────────────────────────────

function filteredVideos() {

  const yearFilter = $("#yearFilter");
  const creatorFilter = $("#creatorFilter");

  const year = yearFilter ? yearFilter.value : "all";
  const creator = creatorFilter ? creatorFilter.value : "all";


  let result = videos.filter(video => {

    const haystack = [
      video.title,
      video.description,
      video.creator
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();


    const videoYear = video.publishedAt
      ? video.publishedAt.slice(0, 4)
      : "";


    return (
      (year === "all" || videoYear === year) &&
      (creator === "all" || video.creator === creator) &&
      (!currentSearch || haystack.includes(currentSearch))
    );
  });


  if (currentSort === "popular") {
    result.sort(
      (a, b) => (Number(b.viewCount) || 0) - (Number(a.viewCount) || 0)
    );
  }


  if (currentSort === "oldest") {
    result.sort(
      (a, b) =>
        new Date(a.publishedAt) - new Date(b.publishedAt)
    );
  }


  if (currentSort === "latest") {
    result.sort(
      (a, b) =>
        new Date(b.publishedAt) - new Date(a.publishedAt)
    );
  }


  if (currentSort === "random") {
    result.sort(() => Math.random() - 0.5);
  }


  return result;
}


// ─────────────────────────────────────────────
// Render videos
// ─────────────────────────────────────────────

function render() {

  const videoGrid = $("#videoGrid");

  if (!videoGrid) {
    console.error("Could not find #videoGrid");
    return;
  }


  const result = filteredVideos();


  const resultCount = $("#resultCount");

  if (resultCount) {
    resultCount.textContent = `${result.length} found`;
  }


  const totalViews = videos.reduce(
    (sum, video) => sum + (Number(video.viewCount) || 0),
    0
  );


  const stats = $("#stats");

  if (stats) {

    const creatorCount = new Set(
      videos.map(v => v.creator).filter(Boolean)
    ).size;


    const yearCount = new Set(
      videos
        .map(v => v.publishedAt)
        .filter(Boolean)
        .map(v => v.slice(0, 4))
    ).size;


    stats.innerHTML = `
      <strong>${videos.length}</strong> explainers found
      <span class="dot">•</span>
      ${creatorCount} creators
      <span class="dot">•</span>
      ${yearCount} years
      <span class="dot">•</span>
      ${fmtViews(totalViews)} combined views in this sample
    `;
  }


  if (!result.length) {

    videoGrid.innerHTML = `
      <div class="no-results">
        No Costco videos found. This is either a bug or the internet has finally moved on.
      </div>
    `;

    return;
  }


  videoGrid.innerHTML = result.map(video => {

    const url =
      video.youtubeUrl ||
      `https://www.youtube.com/watch?v=${video.id}`;


    const thumbnail =
      video.thumbnailUrl ||
      `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;


    return `
      <article class="video-card">

        <a
          class="thumb-wrap"
          href="${url}"
          target="_blank"
          rel="noopener"
        >
          <img
            src="${thumbnail}"
            alt=""
            loading="lazy"
          >

          <span class="duration">
            ${escapeHtml(video.duration || "")}
          </span>
        </a>


        <a
          class="video-title"
          href="${url}"
          target="_blank"
          rel="noopener"
        >
          ${escapeHtml(video.title)}
        </a>


        <div class="creator">
          ${escapeHtml(video.creator)}
        </div>


        <div class="meta">
          ${fmtViews(video.viewCount)} views
          <span class="dot">•</span>
          ${fmtDate(video.publishedAt)}
        </div>

      </article>
    `;

  }).join("");
}


// ─────────────────────────────────────────────
// Sorting
// ─────────────────────────────────────────────

function setSort(sort) {

  currentSort = sort;


  $$(".sort-btn").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.sort === sort
    );
  });


  $$(".side-link").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.sort === sort
    );
  });


  render();
}


$$("[data-sort]").forEach(element => {

  element.addEventListener(
    "click",
    () => setSort(element.dataset.sort)
  );

});


// ─────────────────────────────────────────────
// Filter events
// ─────────────────────────────────────────────

const yearFilter = $("#yearFilter");

if (yearFilter) {
  yearFilter.addEventListener("change", render);
}


const creatorFilter = $("#creatorFilter");

if (creatorFilter) {
  creatorFilter.addEventListener("change", render);
}


// ─────────────────────────────────────────────
// Search
// ─────────────────────────────────────────────

const search = $("#search");

if (search) {

  search.addEventListener("input", event => {

    currentSearch =
      event.target.value
        .trim()
        .toLowerCase();

    render();

  });

}


const searchBtn = $("#searchBtn");

if (searchBtn) {

  searchBtn.addEventListener(
    "click",
    () => {
      if (search) search.focus();
    }
  );

}


// ─────────────────────────────────────────────
// Random
// ─────────────────────────────────────────────

const randomBtn = $("#randomBtn");

if (randomBtn) {

  randomBtn.addEventListener("click", () => {

    const pool = filteredVideos();

    if (!pool.length) return;

    const video =
      pool[Math.floor(Math.random() * pool.length)];


    window.open(
      video.youtubeUrl ||
      `https://www.youtube.com/watch?v=${video.id}`,
      "_blank"
    );

    showToast("Sending you to a Costco video.");

  });

}


// ─────────────────────────────────────────────
// Toast
// ─────────────────────────────────────────────

function showToast(message) {

  const toast = $("#toast");

  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(
    () => toast.classList.remove("show"),
    1800
  );
}


// ─────────────────────────────────────────────
// Quiz
// ─────────────────────────────────────────────

const questions = [

  [
    "What is Costco's most repeatedly explained economic trick?",
    [
      "Membership fees",
      "Selling gold",
      "Selling only hot dogs"
    ],
    [2, 0, 0]
  ],

  [
    "What is Kirkland Signature?",
    [
      "Costco's private label",
      "A warehouse location",
      "The CEO's dog"
    ],
    [2, 0, 0]
  ],

  [
    "What do Costco explainers love talking about?",
    [
      "Margins",
      "The weather",
      "Parking lot paint"
    ],
    [2, 0, 0]
  ],

  [
    "What is a Costco 'treasure hunt'?",
    [
      "A merchandising strategy",
      "A children's activity",
      "A loyalty card"
    ],
    [2, 0, 0]
  ],

  [
    "What happens when someone discovers Costco's margins?",
    [
      "They make a YouTube video",
      "They immediately leave the internet",
      "Nothing"
    ],
    [2, 0, 0]
  ],

  [
    "How many SKUs does Costco famously carry compared with giant supermarkets?",
    [
      "Far fewer",
      "Far more",
      "Exactly 7"
    ],
    [2, 0, 0]
  ],

  [
    "What do people often compare Costco with?",
    [
      "Amazon / Walmart / Sam's Club",
      "NASA",
      "The Olympics"
    ],
    [2, 0, 0]
  ],

  [
    "What does a new Costco explainer usually promise?",
    [
      "To explain why Costco works",
      "To teach algebra",
      "To review a toaster"
    ],
    [2, 0, 0]
  ],

  [
    "What is this website actually for?",
    [
      "Absolutely nothing",
      "Managing your Costco membership",
      "Ordering groceries"
    ],
    [2, 0, 0]
  ],

  [
    "How many Costco explainers should there be?",
    [
      "Apparently, all of them",
      "One",
      "None"
    ],
    [2, 0, 0]
  ]

];


function renderQuiz() {

  const app = $("#quizApp");

  if (!app) {
    console.error("Could not find #quizApp");
    return;
  }


  app.innerHTML = questions.map((question, index) => `

    <div class="quiz-question">

      <h3>
        ${index + 1}. ${escapeHtml(question[0])}
      </h3>

      ${question[1].map((answer, answerIndex) => `

        <button
          class="quiz-option"
          data-q="${index}"
          data-a="${answerIndex}"
        >
          ${escapeHtml(answer)}
        </button>

      `).join("")}

    </div>

  `).join("");


  app.insertAdjacentHTML(
    "beforeend",
    `
      <button class="quiz-submit" id="quizSubmit">
        Reveal my Costco identity
      </button>

      <div id="quizResult"></div>
    `
  );


  const answers = {};


  $$(".quiz-option").forEach(button => {

    button.addEventListener("click", () => {

      const questionIndex = button.dataset.q;
      const answerIndex = Number(button.dataset.a);

      answers[questionIndex] = answerIndex;


      $$(
        `.quiz-option[data-q="${questionIndex}"]`
      ).forEach(option => {
        option.style.fontWeight = "normal";
      });


      button.style.fontWeight = "bold";

    });

  });


  const submit = $("#quizSubmit");

  if (!submit) return;


  submit.addEventListener("click", () => {

    if (
      Object.keys(answers).length <
      questions.length
    ) {

      showToast(
        "Please finish your extremely important assessment."
      );

      return;
    }


    const score = Object.entries(answers)
      .reduce(
        (total, [questionIndex, answerIndex]) =>
          total +
          questions[questionIndex][2][answerIndex],
        0
      );


    let title;
    let text;


    if (score >= 18) {

      title = "THE COSTCO SCHOLAR";

      text =
        "You have crossed the line from consumer to Costco discourse participant. You probably know what a negative cash conversion cycle is.";

    } else if (score >= 14) {

      title = "THE ECONOMICALLY CURIOUS";

      text =
        "You know enough about Costco to understand why people keep making videos about it. You may be one of the people making those videos.";

    } else if (score >= 9) {

      title = "THE CASUAL MEMBER";

      text =
        "You know Costco is big, cheap, and sells things in quantities that would frighten a normal supermarket.";

    } else {

      title = "THE NORMAL PERSON";

      text =
        "Congratulations. You appear to have retained a healthy distance from Costco YouTube.";

    }


    const result = $("#quizResult");

    if (result) {

      result.innerHTML = `
        <div class="quiz-result">
          <h3>${title}</h3>
          <p>${text}</p>
        </div>
      `;

    }

  });

}


// ─────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────

console.log("Costco archive starting...");
console.log("Videos loaded:", videos.length);

setupFilters();
render();
renderQuiz();

console.log("Costco archive loaded successfully.");