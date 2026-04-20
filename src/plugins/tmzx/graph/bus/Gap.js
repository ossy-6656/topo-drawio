import GraphTool from '@/plugins/tmzx/graph/GraphTool.js'
import Dimension from '@/plugins/tmzx/graph/Dimension.js'
import DeviceCategoryUtil from '@/plugins/tmzx/graph/DeviceCategoryUtil.js'
import mathutil from '@/plugins/tmzx/mathutil.js'
import GapUtil from '@/plugins/tmzx/graph/bus/GapUtil.js'

export default class Gap {
  constructor(graph, busCell, firstLine) {
    this.graph = graph
    this.model = graph.getModel()
    this.busCell = busCell
    this.oppositeBusCell = null
    this.oppositeFirstLine = null
    this.firstLine = firstLine
    this.connectionPoint = null
    this.dimenstion = null
    this.cellList = [] // 当前间隔的cell
    this.midCellList = [] // 母线之间的间隔
    this.list = [] // 用于放母联间隔中的所有cell
    this.init()
  }

  moveGap(vecStep) {
    let graph = this.graph
    let model = graph.getModel()
    let dimension = this.dimension

    for (let cell of this.cellList) {
      let geo = model.getGeometry(cell)
      let geoClone = geo.clone()
      if (model.isVertex(cell)) {
        let { width, height } = geo
        let vec = new Vector2(geo.getCenterX(), geo.getCenterY())
        let vec2 = vec.clone().add(vecStep)

        geoClone.x = vec2.x - width / 2
        geoClone.y = vec2.y - height / 2
        model.setGeometry(cell, geoClone)
      } else if (model.isEdge(cell)) {
        let vecLs = []
        let vecList = GraphTool.getEdgePointsCommon(graph, cell)
        for (let vec of vecList) {
          let vec2 = vec.clone().add(vecStep)
          vecLs.push(vec2)
        }

        let firstVec = vecLs[0]
        let lastVec = vecLs[vecList.length - 1]
        geoClone.sourcePoint = new mxPoint(firstVec.x, firstVec.y)
        geoClone.targetPoint = new mxPoint(lastVec.x, lastVec.y)

        if (vecList.length > 2) {
          let points = []
          let tmpList = vecLs.slice(1, vecList.length - 1)
          for (let vec of tmpList) {
            points.push(new mxPoint(vec.x, vec.y))
          }
          geoClone.points = points
        }
        model.setGeometry(cell, geoClone)
      }
    }

    dimension.xmin = dimension.xmin + vecStep.x
    dimension.ymax = dimension.ymax + vecStep.x
  }

  // 间隔坐标范围计算
  computeDimension() {
    let graph = this.graph
    let model = this.model

    if (this.cellList.length == 0) {
      return
    }

    let vecList = []
    for (let cell of this.cellList) {
      let list = GraphTool.getCellPointsCommon(graph, cell)
      vecList.push(...list)
    }

    let dimension = (this.dimension = new Dimension())
    let { xmin, ymin, xmax, ymax } = mathutil.vecListBounds(vecList)

    dimension.init(xmin, ymin, xmax, ymax)
    return dimension
  }

  init() {
    let graph = this.graph
    let busCell = this.busCell
    let firstLine = this.firstLine

    this.connectionPoint = GraphTool.getBusTouchPointCommon(graph, firstLine)

    let { oppositeBusCell, oppositeFirstLine, list } = GapUtil.getGapInfo(graph, busCell, firstLine)
    if (oppositeBusCell) {
      this.oppositeBusCell = oppositeBusCell
      this.oppositeFirstLine = oppositeFirstLine
      this.list = list
    } else {
      this.cellList = list
    }
  }
}
