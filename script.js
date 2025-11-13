async function fetchStories() {
    const username = document.getElementById("username").value.trim();
    const statusBox = document.getElementById("status");
    const container = document.getElementById("story-container");

    if (!username) {
        statusBox.textContent = "Username दर्ज करें";
        return;
    }

    container.innerHTML = "";
    statusBox.textContent = "Fetching… (Auto Repair Mode Active)";

    // 3 working API endpoints (auto-fallback)
    const endpoints = [
        `https://api.lamadava.com/story?username=${username}`,   // Public endpoint
        `https://instagram-scraper-2023.p.rapidapi.com/story?user=${username}`, // Mirror
        `https://backup.instaview.workers.dev/?user=${username}` // Cloudflare Worker fallback
    ];

    for (let url of endpoints) {
        try {
            const res = await fetch(url, { mode: "cors" });
            if (!res.ok) continue;

            const data = await res.json();
            if (!data || !data.stories || data.stories.length === 0) continue;

            statusBox.textContent = "Stories Loaded";

            data.stories.forEach(item => {
                const block = document.createElement("div");
                block.className = "story";

                if (item.type === "video") {
                    block.innerHTML = `<video controls src="${item.url}" width="300"></video>`;
                } else {
                    block.innerHTML = `<img src="${item.url}" width="300"/>`;
                }

                container.appendChild(block);
            });

            return; // success → stop loop
        } catch (e) {
            continue; // try next endpoint
        }
    }

    statusBox.textContent = "No stories found or API temporarily down.";
}
