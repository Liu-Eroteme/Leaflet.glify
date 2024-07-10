uniform mat4 matrix;
attribute vec4 vertex;
attribute vec4 color;
attribute float pointSize;
attribute vec2 texCoord;
varying vec4 _color;
varying vec2 _texCoord;

void main() {
  gl_PointSize = pointSize;
  gl_Position = matrix * vertex;
  _color = color;
  _texCoord = texCoord;
}