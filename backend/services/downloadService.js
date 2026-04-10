// backend/services/downloadService.js
// Handles signed download URL generation and download tracking.
// Supports local disk files and S3.

const crypto = require("crypto");
const path = require("path");

function resolveDownloadSecret() {
  const secret = process.env.DOWNLOAD_SECRET || process.env.JWT_SECRET || "";
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("DOWNLOAD_SECRET (or JWT_SECRET) must be configured in production");
  }
  return secret || "dev-download-secret-change-me";
}

const DOWNLOAD_SECRET = resolveDownloadSecret();
const DOWNLOAD_EXPIRY_HOURS = Number(process.env.DOWNLOAD_EXPIRY_HOURS || "24");
const MAX_DOWNLOADS = Number(process.env.MAX_DOWNLOADS_PER_ITEM || "5");
const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;

/**
 * Generate a signed download token for a file.
 * The token encodes orderId, productId, userId, and expiry — verified on download.
 */
function generateSignedToken({ orderId, productId, userId, expiresInHours = DOWNLOAD_EXPIRY_HOURS }) {
  const expiresAt = Date.now() + expiresInHours * 60 * 60 * 1000;
  const payload = `${orderId}:${productId}:${userId}:${expiresAt}`;
  const signature = crypto.createHmac("sha256", DOWNLOAD_SECRET).update(payload).digest("hex");
  // URL-safe base64 encoding of the token
  const token = Buffer.from(JSON.stringify({
    o: orderId,
    p: productId,
    u: userId,
    e: expiresAt,
    s: signature,
  })).toString("base64url");
  return { token, expiresAt: new Date(expiresAt) };
}

/**
 * Verify a signed download token.
 * Returns the decoded payload or null if invalid.
 */
function verifySignedToken(token) {
  try {
    const decoded = JSON.parse(Buffer.from(token, "base64url").toString());
    const { o: orderId, p: productId, u: userId, e: expiresAt, s: signature } = decoded;

    // Check expiry
    if (Date.now() > expiresAt) return null;

    // Verify signature
    const payload = `${orderId}:${productId}:${userId}:${expiresAt}`;
    const expected = crypto.createHmac("sha256", DOWNLOAD_SECRET).update(payload).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;

    return { orderId, productId, userId, expiresAt: new Date(expiresAt) };
  } catch {
    return null;
  }
}

/**
 * Generate a signed download URL for a purchased product.
 */
function generateSignedDownloadUrl({ orderId, productId, userId }) {
  const { token, expiresAt } = generateSignedToken({ orderId, productId, userId });
  const url = `${BACKEND_URL}/api/marketplace/downloads/${token}`;
  return { signedUrl: url, expiresAt };
}

/**
 * Generate download links for all items in a confirmed order.
 */
function generateOrderDownloadLinks(order) {
  const links = [];
  for (const item of order.items) {
    const { signedUrl, expiresAt } = generateSignedDownloadUrl({
      orderId: order._id.toString(),
      productId: item.product.toString ? item.product.toString() : item.product,
      userId: order.buyer.toString ? order.buyer.toString() : order.buyer,
    });
    links.push({
      product: item.product,
      signedUrl,
      signedUrlExpires: expiresAt,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days overall
      downloadCount: 0,
      maxDownloads: MAX_DOWNLOADS,
      license: "standard",
    });
  }
  return links;
}

module.exports = {
  generateSignedToken,
  verifySignedToken,
  generateSignedDownloadUrl,
  generateOrderDownloadLinks,
  MAX_DOWNLOADS,
};
