precision mediump float;

varying vec2 vSize;
varying float vCornerRadius;
varying vec4 vColor;

void main() {
  vec2 pixelPos = gl_FragCoord.xy - gl_FragCoord.w * gl_FragCoord.xy;
  vec2 center = vSize * 0.5;
  vec2 dist = abs(pixelPos - center);
  
  if (dist.x > center.x - vCornerRadius || dist.y > center.y - vCornerRadius) {
    float distToCorner = length(max(dist - center + vCornerRadius, 0.0));
    if (distToCorner > vCornerRadius) {
      discard;
    }
  }
  
  gl_FragColor = vColor;
}