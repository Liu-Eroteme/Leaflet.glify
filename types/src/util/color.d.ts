export interface IColor {
    r: number;
    g: number;
    b: number;
    a?: number;
}
export declare const green: IColor;
export declare const red: IColor;
export declare const blue: IColor;
export declare const teal: IColor;
export declare const yellow: IColor;
export declare const white: IColor;
export declare const black: IColor;
export declare const gray: IColor;
export declare const grey: IColor;
export declare function fromHex(hex: string): IColor | null;
export declare function random(): IColor;
export declare function pallet(): IColor;
