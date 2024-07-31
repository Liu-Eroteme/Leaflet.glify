import { IconPoints, IIconPointsSettings, IIconVertex } from "./icon-points";
import { ICanvasOverlayDrawEvent } from "./canvas-overlay";
import {
  Feature,
  FeatureCollection,
  Point as GeoPoint,
  GeoJsonProperties,
} from "geojson";
import { LeafletMouseEvent, Map, LatLng } from "leaflet";

import fontAtlasJson from "./resources/helvetica-msdf/Helvetica-msdf.json";
import fontAtlasImageSrc from "./resources/helvetica-msdf/Helvetica.png";

// TODO switch color param arrays to ICOLOR
interface IColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}

interface ILabeledIconPointsSettings extends IIconPointsSettings {
  labelOffset?: [number, number];
  labelFont?: string;
  labelColor?: IColor;
  labelBackgroundColor?: IColor;
  labelText?: (
    feature: Feature<GeoPoint, GeoJsonProperties> | number[]
  ) => string;
  labelBackgroundPadding?: [number, number];
  labelBackgroundCornerRadius?: number;
  labelBackgroundVertexShaderSource: () => string;
  labelBackgroundFragmentShaderSource: () => string;
  labelTextVertexShaderSource: () => string;
  labelTextFragmentShaderSource: () => string;
}

// TODO ?
interface ILabeledFeature extends Feature<GeoPoint> {
  properties: {
    labelText?: string;
    labelOffset?: [number, number];
    labelFont?: string;
    labelColor?: IColor;
    labelBackgroundColor?: IColor;
    labelBackgroundPadding?: [number, number];
    labelBackgroundCornerRadius?: number;
  } & GeoJsonProperties;
}

class LabeledIconPoints extends IconPoints {
  private isWebGL2: boolean;
  private labelShader: WebGLProgram | null = null;
  private backgroundShader: WebGLProgram | null = null;
  private fontTexture: WebGLTexture | null = null;
  private fontAtlas: any | null = null;
  private glyphQuad: WebGLBuffer | null = null;
  private labelInstanceData: WebGLBuffer | null = null;
  private backgroundBuffer: WebGLBuffer | null = null;
  private labelSettings: ILabeledIconPointsSettings;

  private isInitialized: boolean = false;
  private initPromise: Promise<void>;

  private textData: number[] = [];
  private backgroundData: number[] = [];

  constructor(settings: ILabeledIconPointsSettings) {
    super(settings);
    this.labelSettings = {
      labelOffset: [0, 0],
      labelFont: "12px Arial", // wtf am i even using this for what was i smoking?
      labelColor: { r: 0, g: 0, b: 0, a: 1 },
      labelBackgroundColor: { r: 255, g: 255, b: 255, a: 1 },
      labelText: () => "",
      labelBackgroundPadding: [2, 2],
      labelBackgroundCornerRadius: 3,
      ...settings,
    };

    // Check for WebGL2 support
    this.isWebGL2 = this.gl instanceof WebGL2RenderingContext;
    console.log("isWebGL2:", this.isWebGL2);

    this.initPromise = this.initializeLabelRendering();
  }

  private async initializeLabelRendering(): Promise<void> {
    try {
      console.log("awaiting super.ready()");
      await super.ready();
      console.log("super.ready() resolved");
      console.log("initializing label rendering");
      await this.loadFontAtlas();
      await this.createShaders();
      await this.createBuffers();
      this.isInitialized = true;
      console.log("label rendering initialized");
    } catch (error) {
      console.error("Failed to initialize label rendering:", error);
    }
  }

  // rethink?
  private async loadFontAtlas(): Promise<void> {
    this.fontAtlas = fontAtlasJson;

    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const texture = this.gl.createTexture();
        if (!texture) {
          reject(new Error("Failed to create texture"));
          return;
        }
        this.fontTexture = texture;

        // TODO separate out, call in own func, needs to be re called?
        this.gl.activeTexture(this.gl.TEXTURE1);
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

        resolve();
      };

      image.onerror = () => {
        reject(new Error("Failed to load font atlas image"));
      };

