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
import { LeafletMouseEvent, Map } from "leaflet";
import { IColor } from "../util/color";
import { IPixel } from "../util/pixel";
import { CanvasOverlay, ICanvasOverlayDrawEvent } from "./canvas-overlay";
import { MapMatrix } from "../util/map-matrix";
import { Point } from "leaflet";
export interface IShaderVariable {
    type: "FLOAT";
    start: number;
    size: number;
    normalize: boolean;
    stride?: number;
}
export type EventCallback = (e: LeafletMouseEvent, feature: GeoJSON.Feature | number[]) => boolean | void;
export type SetupHoverCallback = (map: Map, hoverWait?: number, immediate?: false) => void;
export interface IWebGLContextOptions {
    preserveDrawingBuffer?: boolean;
    antialias?: boolean;
    alpha?: boolean;
    depth?: boolean;
    stencil?: boolean;
    premultipliedAlpha?: boolean;
    failIfMajorPerformanceCaveat?: boolean;
    powerPreference?: "default" | "high-performance" | "low-power";
    desynchronized?: boolean;
}
export interface IGlBufferConfig {
    name: string;
    size: number;
    type: number;
    normalize: boolean;
    stride: number;
    offset: number;
}
export interface IGlShaderConfig {
    vertexSource: string;
    fragmentSource: string;
    attributes: {
        [key: string]: IGlBufferConfig;
    };
    uniforms: string[];
}
export interface IBaseGlLayerSettings {
    data: GeoJSON.FeatureCollection | GeoJSON.Feature | GeoJSON.Geometry | number[][];
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
export declare const defaultPane = "overlayPane";
export declare const defaultHoverWait = 250;
export declare const defaults: Partial<IBaseGlLayerSettings>;
export type ColorCallback = (featureIndex: number, feature: any) => IColor;
export declare abstract class BaseGlLayer<T extends IBaseGlLayerSettings = IBaseGlLayerSettings> {
    bytes: number;
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
    abstract vertices: number[] | Float32Array;
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
    };
    protected shaderConfig: IShaderConfig | null;
    protected bufferStates: Record<string, IBufferState>;
    buffers: {
        [name: string]: WebGLBuffer;
    };
    attributeLocations: {
        [name: string]: number;
    };
    uniformLocations: {
        [name: string]: WebGLUniformLocation;
    };
    static defaults: Partial<IBaseGlLayerSettings>;
    abstract render(): this;
    abstract removeInstance(this: any): this;
    protected _isDragging: boolean;
    protected _dragStartCenter: IPixel | null;
    protected _dragStartZoom: number | null;
    protected _dragStartOffset: Point | null;
    protected _context: ICanvasOverlayDrawEvent | null;
    protected startDragCaching(): void;
    protected stopDragCaching(): void;
    get data(): any;
    get pane(): string;
    get className(): string;
    get map(): Map;
    get sensitivity(): number;
    get sensitivityHover(): number;
    get hoverWait(): number;
    get longitudeKey(): number;
    protected isFeatureCollection(data: any): data is GeoJSON.FeatureCollection;
    get latitudeKey(): number;
    get opacity(): number;
    get color(): ColorCallback | IColor | null;
    constructor(settings: Partial<IBaseGlLayerSettings>);
    protected initWebGLContext(options: IWebGLContextOptions): WebGLRenderingContext | WebGL2RenderingContext;
    protected updateBufferState(name: string, data: Float32Array): void;
    protected getRenderMetrics(): Partial<typeof this.glState>;
    abstract drawOnCanvas(context: ICanvasOverlayDrawEvent): this;
    attachShaderVariables(byteCount: number): this;
    getShaderVariableCount(): number;
    setData(data: any): this;
    setup(): this;
    setupVertexShader(): this;
    setupFragmentShader(): this;
    setupProgram(): this;
    addTo(map?: Map): this;
    remove(indices?: number | number[]): this;
    insert(features: any | any[], index: number): this;
    update(feature: any | any[], index: number): this;
    updateAll(features: number[][]): this;
    getBuffer(name: string): WebGLBuffer;
    getAttributeLocation(name: string): number;
    getUniformLocation(name: string): WebGLUniformLocation;
    click(e: LeafletMouseEvent, feature: any): boolean | undefined;
    hover(e: LeafletMouseEvent, feature: any): boolean | undefined;
    hoverOff(e: LeafletMouseEvent, feature: any): void;
}
