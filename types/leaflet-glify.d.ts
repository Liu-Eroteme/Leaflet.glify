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
    }

    // NOTE: Event handling types
    type EventCallback = (e: L.LeafletMouseEvent, feature: any) => boolean | void;
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
      sensitivity?: number;
      sensitivityHover?: number;
      click?: EventCallback;
      hover?: EventCallback;
      hoverOff?: EventCallback;
      setupClick?: (map: L.Map) => void;
      setupHover?: SetupHoverCallback;
      hoverWait?: number;
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
      update(data: [number, number][] | GeoJSON.Feature<GeoJSON.Point>, index: number): void;
      updateAll(data: number[][] | FeatureCollection): void;
      remove(): void;
      render(): void;
      addTo(map: L.Map): this;
      setData(data: [number, number][] | GeoJSON.FeatureCollection<GeoJSON.Point>): this;
    }

    interface PointsInstance extends IGlifyLayer {}
    interface IconPointsInstance extends IGlifyLayer {}

    interface LabeledIconPointsInstance extends IGlifyLayer {
      resetVertices(): this;
      updateLabelPositions(e: any): void;
      setLikuNumberArray(likuNumberArray: string[]): void;
    }

    function points(options: PointsOptions): PointsInstance;
    function iconPoints(options: IconPointsOptions): IconPointsInstance;
    function labeledIconPoints(options: LabeledIconPointsOptions): LabeledIconPointsInstance;
    function lines(options: any): any;
    function shapes(options: any): any;

    const pointsInstances: PointsInstance[];
    const iconPointsInstances: IconPointsInstance[];
    const labeledIconPointsInstances: LabeledIconPointsInstance[];
    const linesInstances: any[];
    const shapesInstances: any[];
  }

  interface Map {
    glify: typeof glify;
  }
}

export interface LeafletWithGlify extends L.Map {
  glify: typeof L.glify;
}
