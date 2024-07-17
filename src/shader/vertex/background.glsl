attribute vec2 position;
attribute vec2 size;
attribute float cornerRadius;
attribute vec4 color;

uniform mat4 matrix;

varying vec2 vSize;
varying float vCornerRadius;
varying vec4 vColor;

void main() {
  gl_Position = matrix * vec4(position, 0.0, 1.0);
  vSize = size;
  vCornerRadius = cornerRadius;
  vColor = color;
}