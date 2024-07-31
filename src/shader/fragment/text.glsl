// FRAGMENT SHADER DEBUG
precision mediump float;

varying vec2 vTexCoord;
varying vec4 vColor;

uniform sampler2D fontTexture;
uniform float smoothing;

void main() {
  // Use all variables to prevent compiler from removing them
  vec4 unusedColor = texture2D(fontTexture, vTexCoord);
  float unusedAlpha = smoothstep(0.5 - smoothing, 0.5 + smoothing, unusedColor.r);
  vec4 unusedFinalColor = vec4(vColor.rgb, vColor.a * unusedAlpha);
  
  // Set the entire quad to black
  gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
}

// FRAGMENT SHADER
// precision mediump float;

// varying vec2 vTexCoord;
// varying vec4 vColor;

// uniform sampler2D fontTexture;
// uniform float smoothing;

// void main() {
//   float distance = texture2D(fontTexture, vTexCoord).r;
//   float alpha = smoothstep(0.5 - smoothing, 0.5 + smoothing, distance);
//   gl_FragColor = vec4(vColor.rgb, vColor.a * alpha);
// }