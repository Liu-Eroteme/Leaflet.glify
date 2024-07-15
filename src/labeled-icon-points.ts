import { IconPoints, IIconPointsSettings, IIconVertex } from "./icon-points";
import { ICanvasOverlayDrawEvent } from "./canvas-overlay";
import { LatLng, Point } from "leaflet";
import { Feature, FeatureCollection, Point as GeoPoint } from "geojson";
import { MapMatrix } from "./map-matrix";
import * as Color from "./color";

interface ILabeledIconPointsSettings extends IIconPointsSettings {
  labelOffset: [number, number];
  labelFont: string;
  labelColor: [number, number, number, number];
  labelBackgroundColor: [number, number, number, number];
  labelText: (feature: any) => string;
}

interface ILabeledFeature extends Feature<GeoPoint> {
  properties: {
    labelText?: string;
    labelOffset?: [number, number];
  };
}

class LabeledIconPoints extends IconPoints {
  gl: WebGLRenderingContext | WebGL2RenderingContext;
  private isWebGL2: boolean;
  private labelShader: WebGLProgram | null = null;
  private backgroundShader: WebGLProgram | null = null;
  private fontTexture: WebGLTexture | null = null;
  private fontAtlas: any | null = null;
  private glyphQuad: WebGLBuffer | null = null;
  private labelInstanceData: WebGLBuffer | null = null;
  private labelSettings: ILabeledIconPointsSettings;

  constructor(settings: ILabeledIconPointsSettings) {
    super(settings);
    this.labelSettings = settings;

    // Check for WebGL2 support
    const canvas = document.createElement("canvas");
    this.gl = canvas.getContext("webgl2") || canvas.getContext("webgl")!;
    this.isWebGL2 = !!canvas.getContext("webgl2");

    if (!this.gl) {
      throw new Error("WebGL not supported");
    }

    this.initializeLabelRendering();
  }

  private async initializeLabelRendering() {
    await this.loadFontAtlas();
    await this.createShaders();
    this.createBuffers();
  }

  private async loadFontAtlas() {
    const response = await fetch(
      "./resources/helvetica-msdf/Helvetica-msdf.json"
    );
    this.fontAtlas = await response.json();

    const image = new Image();
    image.src = "./resources/helvetica-msdf/Helvetica.png";
    await new Promise((resolve) => (image.onload = resolve));

    const texture = this.gl.createTexture();
    if (!texture) {
      throw new Error("Failed to create texture");
    }
    this.fontTexture = texture;

    this.gl.bindTexture(this.gl.TEXTURE_2D, this.fontTexture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      image
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_WRAP_S,
      this.gl.CLAMP_TO_EDGE
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_WRAP_T,
      this.gl.CLAMP_TO_EDGE
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MIN_FILTER,
      this.gl.LINEAR
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MAG_FILTER,
      this.gl.LINEAR
    );
  }

  private async createShaders() {
    const loadShader = async (path: string) => {
      const response = await fetch(path);
      return response.text();
    };

    const backgroundVertexShader = await loadShader(
      "./shader/vertex/background.glsl"
    );
    const backgroundFragmentShader = await loadShader(
      "./shader/fragment/background.glsl"
    );
    const textVertexShader = await loadShader("./shader/vertex/text.glsl");
    const textFragmentShader = await loadShader("./shader/fragment/text.glsl");

    this.backgroundShader = this.createShaderProgram(
      backgroundVertexShader,
      backgroundFragmentShader
    );
    this.labelShader = this.createShaderProgram(
      textVertexShader,
      textFragmentShader
    );
  }

  private createShaderProgram(
    vertexSource: string,
    fragmentSource: string
  ): WebGLProgram {
    const vertexShader = this.gl.createShader(this.gl.VERTEX_SHADER);
    if (!vertexShader) {
      throw new Error("Failed to create vertex shader");
    }
    this.gl.shaderSource(vertexShader, vertexSource);
    this.gl.compileShader(vertexShader);

    const fragmentShader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
    if (!fragmentShader) {
      throw new Error("Failed to create fragment shader");
    }
    this.gl.shaderSource(fragmentShader, fragmentSource);
    this.gl.compileShader(fragmentShader);

    const program = this.gl.createProgram();
    if (!program) {
      throw new Error("Failed to create shader program");
    }
    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      throw new Error(
        `Failed to link shader program: ${this.gl.getProgramInfoLog(program)}`
      );
    }

