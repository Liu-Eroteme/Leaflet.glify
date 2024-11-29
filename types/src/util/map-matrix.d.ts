export declare class MapMatrix {
    array: Float32Array;
    constructor();
    setSize(width: number, height: number): this;
    translateTo(x: number, y: number): this;
    scaleTo(scale: number): this;
}
