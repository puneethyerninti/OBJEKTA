// README: Ring shader for SpaceBackground.
precision highp float;

uniform float uTime;

varying vec2 vUv;

float hash(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

void main() {
  float dist = abs(vUv.y - 0.5) * 2.0;
  float alpha = smoothstep(1.0, 0.2, dist);
  float bands = noise(vUv * 8.0 + uTime * 0.05);
  vec3 color = mix(vec3(0.4, 0.6, 0.9), vec3(0.8, 0.5, 1.0), bands);
  gl_FragColor = vec4(color, alpha * 0.7);
}
