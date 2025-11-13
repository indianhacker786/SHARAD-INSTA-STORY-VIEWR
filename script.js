async function fetchAll() {
    const user = document.getElementById("username").value.trim();
    const status = document.getElementById("status");
    const out = document.getElementById("output");

    if (!user) return alert("Username required!");
    status.innerText = "Fetching...";
    out.innerHTML = "";

    try {
        const url = `https://api.storiesig.info/stories/${user}`;
        let res = await fetch(url);

        if (!res.ok) throw new Error("API down");

        let data = await res.json();

        status.innerText = "Loaded!";

        // STORIES
        if (data.items && data.items.length) {
            out.innerHTML += "<h3>Stories</h3>";
            data.items.forEach(s => {
                if (s.video_versions) {
                    out.innerHTML += `<div class="media">
                        <video controls src="${s.video_versions[0].url}"></video>
                    </div>`;
                } else if (s.image_versions2) {
                    out.innerHTML += `<div class="media">
                        <img src="${s.image_versions2.candidates[0].url}">
                    </div>`;
                }
            });
        } else {
            out.innerHTML += "<p>No stories found.</p>";
        }

        // HIGHLIGHTS
        if (data.highlights && data.highlights.length) {
            out.innerHTML += "<h3>Highlights</h3>";
            data.highlights.forEach(h => {
                out.innerHTML += `<div class="media">
                    <img src="${h.cover}">
                    <p>${h.title}</p>
                </div>`;
            });
        }

        // POSTS
        if (data.latest_reels && data.latest_reels.length) {
            out.innerHTML += "<h3>Latest Posts</h3>";
            data.latest_reels.forEach(p => {
                out.innerHTML += `<div class="media">
                    <img src="${p.thumbnail}">
                </div>`;
            });
        }

    } catch (e) {
        status.innerText = "Error loading data";
    }
}
