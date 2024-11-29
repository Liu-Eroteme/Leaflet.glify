import * as L from "leaflet";
import { Feature, FeatureCollection, GeoJsonProperties, Point } from "geojson";

declare module "leaflet" {
  namespace glify {
    // NOTE: Core color interface used throughout the library
    interface IColor {
      r: number;
      g: number;
      b: number;
      a?: number;
    }

    // NOTE: Base options interface for all GL layers
    /**
     * Core options interface for all GL-based layers
     * 
     * @property contextOptions - WebGL context configuration
     *   - preserveDrawingBuffer: boolean (for screenshot support)
     *   - antialias: boolean (for smoother rendering)
     *   - alpha: boolean (for transparency support)
     * 
     * @property renderMetrics - Enable performance monitoring
     *   - Exposes basic metrics like FPS and draw calls
     */
    interface IGlifyLayerOptions {
      map: L.Map;
      data: [number, number][] | GeoJSON.FeatureCollection<GeoJSON.Point>;
      size?: number | ((index: number, point: [number, number]) => number);
      color?: IColor | ((index: number, point: [number, number]) => IColor);
      opacity?: number;
      className?: string;
      vertexShaderSource?: string | (() => string);
      fragmentShaderSource?: string | (() => string);
      pane?: string;
      preserveDrawingBuffer?: boolean;
      longitudeKey?: number;
      latitudeKey?: number;
      shaderVariables?: {
        [name: string]: {
          type: "FLOAT";
          start: number;
          size: number;
          normalize: boolean;
          stride?: number;
        };
      };
      contextOptions?: {
        preserveDrawingBuffer?: boolean;
        antialias?: boolean;
        alpha?: boolean;
      };
      renderMetrics?: boolean;
    }

    // NOTE: Event handling types
    type EventCallback = (
      e: L.LeafletMouseEvent, 
      feature: GeoJSON.Feature<GeoJSON.Point> | [number, number]
    ) => boolean | void;
    type SetupHoverCallback = (map: L.Map, hoverWait?: number, immediate?: false) => void;

    // NOTE: Canvas overlay drawing event interface
    interface ICanvasOverlayDrawEvent {
      canvas: HTMLCanvasElement;
      bounds: L.LatLngBounds;
      offset: L.Point;
      scale: number;
      size: L.Point;
      zoomScale: number;
      zoom: number;
      timestamp?: number;
    }

    // NOTE: Layer-specific options interfaces
    interface PointsOptions extends IGlifyLayerOptions {
      sensitivity?: number; // Multiplier for click detection radius
      sensitivityHover?: number; // Multiplier for hover detection radius
      click?: EventCallback;
      hover?: EventCallback;
      hoverOff?: EventCallback;
      setupClick?: (map: L.Map) => void;
      setupHover?: SetupHoverCallback;
      hoverWait?: number;
      eachVertex?: (vertex: IPointVertex) => void; // Callback for each vertex during initialization
      size?: number | ((index: number, latLng: L.LatLng | null) => number); // Point size in pixels
    }

    // Add interface for point vertex data
    interface IPointVertex {
      latLng: L.LatLng;
      pixel: L.Point;
      chosenColor: IColor;
      chosenSize: number;
      key: string;
      feature?: any; // Could be GeoJSON.Feature or raw coordinates
    }

    // NOTE: Interface for vertex data in IconPoints
    interface IIconVertex {
      latLng: L.LatLng;
      pixel: L.Point;
      chosenColor: IColor;
      chosenSize: number;
      key: string;
      feature?: GeoJSON.Feature | number[];
    }

    interface IconPointsOptions extends IGlifyLayerOptions {
      iconUrl: string;
      iconSize: number;
      iconAnchor?: [number, number];
      sensitivity?: number;
      sensitivityHover?: number;
      click?: EventCallback;
      hover?: EventCallback;
      hoverOff?: EventCallback;
      setupClick?: (map: L.Map) => void;
      setupHover?: SetupHoverCallback;
      hoverWait?: number;
      incrementZ?: number;
      eachVertex?: (vertex: IIconVertex) => void;
      data: GeoJSON.FeatureCollection<GeoJSON.Point> | [number, number][];
    }

    interface LabeledIconPointsOptions extends IconPointsOptions {
      labelOffset?: [number, number];
      labelFont?: string;
      labelColor?: IColor;
      labelBackgroundColor?: IColor;
      labelText?: (feature?: Feature<Point, GeoJsonProperties> | number[], index?: number) => string;
      labelBackgroundPadding?: [number, number];
      labelBackgroundCornerRadius?: number;
      labelBackgroundOutlineThickness?: number;
      globalScaleFactor?: number;
      labelTextSmoothing?: number;
      labelBackgroundVertexShaderSource?: () => string;
      labelBackgroundFragmentShaderSource?: () => string;
      labelTextVertexShaderSource?: () => string;
      labelTextFragmentShaderSource?: () => string;
    }

