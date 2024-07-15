attribute vec2 position;
attribute vec2 texCoord;
attribute vec2 instancePosition;
attribute vec4 instanceColor;

uniform mat4 matrix;
uniform vec2 labelSize;
uniform vec2 offset;

varying vec2 vTexCoord;
varying vec4 vColor;

void main() {
  vec2 pos = position * labelSize + instancePosition + offset;
  gl_Position = matrix * vec4(pos, 0.0, 1.0);
  vTexCoord = texCoord;
  vColor = instanceColor;
}