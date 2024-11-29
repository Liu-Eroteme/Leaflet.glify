// File info: base-gl-layer.ts
// INFO: Core abstract class for WebGL-based Leaflet layers

// NOTE: WebGL shader and buffer configuration types
export interface IShaderConfig {
  vertexSource: string;
  fragmentSource: string;
  attributes: Record<string, {
    location: number;
    size: number;
    type: number;
    normalized: boolean;
    stride: number;
    offset: number;
  }>;
  uniforms: Record<string, WebGLUniformLocation>;
}

export interface IBufferState {
  buffer: WebGLBuffer | null;
  data: Float32Array | null;
  isDirty: boolean;
  lastUpdateTime: number;
}

import { LeafletMouseEvent, Map, LatLng, Layer } from "leaflet";

import { IColor } from "../util/color";
import { IPixel } from "../util/pixel";
import { CanvasOverlay, ICanvasOverlayDrawEvent } from "./canvas-overlay";
import { notProperlyDefined } from "../util/errors";
import { MapMatrix } from "../util/map-matrix";

import { Point } from "leaflet";

// NOTE: Shader variable interface for WebGL attribute configuration
export interface IShaderVariable {
  type: "FLOAT"; // TODO: Support more WebGL types (INT, VEC2, etc)
  start: number; // Starting offset in bytes
  size: number; // Number of components per vertex
  normalize: boolean; // Whether to normalize the values
  stride?: number; // Optional byte offset between consecutive attributes
}

// NOTE: Callback type for mouse events
export type EventCallback = (
  e: LeafletMouseEvent,
  feature: GeoJSON.Feature | number[] // IDEA: Consider making this more specific based on layer type
) => boolean | void;

export type SetupHoverCallback = (
  map: Map,
  hoverWait?: number,
  immediate?: false
) => void;

// NOTE: WebGL context configuration
export interface IWebGLContextOptions {
  preserveDrawingBuffer?: boolean;
  antialias?: boolean;
  alpha?: boolean;
  depth?: boolean;
  stencil?: boolean;
  premultipliedAlpha?: boolean;
  failIfMajorPerformanceCaveat?: boolean;
  powerPreference?: 'default' | 'high-performance' | 'low-power';
  desynchronized?: boolean;
}

// NOTE: WebGL buffer configuration
export interface IGlBufferConfig {
  name: string;
  size: number;
  type: number;
  normalize: boolean;
  stride: number;
  offset: number;
}

// NOTE: WebGL shader configuration
export interface IGlShaderConfig {
  vertexSource: string;
  fragmentSource: string;
  attributes: { [key: string]: IGlBufferConfig };
  uniforms: string[];
}

export interface IBaseGlLayerSettings {
  data: GeoJSON.FeatureCollection | number[][];
  longitudeKey: number;
  latitudeKey: number;
  pane: string;
  map: Map;
  renderMetrics?: boolean;
  contextOptions?: IWebGLContextOptions;
  shaderVariables?: {
    [name: string]: IShaderVariable;
  };
  setupClick?: (map: Map) => void;
  setupHover?: SetupHoverCallback;
  sensitivity?: number;
  sensitivityHover?: number;
  vertexShaderSource?: (() => string) | string;
  fragmentShaderSource?: (() => string) | string;
  canvas?: HTMLCanvasElement;
  click?: EventCallback;
  hover?: EventCallback;
  hoverOff?: EventCallback;
  color?: ColorCallback | IColor | null;
  className?: string;
  opacity?: number;
  preserveDrawingBuffer?: boolean;
  hoverWait?: number;
}

export const defaultPane = "overlayPane";
export const defaultHoverWait = 250;
export const defaults: Partial<IBaseGlLayerSettings> = {
  pane: defaultPane,
};

export type ColorCallback = (featureIndex: number, feature: any) => IColor;

export abstract class BaseGlLayer<
  T extends IBaseGlLayerSettings = IBaseGlLayerSettings,
