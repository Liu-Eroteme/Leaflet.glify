import {
  Feature,
  FeatureCollection,
  Point as GeoPoint,
  Position,
} from "geojson";

import { BaseGlLayer, IBaseGlLayerSettings } from "./base-gl-layer";
import { ICanvasOverlayDrawEvent } from "./canvas-overlay";
import * as Color from "./color";
import { LeafletMouseEvent, Map, Point, LatLng } from "leaflet";
import { IPixel } from "./pixel";
import { locationDistance, pixelInCircle } from "./utils";
import glify from "./index";

import { MapMatrix } from "./map-matrix";

export interface IIconPointsSettings extends IBaseGlLayerSettings {
  data: number[][] | FeatureCollection<GeoPoint>;
  size?: ((i: number, latLng: LatLng | null) => number) | number | null;
  eachVertex?: (iconVertex: IIconVertex) => void;
  sensitivity?: number;
  sensitivityHover?: number;
  iconUrl: string;
  iconSize: number;
  iconAnchor?: [number, number];
}

const defaults: Partial<IIconPointsSettings> = {
  color: Color.random,
  opacity: 1,
  className: "",
  sensitivity: 2,
  sensitivityHover: 0.03,
  iconSize: 32,
  iconAnchor: [16, 32],
  shaderVariables: {
    vertex: {
      type: "FLOAT",
      start: 0,
      size: 2,
    },
    color: {
      type: "FLOAT",
      start: 2,
      size: 4,
    },
    pointSize: {
      type: "FLOAT",
      start: 6,
      size: 1,
    },
    texCoord: {
      type: "FLOAT",
      start: 7,
      size: 2,
    },
  },
};

export interface IIconVertex {
  latLng: LatLng;
  pixel: IPixel;
  chosenColor: Color.IColor;
  chosenSize: number;
  key: string;
  feature?: any;
}

// TODO this all feels kinda.. sketchy
// rewrite?

export class IconPoints extends BaseGlLayer<IIconPointsSettings> {
  static defaults = defaults;
  static maps: Map[] = [];
  bytes = 9; // 2 for vertex, 4 for color, 1 for size, 2 for texture coordinates.. ?
  latLngLookup: {
    [key: string]: IIconVertex[];
  } = {};

  allLatLngLookup: IIconVertex[] = [];
  vertices: number[] = [];
  typedVertices: Float32Array = new Float32Array();
  dataFormat: "Array" | "GeoJson.FeatureCollection";
  settings: Partial<IIconPointsSettings>;
  active: boolean;
  texture: WebGLTexture | null = null;

  textureWidth: number = 0;
  textureHeight: number = 0;

  get size(): ((i: number, latLng: LatLng | null) => number) | number | null {
    if (typeof this.settings.size === "number") {
      return this.settings.size;
    }
    if (typeof this.settings.size === "function") {
      return this.settings.size;
    }
    return null;
  }

  constructor(settings: Partial<IIconPointsSettings>) {
    super(settings);

    this.settings = { ...defaults, ...settings };

    this.active = true;

    const { data, map } = this;
    if (Array.isArray(data)) {
      this.dataFormat = "Array";
    } else if (data.type === "FeatureCollection") {
      this.dataFormat = "GeoJson.FeatureCollection";
    } else {
      throw new Error(
        "unhandled data type. Supported types are Array and GeoJson.FeatureCollection"
      );
    }

    if (map.options.crs?.code !== "EPSG:3857") {
      console.warn("layer designed for SphericalMercator, alternate detected");
    }

    this.loadTexture(this.settings.iconUrl!)
      .then(() => this.setup().render())
      .catch((error) => console.error("Failed to load texture:", error));
  }

