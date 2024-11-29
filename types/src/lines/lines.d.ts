import { Map, LeafletMouseEvent } from "leaflet";
import { Feature, FeatureCollection, LineString, MultiLineString } from "geojson";
import { BaseGlLayer, IBaseGlLayerSettings } from "../base/base-gl-layer";
import { ICanvasOverlayDrawEvent } from "../base/canvas-overlay";
import { LineFeatureVertices } from "./line-feature-vertices";
export type WeightCallback = (i: number, feature: any) => number;
export interface ILinesSettings extends IBaseGlLayerSettings {
    data: FeatureCollection<LineString | MultiLineString>;
    weight: WeightCallback | number;
    sensitivity?: number;
    sensitivityHover?: number;
    eachVertex?: (vertices: LineFeatureVertices) => void;
    setupClick?: (map: Map) => void;
    setupHover?: (map: Map, hoverWait?: number, immediate?: false) => void;
}
export declare class Lines extends BaseGlLayer<ILinesSettings> {
    static defaults: Partial<ILinesSettings>;
    scale: number;
    bytes: number;
    allVertices: number[];
    allVerticesTyped: Float32Array;
    vertices: number[];
    lineFeatures: LineFeatureVertices[];
    aPointSize: number;
    settings: Partial<ILinesSettings>;
    get weight(): WeightCallback | number;
    constructor(settings: Partial<ILinesSettings>);
    render(): this;
    resetVertices(): this;
    removeInstance(): this;
    drawOnCanvas(e: ICanvasOverlayDrawEvent): this;
    static tryClick(e: LeafletMouseEvent, map: Map, instances: Lines[]): boolean | undefined;
    hoveringFeatures: Array<Feature<LineString | MultiLineString>>;
    static tryHover(e: LeafletMouseEvent, map: Map, instances: Lines[]): Array<boolean | undefined>;
}
