const express = require('express');
const multer = require('multer');
const cors = require('cors');
const axios = require('axios');
const { S3Client } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");

const app = express();
app.use(cors()); // Allows your .rf.gd site to talk to Render
const upload = multer({ storage: multer.memoryStorage() });

const PORT = process.env.PORT || 3000;

// --- ARCHIVE.ORG LOGIN (S3 KEYS) ---
const s3Client = new S3Client({
    endpoint: "https://s3.us.archive.org",
    region: "us-east-1",
    credentials: {
        accessKeyId: process.env.ARCHIVE_ACCESS_KEY,
        secretAccessKey: process.env.ARCHIVE_SECRET_KEY,
    },
    forcePathStyle: true,
});

// --- 1. HEALTH CHECK (Keep-alive) ---
app.get('/', (req, res) => res.send('PlayTubes Bridge is Online! 🚀'));

// --- 2. UPLOAD ROUTE (With #playtubes tag) ---
app.post('/upload', upload.single('video'), async (req, res) => {
    if (!req.file) return res.status(400).send('No video file provided.');

    const itemId = `playtubes_${Date.now()}`;
    const fileName = req.file.originalname.replace(/\s+/g, '_');

    try {
        const parallelUpload = new Upload({
            client: s3Client,
            params: {
                Bucket: itemId,
                Key: fileName,
                Body: req.file.buffer,
                ContentType: req.file.mimetype,
                Metadata: {
                    "mediatype": "movies",
                    "collection": "opensource_movies",
                    "subject": "playtubes", // YOUR HASHTAG HERE
                    "title": fileName
                },
            },
            partSize: 1024 * 1024 * 5, // 5MB chunks
        });

        await parallelUpload.done();
        res.json({ success: true, id: itemId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Upload failed." });
    }
});

// --- 3. SEARCH ROUTE (Find videos by hashtag) ---
app.get('/videos', async (req, res) => {
    try {
        const query = "subject:(playtubes) AND mediatype:(movies)";
        const url = `https://archive.org/advancedsearch.php?q=${query}&output=json&sort[]=createdate+desc`;

        const response = await axios.get(url);
        const docs = response.data.response.docs;

        const videoList = docs.map(item => ({
            id: item.identifier,
            title: item.title,
            thumbnail: `https://archive.org/services/img/${item.identifier}`,
            video_url: `https://archive.org/download/${item.identifier}/${item.identifier}.mp4`
        }));

        res.json(videoList);
    } catch (err) {
        res.status(500).json({ error: "Search failed." });
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