      // Set the source to the imported base64 image data
      // is converted to b64 by webpack plugin
      image.src = fontAtlasImageSrc;
    });
  }

  private async createShaders() {
    this.backgroundShader = this.createShaderProgram(
      this.labelSettings.labelBackgroundVertexShaderSource(),
      this.labelSettings.labelBackgroundFragmentShaderSource()
    );
    this.labelShader = this.createShaderProgram(
      this.labelSettings.labelTextVertexShaderSource(),
      this.labelSettings.labelTextFragmentShaderSource()
    );
  }

  private createShaderProgram(
    vertexSource: string,
    fragmentSource: string
  ): WebGLProgram {
    console.log("Starting shader program creation");

    console.log("Creating vertex shader");
    const vertexShader = this.gl.createShader(this.gl.VERTEX_SHADER);
    if (!vertexShader) {
      console.error("Failed to create vertex shader");
      throw new Error("Failed to create vertex shader");
    }
    console.log("Vertex shader created successfully");

    console.log("Setting vertex shader source");
    this.gl.shaderSource(vertexShader, vertexSource);
    console.log("Compiling vertex shader");
    this.gl.compileShader(vertexShader);

    console.log("Checking vertex shader compilation status");
    if (!this.gl.getShaderParameter(vertexShader, this.gl.COMPILE_STATUS)) {
      const info = this.gl.getShaderInfoLog(vertexShader);
      console.error("Vertex shader compilation failed:", info);
      throw new Error(`Vertex shader compilation failed: ${info}`);
    }
    console.log("Vertex shader compiled successfully");

    console.log("Creating fragment shader");
    const fragmentShader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
    if (!fragmentShader) {
      console.error("Failed to create fragment shader");
      throw new Error("Failed to create fragment shader");
    }
    console.log("Fragment shader created successfully");

    console.log("Setting fragment shader source");
    this.gl.shaderSource(fragmentShader, fragmentSource);
    console.log("Compiling fragment shader");
    this.gl.compileShader(fragmentShader);

    console.log("Checking fragment shader compilation status");
    if (!this.gl.getShaderParameter(fragmentShader, this.gl.COMPILE_STATUS)) {
      const info = this.gl.getShaderInfoLog(fragmentShader);
      console.error("Fragment shader compilation failed:", info);
      throw new Error(`Fragment shader compilation failed: ${info}`);
    }
    console.log("Fragment shader compiled successfully");

    console.log("Creating shader program");
    const program = this.gl.createProgram();
    if (!program) {
      console.error("Failed to create shader program");
      throw new Error("Failed to create shader program");
    }
    console.log("Shader program created successfully");

    console.log("Attaching shaders to program");
    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);

    console.log("Linking shader program");
    this.gl.linkProgram(program);

    console.log("Checking shader program link status");
    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      const info = this.gl.getProgramInfoLog(program);
      console.error("Shader program link failed:", info);
      throw new Error(`Failed to link shader program: ${info}`);
    }
    console.log("Shader program linked successfully");

    console.log("Shader program creation completed");
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

    const backgroundBuffer = this.gl.createBuffer();
    if (!backgroundBuffer) {
      throw new Error("Failed to create background buffer");
    }
    this.backgroundBuffer = backgroundBuffer;
  }

  render(): this {
    console.log("render call!");
    if (this.isInitialized) {
      console.log("is initialized");

      // call super render with optional property noRedraw = false to disable redraw call
      super.render(false);
      console.log("super render called");

      // setup data for labels
      // needs to be called after super render since super render calls resetVertices and that sets up the coordinates
      // more of that can be reused tbh, i might be recalculating too much
      // also, consider destructuring render in the base class and using subfuncs here
      this.updateLabelInstanceData();

      // perform redraw call - will pass this.drawOnCanvas as a callback to rAF which should render all
      this.layer.redraw();
    }
    return this;
  }

  private setupStateBackground(): this {
    const { gl } = this;
    console.log("setupStateBackground called");

    // sanity check
    if (!this.backgroundShader) return this;

    if (!this.gl) return this;

    // set up program
    gl.useProgram(this.backgroundShader!);

    // set up buffer
    console.log("Binding backgroundBuffer");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.backgroundBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(this.backgroundData),
      gl.STATIC_DRAW
    );

    // set up shader variables
    // position attribute
    const positionLocation = gl.getAttribLocation(
      this.backgroundShader!,
      "position"
    );
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 4, gl.FLOAT, false, 48, 0);

    // size attribute
    const sizeLocation = gl.getAttribLocation(this.backgroundShader!, "size");
    gl.enableVertexAttribArray(sizeLocation);
    gl.vertexAttribPointer(sizeLocation, 2, gl.FLOAT, false, 48, 16);

    // color attribute
    const colorLocation = gl.getAttribLocation(this.backgroundShader!, "color");
    gl.enableVertexAttribArray(colorLocation);
    gl.vertexAttribPointer(colorLocation, 4, gl.FLOAT, false, 48, 24);

    // offset attribute
    const offsetLocation = gl.getAttribLocation(
      this.backgroundShader!,
      "offset"
    );
    gl.enableVertexAttribArray(offsetLocation);
    gl.vertexAttribPointer(offsetLocation, 2, gl.FLOAT, false, 48, 40);

    // set up instanced rendering

    if (this.isWebGL2) {
      const gl2 = gl as WebGL2RenderingContext;
      gl2.vertexAttribDivisor(positionLocation, 1);
      gl2.vertexAttribDivisor(sizeLocation, 1);
      gl2.vertexAttribDivisor(colorLocation, 1);
      gl2.vertexAttribDivisor(offsetLocation, 1);
    } else {
      const ext = gl.getExtension("ANGLE_instanced_arrays");
      if (!ext) {
        throw new Error("ANGLE_instanced_arrays extension not supported");
      }
      ext.vertexAttribDivisorANGLE(positionLocation, 1);
      ext.vertexAttribDivisorANGLE(sizeLocation, 1);
      ext.vertexAttribDivisorANGLE(colorLocation, 1);
      ext.vertexAttribDivisorANGLE(offsetLocation, 1);
    }

    // set up uniforms
    this.setBackgroundUniforms();

    return this;
  }

  private setupStateText(): this {
    const { gl } = this;
    console.log("setupStateText called");

    // sanity checks
    if (!this.labelShader) return this;

    if (!this.gl) return this;

    // set up program
    gl.useProgram(this.labelShader!);

    // set up glyqp quad buffer
    console.log("Binding glyphQuad buffer");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.glyphQuad!); // data never changes

    // set up glyph quad attributes
    // position attribute
    const positionLocation = gl.getAttribLocation(
      this.labelShader!,
      "position"
    );
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 16, 0);

    // texCoord attribute
    const texCoordLocation = gl.getAttribLocation(
      this.labelShader!,
      "texCoord"
    );
    gl.enableVertexAttribArray(texCoordLocation);
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 16, 8);

    // set up buffer
    console.log("Binding labelInstanceData buffer");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.labelInstanceData);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(this.textData),
      gl.STATIC_DRAW
    );

    // set up shader variables
    // position attribute
    const instancePositionLocation = gl.getAttribLocation(
      this.labelShader!,
      "instancePosition"
    );
    gl.enableVertexAttribArray(instancePositionLocation);
    gl.vertexAttribPointer(instancePositionLocation, 2, gl.FLOAT, false, 44, 0);

    // offset attribute
    const instanceOffsetLocation = gl.getAttribLocation(
      this.labelShader!,
      "instanceOffset"
    );
    gl.enableVertexAttribArray(instanceOffsetLocation);
    gl.vertexAttribPointer(instanceOffsetLocation, 1, gl.FLOAT, false, 44, 8);

    // texCoord attribute
    const instanceTexCoordLocation = gl.getAttribLocation(
      this.labelShader!,
      "instanceTexCoord"
    );
    gl.enableVertexAttribArray(instanceTexCoordLocation);
    gl.vertexAttribPointer(
      instanceTexCoordLocation,
      4,
      gl.FLOAT,
      false,
      44,
      12
    );

    // color attribute
    const instanceColorLocation = gl.getAttribLocation(
      this.labelShader!,
      "instanceColor"
    );
    gl.enableVertexAttribArray(instanceColorLocation);
    gl.vertexAttribPointer(instanceColorLocation, 4, gl.FLOAT, false, 44, 28);

    // set up instanced rendering
    if (this.isWebGL2) {
      const gl2 = gl as WebGL2RenderingContext;
      gl2.vertexAttribDivisor(instancePositionLocation, 1);
      gl2.vertexAttribDivisor(instanceOffsetLocation, 1);
      gl2.vertexAttribDivisor(instanceTexCoordLocation, 1);
      gl2.vertexAttribDivisor(instanceColorLocation, 1);
    } else {
      const ext = gl.getExtension("ANGLE_instanced_arrays");
      if (!ext) {
        throw new Error("ANGLE_instanced_arrays extension not supported");
      }
      ext.vertexAttribDivisorANGLE(instancePositionLocation, 1);
      ext.vertexAttribDivisorANGLE(instanceOffsetLocation, 1);
      ext.vertexAttribDivisorANGLE(instanceTexCoordLocation, 1);
      ext.vertexAttribDivisorANGLE(instanceColorLocation, 1);
    }

    // set up uniforms
    this.setTextUniforms();

    // WARN debug
    console.log("debug information:");
    console.log("positionLocation:", positionLocation);
    console.log("texCoordLocation:", texCoordLocation);
    console.log("instancePositionLocation:", instancePositionLocation);
    console.log("instanceOffsetLocation:", instanceOffsetLocation);
    console.log("instanceTexCoordLocation:", instanceTexCoordLocation);
    console.log("instanceColorLocation:", instanceColorLocation);

    try {
      const scaleLocation = gl.getUniformLocation(this.labelShader!, "uScale");

      const matrixLocation = gl.getUniformLocation(this.labelShader!, "matrix");

      console.log("matrix:", gl.getUniform(this.labelShader, matrixLocation!));

      console.log("uScale:", gl.getUniform(this.labelShader, scaleLocation!));
    } catch (error) {
      console.error("Error getting uniforms:", error);
    }
    // WARN debug

    return this;
  }

  private setBackgroundUniforms() {
    const { gl, mapMatrix } = this;

    const currentZoom = this.map.getZoom();
    const scale = Math.pow(2, currentZoom);

    // map transformation matrix
    const backgroundMatrixLocation = gl.getUniformLocation(
      this.backgroundShader!,
      "matrix"
    );
    if (backgroundMatrixLocation === null) {
      console.error("Unable to get uniform location for 'matrix'");
    } else {
      gl.uniformMatrix4fv(backgroundMatrixLocation, false, mapMatrix.array);
    }

    // scale
    const scaleLocation = gl.getUniformLocation(
      this.backgroundShader!,
      "uScale"
    );
    if (scaleLocation === null) {
      console.error("Unable to get uniform location for 'uScale'");
    } else {
      gl.uniform1f(scaleLocation, scale);
    }

    // background corner radius
    const backgroundRadiusLocation = gl.getUniformLocation(
      this.backgroundShader!,
      "uCornerRadius"
    );
    if (backgroundRadiusLocation === null) {
      console.error("Unable to get uniform location for 'uCornerRadius'");
    } else {
      // INFO corder radius 20 ?
      const radius: number = 16;
      gl.uniform1f(backgroundRadiusLocation, radius);
    }

    // background outline thickness
    const backgroundOutlineLocation = gl.getUniformLocation(
      this.backgroundShader!,
      "uOutlineThickness"
    );
    if (backgroundOutlineLocation === null) {
      console.error("Unable to get uniform location for 'uOutlineThickness'");
    } else {
      // INFO outline thickness 3 ?
      const thock: number = 3;
      gl.uniform1f(backgroundOutlineLocation, thock);
    }
  }

  private drawBackgrounds() {
    const { gl } = this;

    // sanity check
    if (!this.backgroundShader) return this;

    if (!this.gl) return this;

    if (this.isWebGL2) {
      const gl2 = gl as WebGL2RenderingContext;
      // divisors for instanced rendering

      // Instanced rendering
      gl2.drawArraysInstanced(
        gl2.TRIANGLE_STRIP,
        0,
        4,
        this.allLatLngLookup.length
      );
    } else {
      const ext = gl.getExtension("ANGLE_instanced_arrays");
      if (!ext) {
        throw new Error("ANGLE_instanced_arrays extension not supported");
      }
      ext.drawArraysInstancedANGLE(
        gl.TRIANGLE_STRIP,
        0,
        4,
        this.allLatLngLookup.length
      );
    }
  }

  private setTextUniforms() {
    const { gl, mapMatrix } = this;

    const currentZoom = this.map.getZoom();
    const scale = Math.pow(2, currentZoom);

    const textMatrixLocation = gl.getUniformLocation(
      this.labelShader!,
      "matrix"
    );
    if (textMatrixLocation === null) {
      console.error("Unable to get uniform location for 'matrix'");
    } else {
      gl.uniformMatrix4fv(textMatrixLocation, false, mapMatrix.array);
    }

    // scale
    const scaleLocation = gl.getUniformLocation(this.labelShader!, "uScale");
    if (scaleLocation === null) {
      console.error("Unable to get uniform location for 'uScale'");
    } else {
      gl.uniform1f(scaleLocation, scale);
    }

    // WARN commented out for testing
    // // set webgl to use texture registry 1
    // gl.activeTexture(gl.TEXTURE1);
    // gl.bindTexture(gl.TEXTURE_2D, this.fontTexture);
    // const fontTextureLocation = gl.getUniformLocation(
    //   this.labelShader!,
    //   "fontTexture"
    // );
    // if (fontTextureLocation === null) {
    //   console.error("Unable to get uniform location for 'fontTexture'");
    // } else {
    //   // 1 here points to texture registry 1
    //   gl.uniform1i(fontTextureLocation, 1);
    // }

    // const smoothingLocation = gl.getUniformLocation(
    //   this.labelShader!,
    //   "smoothing"
    // );
    // if (smoothingLocation === null) {
    //   console.error("Unable to get uniform location for 'smoothing'");
    // } else {
    //   gl.uniform1f(smoothingLocation, 0.1); // Adjust as needed
    // }
    // WARN commented out for testing
  }

  private drawText() {
    const { gl } = this;

    // sanity check
    if (!this.backgroundShader) return this;

    if (!this.gl) return this;

    const glyphs: number = this.getTotalGlyphCount();

    // WARN debug
    console.log("Program info log:", gl.getProgramInfoLog(this.labelShader!));
    console.log("Viewport:", gl.getParameter(gl.VIEWPORT));
    console.log("Scissor test enabled:", gl.getParameter(gl.SCISSOR_TEST));
    console.log("Scissor box:", gl.getParameter(gl.SCISSOR_BOX));
    console.log("Blend enabled:", gl.getParameter(gl.BLEND));
    console.log(
      "Blend func:",
      gl.getParameter(gl.BLEND_SRC_RGB),
      gl.getParameter(gl.BLEND_DST_RGB)
    );
    console.log("Depth test enabled:", gl.getParameter(gl.DEPTH_TEST));
    console.log("Depth func:", gl.getParameter(gl.DEPTH_FUNC));
    console.log("Stencil test enabled:", gl.getParameter(gl.STENCIL_TEST));
    console.log("Cull face enabled:", gl.getParameter(gl.CULL_FACE));
    console.log("Cull face mode:", gl.getParameter(gl.CULL_FACE_MODE));
    console.log("Drawing text:", gl.TRIANGLES, 0, 6, glyphs);

    // WARN debug

    if (this.isWebGL2) {
      const gl2 = gl as WebGL2RenderingContext;
      gl2.drawArraysInstanced(gl2.TRIANGLES, 0, 6, glyphs);
    } else {
      const ext = gl.getExtension("ANGLE_instanced_arrays");
      if (!ext) {
        throw new Error("ANGLE_instanced_arrays extension not supported");
      }
      ext.drawArraysInstancedANGLE(gl.TRIANGLES, 0, 6, glyphs);
    }
  }

  private getTotalGlyphCount(): number {
    let count = 0;
    const features = Array.isArray(this.settings.data)
      ? this.settings.data
      : (this.settings.data as FeatureCollection<GeoPoint>).features || [];
    features.forEach((feature) => {
      const text = this.getLabelText(feature);
      count += text.length;
    });
    return count;
  }

  private updateLabelInstanceData(): this {
    console.log("Starting updateLabelInstanceData");

    this.textData = [];
    this.backgroundData = [];

    if (!this.labelInstanceData || !this.backgroundBuffer) {
      console.log("labelInstanceData or backgroundBuffer is null, returning");
      return this;
    }

    console.log("Initialized textData and backgroundData arrays");

    const currentZoom = this.map.getZoom();
    const scale = Math.pow(2, currentZoom);
    console.log("Current Zoom:", currentZoom);
    console.log("Resulting scale:", scale);

    const features = Array.isArray(this.settings.data)
      ? this.settings.data
      : (this.settings.data as FeatureCollection<GeoPoint>).features || [];

    console.log("Features data:", features);
    console.log("Number of features:", features.length);

    features.forEach((feature, index) => {
      console.log(`Processing feature ${index}:`, feature);

      const text = this.getLabelText(feature as ILabeledFeature | number[]);
      console.log("Label text:", text);

      const offset = this.getLabelOffset(feature as ILabeledFeature | number[]);
      console.log("Label offset:", offset);

      const rawLatLng = this.allLatLngLookup[index].latLng;
      const pixel = this.map.project(rawLatLng, 0);
      const position: [number, number] = [
        pixel.x - this.mapCenterPixels.x,
        pixel.y - this.mapCenterPixels.y,
      ];

      console.log("Calculated label position:", position);

      const labelColor = this.getLabelColor(
        feature as ILabeledFeature | number[]
      );
      console.log("Label color:", labelColor);

      const backgroundColor = this.getLabelBackgroundColor(
        feature as ILabeledFeature | number[]
      );
      console.log("Background color:", backgroundColor);

      const padding = this.getLabelBackgroundPadding(
        feature as ILabeledFeature | number[]
      );
      console.log("Background padding:", padding);

      const cornerRadius = this.getLabelBackgroundCornerRadius(
        feature as ILabeledFeature | number[]
      );
      console.log("Corner radius:", cornerRadius);

      let xOffset = 0;
      let maxWidth = 0;
      let maxHeight = 0;

      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        console.log(`Processing character: ${char}`);

        // TODO change any type
        const charInfo = this.fontAtlas.chars.find((c: any) => c.char === char);
        if (!charInfo) {
          console.log(`No char info for: ${char}, skipping`);
          continue;
        }

        console.log("Char info:", charInfo);

        const charData = [
          // position is in leaflet coordinates at zoom level 0 shifted to use a central origin
          // cuz leaflet uses central origin - offsets are scaled to zoom 0 and applied in the shader
          position[0], // the corresponding shader parameter is called instancePosition !warn could be confusing
          position[1],
          xOffset, // in pixels, scaled in the shader
          charInfo.x,
          charInfo.y,
          charInfo.width,
          charInfo.height, // pixels, scaled in the shader
          labelColor.r, // color
          labelColor.g,
          labelColor.b,
          labelColor.a ?? 1,
        ];

        // INFO breaks before here.. has to be color then
        console.log("Char data to be pushed:", charData);

        this.textData.push(...charData);

        xOffset += charInfo.width;
        maxWidth = Math.max(maxWidth, xOffset);
        maxHeight = Math.max(maxHeight, charInfo.height);
      }

      console.log("Final xOffset:", xOffset);
      console.log("Max width:", maxWidth);
      console.log("Max height:", maxHeight);

      // temp test offsets:
      const pixelOffset: [number, number] = [18, -40];

      // Add background data
      const bgWidth = maxWidth + padding[0] * 2;
      const bgHeight = maxHeight + padding[1] * 2;
      const bgData = [
        // position is in leaflet coordinates at zoom level 0 shifted to use a central origin
        // cuz leaflet uses central origin - offsets are scaled to zoom 0 and applied in the shader
        position[0], // - padding[0]  - add padding to pixel offset?
        position[1], // - padding[1],
        0,
        1, // filling up the vec4 position im using to appease matmul gods
        bgWidth,
        bgHeight, // size - pixels
        backgroundColor.r, // color
        backgroundColor.g,
        backgroundColor.b,
        backgroundColor.a ?? 1,
        pixelOffset[0], // offset - pixels
        pixelOffset[1],
      ];
      console.log("Background data to be pushed:", bgData);

      this.backgroundData.push(...bgData);
    });

    console.log("Final textData length:", this.textData.length);
    console.log("Final backgroundData length:", this.backgroundData.length);

    console.log("Finished updateLabelInstanceData");

    return this;
  }

  drawOnCanvas(e: ICanvasOverlayDrawEvent): this {
    // TODO
    // consider drawing into framebuffer here, then using post processing for AA
    console.log("drawOnCanvas from labeled-icon-points called");

    // super drawOnCanvas does extras:
    // updates map matrix
    // clears color buffer
    // sets up viewport
    super.drawOnCanvas(e);

    this.setupStateBackground();

    this.drawBackgrounds();

    console.log("setupStateText");
    // text drawing does not work yet
    this.setupStateText();
    console.log("drawText");
    this.drawText();

    return this;
  }

  private calculateLabelPosition(
    iconVertex: IIconVertex,
    offset: [number, number]
  ): [number, number] {
    const { map } = this;
    const point = map.latLngToContainerPoint(iconVertex.latLng);
    return [point.x + offset[0], point.y + offset[1]];
  }

  private getLabelText(
    feature: Feature<GeoPoint, GeoJsonProperties> | ILabeledFeature | number[]
  ): string {
    if (Array.isArray(feature)) {
      return this.labelSettings.labelText?.(feature) ?? "";
    }
    if (
      "properties" in feature &&
      feature.properties &&
      "labelText" in feature.properties
    ) {
      return feature.properties.labelText ?? "";
    }
    if (this.labelSettings.labelText) {
      return this.labelSettings.labelText(feature);
    }
    return "";
  }

  private getLabelOffset(
    feature: ILabeledFeature | number[]
  ): [number, number] {
    if (Array.isArray(feature)) {
      return this.labelSettings.labelOffset ?? [0, 0];
    }
    if (feature.properties && feature.properties.labelOffset) {
      return feature.properties.labelOffset;
    }
    return this.labelSettings.labelOffset ?? [0, 0];
  }

  private getLabelColor(feature: ILabeledFeature | number[]): IColor {
    if (Array.isArray(feature)) {
      return this.labelSettings.labelColor ?? { r: 0, g: 0, b: 0, a: 1 };
    }
    if (feature.properties && feature.properties.labelColor) {
      return feature.properties.labelColor;
    }
    return this.labelSettings.labelColor ?? { r: 0, g: 0, b: 0, a: 1 };
  }

  private getLabelBackgroundColor(feature: ILabeledFeature | number[]): IColor {
    if (Array.isArray(feature)) {
      return (
        this.labelSettings.labelBackgroundColor ?? {
          r: 255,
          g: 255,
          b: 255,
          a: 0.7,
        }
      );
    }
    if (feature.properties && feature.properties.labelBackgroundColor) {
      return feature.properties.labelBackgroundColor;
    }
    return (
      this.labelSettings.labelBackgroundColor ?? {
        r: 255,
        g: 255,
        b: 255,
        a: 0.7,
      }
    );
  }

  private getLabelBackgroundPadding(
    feature: ILabeledFeature | number[]
  ): [number, number] {
    if (Array.isArray(feature)) {
      return this.labelSettings.labelBackgroundPadding ?? [2, 2];
    }
    if (feature.properties && feature.properties.labelBackgroundPadding) {
      return feature.properties.labelBackgroundPadding;
    }
    return this.labelSettings.labelBackgroundPadding ?? [2, 2];
  }

  private getLabelBackgroundCornerRadius(
    feature: ILabeledFeature | number[]
  ): number {
    if (Array.isArray(feature)) {
      return this.labelSettings.labelBackgroundCornerRadius ?? 3;
    }
    if (feature.properties && feature.properties.labelBackgroundCornerRadius) {
      return feature.properties.labelBackgroundCornerRadius;
    }
    return this.labelSettings.labelBackgroundCornerRadius ?? 3;
  }

  setData(data: FeatureCollection<GeoPoint> | number[][]): this {
    this.settings = { ...this.settings, data };
    return this.render();
  }

  // INFO error might be from here?
  resetVertices(): this {
    console.log("Resetting base class vertices");
    super.resetVertices();
    return this;
  }

  // Add these static methods
  static tryClick(
    e: LeafletMouseEvent,
    map: Map,
    instances: LabeledIconPoints[]
  ): boolean | undefined {
    // TODO implement ?
    // TODO i dont know if i even implemented this in the base class
    // I definitely haven't tested it yet or even gotten that far...
    // Pls dont be too much work in the future :(
    // INFO make sure the icon points function is working first, then just use super.tryClick() here
    return undefined;
  }

  static tryHover(
    e: LeafletMouseEvent,
    map: Map,
    instances: LabeledIconPoints[]
  ): Array<boolean | undefined> {
    // TODO implement ?
    // TODO i dont know if i even implemented this in the base class
    // I definitely haven't tested it yet or even gotten that far...
    // Pls dont be too much work in the future :(
    // INFO make sure the icon points function is working first, then just use super.tryHover() here
    return [];
  }
}

export { LabeledIconPoints, ILabeledIconPointsSettings };
