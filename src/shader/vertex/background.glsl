precision mediump float;

varying vec2 vTexCoord;
varying vec4 vColor;

uniform sampler2D fontTexture;
uniform float smoothing;

void main() {
  float distance = texture2D(fontTexture, vTexCoord).r;
  float alpha = smoothstep(0.5 - smoothing, 0.5 + smoothing, distance);
  gl_FragColor = vec4(vColor.rgb, vColor.a * alpha);
}