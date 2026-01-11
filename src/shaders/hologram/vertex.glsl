// hologram.vert.glsl
varying vec3 vNormal;
varying float vFresnel;
void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vec3 worldNormal = normalize(mat3(modelMatrix) * normal);
  vec3 viewDirection = normalize(cameraPosition - worldPosition.xyz);
  vFresnel = 1.0 - abs(dot(worldNormal, viewDirection));
  vNormal = normal;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}