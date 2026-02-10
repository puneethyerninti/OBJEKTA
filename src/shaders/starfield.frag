// README: Starfield fragment shader for SpaceBackground.
precision highp float;

uniform vec3 uTint;
uniform float uIntensity;

varying float vTwinkle;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  float alpha = smoothstep(0.5, 0.0, d);
  vec3 tint = uTint;
  float intensity = uIntensity;
  gl_FragColor = vec4(tint * vTwinkle * intensity, alpha * vTwinkle);
}
