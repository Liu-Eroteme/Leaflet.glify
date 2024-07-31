#version 300 es
uniform mat4 matrix;
uniform float uScale;
in vec4 position;
in vec2 size;
in vec4 color;
in vec2 offset;
out vec4 vColor;
out vec2 vPosition;
out vec2 vSize;

void main() {
  vec2 sizeOffset = vec2(
    float(gl_VertexID % 2),
    float(gl_VertexID / 2)
  ) * (size / uScale);

  vec2 scaledOffset = offset / uScale;
  
  vec4 pos = position + vec4(sizeOffset, 0.0, 0.0) + vec4(scaledOffset, 0.0, 0.0);
  gl_Position = matrix * pos;
  
  vColor = color;
  vPosition = pos.xy - position.xy - scaledOffset;
  vSize = size / uScale;
}