import { Feature, FeatureCollection, Point as GeoPoint } from "geojson";
import { BaseGlLayer, IBaseGlLayerSettings } from "../base/base-gl-layer";
import { ICanvasOverlayDrawEvent } from "../base/canvas-overlay";
import * as Color from "../util/color";
import { LeafletMouseEvent, Map, LatLng } from "leaflet";
import { IPixel } from "../util/pixel";
export interface IIconPointsSettings extends IBaseGlLayerSettings {
    data: number[][] | FeatureCollection<GeoPoint>;
    size?: ((i: number, latLng: LatLng | null) => number) | number | null;
    eachVertex?: (iconVertex: IIconVertex) => void;
    sensitivity?: number;
    sensitivityHover?: number;
    iconUrl: string;
    iconSize: number;
    iconAnchor?: [number, number];
    incrementZ?: number;
}
export interface IIconVertex {
    latLng: LatLng;
    pixel: IPixel;
    chosenColor: Color.IColor;
    chosenSize: number;
    key: string;
    feature?: any;
}
export declare class IconPoints extends BaseGlLayer<IIconPointsSettings> {
    static defaults: Partial<IIconPointsSettings>;
    static maps: Map[];
    bytes: number;
    latLngLookup: {
        [key: string]: IIconVertex[];
    };
    allLatLngLookup: IIconVertex[];
    private _verticesArray;
    vertices: Float32Array;
    typedVertices: Float32Array;
    dataFormat: "Array" | "GeoJson.FeatureCollection";
    settings: Partial<IIconPointsSettings>;
    active: boolean;
    texture: WebGLTexture | null;
    textureWidth: number;
    textureHeight: number;
    incrementZ: number;
    private readyPromise;
    get size(): ((i: number, latLng: LatLng | null) => number) | number | null;
    constructor(settings: Partial<IIconPointsSettings>);
    ready(): Promise<void>;
    loadTexture(url: string): Promise<void>;
    render(noRedraw?: boolean): this;
    getPointLookup(key: string): IIconVertex[];
    addLookup(lookup: IIconVertex): this;
    resetVertices(): this;
    setupState(): this;
    drawOnCanvas(e: ICanvasOverlayDrawEvent): this;
    removeInstance(): this;
    lookup(coords: LatLng): IIconVertex | null;
    static closest(targetLocation: LatLng, points: IIconVertex[], map: Map): IIconVertex | null;
    static tryClick(e: LeafletMouseEvent, map: Map, instances: IconPoints[]): boolean | undefined;
    hoveringFeatures: Array<Feature<GeoPoint>>;
    static tryHover(e: LeafletMouseEvent, map: Map, instances: IconPoints[]): Array<boolean | undefined>;
}
