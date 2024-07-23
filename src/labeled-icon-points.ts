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

  constructor(settings: ILabeledIconPointsSettings) {
    super(settings);
    this.labelSettings = {
      labelOffset: [0, 0],
      labelFont: "12px Arial",
      labelColor: { r: 0, g: 0, b: 0, a: 1 },
      labelBackgroundColor: { r: 255, g: 255, b: 255, a: 0.7 },
      labelText: () => "",
      labelBackgroundPadding: [2, 2],
      labelBackgroundCornerRadius: 3,
      ...settings,
    };

    // Check for WebGL2 support
    this.isWebGL2 = this.gl instanceof WebGL2RenderingContext;

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
      this.gl.useProgram(this.program);
      console.log("main program used");
      super.render();
      console.log("super render called");
      this.renderLabels();
      console.log("label render called");
    }
    // this kind of defered rendering is not working it seems
    // promise resolves at some random point and then i get webgl errors
    // just .. commenting it out seems to work?
    // why did i write it in the first place?
    // nobody knows
    // else {
    //   console.log("not initialized");
    //   this.initPromise.then(() => {
    //     console.log("init promise resolved");
    //     if (this.isInitialized) {
    //       console.log("is initialized");
    //       this.gl.useProgram(this.program);
    //       console.log("main program used");
    //       super.render();
    //       console.log("super render called");
    //       this.renderLabels();
    //       console.log("label render called");
    //     }
    //   });
    // }
    console.log("render call done");
    return this;
  }

  private renderLabels() {
    if (!this.backgroundShader || !this.labelShader || !this.fontTexture) {
      console.log("shader or font issue:");
      if (!this.backgroundShader) {
        console.log("Shader program 'backgroundShader' not initialized");
      }
      if (!this.labelShader) {
        console.log("Shader program 'labelShader' not initialized");
      }
      if (!this.fontTexture) {
        console.log("Font texture not initialized");
      }
      return;
    }

    const { gl } = this;

    console.log("Rendering labels");

    // Render backgrounds
    gl.useProgram(this.backgroundShader!);
    console.log("background shader used");
    this.setBackgroundUniforms();
    console.log("background uniforms set");
    this.drawBackgrounds();
    console.log("backgrounds drawn");

    // Render text
    gl.useProgram(this.labelShader!);
    console.log("label shader used");
    this.setTextUniforms();
    console.log("text uniforms set");
    this.drawText();
    console.log("text drawn");
  }

  //   private setBackgroundUniforms() {
  //     console.log("Setting background uniforms");

  //     if (!this.backgroundShader) {
  //       console.log("Background shader not initialized");
  //     }

  //     const { gl, mapMatrix } = this;

  //     const backgroundMatrixLocation = gl.getUniformLocation(
  //       this.backgroundShader!,
  //       "matrix"
  //     );
  //     if (backgroundMatrixLocation === null) {
  //       console.error("Unable to get uniform location for 'matrix'");
  //     }
  //     gl.uniformMatrix4fv(backgroundMatrixLocation, false, mapMatrix.array);

  //     const backgroundColorLocation = gl.getUniformLocation(
  //       this.backgroundShader!,
  //       "color"
  //     );
  //     if (backgroundColorLocation === null) {
  //       console.error("Unable to get uniform location for 'color'");
  //     }
  //     gl.uniform4fv(
  //       backgroundColorLocation,
  //       this.labelSettings.labelBackgroundColor ?? [255, 255, 255, 0.7]
  //     );

  //     const labelSizeLocation = gl.getUniformLocation(
  //       this.backgroundShader!,
  //       "size"
  //     );
  //     if (labelSizeLocation === null) {
  //       console.error("Unable to get uniform location for 'size'");
  //     }
  //     gl.uniform2f(
  //       labelSizeLocation,
  //       this.labelSettings.iconSize,
  //       this.labelSettings.iconSize / 2
  //     );

  //     const cornerRadiusLocation = gl.getUniformLocation(
  //       this.backgroundShader!,
  //       "cornerRadius"
  //     );
  //     if (cornerRadiusLocation === null) {
  //       console.error("Unable to get uniform location for 'cornerRadius'");
  //     }
  //     gl.uniform1f(cornerRadiusLocation, 5.0); // Adjust as needed
  //   }

  private setBackgroundUniforms() {
    const { gl, mapMatrix } = this;

    const backgroundMatrixLocation = gl.getUniformLocation(
      this.backgroundShader!,
      "matrix"
    );
    if (backgroundMatrixLocation === null) {
      console.error("Unable to get uniform location for 'matrix'");
    } else {
      gl.uniformMatrix4fv(backgroundMatrixLocation, false, mapMatrix.array);
    }
  }

  private drawBackgrounds() {
    const { gl } = this;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.backgroundBuffer!);

    const positionLocation = gl.getAttribLocation(
      this.backgroundShader!,
      "position"
    );
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 24, 0);

    const sizeLocation = gl.getAttribLocation(this.backgroundShader!, "size");
    gl.enableVertexAttribArray(sizeLocation);
    gl.vertexAttribPointer(sizeLocation, 2, gl.FLOAT, false, 24, 8);

    const cornerRadiusLocation = gl.getAttribLocation(
      this.backgroundShader!,
      "cornerRadius"
    );
    gl.enableVertexAttribArray(cornerRadiusLocation);
    gl.vertexAttribPointer(cornerRadiusLocation, 1, gl.FLOAT, false, 24, 16);

    const colorLocation = gl.getAttribLocation(this.backgroundShader!, "color");
    gl.enableVertexAttribArray(colorLocation);
    gl.vertexAttribPointer(colorLocation, 4, gl.FLOAT, false, 24, 20);

    if (this.isWebGL2) {
      const gl2 = gl as WebGL2RenderingContext;
      gl2.vertexAttribDivisor(positionLocation, 1);
      gl2.vertexAttribDivisor(sizeLocation, 1);
      gl2.vertexAttribDivisor(cornerRadiusLocation, 1);
      gl2.vertexAttribDivisor(colorLocation, 1);
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
      ext.vertexAttribDivisorANGLE(positionLocation, 1);
      ext.vertexAttribDivisorANGLE(sizeLocation, 1);
      ext.vertexAttribDivisorANGLE(cornerRadiusLocation, 1);
      ext.vertexAttribDivisorANGLE(colorLocation, 1);
      ext.drawArraysInstancedANGLE(
        gl.TRIANGLE_STRIP,
        0,
        4,
        this.allLatLngLookup.length
      );
    }
  }

  //   private setTextUniforms() {
  //     console.log("Setting text uniforms");

  //     if (!this.backgroundShader) {
  //       console.log("Text shader not initialized");
  //     }

  //     const { gl, mapMatrix } = this;
  //     const textMatrixLocation = gl.getUniformLocation(
  //       this.labelShader!,
  //       "matrix"
  //     );
  //     gl.uniformMatrix4fv(textMatrixLocation, false, mapMatrix.array);

  //     const fontTextureLocation = gl.getUniformLocation(
  //       this.labelShader!,
  //       "fontTexture"
  //     );
  //     gl.uniform1i(fontTextureLocation, 0);

  //     const smoothingLocation = gl.getUniformLocation(
  //       this.labelShader!,
  //       "smoothing"
  //     );
  //     gl.uniform1f(smoothingLocation, 0.1); // Adjust as needed

  //     const labelSizeLocation = gl.getUniformLocation(
  //       this.labelShader!,
  //       "labelSize"
  //     );
  //     gl.uniform2f(
  //       labelSizeLocation,
  //       this.labelSettings.iconSize,
  //       this.labelSettings.iconSize / 2
  //     );
  //   }

  private setTextUniforms() {
    const { gl, mapMatrix } = this;

    const textMatrixLocation = gl.getUniformLocation(
      this.labelShader!,
      "matrix"
    );
    if (textMatrixLocation === null) {
      console.error("Unable to get uniform location for 'matrix'");
    } else {
      gl.uniformMatrix4fv(textMatrixLocation, false, mapMatrix.array);
    }

    const fontTextureLocation = gl.getUniformLocation(
      this.labelShader!,
      "fontTexture"
    );
    if (fontTextureLocation === null) {
      console.error("Unable to get uniform location for 'fontTexture'");
    } else {
      gl.uniform1i(fontTextureLocation, 0);
    }

    const smoothingLocation = gl.getUniformLocation(
      this.labelShader!,
      "smoothing"
    );
    if (smoothingLocation === null) {
      console.error("Unable to get uniform location for 'smoothing'");
    } else {
      gl.uniform1f(smoothingLocation, 0.1); // Adjust as needed
    }
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
      : (this.settings.data as FeatureCollection<GeoPoint>).features || [];
    features.forEach((feature) => {
      const text = this.getLabelText(feature);
      count += text.length;
    });
    return count;
  }

  //   private updateLabelInstanceData() {
  //     if (!this.labelInstanceData || !this.backgroundBuffer) return;

  //     const textData: number[] = [];
  //     const backgroundData: number[] = [];
  //     const features = Array.isArray(this.settings.data)
  //       ? this.settings.data
  //       : (this.settings.data as FeatureCollection<GeoPoint>).features || [];

  //     features.forEach((feature, index) => {
  //       const text = this.getLabelText(feature as ILabeledFeature | number[]);
  //       const offset = this.getLabelOffset(feature as ILabeledFeature | number[]);
  //       const position = this.calculateLabelPosition(
  //         this.allLatLngLookup[index],
  //         offset
  //       );
  //       const labelColor = this.getLabelColor(
  //         feature as ILabeledFeature | number[]
  //       );
  //       const backgroundColor = this.getLabelBackgroundColor(
  //         feature as ILabeledFeature | number[]
  //       );
  //       const padding = this.getLabelBackgroundPadding(
  //         feature as ILabeledFeature | number[]
  //       );
  //       const cornerRadius = this.getLabelBackgroundCornerRadius(
  //         feature as ILabeledFeature | number[]
  //       );

  //       let xOffset = 0;
  //       let maxWidth = 0;
  //       let maxHeight = 0;

  //       for (let i = 0; i < text.length; i++) {
  //         const char = text[i];
  //         const charInfo = this.fontAtlas.chars[char];
  //         if (!charInfo) continue;

  //         textData.push(
  //           position[0] + xOffset,
  //           position[1], // position
  //           charInfo.x,
  //           charInfo.y,
  //           charInfo.width,
  //           charInfo.height, // texture coordinates
  //           ...labelColor // color
  //         );

  //         xOffset += charInfo.width;
  //         maxWidth = Math.max(maxWidth, xOffset);
  //         maxHeight = Math.max(maxHeight, charInfo.height);
  //       }

  //       // Add background data
  //       const bgWidth = maxWidth + padding[0] * 2;
  //       const bgHeight = maxHeight + padding[1] * 2;
  //       backgroundData.push(
  //         position[0] - padding[0],
  //         position[1] - padding[1], // position
  //         bgWidth,
  //         bgHeight, // size
  //         cornerRadius, // corner radius
  //         ...backgroundColor // color
  //       );
  //     });

  //     this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.labelInstanceData);
  //     this.gl.bufferData(
  //       this.gl.ARRAY_BUFFER,
  //       new Float32Array(textData),
  //       this.gl.DYNAMIC_DRAW
  //     );

  //     this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.backgroundBuffer);
  //     this.gl.bufferData(
  //       this.gl.ARRAY_BUFFER,
  //       new Float32Array(backgroundData),
  //       this.gl.DYNAMIC_DRAW
  //     );
  //   }

  private updateLabelInstanceData() {
    console.log("Starting updateLabelInstanceData");

    if (!this.labelInstanceData || !this.backgroundBuffer) {
      console.log("labelInstanceData or backgroundBuffer is null, returning");
      return;
    }

    const textData: number[] = [];
    const backgroundData: number[] = [];
    console.log("Initialized textData and backgroundData arrays");

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

      const position = this.calculateLabelPosition(
        this.allLatLngLookup[index],
        offset
      );
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
          position[0] + xOffset,
          position[1], // position
          charInfo.x,
          charInfo.y,
          charInfo.width,
          charInfo.height, // texture coordinates
          labelColor.r, // color
          labelColor.g,
          labelColor.b,
          labelColor.a ?? 1,
        ];

        // INFO breaks before here.. has to be color then
        console.log("Char data to be pushed:", charData);

        textData.push(...charData);

        xOffset += charInfo.width;
        maxWidth = Math.max(maxWidth, xOffset);
        maxHeight = Math.max(maxHeight, charInfo.height);
      }

      console.log("Final xOffset:", xOffset);
      console.log("Max width:", maxWidth);
      console.log("Max height:", maxHeight);

      // Add background data
      const bgWidth = maxWidth + padding[0] * 2;
      const bgHeight = maxHeight + padding[1] * 2;
      const bgData = [
        position[0] - padding[0],
        position[1] - padding[1], // position
        bgWidth,
        bgHeight, // size
        cornerRadius, // corner radius
        backgroundColor.r, // color
        backgroundColor.g,
        backgroundColor.b,
        backgroundColor.a ?? 1,
      ];
      console.log("Background data to be pushed:", bgData);

      backgroundData.push(...bgData);
    });

    console.log("Final textData length:", textData.length);
    console.log("Final backgroundData length:", backgroundData.length);

    console.log("Binding labelInstanceData buffer");
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.labelInstanceData);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array(textData),
      this.gl.DYNAMIC_DRAW
    );

    console.log("Binding backgroundBuffer");
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.backgroundBuffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array(backgroundData),
      this.gl.DYNAMIC_DRAW
    );

    console.log("Finished updateLabelInstanceData");
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
    console.log("Updating label instance data");
    this.updateLabelInstanceData();
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
