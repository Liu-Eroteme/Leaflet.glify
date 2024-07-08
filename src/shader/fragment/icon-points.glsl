precision mediump float;
   varying vec4 _color;
   varying vec2 _texCoord;
   uniform sampler2D uTexture;

   void main() {
     vec4 texColor = texture2D(uTexture, gl_PointCoord);
     gl_FragColor = texColor * _color;
   }