> {
  bytes = 0;
  active: boolean;
  fragmentShader: WebGLShader | null;
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext | WebGL2RenderingContext;
  layer: CanvasOverlay;
  mapMatrix: MapMatrix;
  matrix: WebGLUniformLocation | null;
  program: WebGLProgram | null;
  settings: Partial<IBaseGlLayerSettings>;
  vertexShader: WebGLShader | null;
  vertices: Float32Array = new Float32Array(0);
  vertexLines: Float32Array = new Float32Array(0);
  mapCenterPixels: IPixel;
  
  protected readonly glState: {
    isContextLost: boolean;
    lastFrameTime: number;
    frameCount: number;
    drawCalls: number;
    vertexCount: number;
    fps: number;
    shaderCompileTime: number;
    bufferUploadTime: number;
    renderTime: number;
  } = {
    isContextLost: false,
    lastFrameTime: 0,
    frameCount: 0,
    drawCalls: 0,
    vertexCount: 0,
    fps: 0,
    shaderCompileTime: 0,
    bufferUploadTime: 0,
    renderTime: 0
  };

  protected shaderConfig: IShaderConfig | null = null;
  protected bufferStates: Record<string, IBufferState> = {};

  buffers: { [name: string]: WebGLBuffer } = {};
  attributeLocations: { [name: string]: number } = {};
  uniformLocations: { [name: string]: WebGLUniformLocation } = {};

  static defaults = defaults;

  abstract render(): this;
  abstract removeInstance(this: any): this;

  // -----------------------------
  // CACHING THE COORDINATE SYSTEM

  protected _isDragging: boolean = false;
  protected _dragStartCenter: IPixel | null = null;
  protected _dragStartZoom: number | null = null;
  protected _dragStartOffset: Point | null = null;

  protected _context: ICanvasOverlayDrawEvent | null = null;

  protected startDragCaching(): void {
    this._isDragging = true;
    this._dragStartCenter = this.mapCenterPixels;
    this._dragStartZoom = this.map.getZoom();
    if (this._context) {
      this._dragStartOffset = this._context.offset.clone();
    }
  }

  protected stopDragCaching(): void {
    this._isDragging = false;
    this._dragStartCenter = null;
    this._dragStartZoom = null;
    this._dragStartOffset = null;
    this.render(); // Re-render after stopping caching
  }

  // CACHING THE COORDINATE SYSTEM
  // -----------------------------

  get data(): any {
    if (!this.settings.data) {
      throw new Error(notProperlyDefined("settings.data"));
    }
    return this.settings.data;
  }

  get pane(): string {
    return this.settings.pane ?? defaultPane;
  }

  get className(): string {
    return this.settings.className ?? "";
  }

  get map(): Map {
    if (!this.settings.map) {
      throw new Error(notProperlyDefined("settings.map"));
    }
    return this.settings.map;
  }

  get sensitivity(): number {
    if (typeof this.settings.sensitivity !== "number") {
      throw new Error(notProperlyDefined("settings.sensitivity"));
    }
    return this.settings.sensitivity;
  }

  get sensitivityHover(): number {
    if (typeof this.settings.sensitivityHover !== "number") {
      throw new Error(notProperlyDefined("settings.sensitivityHover"));
    }
    return this.settings.sensitivityHover;
  }

  get hoverWait(): number {
    return this.settings.hoverWait ?? defaultHoverWait;
  }

  get longitudeKey(): number {
    if (typeof this.settings.longitudeKey !== "number") {
      throw new Error(notProperlyDefined("settings.longitudeKey"));
    }
    return this.settings.longitudeKey;
  }

  protected isFeatureCollection(data: any): data is GeoJSON.FeatureCollection {
    return data && typeof data === 'object' && Array.isArray(data.features);
  }

  get latitudeKey(): number {
    if (typeof this.settings.latitudeKey !== "number") {
      throw new Error(notProperlyDefined("settings.latitudeKey"));
    }
    return this.settings.latitudeKey;
  }

  get opacity(): number {
    if (typeof this.settings.opacity !== "number") {
      throw new Error(notProperlyDefined("settings.opacity"));
    }
    return this.settings.opacity;
  }

  get color(): ColorCallback | IColor | null {
    return this.settings.color ?? null;
  }

  constructor(settings: Partial<IBaseGlLayerSettings>) {
    this.settings = { ...defaults, ...settings };
    this.mapMatrix = new MapMatrix();
    this.active = true;
    this.vertexShader = null;
    this.fragmentShader = null;
    this.program = null;
    this.matrix = null;
    this.vertices = new Float32Array(0);
    this.vertexLines = new Float32Array(0);

    // Initialize WebGL context with configured options
    if (settings.contextOptions) {
      this.gl = this.initWebGLContext(settings.contextOptions);
    }
    try {
      this.mapCenterPixels = this.map.project(this.map.getCenter(), 0);
    } catch (err) {
      this.mapCenterPixels = { x: -0, y: -0 };
    }
    const preserveDrawingBuffer = Boolean(settings.preserveDrawingBuffer);

    const layer = (this.layer = new CanvasOverlay(
      (context: ICanvasOverlayDrawEvent) => {
        this._context = context;
        return this.drawOnCanvas(context);
      },
      this.pane
    ).addTo(this.map));

    layer.eventEmitter.on("movestart", this.startDragCaching.bind(this));
    layer.eventEmitter.on("moveend", this.stopDragCaching.bind(this));
    layer.eventEmitter.on("zoomstart", this.startDragCaching.bind(this));
    layer.eventEmitter.on("zoomend", this.stopDragCaching.bind(this));
    layer.eventEmitter.on("dragstart", this.startDragCaching.bind(this));
    layer.eventEmitter.on("dragend", this.stopDragCaching.bind(this));

    if (!layer.canvas) {
      throw new Error(notProperlyDefined("layer.canvas"));
    }
    const canvas = (this.canvas = layer.canvas);
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    canvas.style.position = "absolute";
    if (this.className) {
      canvas.className += " " + this.className;
    }
    this.gl = (canvas.getContext("webgl2", {
      preserveDrawingBuffer,
      antialias: true,
    }) ??
      canvas.getContext("webgl", { preserveDrawingBuffer }) ??
      canvas.getContext("experimental-webgl", {
        preserveDrawingBuffer,
      })) as WebGLRenderingContext;
  }

  protected initWebGLContext(options: IWebGLContextOptions): WebGLRenderingContext | WebGL2RenderingContext {
    if (!this.canvas) {
      throw new Error('Canvas not initialized');
    }

    const contextTypes: string[] = ['webgl2', 'webgl', 'experimental-webgl'];
    let context: WebGLRenderingContext | WebGL2RenderingContext | null = null;

    for (const type of contextTypes) {
      context = this.canvas.getContext(type, options) as WebGLRenderingContext | WebGL2RenderingContext;
      if (context) {
        if (type === 'webgl2') {
          return context as WebGL2RenderingContext;
        }
        return context as WebGLRenderingContext;
      }
    }

    throw new Error('WebGL not supported');
  }

  protected updateBufferState(name: string, data: Float32Array): void {
    const state = this.bufferStates[name] = this.bufferStates[name] || {
      buffer: this.gl.createBuffer(),
      data: null,
      isDirty: true,
      lastUpdateTime: 0
    };

    state.data = data;
    state.isDirty = true;
    state.lastUpdateTime = performance.now();
  }

  protected getRenderMetrics(): Partial<typeof this.glState> {
    if (!this.settings.renderMetrics) {
      return {};
    }

    return {
      drawCalls: this.glState.drawCalls,
      vertexCount: this.glState.vertexCount,
      fps: this.glState.fps,
      renderTime: this.glState.renderTime,
      shaderCompileTime: this.glState.shaderCompileTime,
      bufferUploadTime: this.glState.bufferUploadTime
    };
  }

  abstract drawOnCanvas(context: ICanvasOverlayDrawEvent): this;

  attachShaderVariables(byteCount: number): this {
    const variableCount = this.getShaderVariableCount();
    if (variableCount === 0) {
      return this;
    }
    const { gl, settings } = this;
    const { shaderVariables } = settings;
    let offset = 0;
    for (const name in shaderVariables) {
      if (!shaderVariables.hasOwnProperty(name)) continue;
      const shaderVariable = shaderVariables[name];
      const loc = this.getAttributeLocation(name);
      if (loc < 0) {
        throw new Error("shader variable " + name + " not found");
      }
      gl.vertexAttribPointer(
        loc,
        shaderVariable.size,
        gl[shaderVariable.type],
        !!shaderVariable.normalize,
        this.bytes * byteCount,
        offset * byteCount
      );
      offset += shaderVariable.size;
      gl.enableVertexAttribArray(loc);
    }

    return this;
  }

  getShaderVariableCount(): number {
    return Object.keys(this.settings.shaderVariables ?? {}).length;
  }

  setData(data: any): this {
    this.settings = { ...this.settings, data };
    return this.render();
  }

  setup(): this {
    const settings = this.settings;
    if (settings.click && settings.setupClick) {
      settings.setupClick(this.map);
    }
    if (settings.hover && settings.setupHover) {
      settings.setupHover(this.map, this.hoverWait);
    }

    return this.setupVertexShader().setupFragmentShader().setupProgram();
  }

  setupVertexShader(): this {
    const { gl, settings } = this;
    const vertexShaderSource =
      typeof settings.vertexShaderSource === "function"
        ? settings.vertexShaderSource()
        : settings.vertexShaderSource;
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    if (!vertexShader) {
      throw new Error("Not able to create vertex");
    }
    if (!vertexShaderSource) {
      throw new Error(notProperlyDefined("settings.vertexShaderSource"));
    }
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);

    this.vertexShader = vertexShader;

    return this;
  }

  setupFragmentShader(): this {
    const gl = this.gl;
    const settings = this.settings;
    const fragmentShaderSource =
      typeof settings.fragmentShaderSource === "function"
        ? settings.fragmentShaderSource()
        : settings.fragmentShaderSource;
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    if (!fragmentShader) {
      throw new Error("Not able to create fragment");
    }
    if (!fragmentShaderSource) {
      throw new Error(notProperlyDefined("settings.fragmentShaderSource"));
    }
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);

    this.fragmentShader = fragmentShader;

    return this;
  }

  setupProgram(): this {
    // link shaders to create our program
    const { gl, vertexShader, fragmentShader } = this;
    const program = gl.createProgram();
    if (!program) {
      throw new Error("Not able to create program");
    }
    if (!vertexShader) {
      throw new Error(notProperlyDefined("this.vertexShader"));
    }
    if (!fragmentShader) {
      throw new Error(notProperlyDefined("this.fragmentShader"));
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);
    gl.blendFuncSeparate(
      gl.SRC_ALPHA,
      gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA
    );
    gl.enable(gl.BLEND);

    this.program = program;

    return this;
  }

  addTo(map?: Map): this {
    this.layer.addTo(map ?? this.map);
    this.active = true;
    return this.render();
  }

  remove(indices?: number | number[]): this {
    if (indices === undefined) {
      this.removeInstance();
      this.map.removeLayer(this.layer);
      this.active = false;
    } else {
      const features = Array.isArray(this.settings.data) 
        ? this.settings.data 
        : this.settings.data.features;
      indices = indices instanceof Array ? indices : [indices];
      if (typeof indices === "number") {
        indices = [indices];
      }
      indices
        .sort((a: number, b: number): number => {
          return a - b;
        })
        .reverse()
        .forEach((index: number) => {
          features.splice(index, 1);
        });
      this.render();
    }
    return this;
  }

  insert(features: any | any[], index: number): this {
    const featuresArray = Array.isArray(features) ? features : [features];
    const featuresData = Array.isArray(this.settings.data) 
      ? this.settings.data 
      : this.settings.data.features;

    for (let i = 0; i < featuresArray.length; i++) {
      featuresData.splice(index + i, 0, featuresArray[i]);
    }

    return this.render();
  }

  update(feature: any | any[], index: number): this {
    const featuresData = Array.isArray(this.settings.data) 
      ? this.settings.data 
      : this.settings.data.features;

    if (Array.isArray(feature)) {
      for (let i = 0; i < feature.length; i++) {
        featuresData[index + i] = feature[i];
      }
    } else {
      featuresData[index] = feature;
    }

    return this.render();
  }

  updateAll(features: number[][]): this {
    // WARN TEMP
    // TODO FIX
    // console.log("updateAll CALLED! features:", features);
    this.settings.data = features;
    return this.render();
  }

  getBuffer(name: string): WebGLBuffer {
    if (!this.buffers[name]) {
      const buffer = this.gl.createBuffer();
      if (!buffer) {
        throw new Error("Not able to create buffer");
      }
      this.buffers[name] = buffer;
    }
    return this.buffers[name];
  }

  getAttributeLocation(name: string): number {
    if (!this.program) {
      throw new Error(notProperlyDefined("this.program"));
    }
    if (this.attributeLocations[name] !== undefined) {
      return this.attributeLocations[name];
    }
    return (this.attributeLocations[name] = this.gl.getAttribLocation(
      this.program,
      name
    ));
  }

  getUniformLocation(name: string): WebGLUniformLocation {
    if (!this.program) {
      throw new Error(notProperlyDefined("this.program"));
    }
    if (this.uniformLocations[name] !== undefined) {
      return this.uniformLocations[name];
    }
    const loc = this.gl.getUniformLocation(this.program, name);
    if (!loc) {
      throw new Error("Cannot find location");
    }
    return (this.uniformLocations[name] = loc);
  }

  click(e: LeafletMouseEvent, feature: any): boolean | undefined {
    if (!this.settings.click) return;
    const result = this.settings.click(e, feature);
    if (result !== undefined) {
      return result;
    }
  }

  hover(e: LeafletMouseEvent, feature: any): boolean | undefined {
    if (!this.settings.hover) return;
    const result = this.settings.hover(e, feature);
    if (result !== undefined) {
      return result;
    }
  }

  hoverOff(e: LeafletMouseEvent, feature: any): void {
    if (!this.settings.hoverOff) return;
    this.settings.hoverOff(e, feature);
  }
}
