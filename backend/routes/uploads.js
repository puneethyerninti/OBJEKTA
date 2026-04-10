// backend/routes/uploads.js
const express = require("express");
const {
  S3Client,
  PutObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const fs = require("fs");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();
router.use(protect);

// Create S3 client from env
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// In-memory map to track multipart uploads (uploadId -> { key, bucket, createdAt })
const multipartMap = new Map();
const MULTIPART_TTL_MS = parseInt(process.env.MULTIPART_TTL_MS || `${60 * 60 * 1000}`, 10); // 1h default

const ALLOWED_EXTENSIONS = new Set([
  "glb",
  "gltf",
  "fbx",
  "obj",
  "usdz",
  "zip",
  "hdr",
  "exr",
  "png",
  "jpg",
  "jpeg",
  "webp",
]);

const ALLOWED_MIME_TYPES = new Set([
  "application/octet-stream",
  "application/gltf+json",
  "model/gltf-binary",
  "application/zip",
  "model/obj",
  "model/vnd.usdz+zip",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/vnd.radiance",
  "application/octet-stream",
]);

function getExtension(filename) {
  return path.extname(String(filename || "")).toLowerCase().replace(/^\./, "");
}

function isAllowedUpload(filename, contentType) {
  if (!contentType || typeof contentType !== "string") return false;
  const ext = getExtension(filename);
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) return false;
  return ALLOWED_MIME_TYPES.has(contentType);
}

function sanitizeExt(filename) {
  const rawExt = path.extname(String(filename || "")).toLowerCase();
  if (!rawExt || rawExt.length > 10) return "bin";
  return rawExt.replace(/[^a-z0-9.]/g, "").replace(/^\./, "") || "bin";
}

function isExpired(createdAt) {
  try { return Date.now() - (createdAt || 0) > MULTIPART_TTL_MS; } catch { return false; }
}