    interface IGlifyLayer {
      update(data: [number, number][] | GeoJSON.Feature<GeoJSON.Point>, index: number): this;
      updateAll(data: number[][] | FeatureCollection): this;
      remove(indices?: number | number[]): this; // Optional indices for partial removal
      render(): this;
      addTo(map?: L.Map): this; // Map parameter is optional
      setData(data: [number, number][] | GeoJSON.FeatureCollection<GeoJSON.Point>): this;
      insert(features: any | any[], index: number): this; // Add insert method
    }

    interface PointsInstance extends IGlifyLayer {}
    interface IconPointsInstance extends IGlifyLayer {
      active: boolean;
      texture: WebGLTexture | null;
      vertices: Float32Array;
      canvas: HTMLCanvasElement;
      gl: WebGLRenderingContext | WebGL2RenderingContext;
      
      setupState(): this;
      drawOnCanvas(e: ICanvasOverlayDrawEvent): this;
      lookup(coords: L.LatLng): IIconVertex | null;
      resetVertices(): this;
      ready(): Promise<void>;
      
      // WebGL related methods
      getBuffer(name: string): WebGLBuffer;
      getAttributeLocation(name: string): number;
      getUniformLocation(name: string): WebGLUniformLocation;
    }

    interface LabeledIconPointsInstance extends IGlifyLayer {
      resetVertices(): this;
      updateLabelPositions(e: any): void;
      setLikuNumberArray(likuNumberArray: string[]): void;
    }

    function points(options: PointsOptions): PointsInstance;
    function iconPoints(options: IconPointsOptions): IconPointsInstance;
    function labeledIconPoints(options: LabeledIconPointsOptions): LabeledIconPointsInstance;
    // Line-specific interfaces
    interface ILineVertex {
      latLng: L.LatLng;
      pixel: L.Point;
      chosenColor: IColor;
      chosenWeight: number;
      key: string;
      feature?: GeoJSON.Feature<GeoJSON.LineString | GeoJSON.MultiLineString>;
    }

    interface LinesOptions extends IGlifyLayerOptions {
      data: GeoJSON.FeatureCollection<GeoJSON.LineString | GeoJSON.MultiLineString>;
      weight: number | ((index: number, feature: GeoJSON.Feature) => number);
      sensitivity?: number;
      sensitivityHover?: number;
      click?: EventCallback;
      hover?: EventCallback;
      hoverOff?: EventCallback;
      setupClick?: (map: L.Map) => void;
      setupHover?: SetupHoverCallback;
      hoverWait?: number;
      eachVertex?: (vertices: ILineVertex[]) => void;
    }

    interface LinesInstance extends IGlifyLayer {
      active: boolean;
      vertices: number[];
      allVertices: number[];
      allVerticesTyped: Float32Array;
      lineFeatures: ILineVertex[];
      canvas: HTMLCanvasElement;
      gl: WebGLRenderingContext | WebGL2RenderingContext;
      
      resetVertices(): this;
      drawOnCanvas(e: ICanvasOverlayDrawEvent): this;
      getBuffer(name: string): WebGLBuffer;
      getAttributeLocation(name: string): number;
      getUniformLocation(name: string): WebGLUniformLocation;
    }

    function lines(options: LinesOptions): LinesInstance;

    // Shape-specific interfaces
    interface IShapesSettings extends IGlifyLayerOptions {
      data: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> | 
            GeoJSON.FeatureCollection<GeoJSON.Polygon | GeoJSON.MultiPolygon> | 
            GeoJSON.MultiPolygon | 
            number[][];
      border?: boolean;
      borderOpacity?: number;
      setupClick?: (map: L.Map) => void;
      setupHover?: SetupHoverCallback;
      sensitivity?: number;
      sensitivityHover?: number;
      click?: EventCallback;
      hover?: EventCallback;
      hoverOff?: EventCallback;
      hoverWait?: number;
    }

    interface ShapesInstance extends IGlifyLayer {
      active: boolean;
      vertices: number[];
      vertexLines: number[]; // For border rendering
      canvas: HTMLCanvasElement;
      gl: WebGLRenderingContext | WebGL2RenderingContext;
      
      // Core methods
      resetVertices(): this;
      drawOnCanvas(e: ICanvasOverlayDrawEvent): this;
      
      // WebGL helpers
      getBuffer(name: string): WebGLBuffer;
      getAttributeLocation(name: string): number;
      getUniformLocation(name: string): WebGLUniformLocation;

      // Shape-specific properties
      readonly border: boolean;
      readonly borderOpacity: number;
    }

    function shapes(options: IShapesSettings): ShapesInstance;

    const pointsInstances: PointsInstance[];
    const iconPointsInstances: IconPointsInstance[];
    const labeledIconPointsInstances: LabeledIconPointsInstance[];
    const linesInstances: LinesInstance[];
    const shapesInstances: ShapesInstance[];
  }

  interface Map {
    glify: typeof glify;
  }
}

export interface LeafletWithGlify extends L.Map {
  glify: typeof L.glify;
}