    return program;
  }

  private createBuffers() {
    const glyphQuadVertices = new Float32Array([
      0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 1, 0, 1, 0, 1,
    ]);

    const glyphQuad = this.gl.createBuffer();
    if (!glyphQuad) {
      throw new Error("Failed to create glyph quad buffer");
    }
    this.glyphQuad = glyphQuad;

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.glyphQuad);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      glyphQuadVertices,
      this.gl.STATIC_DRAW
    );

    const labelInstanceData = this.gl.createBuffer();
    if (!labelInstanceData) {
      throw new Error("Failed to create label instance data buffer");
    }
    this.labelInstanceData = labelInstanceData;
  }

  render(): this {
    super.render();
    this.renderLabels();
    return this;
  }

  private renderLabels() {
    if (!this.backgroundShader || !this.labelShader || !this.fontTexture) {
      console.error("Shader programs or font texture not initialized");
      return;
    }

    const { gl, canvas, mapMatrix } = this;

    // Render backgrounds
    gl.useProgram(this.backgroundShader);
    this.setBackgroundUniforms();
    this.drawBackgrounds();

    // Render text
    gl.useProgram(this.labelShader);
    this.setTextUniforms();
    this.drawText();
  }

  private setBackgroundUniforms() {
    const { gl, mapMatrix } = this;
    const backgroundMatrixLocation = gl.getUniformLocation(
      this.backgroundShader!,
      "matrix"
    );
    gl.uniformMatrix4fv(backgroundMatrixLocation, false, mapMatrix.array);

    const backgroundColorLocation = gl.getUniformLocation(
      this.backgroundShader!,
      "backgroundColor"
    );
    gl.uniform4fv(
      backgroundColorLocation,
      this.labelSettings.labelBackgroundColor
    );

    const labelSizeLocation = gl.getUniformLocation(
      this.backgroundShader!,
      "labelSize"
    );
    gl.uniform2f(
      labelSizeLocation,
      this.labelSettings.iconSize,
      this.labelSettings.iconSize / 2
    );

    const cornerRadiusLocation = gl.getUniformLocation(
      this.backgroundShader!,
      "cornerRadius"
    );
    gl.uniform1f(cornerRadiusLocation, 5.0); // Adjust as needed
  }

  private drawBackgrounds() {
    const { gl } = this;
    const positionBuffer = this.getBuffer("backgroundPosition");
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    const positionLocation = gl.getAttribLocation(
      this.backgroundShader!,
      "position"
    );
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, this.allLatLngLookup.length * 6);
  }

  private setTextUniforms() {
    const { gl, mapMatrix } = this;
    const textMatrixLocation = gl.getUniformLocation(
      this.labelShader!,
      "matrix"
    );
    gl.uniformMatrix4fv(textMatrixLocation, false, mapMatrix.array);

    const fontTextureLocation = gl.getUniformLocation(
      this.labelShader!,
      "fontTexture"
    );
    gl.uniform1i(fontTextureLocation, 0);

    const smoothingLocation = gl.getUniformLocation(
      this.labelShader!,
      "smoothing"
    );
    gl.uniform1f(smoothingLocation, 0.1); // Adjust as needed

    const labelSizeLocation = gl.getUniformLocation(
      this.labelShader!,
      "labelSize"
    );
    gl.uniform2f(
      labelSizeLocation,
      this.labelSettings.iconSize,
      this.labelSettings.iconSize / 2
    );
  }

  private drawText() {
    const { gl } = this;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.glyphQuad!);

    const positionLocation = gl.getAttribLocation(
      this.labelShader!,
      "position"
    );
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 16, 0);

    const texCoordLocation = gl.getAttribLocation(
      this.labelShader!,
      "texCoord"
    );
    gl.enableVertexAttribArray(texCoordLocation);
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 16, 8);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.labelInstanceData!);

    const instancePositionLocation = gl.getAttribLocation(
      this.labelShader!,
      "instancePosition"
    );
    gl.enableVertexAttribArray(instancePositionLocation);
    gl.vertexAttribPointer(instancePositionLocation, 2, gl.FLOAT, false, 32, 0);

    const instanceTexCoordLocation = gl.getAttribLocation(
      this.labelShader!,
      "instanceTexCoord"
    );
    gl.enableVertexAttribArray(instanceTexCoordLocation);
    gl.vertexAttribPointer(instanceTexCoordLocation, 4, gl.FLOAT, false, 32, 8);

    const instanceColorLocation = gl.getAttribLocation(
      this.labelShader!,
      "instanceColor"
    );
    gl.enableVertexAttribArray(instanceColorLocation);
    gl.vertexAttribPointer(instanceColorLocation, 4, gl.FLOAT, false, 32, 24);

    if (this.isWebGL2) {
      const gl2 = gl as WebGL2RenderingContext;
      gl2.vertexAttribDivisor(instancePositionLocation, 1);
      gl2.vertexAttribDivisor(instanceTexCoordLocation, 1);
      gl2.vertexAttribDivisor(instanceColorLocation, 1);
      gl2.drawArraysInstanced(gl2.TRIANGLES, 0, 6, this.getTotalGlyphCount());
    } else {
      const ext = gl.getExtension("ANGLE_instanced_arrays");
      if (!ext) {
        throw new Error("ANGLE_instanced_arrays extension not supported");
      }
      ext.vertexAttribDivisorANGLE(instancePositionLocation, 1);
      ext.vertexAttribDivisorANGLE(instanceTexCoordLocation, 1);
      ext.vertexAttribDivisorANGLE(instanceColorLocation, 1);
      ext.drawArraysInstancedANGLE(
        gl.TRIANGLES,
        0,
        6,
        this.getTotalGlyphCount()
      );
    }
  }

  private getTotalGlyphCount(): number {
    let count = 0;
    const features = Array.isArray(this.settings.data)
      ? this.settings.data
      : this.settings.data!.features || [];
    features.forEach((feature: ILabeledFeature | number[]) => {
      const text = this.getLabelText(feature);
      count += text.length;
    });
    return count;
  }

  private updateLabelInstanceData() {
    if (!this.labelInstanceData) return;

    const data: number[] = [];
    const features = Array.isArray(this.settings.data)
      ? this.settings.data
      : (this.settings.data as FeatureCollection<GeoPoint>).features || [];

    features.forEach((feature: Feature<GeoPoint, GeoJsonProperties> | number[], index: number) => {
      const text = this.getLabelText(feature);
      const offset = this.getLabelOffset(feature);
      const position = this.calculateLabelPosition(
        this.allLatLngLookup[index],
        offset
      );

      let xOffset = 0;
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const charInfo = this.fontAtlas.chars[char];
        if (!charInfo) continue;

        data.push(
          position[0] + xOffset,
          position[1], // position
          charInfo.x,
          charInfo.y,
          charInfo.width,
          charInfo.height, // texture coordinates
          ...this.labelSettings.labelColor // color
        );

        xOffset += charInfo.width;
      }
    });

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.labelInstanceData);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array(data),
      this.gl.DYNAMIC_DRAW
    );
  }
  drawOnCanvas(e: ICanvasOverlayDrawEvent): this {
    super.drawOnCanvas(e);
    this.updateLabelPositions(e);
    return this;
  }

  private updateLabelPositions(e: ICanvasOverlayDrawEvent) {
    // Recalculate label positions based on new map state
    this.updateLabelInstanceData();
  }

  private calculateLabelPosition(
    iconVertex: IIconVertex,
    offset: [number, number]
  ): [number, number] {
    const { map } = this;
    const point = map.latLngToContainerPoint(iconVertex.latLng);
    return [point.x + offset[0], point.y + offset[1]];
  }

  private getLabelText(feature: Feature<GeoPoint, GeoJsonProperties> | number[]): string {
    if (Array.isArray(feature)) {
      return this.labelSettings.labelText(feature);
    }
    if (feature.properties && 'labelText' in feature.properties && typeof feature.properties.labelText === 'string') {
      return feature.properties.labelText;
    }
    return this.labelSettings.labelText(feature);
  }

  private getLabelOffset(
    feature: Feature<GeoPoint, GeoJsonProperties> | number[]
  ): [number, number] {
    if (Array.isArray(feature)) {
      return this.labelSettings.labelOffset;
    }
    if (feature.properties && 'labelOffset' in feature.properties && Array.isArray(feature.properties.labelOffset)) {
      return feature.properties.labelOffset as [number, number];
    }
    return this.labelSettings.labelOffset;
  }

  setData(data: FeatureCollection<GeoPoint> | number[][]): this {
    this.settings = { ...this.settings, data };
    return this.render();
  }

  resetVertices(): this {
    super.resetVertices();
    this.updateLabelInstanceData();
    return this;
  }
}

export { LabeledIconPoints, ILabeledIconPointsSettings };
