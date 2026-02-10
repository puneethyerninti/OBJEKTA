// README: Planet surface shader for SpaceBackground.
precision highp float;

uniform float uTime;
uniform vec3 uLightDir;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;

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

float fbm(vec2 p){
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec3 n = normalize(vNormal);
  float light = max(dot(n, normalize(uLightDir)), 0.0);

  vec2 uv = vUv * 2.6;
  float bands = fbm(uv + vec2(uTime * 0.03, -uTime * 0.02));
  float storms = fbm(uv * 1.6 + vec2(2.0, uTime * 0.06));

  vec3 deep = vec3(0.05, 0.08, 0.2);
  vec3 mid = vec3(0.2, 0.28, 0.55);
  vec3 bright = vec3(0.7, 0.4, 0.9);

  vec3 base = mix(deep, mid, bands);
  base = mix(base, bright, storms * 0.5);

  float rim = pow(1.0 - max(dot(n, vec3(0.0, 0.0, 1.0)), 0.0), 2.2);
  vec3 color = base * (0.4 + light * 0.9) + rim * vec3(0.2, 0.6, 0.9);

  gl_FragColor = vec4(color, 1.0);
}
