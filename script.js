// -------- AUTO-DETECT + AUTO-REPAIR LOGIC ----------- //

const statusEl = document.getElementById("status");

function setStatus(t) {
  statusEl.textContent = "Status: " + t;
}

const PROXIES = [
  url => url,
  url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
];

const ENDPOINTS = [
  u => `https://www.instagram.com/api/v1/users/web_profile_info/?username=${u}`,
  u => `https://www.instagram.com/${u}/?__a=1&__d=dis`,
  u => `https://www.instagram.com/${u}/?__a=1`,
];

// Cache for working combination
const SAVE_KEY = "sharad_insta_cache";

function loadCache() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (Date.now() - obj.time > 24 * 60 * 60 * 1000) return null;
    return obj;
  } catch {
    return null;
  }
}

function saveCache(c) {
  localStorage.setItem(SAVE_KEY, JSON.stringify({ time: Date.now(), ...c }));
}

async function tryFetch(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("Bad response");
  return r.text();
}

function extractJSON(text) {
  if (text.trim().startsWith("{")) return JSON.parse(text);

  const m1 = text.match(/window\._sharedData\s*=\s*(\{.*?\});/s);
  if (m1) return JSON.parse(m1[1]);

  const m2 = text.match(/__additionalDataLoaded\(.?(\{.?\})\);/s);
  if (m2) return JSON.parse(m2[1]);

  return null;
}

function extractUser(j) {
  if (j?.data?.user) return j.data.user;
  if (j?.graphql?.user) return j.graphql.user;
  if (j?.entry_data?.ProfilePage?.[0]?.graphql?.user)
    return j.entry_data.ProfilePage[0].graphql.user;
  return null;
}

// ---------- FRESHNESS VALIDATOR ------------ //

function filterFreshStories(items) {
  const now = Date.now() / 1000; // seconds
  return items.filter(s => {
    const age = now - (s.taken_at || 0);
    return age < 24 * 3600; // less than 24 hours old
  });
}

// ---------- UI REFERENCES ---------- //

const input = document.getElementById("username");
const btn = document.getElementById("btnSearch");

const profileBox = document.getElementById("profile");
const storiesBox = document.getElementById("stories");
const highlightsBox = document.getElementById("highlights");
const postsBox = document.getElementById("posts");

const storiesList = document.getElementById("storiesList");
const highList = document.getElementById("highList");
const postsList = document.getElementById("postsList");

// ---------- MAIN SEARCH ---------- //

btn.onclick = () => run(input.value.trim());
input.onkeydown = e => e.key === "Enter" && run(input.value.trim());

async function run(username) {
  if (!username) return alert("Username डालो");

  resetUI();
  setStatus("Finding best endpoint…");

  let cached = loadCache();

  // ---------- PROBE ----------
  let working = null;

  if (cached && cached.username === username) {
    working = cached;
  } else {
    working = await probe(username);
    saveCache({ username, ...working });
  }

  setStatus("Profile loading…");

  const user = extractUser(working.json);
  if (!user) return alert("User not found");

  showProfile(user);

  if (user.id) fetchStories(user.id);
  fetchHighlights(user.id);
  fetchPosts(username);
}

// ---------- PROBING SYSTEM ---------- //

async function probe(username) {
  for (let ep of ENDPOINTS) {
    for (let pr of PROXIES) {
      try {
        const url = pr(ep(username));
        setStatus(`Trying ${ep.name || "endpoint"} via proxy`);
        const txt = await tryFetch(url);

        const j = extractJSON(txt);
        if (!j) continue;

        const u = extractUser(j);
        if (!u) continue;

        return { ep: ep.toString(), pr: pr.toString(), json: j };
      } catch {
        // try next
      }
    }
  }
  throw new Error("No endpoint working");
}

// ---------- UI RESET ---------- //

