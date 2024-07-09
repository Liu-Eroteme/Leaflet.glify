// File info: index.ts
import { LeafletMouseEvent, Map } from "leaflet";

import { Lines, ILinesSettings } from "./lines";
import { Points, IPointsSettings } from "./points";
import { Shapes, IShapesSettings } from "./shapes";
import { IconPoints, IIconPointsSettings } from "./icon-points"; // Add this line
import { debounce } from "./utils";

import defaultShader from "./shader/vertex/default.glsl";
import IPshader from "./shader/vertex/icon-points.glsl"; // Add this line
import dot from "./shader/fragment/dot.glsl";
import point from "./shader/fragment/point.glsl";
import puck from "./shader/fragment/puck.glsl";
import simpleCircle from "./shader/fragment/simple-circle.glsl";
import square from "./shader/fragment/square.glsl";
import polygon from "./shader/fragment/polygon.glsl";
import iconPoints from "./shader/fragment/icon-points.glsl"; // Add this line

const shader = {
  vertex: {
    defaultShader,
    IPshader,
  },
  fragment: {
    dot,
    point,
    puck,
    simpleCircle,
    square,
    polygon,
    iconPoints, // Add this line
  },
};

export class Glify {
  longitudeKey = 1;
  latitudeKey = 0;
  clickSetupMaps: Map[] = [];
  hoverSetupMaps: Map[] = [];
  shader = shader;

  Points: typeof Points = Points;
  Shapes: typeof Shapes = Shapes;
  Lines: typeof Lines = Lines;
  IconPoints: typeof IconPoints = IconPoints; // Add this line
  iconPointsInstances: IconPoints[] = []; // Add this line

  pointsInstances: Points[] = [];
  shapesInstances: Shapes[] = [];
  linesInstances: Lines[] = [];

  longitudeFirst(): this {
    this.longitudeKey = 0;
    this.latitudeKey = 1;
    return this;
  }

  latitudeFirst(): this {
    this.latitudeKey = 0;
    this.longitudeKey = 1;
    return this;
  }

  get instances(): Array<Points | Lines | Shapes | IconPoints> {
    return [
      ...this.pointsInstances,
      ...this.linesInstances,
      ...this.shapesInstances,
      ...this.iconPointsInstances,
    ];
  }

  points(settings: Partial<IPointsSettings>): Points {
    const points = new this.Points({
      setupClick: this.setupClick.bind(this),
      setupHover: this.setupHover.bind(this),
      latitudeKey: glify.latitudeKey,
      longitudeKey: glify.longitudeKey,
      vertexShaderSource: () => {
        return this.shader.vertex.defaultShader;
      },
      fragmentShaderSource: () => {
        return this.shader.fragment.point;
      },
      ...settings,
    });
    this.pointsInstances.push(points);
    return points;
  }

  lines(settings: Partial<ILinesSettings>): Lines {
    const lines = new this.Lines({
      setupClick: this.setupClick.bind(this),
      setupHover: this.setupHover.bind(this),
      latitudeKey: this.latitudeKey,
      longitudeKey: this.longitudeKey,
      vertexShaderSource: () => {
        return this.shader.vertex.defaultShader;
      },
      fragmentShaderSource: () => {
        return this.shader.fragment.polygon;
      },
      ...settings,
    });
    this.linesInstances.push(lines);
    return lines;
  }

  shapes(settings: Partial<IShapesSettings>): Shapes {
    const shapes = new this.Shapes({
      setupClick: this.setupClick.bind(this),
      setupHover: this.setupHover.bind(this),
      latitudeKey: this.latitudeKey,
      longitudeKey: this.longitudeKey,
      vertexShaderSource: () => {
        return this.shader.vertex.defaultShader;
      },
      fragmentShaderSource: () => {
        return this.shader.fragment.polygon;
      },
      ...settings,
    });
    this.shapesInstances.push(shapes);
    return shapes;
  }

  iconPoints(settings: Partial<IIconPointsSettings>): IconPoints {
    const iconPoints = new this.IconPoints({
      setupClick: this.setupClick.bind(this),
      setupHover: this.setupHover.bind(this),
      latitudeKey: this.latitudeKey,
      longitudeKey: this.longitudeKey,
      vertexShaderSource: () => {
        return this.shader.vertex.IPshader;
      },
      fragmentShaderSource: () => {
        return this.shader.fragment.iconPoints;
      },
      ...settings,
    });
    this.iconPointsInstances.push(iconPoints);
    return iconPoints;
  }

  // Update setupClick and setupHover methods to include IconPoints
  setupClick(map: Map): void {
    if (this.clickSetupMaps.includes(map)) return;
    this.clickSetupMaps.push(map);
    map.on("click", (e: LeafletMouseEvent) => {
      let hit;
      hit = this.Points.tryClick(e, map, this.pointsInstances);
      if (hit !== undefined) return hit;

      hit = this.IconPoints.tryClick(e, map, this.iconPointsInstances);
      if (hit !== undefined) return hit;

      hit = this.Lines.tryClick(e, map, this.linesInstances);
      if (hit !== undefined) return hit;

      hit = this.Shapes.tryClick(e, map, this.shapesInstances);
      if (hit !== undefined) return hit;
    });
  }

  setupHover(map: Map, hoverWait?: number, immediate?: false): void {
    if (this.hoverSetupMaps.includes(map)) return;
    this.hoverSetupMaps.push(map);
    map.on(
      "mousemove",
      debounce(
        (e: LeafletMouseEvent) => {
          this.Points.tryHover(e, map, this.pointsInstances);
          this.IconPoints.tryHover(e, map, this.iconPointsInstances);
          this.Lines.tryHover(e, map, this.linesInstances);
          this.Shapes.tryHover(e, map, this.shapesInstances);
        },
        hoverWait ?? 0,
        immediate
      )
    );
  }
}

export const glify = new Glify();
export default glify;
if (typeof window !== "undefined" && window.L) {
  // @ts-expect-error exporting it to window
  window.L.glify = glify;
  // @ts-expect-error exporting it to window
  window.L.Glify = Glify;
}
