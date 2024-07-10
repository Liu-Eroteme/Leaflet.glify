precision mediump float;
varying vec4 _color;
varying vec2 _texCoord;
uniform sampler2D uTexture;

void main() {
  // Adjust texture coordinates based on the _texCoord offset
  vec2 adjustedTexCoord = gl_PointCoord - _texCoord;
  
  // Ensure the texture coordinates stay within [0, 1] range
  adjustedTexCoord = clamp(adjustedTexCoord, 0.0, 1.0);
  
  vec4 texColor = texture2D(uTexture, adjustedTexCoord);
  gl_FragColor = texColor * _color;
}