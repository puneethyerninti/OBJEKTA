// grid.frag.glsl
varying vec2 vUv;
uniform float uTime;
void main() {
  vec2 grid = abs(fract(vUv * 10.0) - 0.5);
  float line = min(grid.x, grid.y);
  float lineGlow = 1.0 - smoothstep(0.01, 0.02, line);
  float pulse = sin(vUv.y * 5.0 - uTime * 2.0);
  float pulseGlow = smoothstep(0.8, 1.0, pulse);
  
  // IMPROVEMENT: Reduced color from (0.0, 2.5, 5.0) to a subtle cyan/blue
  vec3 color = vec3(0.0, 0.5, 1.0); 
  
  // IMPROVEMENT: Reduced glow multiplier from 10.0 to 2.0
  float finalGlow = (lineGlow + pulseGlow) * 2.0;
  
  gl_FragColor = vec4(color * finalGlow, 1.0);
}