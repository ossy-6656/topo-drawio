let radianPerAngle = Math.PI / 180
let pi = 3.1415926535897932384626
let x_pi = (3.14159265358979324 * 3000.0) / 180.0
let a = 6378245.0
let ee = 0.00669342162296594323

let CorUtil = {
  transformLat(x, y) {
    let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
    ret += ((20.0 * Math.sin(6.0 * x * pi) + 20.0 * Math.sin(2.0 * x * pi)) * 2.0) / 3.0
    ret += ((20.0 * Math.sin(y * pi) + 40.0 * Math.sin((y / 3.0) * pi)) * 2.0) / 3.0
    ret += ((160.0 * Math.sin((y / 12.0) * pi) + 320 * Math.sin((y * pi) / 30.0)) * 2.0) / 3.0
    return ret
  },

  transformLon(x, y) {
    let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
    ret += ((20.0 * Math.sin(6.0 * x * pi) + 20.0 * Math.sin(2.0 * x * pi)) * 2.0) / 3.0
    ret += ((20.0 * Math.sin(x * pi) + 40.0 * Math.sin((x / 3.0) * pi)) * 2.0) / 3.0
    ret += ((150.0 * Math.sin((x / 12.0) * pi) + 300.0 * Math.sin((x / 30.0) * pi)) * 2.0) / 3.0
    return ret
  },

  transform(lat, lon) {
    if (this.outOfChina(lat, lon)) {
      return [lat, lon]
    }

    let dLat = this.transformLat(lon - 105.0, lat - 35.0)
    let dLon = this.transformLon(lon - 105.0, lat - 35.0)
    let radLat = (lat / 180.0) * pi
    let magic = Math.sin(radLat)
    magic = 1 - ee * magic * magic
    let sqrtMagic = Math.sqrt(magic)
    dLat = (dLat * 180.0) / (((a * (1 - ee)) / (magic * sqrtMagic)) * pi)
    dLon = (dLon * 180.0) / ((a / sqrtMagic) * Math.cos(radLat) * pi)
    let mgLat = lat + dLat
    let mgLon = lon + dLon
    return [mgLat, mgLon]
  },

  outOfChina(lat, lon) {
    if (lon < 72.004 || lon > 137.8347) return true
    if (lat < 0.8293 || lat > 55.8271) return true
    return false
  },

  // 经纬度转Web墨卡托
  lonLat2WebMercator(lat, lon) {
    let x = (lon * 20037508.34) / 180
    let y = Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180)
    y = (y * 20037508.34) / 180
    return [y, x]
  },

  // Web墨卡托转经纬度
  webMercator2lonLat(lat, lon) {
    let x = (lon / 20037508.34) * 180
    let y = (lat / 20037508.34) * 180
    y = (180 / Math.PI) * (2 * Math.atan(Math.exp((y * Math.PI) / 180)) - Math.PI / 2)
    return [y, x]
  },

  /**
   * 84转webMercator(最终)
   * 跳过中间的火星坐标
   *
   * @param p 数组x,y
   * @returns {[*, *]}
   */
  gps84_to_webMercator(p) {
    let cor = this.gps84_To_Gcj02(p[1], p[0])
    let mcor = this.lonLat2WebMercator(cor[0], cor[1])
    return [mcor[1], mcor[0]]
  },

  /**
   * webMercator转84(最终)
   * 跳过中间的火星坐标
   *
   * @param p 数组x,y
   * @returns {[*, *]}
   */
  webMercator_to_gps84(p) {
    let corGcj02 = this.webMercator2lonLat(p[1], p[0])
    let cor = this.gcj02_To_Gps84(corGcj02[0], corGcj02[1])
    return [cor[1], cor[0]]
  },

  /**
   * 84 to 火星坐标系 (GCJ-02) World Geodetic System ==> Mars Geodetic System
   *
   * @param lat 纬度
   * @param lon 经度
   * @return
   */
  gps84_To_Gcj02(lat, lon) {
    if (outOfChina(lat, lon)) {
      return [lat, lon]
    }
    let dLat = this.transformLat(lon - 105.0, lat - 35.0)
    let dLon = this.transformLon(lon - 105.0, lat - 35.0)
    let radLat = (lat / 180.0) * pi
    let magic = Math.sin(radLat)
    magic = 1 - ee * magic * magic
    let sqrtMagic = Math.sqrt(magic)
    dLat = (dLat * 180.0) / (((a * (1 - ee)) / (magic * sqrtMagic)) * pi)
    dLon = (dLon * 180.0) / ((a / sqrtMagic) * Math.cos(radLat) * pi)
    let mgLat = lat + dLat
    let mgLon = lon + dLon
    return [mgLat, mgLon]
  },

  /**
   * * 火星坐标系 (GCJ-02) to 84 * * @param lon * @param lat * @return
   */
  // gcj02_To_Gps84: function (lat, lon) {
  //     double gps = transform(lat, lon);
  //     double lontitude = lon * 2 - gps[1];
  //     double latitude = lat * 2 - gps[0];
  //     return [latitude, lontitude];
  // },
  gcj02_To_Gps84(lat, lon) {
    let wgs_point = this._gcj02_To_Gps84_plus(lat, lon, lat, lon)
    for (let i = 0; i < 10; ++i) {
      wgs_point = this._gcj02_To_Gps84_plus(wgs_point[0], wgs_point[1], lat, lon)
    }
    return wgs_point
  },

  _gcj02_To_Gps84_plus(wgsLat, wgsLon, gcjLat, gcjLon) {
    let ng_point = transform(wgsLat, wgsLon)
    //double real_point = new LocateInfo(gcjLon - ng_point.getLongitude() + wgsLon, gcjLat - ng_point.getLatitude() + wgsLat);
    let attr = [gcjLat - ng_point[0] + wgsLat, gcjLon - ng_point[1] + wgsLon]
    return attr
  },

  /**
   * 火星坐标系 (GCJ-02) 与百度坐标系 (BD-09) 的转换算法 将 GCJ-02 坐标转换成 BD-09 坐标
   *
   * @param lat
   * @param lon
   */
  gcj02_To_Bd09(lat, lon) {
    let x = lon,
      y = lat
    let z = Math.sqrt(x * x + y * y) + 0.00002 * Math.sin(y * x_pi)
    let theta = Math.atan2(y, x) + 0.000003 * Math.cos(x * x_pi)
    let tempLon = z * Math.cos(theta) + 0.0065
    let tempLat = z * Math.sin(theta) + 0.006
    let gps = [tempLat, tempLon]
    return gps
  },

  /**
   * * 火星坐标系 (GCJ-02) 与百度坐标系 (BD-09) 的转换算法 * * 将 BD-09 坐标转换成GCJ-02 坐标 * * @param
   * bd_lat * @param bd_lon * @return
   */
  bd09_To_Gcj02(lat, lon) {
    let x = lon - 0.0065,
      y = lat - 0.006
    let z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * x_pi)
    let theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * x_pi)
    let tempLon = z * Math.cos(theta)
    let tempLat = z * Math.sin(theta)
    let gps = [tempLat, tempLon]
    return gps
  },

  /**
   * 将gps84转为bd09
   *
   * @param lat
   * @param lon
   * @return
   */
  gps84_To_bd09(lat, lon) {
    let gcj02 = this.gps84_To_Gcj02(lat, lon)
    let bd09 = this.gcj02_To_Bd09(gcj02[0], gcj02[1])
    return bd09
  },

  bd09_To_gps84(lat, lon) {
    let gcj02 = this.bd09_To_Gcj02(lat, lon)
    let gps84 = this.gcj02_To_Gps84(gcj02[0], gcj02[1])
    let gps84Str = []
    //保留小数点后六位
    gps84Str[0] = this.retain6(gps84[0], 0)
    gps84Str[1] = this.retain6(gps84[1], 0)
    return gps84Str
  },

  /**
   * 保留小数点后六位
   *
   * @param value
   * @param n
   * @return
   */
  retain6(value, n) {
    if (n == 0) {
      n = 6
    }
    let f = Math.round(value * Math.pow(10, n)) / Math.pow(10, n)
    let s = f + ''
    let rs = s.indexOf('.')
    if (rs < 0) {
      s += '.'
    }
    for (let i = s.length() - s.indexOf('.'); i <= n; i++) {
      s += '0'
    }
    return s
  },

  /**
   * 计算两点距离
   *
   * @param p1
   * @param p2
   * @return
   */
  distance(p1, p2) {
    //经纬度转弧度
    let lat1 = this.convertDegreesToRadians(p1[1])
    let lon1 = this.convertDegreesToRadians(p1[0])
    let lat2 = this.convertDegreesToRadians(p2[1])
    let lon2 = this.convertDegreesToRadians(p2[0])

    let vLon = Math.abs(lon1 - lon2)
    let vLat = Math.abs(lat1 - lat2)

    let h = this.haverSin(vLat) + Math.cos(lat1) * Math.cos(lat2) * this.haverSin(vLon)
    return 2 * 6371 * Math.asin(Math.sqrt(h)) * 1000
  },
  // distance(p1, p2)
  // {
  //     let p1SArray = p1.split(",");
  //     let p2SArray = p2.split(",");
  //     return this.distance([parseFloat(p1SArray[0]), parseFloat(p1SArray[1])], [parseFloat(p2SArray[0]), parseFloat(p2SArray[1])]);
  // },

  //经纬度转弧度
  convertDegreesToRadians(angle) {
    return angle * radianPerAngle
  },

  haverSin(theta) {
    let v = Math.sin(theta / 2)
    return v * v
  },

  main(args) {
    // let x = 114.10147499256202;
    // let y = 33.51282498974885;
    // let [] s = bd09_To_gps84(y,x);
    // System.out.println(s[1] + "," + s[0]);

    let p1 = [12724341.8889618, 4263344.48427921]
    let p2 = [12730845.8585806, 4267943.71993824]
    let len = this.distance(p1, p2)
    let p3 = this.webMercator_to_gps84(p1)
    let p4 = this.webMercator_to_gps84(p2)
    console.log(p3[0] + ',' + p3[1])
    console.log(p4[0] + ',' + p4[1])
  }
}

export default CorUtil
