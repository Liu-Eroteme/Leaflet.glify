import { ICanvasOverlayDrawEvent } from "../base/canvas-overlay";
import { Map } from "leaflet";
export declare class CanvasOverlay {
    _userDrawFunc: (e: ICanvasOverlayDrawEvent) => void;
    constructor(userDrawFunc: (e: ICanvasOverlayDrawEvent) => void);
    canvas: HTMLCanvasElement;
    addTo(map: Map): this;
    redraw(): void;
}
