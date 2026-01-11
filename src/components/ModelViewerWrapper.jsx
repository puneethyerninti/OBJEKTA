import React, { useEffect, useState } from "react";

const MODEL_VIEWER_SRC = "https://unpkg.com/@google/model-viewer@^3.3.0/dist/model-viewer.min.js";
let scriptPromise;

function ensureModelViewerDefined() {
	if (typeof window === "undefined") return Promise.resolve();
	if (window?.customElements?.get("model-viewer")) return Promise.resolve();
	if (!scriptPromise) {
		scriptPromise = new Promise((resolve, reject) => {
			const script = document.createElement("script");
			script.type = "module";
			script.src = MODEL_VIEWER_SRC;
			script.async = true;
			script.onload = resolve;
			script.onerror = reject;
			document.head.appendChild(script);
		});
	}
	return scriptPromise;
}

export default function ModelViewerWrapper({
	src,
	alt = "3D model preview",
	poster,
	autoRotate = true,
	cameraControls = true,
	reveal = "auto",
	exposure = 1.1,
	accent = "cyan",
	className = "",
	lowPower = false,
	...props
}) {
	const [ready, setReady] = useState(false);
	const [errored, setErrored] = useState(false);

	useEffect(() => {
		let mounted = true;
		if (lowPower) {
			setReady(false);
			return () => {
				mounted = false;
			};
		}
		ensureModelViewerDefined()
			.then(() => {
				if (mounted) setReady(true);
			})
			.catch(() => {
				if (mounted) setErrored(true);
			});
		return () => {
			mounted = false;
		};
	}, [lowPower]);

	const showPoster = !ready || errored || lowPower;

	return (
		<div className={`holo-shell holo-shell-${accent} ${className}`}>
			{showPoster && (
				<div className="holo-poster" aria-live="polite" style={{ position: 'absolute', inset: 0, zIndex: 2 }}>
					{poster ? (
                        <img 
                            src={poster} 
                            alt={alt} 
                            loading="lazy" 
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.parentElement.innerText = 'Preview Unavailable';
                            }}
                        />
                    ) : (
                        <div className="holo-loading">
                            <div className="loading-spinner" />
                            <span>Initializing Neural Link...</span>
                        </div>
                    )}
				</div>
			)}

			{!showPoster && (
				<model-viewer
					src={src}
					poster={poster}
					alt={alt}
					auto-rotate={autoRotate ? "" : undefined}
					camera-controls={cameraControls ? "" : undefined}
					exposure={String(exposure)}
					reveal={reveal}
					shadow-intensity="0.15"
					interaction-prompt="none"
					style={{ width: "100%", height: "100%" }}
					onError={() => setErrored(true)}
					{...props}
				/>
			)}

			<span className="holo-overlay" aria-hidden />
			<span className="holo-grid" aria-hidden />
			<span className="holo-scan" aria-hidden />
		</div>
	);
}
