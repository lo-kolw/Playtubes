const express = require('express');
const multer = require('multer');
const { S3Client } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");
const cors = require('cors');

const app = express();
app.use(cors());

const upload = multer({ storage: multer.memoryStorage() });

const s3Client = new S3Client({
    endpoint: "https://s3.us.archive.org",
    region: "us-east-1",
    credentials: {
        accessKeyId: process.env.ACCESS_ARCHIVE_PRIVATE,
        secretAccessKey: process.env.PUBLIC_ARCHIVE_PRIVATE,
    },
    forcePathStyle: true,
});

app.post('/upload', upload.single('video'), async (req, res) => {
    if (!req.file) return res.status(400).send('No video as received.');

    const itemId = `playtube_${Date.now()}`;
    const fileName = req.file.originalname.replace(/\s+/g, '_');

    try {
        console.log(`Received & sended: ${fileName}`);

        const paralelUpload = new Upload({
            client: s3Client,
            params: {
                Bucket: itemId,
                Key: fileName,
                Body: req.file.buffer,
                ContentType: req.file.mimetype,
                Metadata: {
                    "mediatype": "movies",
                    "collection": "opensource_movies",
                    "title": fileName
                },
            },
            partSize: 1024 * 1024 * 5,
        });

        await paralelUpload.done();
        
        const videoURL = `https://archive.org/download/${itemId}/${fileName}`;
        res.json({ 
            success: true, 
            url: videoURL, 
            details: `https://archive.org/details/${itemId}` 
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Error for tunneling the video." });
    }
});

app.listen(process.env.PORT || 3000, () => console.log("Activet!"));
