import CorUtil from '@/plugins/tmzx/CorUtil.js'

let GisUtil = {
  /**
   * drawio坐标转为gis坐标
   * @param x
   * @param y
   * @returns {(*|number|number|number)[]}
   */
  drawio2wgs84(curParam, x, y) {
    // let { mlt, mrb, sw, sh, scale} = this.currentExtent();
    let { mlt, mrb, sw, sh, scale } = curParam
    let svgx = x * scale
    let svgy = y * scale
    let ratiox = (mrb[0] - mlt[0]) / sw
    let ratioy = (mlt[1] - mrb[1]) / sh
    let merx = mlt[0] + ratiox * svgx
    let mery = mlt[1] - ratioy * svgy
    let [geo_y, geo_x] = CorUtil.webMercator2lonLat(mery, merx)
    return [geo_x, geo_y]
  },
  /**
   * 返回每米多少像素的比率
   * @param map
   * @returns {number}
   */
  pixelPerMeter(map) {
    let con = map.getContainer()
    let { _ne, _sw } = map.getBounds() // LngLatBounds

    let p1 = [_sw.lng, _sw.lat]
    let p2 = [_ne.lng, _sw.lat]
    let meter = CorUtil.distance(p1, p2)
    let pixel = con.clientWidth

    return pixel / meter
  },
  /**
   * 米转化为drawio距离
   * @param curParam
   * @param merter
   */
  meter2drawio(curParam, merter) {
    let { pixelPerMer } = curParam
    return pixelPerMer * merter
  },
  // 每像素多少米
  meterPerPixel(map) {
    let con = map.getContainer()
    let { _ne, _sw } = map.getBounds() // LngLatBounds

    let p1 = [_sw.lng, _sw.lat]
    let p2 = [_ne.lng, _sw.lat]
    let meter = CorUtil.distance(p1, p2)
    let pixel = con.clientWidth

    return meter / pixel
  },
  /**
   * svg坐标转gis坐标
   * @param map_param
   * @param x
   * @param y
   * @returns {{lng: (*|number|number|number), lat: (number|*)}}
   */
  svgCor2Geo(map_param, x, y) {
    let { x: geo_mer_x, y: geo_mer_y } = this.svgCor2Mer(map_param, x, y)
    let [geo_y, geo_x] = CorUtil.webMercator2lonLat(geo_mer_y, geo_mer_x)

    return {
      lng: geo_x,
      lat: geo_y
    }
  },
  /**
   * 单线图中的莫卡托坐标转屏幕坐标（这个只用于初始化）
   * 注意：这个是从左上角0开始的svg坐标
   * @param curParam
   * @param x         svg x 莫卡托坐标
   * @param y         svg y 莫卡托坐标
   * @returns {{lng: *, lat: *}}
   */
  mer2pixel(curParam, x, y) {
    let { mlt, minx, maxy, pixelPerMer } = curParam
    let stepx = minx + x - mlt[0]
    let stepy = mlt[1] - (maxy - y)

    let drawioX = stepx * pixelPerMer
    let drawioY = stepy * pixelPerMer

    return new Vector2(drawioX, drawioY)
  },
  /**
   * 通用mercator坐标转drawio方法（后期用法）
   * @param param
   * @param x  mer lng 世界坐标
   * @param y  mer lat 世界坐标
   * @returns {Vector2}
   */
  mer2drawio(param, x, y) {
    let { mlt, pixelPerMer } = param
    let stepx = x - mlt[0]
    let stepy = mlt[1] - y

    let pixelX = stepx * pixelPerMer
    let pixelY = stepy * pixelPerMer

    return new Vector2(pixelX, pixelY)
  },
  // 通用转换方法（后期用法）
  sg2drawio(param, x, y) {
    let [geo_y, geo_x] = CorUtil.lonLat2WebMercator(y, x)
    return this.mer2drawio(param, geo_x, geo_y)
  },
  /**
   * svg坐标转墨卡托投影坐标（svg以左上角0，0为起点）
   * @param map_param
   * @param x svg坐标
   * @param y svg坐标
   * @returns {{x: *, y: number}}
   */
  svgCor2Mer(map_param, x, y) {
    // let geo_mer_x = map_param.minx + x * map_param.ratio.x_ratio;
    // let geo_mer_y = map_param.maxy - y * map_param.ratio.y_ratio;
    let geo_mer_x = map_param.minx + x
    let geo_mer_y = map_param.maxy - y
    return {
      x: geo_mer_x,
      y: geo_mer_y
    }
  },
  /**
   * 84经纬度坐标转屏幕坐标
   * @param map
   * @param lng
   * @param lat
   */
  lnglat2pixel(map, lng, lat) {
    return map.project([lng, lat])
  },
  // svg坐标转屏幕坐标
  svgcor2pixel(map, map_param, x, y) {
    let obj = this.svgCor2Mer(map_param, x, y) // 获取墨卡托坐标
    let [lat, lng] = CorUtil.webMercator2lonLat(obj.y, obj.x) // 转换为经纬度坐标
    let cor = this.lnglat2pixel(map, lng, lat)
    return cor
  },
  // 屏幕像素经纬度转
  pixel2geo(map, x, y) {
    return map.unproject([x, y]) // {lng, lat}
  },
  // 经纬度转像素，返回值{x: , y: }
  geo2pixel(map, x, y) {
    return map.project([x, y])
  },
  // 屏幕像素转真实距离米
  pixel2merter(map, pixelLen) {
    return pixelLen * this.meterPerPixel(map)
  },
  /**
   *
   * @param curParam
   * @param x   drawio坐标
   * @param y   drawio坐标
   * @returns {{x: *, y: number}}
   */
  pixel2Mer2(curParam, x, y) {
    let { mlt, mrb, sw, sh, scale, merPerPixel } = curParam
    let svgx = x * scale
    let svgy = y * scale
    let ratiox = (mrb[0] - mlt[0]) / sw
    let ratioy = (mlt[1] - mrb[1]) / sh
    let merx = mlt[0] + ratiox * svgx
    let mery = mlt[1] - ratioy * svgy
    return {
      x: merx,
      y: mery
    }
  },
  // drawio坐标转mercator
  drawio2mer(curParam, x, y) {
    let { mlt, merPerPixel } = curParam
    let merx = mlt[0] + merPerPixel * x
    let mery = mlt[1] - merPerPixel * y
    return {
      x: merx,
      y: mery
    }
  },

  /**
   *
   * @param curParam
   * @param x clientX
   * @param y clientY
   * @returns {Vector2}
   */
  pixel2drawio(curParam, x, y) {
    let { lt, mlt, mrb, sw, sh, scale } = curParam
    let svgx = (-lt.x + x) / scale
    let svgy = (-lt.y + y) / scale
    return new Vector2(svgx, svgy)
  },
  pixel2Sg(map, scale, ltpos, x, y) {
    let svgx = x * scale
    let svgy = y * scale
    let sx = ltpos.x + svgx
    let sy = ltpos.y + svgy
    let { lng, lat } = this.pixel2geo(map, sx, sy)
    return [lng, lat]
  },
  // mercator长度转像素长度
  merLen2pixel(merLne, param) {
    let { lt, sw, sh, scale, mlt, mrb } = param
    let ratiox = sw / (mrb[0] - mlt[0])
    let ratioy = sh / (mlt[1] - mrb[1])
    return (ratiox * merLne) / scale
  }
}
export default GisUtil
