import { LatLng } from "leaflet";
import { Position } from "geojson";
import { IColor } from "../util/color";
import { IPixel } from "../util/pixel";
interface ILineFeatureVerticesSettings {
    project: (coordinates: LatLng, distance: number) => IPixel;
    color: IColor;
    weight: number;
    latitudeKey: number;
    longitudeKey: number;
    opacity: number;
    mapCenterPixels: IPixel;
}
export declare class LineFeatureVertices {
    settings: ILineFeatureVerticesSettings;
    vertexCount: number;
    array: number[];
    pixels: IPixel[];
    latLngs: LatLng[];
    get length(): number;
    constructor(settings: ILineFeatureVerticesSettings);
    fillFromCoordinates(coordinates: Position[] | Position[][]): void;
    push(...args: number[]): void;
}
export {};
