// README: Metaball fragment shader for BlobBackground. Produces RGBA with soft alpha for bloom.
precision highp float;

uniform float uTime;
uniform vec2 uResolution;

varying vec2 vUv;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.55;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

float metaball(vec2 p, vec2 c, float r) {
  float d = length(p - c);
  return (r * r) / (d * d + 0.001);
}

void main() {
  vec2 uv = vUv;
  vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);
  vec2 p = (uv - 0.5) * aspect;

  float t = uTime * 0.22;
  vec2 flow = vec2(
    fbm(p * 1.5 + vec2(t * 0.8, -t * 0.6)),
    fbm(p * 1.4 + vec2(-t * 0.7, t * 0.9))
  );
  p += (flow - 0.5) * 0.15;

  vec2 c1 = vec2(0.32 * sin(t * 1.1), 0.25 * cos(t * 0.9));
  vec2 c2 = vec2(-0.33 * cos(t * 0.7), 0.24 * sin(t * 1.3));
  vec2 c3 = vec2(0.22 * sin(t * 1.5), -0.28 * cos(t * 0.8));

  float field = 0.0;
  field += metaball(p, c1, 0.45);
  field += metaball(p, c2, 0.38);
  field += metaball(p, c3, 0.34);

  float turbulence = fbm(p * 2.5 + t * 0.6);
  field += turbulence * 0.45;

  float alpha = smoothstep(0.6, 1.25, field);
  float glow = smoothstep(0.5, 1.4, field);

  vec3 colorA = vec3(0.46, 0.36, 0.98);
  vec3 colorB = vec3(0.0, 0.88, 1.0);
  vec3 colorC = vec3(1.0, 0.28, 0.7);

  float hueShift = 0.5 + 0.5 * sin(t + uv.x * 3.0 + turbulence * 2.0);
  vec3 color = mix(colorA, colorB, uv.y);
  color = mix(color, colorC, hueShift);
  color *= 0.55 + 1.1 * glow;

  gl_FragColor = vec4(color, alpha);
}
