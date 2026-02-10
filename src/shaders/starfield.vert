// README: Starfield vertex shader for SpaceBackground.
precision highp float;

uniform float uTime;
attribute float aSize;
attribute float aSeed;

varying float vTwinkle;

void main() {
  vTwinkle = 0.6 + 0.4 * sin(uTime * 1.4 + aSeed * 6.2831);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = aSize * (60.0 / -mvPosition.z);
}
