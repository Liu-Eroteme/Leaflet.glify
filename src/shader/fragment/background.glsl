precision mediump float;
uniform vec4 backgroundColor;
uniform vec2 labelSize;
uniform float cornerRadius;

void main() {
  vec2 coord = gl_FragCoord.xy;
  vec2 center = labelSize * 0.5;
  vec2 dist = abs(coord - center);
  
  if (dist.x > center.x - cornerRadius || dist.y > center.y - cornerRadius) {
    float distToCorner = length(max(dist - center + cornerRadius, 0.0));
    if (distToCorner > cornerRadius) {
      discard;
    }
  }
  
  gl_FragColor = backgroundColor;
}