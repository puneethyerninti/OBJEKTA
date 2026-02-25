const path = require("path");
const fs = require("fs");
const multer = require("multer");

const uploadsDir = path.resolve(__dirname, "..", "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname || "") || ".bin";
    cb(null, `${unique}${ext}`);
  },
});

const uploadProjectFiles = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024,
    fields: 20,
    files: 5,
  },
});

module.exports = {
  uploadProjectFiles,
  uploadsDir,
};
