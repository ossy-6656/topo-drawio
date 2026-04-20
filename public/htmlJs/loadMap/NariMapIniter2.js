import { cityExtent } from './mapDepend/hncity.js'
import { hn_city_edge_map } from './mapDepend/hn-city.js'
import hnouterLineList from './mapDepend/hnouter.js'
export default class NariMapIniter {
  constructor(map) {
    this.map = map
    this.zcid2CityMap = {
      '16810251AFB7C6DCE050E60A50273290': '新乡',
      '16810251B296C6DCE050E60A50273290': '信阳',
      '16810251BE14C6DCE050E60A50273290': '周口',
      '16810251CD26C6DCE050E60A50273290': '开封',
      '16810251A60EC6DCE050E60A50273290': '南阳',
      '16810251D0B9C6DCE050E60A50273290': '安阳',
      '16810251AB4CC6DCE050E60A50273290': '三门峡',
      '16810251A9BDC6DCE050E60A50273290': '濮阳',
      '16810251CBA8C6DCE050E60A50273290': '焦作',
      '16810251A42AC6DCE050E60A50273290': '平顶山',
      '16810251C14FC6DCE050E60A50273290': '驻马店',
      '16810251C99BC6DCE050E60A50273290': '鹤壁',
      '16810251B95FC6DCE050E60A50273290': '郑州',
      '16810251CB11C6DCE050E60A50273290': '济源',
      '16810251B60BC6DCE050E60A50273290': '许昌',
      '16810251C490C6DCE050E60A50273290': '洛阳',
      '16810251AD07C6DCE050E60A50273290': '商丘',
      '16810251CF44C6DCE050E60A50273290': '漯河'
    }
  }
  go(callback) {
    let that = this
    return new Promise((resolve, reject) => {
      narimap.Require([], () => {
        if (narimap.Config.examples.notlogin) {
          this.initMap(narimap.Config.styles.base)
        } else {
          //电网GIS地图服务登录
          narimap.SGAuth.login()
            .then((result) => {
              if (result.success) {
                console.log('登录成功')
              } else {
                console.log('登录失败', result)
              }
              this.initMap(narimap.Config.styles.sjDark, callback).then(r => {
                resolve(r)
              })
            })
            .catch((err) => {
              console.log('错误', err)
            })
        }
      })
    })
  }

  initMap(style, callback) {
    return new Promise((resolve, reject) => {
      let that = this
      let map = (this.map = new narimap.Map({
        // 地图绑定的DOM元素ID
        container: 'mapdivSvgViewMap', // 地图样式
        style: 'aegis://styles/aegis/StreetsLight-v2',
        // style: StreetsDark,
        preserveDrawingBuffer: true,
        // style: style,
        // 默认缩放层级
        zoom: 8.0,
        // maxZoom:11.9,
        // 地图中心点
        center: [113.72520427636573, 34.76776041297258],
        // pitch: 45,
        pitch: 0,
        bearing: 0,
        dragRotate: false,
        localIdeographFontFamily: 'Microsoft YoHei'
      }))
      this.map = map
      map.on('load', (e) => {
        this.initEdgeLayer()
        this.initCover()

        callback(map, 1)
        that.convertCoor([118.93074031402182, 32.895136511286466])
        resolve(true)
      })
    })
  }
  convertCoor(coor) {
    narimap.cgcs2sg(
      [coor],
      (resp) => {
        if (resp.success) {
          console.log(resp)
          const mercator = resp.returnValue[0]
          console.log(mercator)
        } else {
          console.log(resp.message)
        }
      },
      (err) => {
        console.log(err)
        console.log('调用服务错误')
      }
    )
  }
  initEdgeLayer() {
    let map = this.map
    map.addLayer({
      id: 'single-area-line',
      type: 'line',
      source: {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      },
      paint: {
        'line-color': '#FFAE00',
        'line-width': 4
      }
    })
  }
  initCover() {
    let cityFeatureMap = (this.cityFeatureMap = {})
    // 行政区划边界线
    this.map.addLayer({
      id: 'city-line',
      type: 'line',
      source: {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      },
      paint: {
        'line-color': 'rgba(0,134,196,.4)',
        'line-width': 1
      }
    })
    this.map.addLayer({
      id: 'hn-line',
      type: 'line',
      source: {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',

          features: []
        }
      },
      paint: {
        'line-color': 'rgb(0,134,196)',
        'line-width': 2
      }
    })

    let lineList = []
    for (let name in hn_city_edge_map) {
      lineList.push(hn_city_edge_map[name])
      cityFeatureMap[name] = {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: hn_city_edge_map[name]
        },
        properties: {
          name: name
        }
      }
    }

    // 行政区划边界
    this.map.getSource('city-line').setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'MultiLineString',
            coordinates: lineList
          }
        }
      ]
    })
    // 省边界
    this.map.getSource('hn-line').setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'MultiLineString',
            coordinates: [hnouterLineList]
          }
        }
      ]
    })
    let assetId = ''
    this.drawEdgeByAssetId(assetId)
  }

  drawEdgeByAssetId(id) {
    this.clearEdge()
    let city = this.zcid2CityMap[id]
    if (city) {
      let ext = cityExtent[city]
      let bbox
      if (!ext) {
        ext = [112.71659, 34.265038, 114.2007, 34.97823]
      }
      bbox = [
        [ext[0], ext[1] - 0.1],
        [ext[2], ext[3] + 0.01]
      ]

      this.map.fitBounds(bbox, {
        padding: { top: 10, bottom: 300, left: 15, right: 5 }
      })
      this.drawEdge(city)
    } else {
      var bbox = [
        [110.3604760000000056, 31.3823709999999991],
        [116.6516409999999979, 36.3665599999999998]
      ]
      // this.map.fitBounds(bbox, {
      //     padding: {top: 15, bottom:15, left: 15, right: 15}
      // });
    }
  }

  clearEdge() {
    let map = this.map
    let data = {
      type: 'FeatureCollection',
      features: []
    }
    map.getSource('single-area-line').setData(data)
  }
}
