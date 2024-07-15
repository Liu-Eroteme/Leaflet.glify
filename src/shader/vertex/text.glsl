attribute vec2 position;
attribute vec2 texCoord;
attribute vec2 instancePosition;
attribute vec4 instanceTexCoord;
attribute vec4 instanceColor;

uniform mat4 matrix;

varying vec2 vTexCoord;
varying vec4 vColor;

void main() {
  vec2 pos = position * instanceTexCoord.zw + instancePosition;
  gl_Position = matrix * vec4(pos, 0.0, 1.0);
  vTexCoord = texCoord * instanceTexCoord.zw + instanceTexCoord.xy;
  vColor = instanceColor;
}