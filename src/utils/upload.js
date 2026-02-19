import * as tus from "tus-js-client";
import { apiUrl } from "./api";

export async function presignPut({ filename, contentType, projectId }) {
	const res = await fetch(apiUrl(`/api/uploads/presign`), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify({ filename, contentType, projectId }),
	});
	if (!res.ok) throw new Error(`Presign failed: ${res.status}`);
	return res.json(); // { url, key, publicUrl }
}

export async function registerProjectAssetS3({ projectId, payload }) {
	const res = await fetch(apiUrl(`/api/projects/${encodeURIComponent(projectId)}/assets/s3`), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify(payload),
	});
	if (!res.ok) throw new Error(`asset register failed: ${res.status}`);
	const json = await res.json();
	try {
		console.debug('[OBJEKTA] asset registered', { projectId, key: json?.asset?.key, source: json?.asset?.source, size: json?.asset?.size });
	} catch (e) {}
	return json; // { success, asset, project }
}

export async function uploadSmallViaPresign({ file, projectId, onProgress }) {
	const { url, key } = await presignPut({ filename: file.name || "blob.bin", contentType: file.type || "application/octet-stream", projectId });
	console.debug('[OBJEKTA] presign small upload', { key, size: file.size });
	const resp = await fetch(url, {
		method: "PUT",
		headers: { "Content-Type": file.type || "application/octet-stream" },
		body: file,
	});
	if (!resp.ok) throw new Error(`PUT failed: ${resp.status}`);
	if (onProgress) onProgress(file.size, file.size);
	// register with project
	const reg = await registerProjectAssetS3({ projectId, payload: { key, url: null, filename: file.name, contentType: file.type || "application/octet-stream", size: file.size } });
	return { key, asset: reg.asset };
}

export async function multipartStart({ file, projectId }) {
	const res = await fetch(apiUrl(`/api/uploads/multipart/start`), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify({ filename: file.name || "blob.bin", contentType: file.type || "application/octet-stream", projectId, fileSize: file.size }),
	});
	if (!res.ok) throw new Error(`multipart start failed: ${res.status}`);
	return res.json(); // { uploadId, key, bucket, partSize, parts }
}

export async function signPart({ uploadId, partNumber }) {
	const res = await fetch(apiUrl(`/api/uploads/multipart/sign`), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify({ uploadId, partNumber }),
	});
	if (!res.ok) throw new Error(`sign part failed: ${res.status}`);
	return res.json(); // { url }
}

export async function multipartComplete({ uploadId, parts }) {
	const res = await fetch(apiUrl(`/api/uploads/multipart/complete`), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify({ uploadId, parts }),
	});
	if (!res.ok) throw new Error(`multipart complete failed: ${res.status}`);
	return res.json();
}

export async function uploadMultipartToS3({ file, projectId, onProgress, concurrency = 4, retry = 2 }) {
	const { uploadId, partSize } = await multipartStart({ file, projectId });
	console.debug('[OBJEKTA] multipart start', { uploadId, partSize, total: file.size });
	const total = file.size;
	const count = Math.ceil(total / partSize);
	const partNumbers = Array.from({ length: count }, (_, i) => i + 1);
	let uploaded = 0;
	const parts = new Array(count);

	const report = () => onProgress && onProgress(uploaded, total);

	async function uploadOne(partNumber) {
		const start = (partNumber - 1) * partSize;
		const end = Math.min(start + partSize, total);
		const chunk = file.slice(start, end);
		let attempt = 0;
		while (true) {
			try {
				const { url } = await signPart({ uploadId, partNumber });
				console.debug('[OBJEKTA] uploading part', { partNumber });
				const resp = await fetch(url, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream" }, body: chunk });
				if (!resp.ok) throw new Error(`PUT part ${partNumber} failed: ${resp.status}`);
				const etag = resp.headers.get("ETag") || resp.headers.get("etag");
				parts[partNumber - 1] = { ETag: etag, PartNumber: partNumber };
				uploaded += chunk.size;
				report();
				return;
			} catch (e) {
				if (attempt++ >= retry) throw e;
				await new Promise((r) => setTimeout(r, 500 * attempt));
			}
		}
	}

	let index = 0;
	async function worker() {
		while (index < partNumbers.length) {
			const n = partNumbers[index++];
			await uploadOne(n);
		}
	}
	const maxWorkers = typeof window === "undefined" ? 1 : Math.min(concurrency, count);
	await Promise.all(Array.from({ length: maxWorkers }, worker));

	const done = await multipartComplete({ uploadId, parts });
	// register with project
	const reg = await registerProjectAssetS3({ projectId, payload: { key: done.key, url: null, filename: file.name, contentType: file.type || "application/octet-stream", size: file.size } });
	return { key: done.key, asset: reg.asset };
}

export function uploadWithTus({ file, projectId, endpoint = apiUrl("/api/uploads/tus"), onProgress }) {
	return new Promise((resolve, reject) => {
		const upload = new tus.Upload(file, {
			endpoint,
			retryDelays: [0, 500, 1500, 3000, 5000],
			metadata: {
				filename: file.name,
				filetype: file.type || "application/octet-stream",
			},
			onProgress: (u, t) => onProgress && onProgress(u, t),
			onError: reject,
			onSuccess: async () => {
				try {
					const reg = await registerProjectAssetS3({ projectId, payload: { key: null, url: upload.url, filename: file.name, contentType: file.type || "application/octet-stream", size: file.size } });
					resolve({ url: upload.url, asset: reg.asset });
				} catch (e) {
					// Still resolve with URL; registration can be retried by caller
					resolve({ url: upload.url });
				}
			},
		});
		upload.start();
	});
}

export async function uploadLargeFile({ file, projectId, onProgress }) {
	const SMALL_LIMIT = 50 * 1024 * 1024; // 50MB
	try {
		if (file.size <= SMALL_LIMIT) {
			return await uploadSmallViaPresign({ file, projectId, onProgress });
		}
	} catch (e) {
		// fall through to multipart
	}
	try {
		return await uploadMultipartToS3({ file, projectId, onProgress });
	} catch (e) {
		console.warn("multipart failed, falling back to tus", e);
	}
	return await uploadWithTus({ file, projectId, onProgress });
}
