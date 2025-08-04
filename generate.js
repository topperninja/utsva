const axios = require("axios");
const fs = require("fs");
const path = require("path");

const API_KEY = "AIzaSyBB5GHS08REnWT0IKsFIiITlXTZZPJwvLE";
const CHANNEL_ID = "UCRptoBEWak_neYheT7sXS4w";
const OUTPUT_DIR = "videos";
const BASE_URL = "https://yourdomain.com/videos/";

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

// Fetch all videos from a channel
async function fetchVideoIdsFromChannel() {
  const ids = [];
  let nextPageToken = "";

  do {
    const res = await axios.get(
      `https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&channelId=${CHANNEL_ID}&part=id&order=date&maxResults=50&pageToken=${nextPageToken}`
    );

    res.data.items.forEach((item) => {
      if (item.id.kind === "youtube#video") {
        ids.push(item.id.videoId);
      }
    });

    nextPageToken = res.data.nextPageToken || "";
  } while (nextPageToken);

  return ids;
}

// Fetch video metadata
async function fetchVideoData(videoId) {
  const res = await axios.get(
    `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${API_KEY}`
  );

  const item = res.data.items[0];
  if (!item) throw new Error("Video not found for ID: " + videoId);

  return {
    id: videoId,
    title: item.snippet.title,
    description: item.snippet.description,
    thumbnail: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
    videoUrl: `https://www.youtube.com/embed/${videoId}`,
    isoDate: item.snippet.publishedAt
  };
}

// Generate JSON-LD schema
function generateSchema(video) {
  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: video.title,
    description: video.description,
    thumbnailUrl: video.thumbnail,
    uploadDate: video.isoDate,
    contentUrl: video.videoUrl,
    embedUrl: video.videoUrl
  };
}

// Create HTML page for each video
function generateHTML(video) {
  const jsonLD = JSON.stringify(generateSchema(video), null, 2);

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${video.title}</title>
  <meta name="description" content="${video.description.replace(/"/g, "'")}" />
  <meta property="og:title" content="${video.title}" />
  <meta property="og:description" content="${video.description.replace(/"/g, "'")}" />
  <meta property="og:image" content="${video.thumbnail}" />
  <meta property="og:url" content="${BASE_URL}${video.id}.html" />
  <meta property="og:type" content="video.other" />
  <script type="application/ld+json">${jsonLD}</script>
</head>
<body>
  <h1>${video.title}</h1>
  <iframe width="100%" height="480" src="${video.videoUrl}" frameborder="0" allowfullscreen></iframe>
  <p>${video.description}</p>
  <a href="/index.html">⬅ Back to all videos</a>
</body>
</html>`;
}

// Create index.html
function generateIndex(videos) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>All Videos</title>
  <meta name="description" content="Explore all our YouTube videos in one place." />
</head>
<body>
  <h1>All Videos</h1>
  <ul>
    ${videos
      .map(
        (v) =>
          `<li><a href="${OUTPUT_DIR}/${v.id}.html">${v.title}</a></li>`
      )
      .join("\n")}
  </ul>
</body>
</html>`;
}

// Create sitemap.xml
function generateSitemap(videos) {
  const urls = videos
    .map(
      (v) => `
  <url>
    <loc>${BASE_URL}${v.id}.html</loc>
    <lastmod>${v.isoDate}</lastmod>
  </url>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="https://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

// MAIN
async function main() {
  try {
    const videoIds = await fetchVideoIdsFromChannel();
    const allVideos = [];

    for (const id of videoIds) {
      try {
        const video = await fetchVideoData(id);
        allVideos.push(video);

        const html = generateHTML(video);
        fs.writeFileSync(path.join(OUTPUT_DIR, `${id}.html`), html);
        console.log(`✅ Created HTML: ${id}.html`);
      } catch (err) {
        console.error(`❌ Failed to fetch ${id}: ${err.message}`);
      }
    }

    fs.writeFileSync("videos.json", JSON.stringify(allVideos, null, 2));
    fs.writeFileSync("index.html", generateIndex(allVideos));
    fs.writeFileSync("sitemap.xml", generateSitemap(allVideos));

    console.log("✅ All files generated.");
  } catch (e) {
    console.error("❌ Error:", e.message);
  }
}

main();
