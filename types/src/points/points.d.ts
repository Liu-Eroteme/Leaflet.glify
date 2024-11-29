import { Feature, FeatureCollection, Point as GeoPoint } from "geojson";
import { BaseGlLayer, IBaseGlLayerSettings } from "../base/base-gl-layer";
import { ICanvasOverlayDrawEvent } from "../base/canvas-overlay";
import * as Color from "../util/color";
import { LeafletMouseEvent, Map, LatLng } from "leaflet";
import { IPixel } from "../util/pixel";
export interface IPointsSettings extends IBaseGlLayerSettings {
    data: number[][] | FeatureCollection<GeoPoint>;
    size?: ((i: number, latLng: LatLng | null) => number) | number | null;
    eachVertex?: (pointVertex: IPointVertex) => void;
    sensitivity?: number;
    sensitivityHover?: number;
    setupClick?: (map: Map) => void;
    setupHover?: (map: Map, hoverWait?: number, immediate?: false) => void;
}
export interface IPointVertex {
    latLng: LatLng;
    pixel: IPixel;
    chosenColor: Color.IColor;
    chosenSize: number;
    key: string;
    feature?: any;
}
export declare class Points extends BaseGlLayer<IPointsSettings> {
    static defaults: Partial<IPointsSettings>;
    static maps: never[];
    bytes: number;
    latLngLookup: {
        [key: string]: IPointVertex[];
    };
    allLatLngLookup: IPointVertex[];
    vertices: number[];
    typedVertices: Float32Array;
    dataFormat: "Array" | "GeoJson.FeatureCollection";
    settings: Partial<IPointsSettings>;
    active: boolean;
    get size(): ((i: number, latLng: LatLng | null) => number) | number | null;
    constructor(settings: Partial<IPointsSettings>);
    render(): this;
    getPointLookup(key: string): IPointVertex[];
    addLookup(lookup: IPointVertex): this;
    resetVertices(): this;
    removeInstance(): this;
    pointSize(pointIndex: number): number;
    drawOnCanvas(e: ICanvasOverlayDrawEvent): this;
    lookup(coords: LatLng): IPointVertex | null;
    static closest(targetLocation: LatLng, points: IPointVertex[], map: Map): IPointVertex | null;
    static tryClick(e: LeafletMouseEvent, map: Map, instances: Points[]): boolean | undefined;
    hoveringFeatures: Array<Feature<GeoPoint>>;
    static tryHover(e: LeafletMouseEvent, map: Map, instances: Points[]): Array<boolean | undefined>;
}
