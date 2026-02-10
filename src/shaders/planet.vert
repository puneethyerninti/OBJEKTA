// README: Vertex shader for planet and atmosphere. Shared by SpaceBackground.
precision highp float;

uniform float uTime;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec3(1.0, 0.0, 0.0));
  float c = hash(i + vec3(0.0, 1.0, 0.0));
  float d = hash(i + vec3(1.0, 1.0, 0.0));
  float e = hash(i + vec3(0.0, 0.0, 1.0));
  float f1 = hash(i + vec3(1.0, 0.0, 1.0));
  float g = hash(i + vec3(0.0, 1.0, 1.0));
  float h = hash(i + vec3(1.0, 1.0, 1.0));
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(a, b, u.x), mix(c, d, u.x), u.y), mix(mix(e, f1, u.x), mix(g, h, u.x), u.y), u.z);
}

float fbm(vec3 p) {
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
  vUv = uv;
  vNormal = normalMatrix * normal;
  vec3 displaced = position;
  float n = fbm(normalize(position) * 1.7 + uTime * 0.15);
  displaced += normal * n * 0.06;
  vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
  vPosition = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
