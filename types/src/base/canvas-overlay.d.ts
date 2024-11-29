export declare enum CanvasOverlayEventType {
    BEFORE_DRAW = "beforeDraw",
    AFTER_DRAW = "afterDraw",
    ANIMATION_START = "animationStart",
    ANIMATION_END = "animationEnd",
    CONTEXT_LOST = "contextLost",
    CONTEXT_RESTORED = "contextRestored"
}
export interface IAnimationState {
    isAnimating: boolean;
    startTime: number;
    duration: number;
    easingFunction?: (t: number) => number;
}
export interface IDrawOptions {
    clearCanvas?: boolean;
    useAnimationFrame?: boolean;
    preserveDrawingBuffer?: boolean;
    antialiasing?: boolean;
    alpha?: boolean;
    premultipliedAlpha?: boolean;
}
import { LatLngBounds, Point, Layer, Bounds, LatLng, ZoomAnimEvent, Map, ResizeEvent, LayerOptions } from "leaflet";
import { EventEmitter } from "events";
export interface ICanvasOverlayDrawEvent {
    canvas: HTMLCanvasElement;
    bounds: LatLngBounds;
    offset: Point;
    scale: number;
    size: Point;
    zoomScale: number;
    zoom: number;
    timestamp?: number;
}
export type IUserDrawFunc = (event: ICanvasOverlayDrawEvent) => void;
export type RedrawCallback = (instance: CanvasOverlay) => Promise<void> | void;
export interface ICanvasOverlayOptions extends LayerOptions {
    pane?: string;
    animated?: boolean;
    updateWhenIdle?: boolean;
    updateWhenZooming?: boolean;
    drawOptions?: IDrawOptions;
    animationOptions?: {
        duration?: number;
        easing?: (t: number) => number;
    };
}
export interface ICanvasState {
    frame: number | null;
    isDragging: boolean;
    isAnimated: boolean;
    canvas: HTMLCanvasElement | undefined;
}
export interface ICanvasEventHandlers {
    onAdd?: (map: Map) => void;
    onRemove?: (map: Map) => void;
    onZoom?: (e: ZoomAnimEvent) => void;
    onResize?: (e: ResizeEvent) => void;
    onReset?: () => void;
}
export interface IRenderStats {
    frameTime: number;
    vertexCount: number;
    drawCalls: number;
}
export declare class CanvasOverlay extends Layer {
    private _isDragging;
    private _animationState;
    eventEmitter: EventEmitter;
    private _drawOptions;
    _userDrawFunc: IUserDrawFunc;
    _redrawCallbacks: RedrawCallback[];
    canvas?: HTMLCanvasElement;
    _pane: string;
    _frame?: number | null;
    _leaflet_id?: number;
    options: LayerOptions;
    private _metrics;
    private _hooks;
    constructor(userDrawFunc: IUserDrawFunc, pane: string);
    drawing(userDrawFunc: IUserDrawFunc): this;
    params(options: any): this;
    redraw(callback?: RedrawCallback): this;
    isAnimated(): boolean;
    onAdd(map: Map): this;
    onRemove(map: Map): this;
    addTo(map: Map): this;
    getMetrics(): {
        lastFrameTime: number;
        frameCount: number;
        fps: number;
        drawTime: number;
        drawCalls: number;
        vertexCount: number;
    };
    private _updateMetrics;
    addHook(type: keyof typeof this._hooks, fn: () => void): this;
    removeHook(type: keyof typeof this._hooks, fn: () => void): this;
    private _runHooks;
    startAnimation(duration?: number, easing?: (t: number) => number): void;
    stopAnimation(): void;
    private _animateFrame;
    setDrawOptions(options: Partial<IDrawOptions>): this;
    get map(): Map;
    set map(map: Map);
    _resize(resizeEvent: ResizeEvent): void;
    _reset(): void;
    _redraw(): void;
    _animateZoom(e: ZoomAnimEvent): void;
    _animateZoomNoLayer(e: ZoomAnimEvent): void;
    _unclampedProject(latlng: LatLng, zoom: number): Point;
    _unclampedLatLngBoundsToNewLayerBounds(latLngBounds: LatLngBounds, zoom: number, center: LatLng): Bounds;
}
