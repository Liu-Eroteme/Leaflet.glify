attribute vec2 position;
uniform mat4 matrix;
uniform vec2 labelSize;
uniform vec2 offset;

void main() {
  vec2 pos = position * labelSize + offset;
  gl_Position = matrix * vec4(pos, 0.0, 1.0);
}