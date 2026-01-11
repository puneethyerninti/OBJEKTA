// hologram.frag.glsl
varying float vFresnel;
varying vec3 vNormal;
uniform float uTime;
varying vec2 vUv; // Added vUv
void main() {
  float fresnel = pow(vFresnel, 3.0);
  float scanlines = sin(gl_FragCoord.y * 2.0) * 0.1 + 0.9;
  float flicker = (sin(uTime * 10.0) + 1.0) / 2.0;
  flicker = step(0.8, flicker) + 0.5;
  
  // Use vUv for the artifact, not gl_FragCoord
  float artifact = sin(vUv.y * 10.0 + uTime * 2.0); 
  if (artifact > 0.95) {
    flicker = 0.0;
  }

  vec3 color = vec3(5.0, 0.0, 0.0); // Overdriven Red
  float alpha = fresnel * scanlines * flicker;
  gl_FragColor = vec4(color * alpha, alpha * 0.5);
}