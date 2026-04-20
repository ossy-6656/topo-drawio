export default class Dimension {
  constructor() {
    // if (arguments.length > 0) {
    //
    // } else {
    //     this._xmin = 0;
    //     this._ymin = 0;
    //     this._xmax = 0;
    //     this._ymax = 0;
    // }

    this._xmin = 0
    this._ymin = 0
    this._xmax = 0
    this._ymax = 0
  }

  get xmin() {
    return this._xmin
  }

  set xmin(xmin) {
    this._xmin = xmin
  }

  set ymin(ymin) {
    this._ymin = ymin
  }

  get ymin() {
    return this._ymin
  }

  set xmax(xmax) {
    this._xmax = xmax
  }

  get xmax() {
    return this._xmax
  }

  set ymax(ymax) {
    this._ymax = ymax
  }

  get ymax() {
    return this._ymax
  }

  get width() {
    return Math.abs(this.xmax - this.xmin)
  }

  get height() {
    return Math.abs(this.ymax - this.ymin)
  }

  init(xmin, ymin, xmax, ymax) {
    this.xmin = xmin
    this.ymin = ymin
    this.xmax = xmax
    this.ymax = ymax
  }
}
