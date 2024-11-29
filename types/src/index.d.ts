import { Map } from "leaflet";
import { Lines, ILinesSettings } from "./lines/lines";
import { Points, IPointsSettings } from "./points/points";
import { Shapes, IShapesSettings } from "./shapes/shapes";
import { IconPoints, IIconPointsSettings } from "./icon_points/icon-points";
import { LabeledIconPoints, ILabeledIconPointsSettings } from "./icon_points/labeled-icon-points";
export declare class Glify {
    longitudeKey: number;
    latitudeKey: number;
    clickSetupMaps: Map[];
    hoverSetupMaps: Map[];
    shader: {
        vertex: {
            defaultShader: string;
            IPshader: string;
            labelBackgroundVertex: string;
            labelTextVertex: string;
        };
        fragment: {
            dot: string;
            point: string;
            puck: string;
            simpleCircle: string;
            square: string;
            polygon: string;
            iconPoints: string;
            labelBackgroundFragment: string;
            labelTextFragment: string;
        };
    };
    Points: typeof Points;
    Shapes: typeof Shapes;
    Lines: typeof Lines;
    IconPoints: typeof IconPoints;
    LabeledIconPoints: typeof LabeledIconPoints;
    iconPointsInstances: IconPoints[];
    labeledIconPointsInstances: LabeledIconPoints[];
    pointsInstances: Points[];
    shapesInstances: Shapes[];
    linesInstances: Lines[];
    longitudeFirst(): this;
    latitudeFirst(): this;
    get instances(): Array<Points | Lines | Shapes | IconPoints | LabeledIconPoints>;
    points(settings: Partial<IPointsSettings>): Points;
    lines(settings: Partial<ILinesSettings>): Lines;
    shapes(settings: Partial<IShapesSettings>): Shapes;
    iconPoints(settings: Partial<IIconPointsSettings>): IconPoints;
    labeledIconPoints(settings: Partial<ILabeledIconPointsSettings>): LabeledIconPoints;
    setupClick(map: Map): void;
    setupHover(map: Map, hoverWait?: number, immediate?: false): void;
}
export declare const glify: Glify;
export default glify;
