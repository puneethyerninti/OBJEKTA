// Patch Three.js shader chunk names for legacy/newer mixes
// If a dependency expects colorspace_* chunks but our Three provides encodings_*, alias them.
try {
  // Import on demand to avoid bundler side effects if tree-shaken
  // eslint-disable-next-line import/no-extraneous-dependencies
  const three = await import('three');
  const ShaderChunk = three?.ShaderChunk;
  if (ShaderChunk) {
    if (!ShaderChunk.colorspace_fragment && ShaderChunk.encodings_fragment) {
      ShaderChunk.colorspace_fragment = ShaderChunk.encodings_fragment;
    }
    if (!ShaderChunk.colorspace_pars_fragment && ShaderChunk.encodings_pars_fragment) {
      ShaderChunk.colorspace_pars_fragment = ShaderChunk.encodings_pars_fragment;
    }
  }
} catch (e) {
  // ignore if three not yet available
}
