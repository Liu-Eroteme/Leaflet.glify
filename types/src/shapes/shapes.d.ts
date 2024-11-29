import PolygonLookup from "polygon-lookup";
import { LeafletMouseEvent, Map } from "leaflet";
import { Feature, FeatureCollection, GeoJsonProperties, MultiPolygon, Polygon } from "geojson";
import { BaseGlLayer, IBaseGlLayerSettings } from "../base/base-gl-layer";
import { ICanvasOverlayDrawEvent } from "../base/canvas-overlay";
export interface IShapesSettings extends IBaseGlLayerSettings {
    border?: boolean;
    borderOpacity?: number;
    data: Feature<Polygon | MultiPolygon> | FeatureCollection<Polygon | MultiPolygon> | MultiPolygon | number[][];
    setupClick?: (map: Map) => void;
    setupHover?: (map: Map, hoverWait?: number, immediate?: false) => void;
}
export declare const defaults: Partial<IShapesSettings>;
export declare class Shapes extends BaseGlLayer {
    static defaults: Partial<IShapesSettings>;
    static maps: Map[];
    settings: Partial<IShapesSettings>;
    bytes: number;
    vertices: number[];
    vertexLines: number[];
    polygonLookup: PolygonLookup | null;
    get border(): boolean;
    get borderOpacity(): number;
    constructor(settings: Partial<IShapesSettings>);
    render(): this;
    resetVertices(): this;
    removeInstance(): this;
    drawOnCanvas(e: ICanvasOverlayDrawEvent): this;
    static tryClick(e: LeafletMouseEvent, map: Map, instances: Shapes[]): boolean | undefined;
    hoveringFeatures: Array<Feature<Polygon, GeoJsonProperties> | Feature<MultiPolygon, GeoJsonProperties>>;
    static tryHover(e: LeafletMouseEvent, map: Map, instances: Shapes[]): Array<boolean | undefined>;
}
