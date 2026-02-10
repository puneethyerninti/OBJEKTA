// README: Atmosphere rim glow shader for SpaceBackground.
precision highp float;

uniform float uTime;
uniform vec3 uGlowColor;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vec3 n = normalize(vNormal);
  float rim = pow(1.0 - abs(dot(n, vec3(0.0, 0.0, 1.0))), 2.8);
  float pulse = 0.85 + 0.15 * sin(uTime * 0.6 + vUv.y * 6.0);
  vec3 color = uGlowColor * rim * pulse;
  gl_FragColor = vec4(color, rim * 0.65);
}
