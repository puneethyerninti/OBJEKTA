// server/upload.js
import path from "path";
import multer from "multer";
const upload = multer({
  storage: multer.diskStorage({
    destination: "uploads/",
    filename: (req, file, cb) => {
      const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      cb(null, unique + ext);
    }
  }),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
    fields: 20,
    files: 5
  }
});
app.post("/api/projects", upload.fields([
  { name: "thumbnail", maxCount: 1 },
  { name: "model", maxCount: 1 },               // <— add this if not present
]), async (req, res) => {
  try {
    // req.files.model[0] contains your .glb
    // req.body.data contains JSON string (parse it)
    const data = req.body.data ? JSON.parse(req.body.data) : {};
    // ...save paths/URLs to DB
    return res.status(201).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "SAVE_FAILED" });
  }
});