function hasS3Config() {
  return Boolean(process.env.S3_BUCKET && process.env.AWS_REGION && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
}

function requireS3(res) {
  if (hasS3Config()) return true;
  res.status(500).json({ message: "S3 not configured" });
  return false;
}

setInterval(() => {
  const now = Date.now();
  for (const [uploadId, meta] of multipartMap.entries()) {
    if (!meta?.createdAt || now - meta.createdAt > MULTIPART_TTL_MS) {
      multipartMap.delete(uploadId);
    }
  }
}, Math.max(60 * 1000, Math.floor(MULTIPART_TTL_MS / 2))).unref?.();

// POST /api/uploads/presign
// body: { filename, contentType, projectId, purpose } -> returns { url, key, publicUrl }
router.post("/presign", async (req, res) => {
  try {
    if (!requireS3(res)) return;
    const { filename, contentType, projectId, purpose: _purpose } = req.body;
    if (!filename || !contentType) return res.status(400).json({ message: "filename & contentType required" });
    if (!isAllowedUpload(filename, contentType)) return res.status(400).json({ message: "Unsupported file type" });

    // build a safe key: projekta/{projectId||temp}/{uuid}-{safeName}
    const ext = sanitizeExt(filename);
    const key = `objekta/${projectId || "temp"}/${uuidv4()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      ContentType: contentType,
      ACL: "private", // keep private; serve via CloudFront or presigned GET
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 900 }); // 15min

    // Optionally return the public base url (CloudFront) if you have one
    const publicBase = process.env.S3_PUBLIC_BASE || null; // e.g. https://dxxxxx.cloudfront.net
    const publicUrl = publicBase ? `${publicBase}/${key}` : null;

    res.json({ url, key, publicUrl });
  } catch (err) {
    console.error("presign error", err);
    res.status(500).json({ message: "presign failed" });
  }
});

// POST /api/uploads/multipart/start
// body: { filename, contentType, projectId, fileSize }
// returns: { uploadId, key, bucket, partSize, parts }
router.post("/multipart/start", async (req, res) => {
  try {
    if (!requireS3(res)) return;
    const { filename, contentType, projectId, fileSize } = req.body || {};
    if (!filename || !contentType) return res.status(400).json({ message: "filename & contentType required" });
    if (!isAllowedUpload(filename, contentType)) return res.status(400).json({ message: "Unsupported file type" });

    const maxBytes = parseInt(process.env.MULTIPART_MAX_BYTES || "5368709120", 10); // default 5GB
    if (fileSize && Number(fileSize) > maxBytes) {
      return res.status(413).json({ message: `File too large. Max ${maxBytes} bytes.` });
    }
    if (fileSize && Number(fileSize) <= 0) {
      return res.status(400).json({ message: "Invalid fileSize" });
    }

    const ext = sanitizeExt(filename);
    const key = `objekta/${projectId || "temp"}/${uuidv4()}.${ext}`;

    const create = new CreateMultipartUploadCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      ContentType: contentType,
      ACL: "private",
    });
    const out = await s3.send(create);
    const uploadId = out.UploadId;
    multipartMap.set(uploadId, { key, bucket: process.env.S3_BUCKET, createdAt: Date.now() });

    const partSize = parseInt(process.env.MULTIPART_PART_SIZE || `${8 * 1024 * 1024}`, 10); // 8MiB default
    const parts = fileSize ? Math.ceil(Number(fileSize) / partSize) : null;

    console.log(`[uploads] multipart start: uploadId=${uploadId} key=${key} parts=${parts}`);
    res.json({ uploadId, key, bucket: process.env.S3_BUCKET, partSize, parts });
  } catch (err) {
    console.error("multipart start error", err);
    res.status(500).json({ message: "multipart start failed" });
  }
});

// POST /api/uploads/multipart/sign
// body: { uploadId, partNumber }
// returns: { url }
router.post("/multipart/sign", async (req, res) => {
  try {
    if (!requireS3(res)) return;
    const { uploadId, partNumber } = req.body || {};
    if (!uploadId || !partNumber) return res.status(400).json({ message: "uploadId & partNumber required" });
    const parsedPartNumber = Number(partNumber);
    if (!Number.isInteger(parsedPartNumber) || parsedPartNumber < 1 || parsedPartNumber > 10000) {
      return res.status(400).json({ message: "Invalid partNumber" });
    }
    const meta = multipartMap.get(uploadId);
    if (!meta) return res.status(404).json({ message: "Unknown uploadId" });
    if (isExpired(meta.createdAt)) {
      multipartMap.delete(uploadId);
      return res.status(410).json({ message: "Upload expired" });
    }

    const cmd = new UploadPartCommand({
      Bucket: meta.bucket,
      Key: meta.key,
      UploadId: uploadId,
      PartNumber: parsedPartNumber,
    });
    const url = await getSignedUrl(s3, cmd, { expiresIn: 900 });
    res.json({ url });
  } catch (err) {
    console.error("multipart sign error", err);
    res.status(500).json({ message: "multipart sign failed" });
  }
});

// POST /api/uploads/multipart/complete
// body: { uploadId, parts: [{ ETag, PartNumber }] }
// returns: { ok, key, location, bucket }
router.post("/multipart/complete", async (req, res) => {
  try {
    if (!requireS3(res)) return;
    const { uploadId, parts } = req.body || {};
    if (!uploadId || !Array.isArray(parts) || parts.length === 0) return res.status(400).json({ message: "uploadId & parts required" });
    const normalizedParts = parts
      .map((p) => ({ ETag: p?.ETag, PartNumber: Number(p?.PartNumber) }))
      .filter((p) => typeof p.ETag === "string" && p.ETag.trim().length > 0 && Number.isInteger(p.PartNumber) && p.PartNumber > 0)
      .sort((a, b) => a.PartNumber - b.PartNumber);
    if (!normalizedParts.length) return res.status(400).json({ message: "Invalid parts payload" });
    const meta = multipartMap.get(uploadId);
    if (!meta) return res.status(404).json({ message: "Unknown uploadId" });
    if (isExpired(meta.createdAt)) {
      multipartMap.delete(uploadId);
      return res.status(410).json({ message: "Upload expired" });
    }

    const command = new CompleteMultipartUploadCommand({
      Bucket: meta.bucket,
      Key: meta.key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: normalizedParts,
      },
    });
    const out = await s3.send(command);
    multipartMap.delete(uploadId);
    console.log(`[uploads] multipart complete: uploadId=${uploadId} key=${meta.key}`);
    res.json({ ok: true, key: meta.key, bucket: meta.bucket, location: out.Location || null });
  } catch (err) {
    console.error("multipart complete error", err);
    res.status(500).json({ message: "multipart complete failed" });
  }
});

// OPTIONAL: finalize a TUS upload by moving the file to S3, then return key
// body: { filename, projectId, contentType, originalName }
router.post("/tus/finalize", async (req, res) => {
  try {
    if (!requireS3(res)) return;
    const { filename, projectId, contentType, originalName } = req.body || {};
    if (!filename) return res.status(400).json({ message: "filename required" });
    const nameForValidation = originalName || filename;
    if (contentType && !isAllowedUpload(nameForValidation, contentType)) {
      return res.status(400).json({ message: "Unsupported file type" });
    }
    const tusDir = path.resolve(__dirname, "..", "uploads", "tus");
    const fp = path.join(tusDir, filename);
    if (!fs.existsSync(fp)) return res.status(404).json({ message: "tus file not found" });
    const data = fs.readFileSync(fp);
    const ext = sanitizeExt(originalName || filename);
    const key = `objekta/${projectId || "temp"}/${uuidv4()}.${ext}`;
    await s3.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, Body: data, ContentType: contentType || "application/octet-stream", ACL: "private" }));
    try { fs.unlinkSync(fp); } catch (e) {}
    res.json({ ok: true, key });
  } catch (err) {
    console.error("tus finalize error", err);
    res.status(500).json({ message: "tus finalize failed" });
  }
});

module.exports = router;