function resetUI() {
  profileBox.classList.add("hidden");
  storiesBox.classList.add("hidden");
  highlightsBox.classList.add("hidden");
  postsBox.classList.add("hidden");

  storiesList.innerHTML = "";
  highList.innerHTML = "";
  postsList.innerHTML = "";
}

// ---------- SHOW PROFILE ---------- //

function showProfile(u) {
  profileBox.classList.remove("hidden");

  const pic =
    u.hd_profile_pic_url_info?.url || u.profile_pic_url_hd || u.profile_pic_url;

  profileBox.innerHTML = `
    <div class="profile-top">
      <img src="${pic}" />
      <div class="profile-info">
        <h2>${u.full_name} <span class="badge">@${u.username}</span></h2>
        <p>${u.biography || ""}</p>
        <p>Followers: ${u.edge_followed_by?.count || u.follower_count}</p>
      </div>
    </div>
  `;
}

// ---------- STORIES ---------- //

async function fetchStories(id) {
  try {
    setStatus("Fetching stories…");

    const url = `https://www.instagram.com/api/v1/feed/user/${id}/reel_media/`;
    let txt;

    for (let pr of PROXIES) {
      try {
        txt = await tryFetch(pr(url));
        break;
      } catch {}
    }

    const j = JSON.parse(txt);

    let items = j.items || [];
    items = filterFreshStories(items);

    if (!items.length) {
      setStatus("No fresh stories");
      return;
    }

    storiesBox.classList.remove("hidden");
    items.forEach(s => {
      const url = s.video_versions
        ? s.video_versions[0].url
        : s.image_versions2.candidates[0].url;

      const el = document.createElement("div");
      el.className = "tile";

      el.innerHTML = `
        ${s.video_versions ? <video controls src="${url}"></video> : <img src="${url}" />}
        <a class="downloadBtn" href="${url}" download>Download</a>
      `;

      storiesList.appendChild(el);
    });

    setStatus("Stories loaded");
  } catch {
    setStatus("Stories failed");
  }
}

// ---------- HIGHLIGHTS ---------- //

async function fetchHighlights(id) {
  if (!id) return;

  try {
    const url = `https://www.instagram.com/api/v1/highlights/${id}/highlights_tray/`;
    let txt;

    for (let pr of PROXIES) {
      try {
        txt = await tryFetch(pr(url));
        break;
      } catch {}
    }

    const j = JSON.parse(txt);

    if (!j.tray?.length) return;

    highlightsBox.classList.remove("hidden");

    j.tray.forEach(h => {
      const cover =
        h.cover_media?.cropped_image_version?.url ||
        h.cover_media?.thumbnail_url;

      const el = document.createElement("div");
      el.className = "tile";

      el.innerHTML = `
        <img src="${cover}" />
        <strong>${h.title}</strong>
        <a class="downloadBtn" href="https://www.instagram.com/stories/highlights/${h.id}/" target="_blank">Open</a>
      `;
      highList.appendChild(el);
    });
  } catch {}
}

// ---------- POSTS ---------- //

async function fetchPosts(username) {
  try {
    const url = `https://www.instagram.com/${username}/?__a=1&__d=dis`;
    let txt;

    for (let pr of PROXIES) {
      try {
        txt = await tryFetch(pr(url));
        break;
      } catch {}
    }

    const j = JSON.parse(txt);
    const posts = j.graphql?.user?.edge_owner_to_timeline_media?.edges || [];

    if (!posts.length) return;

    postsBox.classList.remove("hidden");

    posts.forEach(p => {
      const node = p.node;
      const thumb = node.display_url;
      const shortcode = node.shortcode;
      const link = `https://www.instagram.com/p/${shortcode}/`;

      const el = document.createElement("div");
      el.className = "tile";

      el.innerHTML = `
        <img src="${thumb}" />
        <a class="downloadBtn" target="_blank" href="${link}">Open</a>
      `;
      postsList.appendChild(el);
    });
  } catch {}
}