import Dimension from '@/plugins/tmzx/graph/Dimension.js'
import Gap from '@/plugins/tmzx/graph/bus/Gap.js'
import GraphTool from '@/plugins/tmzx/graph/GraphTool.js'
import mathutil from '@/plugins/tmzx/mathutil.js'

export default class Bus {
  constructor(graph, busCell) {
    this.graph = graph
    this.model = graph.getModel()
    this.busCell = busCell
    this.dimension = new Dimension() // 母线与间隔总坐标范围
    this.busDimension = new Dimension() // 母线坐标范围
    this.gapList = []
    this.id = busCell.id
    this.specialGapList = []
    this.init()
  }

  // 初始化bus坐标范围
  initBusDimenstion() {
    let busCell = this.busCell
    let model = this.model
    let busDimension = this.busDimension

    let geo = model.getGeometry(busCell)
    let x = geo.x
    let y = geo.y
    busDimension.init(x, y, x + geo.width, y + geo.height)
  }

  move() {}

  initDimension() {
    let busCell = this.busCell
    let model = this.model

    let list = []

    let gapList = this.gapList
    for (let gap of gapList) {
      list.push(gap.dimension)
    }

    list.push(this.busDimension)

    let txtId = 'TXT-' + busCell.id
    let txtCell = model.getCell(txtId)
    if (txtCell) {
      let geo = model.getGeometry(txtCell)
      let x1 = geo.x
      let y1 = geo.y
      let x2 = x1 + geo.width
      let y2 = y1 + geo.height
      let tmpDime = new Dimension()
      tmpDime.init(x1, y1, x2, y2)

      list.push(tmpDime)
    }

    let region = mathutil.dimensionListBounds(list)
    this.dimension = region
    return region
  }

  // 计算母线间隔坐标范围
  getAvgGapWidth() {
    let gapList = this.gapList

    let widthSum = 0
    let counter = 0
    for (let gap of gapList) {
      let dimension = gap.dimension
      if (dimension) {
        widthSum = widthSum + dimension.width
        counter = counter + 1
      }
    }

    let avgWidth = widthSum / counter

    this.avgWidth = avgWidth
    return avgWidth
  }

  // 初始化间隔的坐标范围
  initGapDimenstion() {
    let gapList = this.gapList
    for (let gapObj of gapList) {
      gapObj.computeDimension()
    }
  }

  // 初始化没有设备的间隔范围
  initEmptyGapDimension(avgGapWidth, ymin, ymax) {
    let gapList = this.gapList

    let dimensionList = []
    // 计算当前正常

    for (let i = 0; i < gapList.length; i++) {
      let gapObj = gapList[i]
      let gapDimension = gapObj.dimension
      let p = gapObj.connectionPoint

      if (!gapDimension) {
        let xmin = p.x - avgGapWidth / 2
        let xmax = p.x + avgGapWidth / 2

        let tmpDim = new Dimension()
        tmpDim.init(xmin, ymin, xmax, ymax)
        gapObj.dimension = tmpDim
      }
    }
  }

  // 初始化
  getGapListDimension() {
    let gapList = this.gapList

    let dimensionList = []

    for (let i = 0; i < gapList.length; i++) {
      let gapObj = gapList[i]

      dimensionList.push(gapObj.dimension)
    }

    let dim = mathutil.dimensionListBounds(dimensionList)

    let dimension = new Dimension()
    dimension.init(dim.xmin, dim.ymin, dim.xmax, dim.ymax)

    return dimension
  }

  // 重算母线连接点
  resetConnection() {
    let graph = this.graph
    let model = this.model
    let busCell = this.busCell
    let gapList = this.gapList

    let busGeo = model.getGeometry(busCell)

    let width_bus = busGeo.width
    let height_bus = busGeo.height
    let x_bus = busGeo.x
    let y_bus = busGeo.y

    for (let { firstLine } of gapList) {
      let isSource = model.getTerminal(firstLine, true) == busCell ? true : false

      let lineGeo = model.getGeometry(firstLine)

      let p
      if (isSource) {
        p = lineGeo.sourcePoint
      } else {
        p = lineGeo.targetPoint
      }

      let ratioX = Math.abs(p.x - x_bus) / width_bus
      if (ratioX > 1) {
        ratioX = 1
      } else if (ratioX < 0) {
        ratioX = 0
      }
      if (isSource) {
        graph.setCellStyles('exitX', ratioX, [firstLine])
        graph.setCellStyles('exitY', 0.5, [firstLine])
      } else {
        graph.setCellStyles('entryX', ratioX, [firstLine])
        graph.setCellStyles('entryY', 0.5, [firstLine])
      }
    }
  }

  // 美化母线及间隔
  beautifyBus() {
    let model = this.model
    let busCell = this.busCell

    let gapList = this.gapList

    // 0、初始化间隔占用空间
    let region = this.getGapListDimension()

    let avgWidth = this.getAvgGapWidth()

    let spaceWidth = avgWidth / 4

    // 1、等距移动间隔
    let startX = 0
    for (let i = 0; i < gapList.length; i++) {
      let gapObj = gapList[i]
      let p = gapObj.connectionPoint
      let dimension = gapObj.dimension
      if (i == 0) {
        startX = dimension.xmax + spaceWidth
      } else {
        let pointCurrent = new Vector2(startX, 0)
        let pointPre = new Vector2(dimension.xmin, 0)

        // let step = startX - dimension.xmin;
        let vecStep = pointCurrent.clone().sub(pointPre)
        gapObj.moveGap(vecStep)

        startX = startX + dimension.width + spaceWidth
      }
    }

    // 2、重算母线大小
    let xmin = region.xmin - avgWidth / 2
    let xmax = region.xmax + avgWidth / 2

    let geo = model.getGeometry(busCell).clone()
    geo.x = xmin
    geo.width = Math.abs(xmax - xmin)

    model.setGeometry(busCell, geo)

    // 重置母线坐标范围
    this.initBusDimenstion()

    // 3、重算母线与连接线的连接点
    this.resetConnection()

    let txtId = 'TXT-' + busCell.id

    let txtCell = model.getCell(txtId)
    if (txtCell) {
      let cx = xmin + geo.width / 2

      let txtGeo = model.getGeometry(txtCell).clone()
      txtGeo.x = cx - txtGeo.width / 2
      txtGeo.y = geo.y - txtGeo.height / 2 - txtGeo.height

      model.setGeometry(txtCell, txtGeo)
    }
    // 4、初始化母线与间隔的整体坐标范围
    this.initDimension()
  }

  init() {
    let graph = this.graph
    let specialGapList = this.specialGapList
    let busCell = this.busCell
    let model = this.model
    let gapList = this.gapList

    this.initBusDimenstion()

    let edgeList = model.getEdges(busCell)

    for (let firstLine of edgeList) {
      let gap = new Gap(graph, busCell, firstLine)
      gapList.push(gap)
    }

    // 间隔正序
    gapList.sort((gap1, gap2) => {
      let vec1 = gap1.connectionPoint
      let vec2 = gap2.connectionPoint
      return vec1.x - vec2.x
    })

    // 寻找母联间隔
    for (let gap of gapList) {
      if (gap.oppositeBusCell) {
        specialGapList.push(gap)
      }
    }
  }
}