  async loadTexture(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const { gl } = this;
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          image
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        this.textureWidth = image.width;
        this.textureHeight = image.height;

        resolve();
      };
      image.onerror = reject;
      image.src = url;
    });
  }

  render(): this {
    this.resetVertices();

    const { gl, canvas, layer, vertices, mapMatrix } = this;
    const matrix = (this.matrix = this.getUniformLocation("matrix"));
    const verticesBuffer = this.getBuffer("vertices");
    const verticesTyped = (this.typedVertices = new Float32Array(vertices));
    const byteCount = verticesTyped.BYTES_PER_ELEMENT;

    mapMatrix.setSize(canvas.width, canvas.height);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniformMatrix4fv(matrix, false, mapMatrix.array);
    gl.bindBuffer(gl.ARRAY_BUFFER, verticesBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, verticesTyped, gl.STATIC_DRAW);

    this.attachShaderVariables(byteCount);

    // Bind texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    const uTexture = this.getUniformLocation("uTexture");
    gl.uniform1i(uTexture, 0);

    // TODO this is unsafe, need to check if the program is null
    const uTextureSizeLocation = gl.getUniformLocation(
      this.program!,
      "u_textureSize"
    );
    gl.uniform2f(uTextureSizeLocation, this.textureWidth, this.textureHeight);

    const uOutlineThicknessLocation = gl.getUniformLocation(
      this.program!,
      "u_outlineThickness"
    );
    gl.uniform1f(uOutlineThicknessLocation, 5); // Adjust this value for desired thickness

    layer.redraw();

    return this;
  }

  // getPointLookup, addLookup, removeInstance methods remain unchanged
  // Add comments here to indicate these methods should be copied from the Points class

  getPointLookup(key: string): IIconVertex[] {
    return this.latLngLookup[key] || (this.latLngLookup[key] = []);
  }

  addLookup(lookup: IIconVertex): this {
    this.getPointLookup(lookup.key).push(lookup);
    this.allLatLngLookup.push(lookup);
    return this;
  }

  resetVertices(): this {
    this.latLngLookup = {};
    this.allLatLngLookup = [];
    this.vertices = [];

    const {
      vertices,
      settings,
      map,
      size,
      latitudeKey,
      longitudeKey,
      color,
      opacity,
      data,
      mapCenterPixels,
    } = this;
    const { eachVertex, iconSize, iconAnchor } = settings;
    let colorFn: ((i: number, latLng: LatLng | any) => Color.IColor) | null =
      null;
    let chosenColor: Color.IColor;
    let chosenSize: number;
    let sizeFn: any;
    let rawLatLng: [number, number] | Position;
    let latLng: LatLng;
    let pixel: Point;
    let key;

    if (!color) {
      throw new Error("color is not properly defined");
    } else if (typeof color === "function") {
      colorFn = color as (i: number, latLng: LatLng) => Color.IColor;
    }

    if (!size) {
      throw new Error("size is not properly defined");
    } else if (typeof size === "function") {
      sizeFn = size;
    }

    const processVertex = (i: number, feature: any) => {
      rawLatLng =
        this.dataFormat === "Array" ? data[i] : feature.geometry.coordinates;
      key =
        rawLatLng[latitudeKey].toFixed(2) +
        "x" +
        rawLatLng[longitudeKey].toFixed(2);
      latLng = new LatLng(rawLatLng[latitudeKey], rawLatLng[longitudeKey]);
      pixel = map.project(latLng, 0);

      if (colorFn) {
        chosenColor = colorFn(
          i,
          this.dataFormat === "Array" ? latLng : feature
        );
      } else {
        chosenColor = color as Color.IColor;
      }

      chosenColor = { ...chosenColor, a: chosenColor.a ?? opacity ?? 0 };

      if (sizeFn) {
        chosenSize = sizeFn(i, latLng);
      } else {
        chosenSize = size as number;
      }

      vertices.push(
        // vertex
        pixel.x - mapCenterPixels.x,
        pixel.y - mapCenterPixels.y,

        // color
        chosenColor.r,
        chosenColor.g,
        chosenColor.b,
        chosenColor.a ?? 0,

        // size
        chosenSize,

        // texture coordinates
        iconAnchor![0],
        iconAnchor![1]
      );

      const vertex: IIconVertex = {
        latLng,
        key,
        pixel,
        chosenColor,
        chosenSize,
        feature: this.dataFormat === "Array" ? rawLatLng : feature,
      };
      this.addLookup(vertex);
      if (eachVertex) {
        eachVertex(vertex);
      }
    };

    if (this.dataFormat === "Array") {
      const max = data.length;
      for (let i = 0; i < max; i++) {
        processVertex(i, null);
      }
    } else if (this.dataFormat === "GeoJson.FeatureCollection") {
      const max = data.features.length;
      for (let i = 0; i < max; i++) {
        const feature = data.features[i] as Feature<GeoPoint>;
        processVertex(i, feature);
      }
    }

    return this;
  }

  drawOnCanvas(e: ICanvasOverlayDrawEvent): this {
    if (!this.gl) return this;

    const {
      gl,
      canvas,
      mapMatrix,
      map,
      matrix,
      allLatLngLookup,
      mapCenterPixels,
    } = this;
    const { offset } = e;
    const zoom = map.getZoom();

    let center: IPixel;
    let currentZoom: number;
    let offsetValue: Point = offset;

    if (
      this._isDragging &&
      this._dragStartCenter &&
      this._dragStartZoom !== null &&
      this._dragStartOffset !== null
    ) {
      center = this._dragStartCenter;
      currentZoom = this._dragStartZoom;
      offsetValue = this._dragStartOffset;
    } else {
      center = mapCenterPixels;
      currentZoom = zoom;
      offsetValue = offset;
    }

    const scale = Math.pow(2, currentZoom);

    mapMatrix
      .setSize(canvas.width, canvas.height)
      .scaleTo(scale)
      .translateTo(-offsetValue.x + center.x, -offsetValue.y + center.y);

    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniformMatrix4fv(matrix, false, mapMatrix.array);

    // Bind texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    const uTexture = this.getUniformLocation("uTexture");
    gl.uniform1i(uTexture, 0);

    gl.drawArrays(gl.POINTS, 0, allLatLngLookup.length);

    return this;
  }

  // lookup, static closest, static tryClick, and static tryHover methods remain unchanged
  // Add comments here to indicate these methods should be copied from the Points class

  removeInstance(): this {
    const index = glify.iconPointsInstances.findIndex(
      (element: any) => element.layer._leaflet_id === this.layer._leaflet_id
    );
    if (index !== -1) {
      glify.iconPointsInstances.splice(index, 1);
    }
    return this;
  }

  lookup(coords: LatLng): IIconVertex | null {
    const latMax: number = coords.lat + 0.03;
    const lngMax: number = coords.lng + 0.03;
    const matches: IIconVertex[] = [];
    let lat = coords.lat - 0.03;
    let lng: number;
    let foundI: number;
    let foundMax: number;
    let found: IIconVertex[];
    let key: string;

    for (; lat <= latMax; lat += 0.01) {
      lng = coords.lng - 0.03;
      for (; lng <= lngMax; lng += 0.01) {
        key = lat.toFixed(2) + "x" + lng.toFixed(2);
        found = this.latLngLookup[key];
        if (found) {
          foundI = 0;
          foundMax = found.length;
          for (; foundI < foundMax; foundI++) {
            matches.push(found[foundI]);
          }
        }
      }
    }

    const { map } = this;

    // try matches first, if it is empty, try the data, and hope it isn't too big
    return IconPoints.closest(
      coords,
      matches.length > 0 ? matches : this.allLatLngLookup,
      map
    );
  }

  static closest(
    targetLocation: LatLng,
    points: IIconVertex[],
    map: Map
  ): IIconVertex | null {
    if (points.length < 1) return null;
    return points.reduce((prev, curr) => {
      const prevDistance = locationDistance(targetLocation, prev.latLng, map);
      const currDistance = locationDistance(targetLocation, curr.latLng, map);
      return prevDistance < currDistance ? prev : curr;
    });
  }

  // attempts to click the top-most Points instance
  static tryClick(
    e: LeafletMouseEvent,
    map: Map,
    instances: IconPoints[]
  ): boolean | undefined {
    const closestFromEach: IIconVertex[] = [];
    const instancesLookup: { [key: string]: IconPoints } = {};
    let result;
    let settings: Partial<IIconPointsSettings> | null = null;
    let pointLookup: IIconVertex | null;

    instances.forEach((_instance: IconPoints) => {
      settings = _instance.settings;
      if (!_instance.active) return;
      if (_instance.map !== map) return;

      pointLookup = _instance.lookup(e.latlng);
      if (pointLookup === null) return;
      instancesLookup[pointLookup.key] = _instance;
      closestFromEach.push(pointLookup);
    });

    if (closestFromEach.length < 1) return;
    if (!settings) return;

    const found = this.closest(e.latlng, closestFromEach, map);

    if (!found) return;

    const instance = instancesLookup[found.key];
    if (!instance) return;
    const { sensitivity } = instance;
    const foundLatLng = found.latLng;
    const xy = map.latLngToLayerPoint(foundLatLng);

    if (
      pixelInCircle(xy, e.layerPoint, found.chosenSize * (sensitivity ?? 1))
    ) {
      result = instance.click(e, found.feature || found.latLng);
      return result !== undefined ? result : true;
    }
  }

  hoveringFeatures: Array<Feature<GeoPoint>> = [];
  // hovers all touching Points instances
  static tryHover(
    e: LeafletMouseEvent,
    map: Map,
    instances: IconPoints[]
  ): Array<boolean | undefined> {
    const results: boolean[] = [];
    instances.forEach((instance: IconPoints): void => {
      const { sensitivityHover, hoveringFeatures } = instance;
      if (!instance.active) return;
      if (instance.map !== map) return;
      const oldHoveredFeatures = hoveringFeatures;
      const newHoveredFeatures: Array<Feature<GeoPoint>> = [];
      instance.hoveringFeatures = newHoveredFeatures;

      const pointLookup = instance.lookup(e.latlng);
      if (!pointLookup) return;
      if (
        pixelInCircle(
          map.latLngToLayerPoint(pointLookup.latLng),
          e.layerPoint,
          pointLookup.chosenSize * sensitivityHover * 30
        )
      ) {
        let feature = pointLookup.feature || pointLookup.latLng;
        if (!newHoveredFeatures.includes(feature)) {
          newHoveredFeatures.push(feature);
        }
        const result = instance.hover(e, feature);
        if (result !== undefined) {
          results.push(result);
        }
      }
      for (let i = 0; i < oldHoveredFeatures.length; i++) {
        const feature = oldHoveredFeatures[i];
        if (!newHoveredFeatures.includes(feature)) {
          instance.hoverOff(e, feature);
        }
      }
    });
    return results;
  }
}
