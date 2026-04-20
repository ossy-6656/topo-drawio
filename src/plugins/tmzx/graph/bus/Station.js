import GraphTool from '@/plugins/tmzx/graph/GraphTool.js'
import Bus from '@/plugins/tmzx/graph/bus/Bus.js'
import GapUtil from '@/plugins/tmzx/graph/bus/GapUtil.js'
import mathutil from '@/plugins/tmzx/mathutil.js'
import DeviceCategoryUtil from '@/plugins/tmzx/graph/DeviceCategoryUtil.js'

export default class Station {
  constructor(graph, groupCell) {
    this.graph = graph
    this.model = graph.getModel()
    this.groupCell = groupCell
    this.stationCell = GraphTool.getStationCell(graph, groupCell)
    this.busObjList = []
    this.busMap = new Map()
    this.gridList = [] // 站房母线按行存储
    this.maxBusHeight = -1

    this.init()
  }

  getGapObjByFirstLine(busObj, firstLine) {
    for (let gapObj of busObj.gapList) {
      if (gapObj.firstLine == firstLine) {
        return gapObj
      }
    }
  }

  // 检测站房是否可以处理
  checkStationValidate() {
    let graph = this.graph
    let model = this.model
    let busMap = this.busMap
    let groupCell = this.groupCell

    let list = model.getChildren(groupCell)
    for (let cell of list) {
      if (model.isVertex(cell)) {
        if (DeviceCategoryUtil.isTextCell(cell)) {
          continue
        }

        if (DeviceCategoryUtil.isStationCell(cell)) {
          continue
        }

        if (DeviceCategoryUtil.isBusCell(cell)) {
          continue
        }

        return true
      }
    }
    return false
  }

  // 母线数据分组，并排序
  groupAndSortBus() {
    let maxBusHeight = this.maxBusHeight
    let gridList = this.gridList
    let busObjList = this.busObjList

    let keys = new Set()

    // 1、分组
    // 检查两个母线是否在一行上，按母线最大高度当作参考
    let checkOneRow = (preBusObj, busObj) => {
      let preDimension = preBusObj.busDimension
      let curDimension = busObj.busDimension

      let preY = preDimension.ymin
      let curY = curDimension.ymin

      return Math.abs(preY - curY) <= maxBusHeight
    }

    for (let busObj of busObjList) {
      if (keys.has(busObj)) {
        continue
      }

      keys.add(busObj)

      let isFindExistRow = false // 是否找到已存在的行
      for (let arr of gridList) {
        if (checkOneRow(arr[0], busObj)) {
          arr.push(busObj)
          isFindExistRow = true
        }
      }

      // 没有找到对应的行，代表是新行的母线
      if (!isFindExistRow) {
        gridList.push([busObj])
      }
    }

    // 2、排序母线
    for (let arr of gridList) {
      arr.sort((busObj1, busObj2) => busObj1.busDimension.xmin - busObj2.busDimension.xmin)
    }
  }

  // 计算间隔设备母线归属
  computeCellsBelongTo(gapObj) {
    let graph = this.graph
    let model = this.model
    let busMap = this.busMap

    let { list, busCell, oppositeBusCell, oppositeFirstLine } = gapObj

    // 注意：母线已经排过序
    let selfBusObj = busMap.get(busCell.id) // 左侧母线
    let oppositeBusObj = busMap.get(oppositeBusCell.id) // 右侧母线

    let oppositeGapObj = this.getGapObjByFirstLine(oppositeBusObj, oppositeFirstLine)

    let left_x_max = selfBusObj.busDimension.xmax
    let right_x_min = oppositeBusObj.busDimension.xmin

    let leftList = []
    let midList = []
    let rightList = []

    for (let cell of list) {
      let vecList = GraphTool.getCellPointsCommon(graph, cell)
      let tmpDimension = mathutil.vecListBounds(vecList)

      if (tmpDimension.xmax <= left_x_max) {
        // 当前cell在左侧母线之下
        leftList.push(cell)
      } else if (tmpDimension.xmin >= right_x_min) {
        // 当前cell在右侧母线之下
        rightList.push(cell)
      } else {
        midList.push(cell)
      }
    }

    gapObj.cellList = leftList
    gapObj.midList = midList

    oppositeGapObj.cellList = rightList
    oppositeGapObj.midList = midList
  }

  // 母联设备分类
  classifyBusConnectionLine() {
    // let busMap = this.busMap;
    let busObjList = this.busObjList

    // 用于判断间隔是否已经处理
    let keys = new Set()

    for (let busObj of busObjList) {
      let specialGapList = busObj.specialGapList

      if (specialGapList.length == 0) {
        // 没有母联间隔
        continue
      }

      for (let gapObj of specialGapList) {
        let selfBusCell = gapObj.busCell
        let oppositeBusCell = gapObj.oppositeBusCell

        if (keys.has(selfBusCell) && keys.has(oppositeBusCell)) {
          continue
        }

        keys.add(selfBusCell)
        keys.add(oppositeBusCell)

        this.computeCellsBelongTo(gapObj)
      }
    }
  }

  // 间隔坐标范围初始化及重新计算间隔距离
  reCalculateGapDistance(avgGapWidth) {
    let graph = this.graph
    let model = this.model

    let stationCell = this.stationCell
    let busMap = this.busMap
    let busObjList = this.busObjList
    // let gridList = this.gridList;

    let dimensionList = []

    let widthSum = 0
    let widthCounter = 0
    // 初始化间隔坐标范围
    for (let busObj of busObjList) {
      busObj.beautifyBus()
      dimensionList.push(busObj.dimension)

      widthSum = widthSum + busObj.avgWidth
      widthCounter = widthCounter + 1
    }

    let avgWidth = widthSum / widthCounter

    let spaceWidth = avgWidth / 2
    let region = mathutil.dimensionListBounds(dimensionList)

    // 重算站房大小
    let stationGeo = model.getGeometry(stationCell).clone()

    stationGeo.x = region.xmin - spaceWidth
    stationGeo.y = region.ymin - spaceWidth
    stationGeo.width = region.width + spaceWidth * 2
    stationGeo.height = region.height + spaceWidth * 2

    model.setGeometry(stationCell, stationGeo)
  }

  // 初始化正常间隔坐标范围
  initGapDimenstion() {
    let graph = this.graph
    let model = this.model
    let busObjList = this.busObjList

    let avgWidth
    let counter = 0
    let widthSum = 0

    let ymin = Number.MAX_VALUE,
      ymax = Number.MIN_VALUE

    for (let busObj of busObjList) {
      busObj.initGapDimenstion()
      for (let gapObj of busObj.gapList) {
        let dimension = gapObj.dimension
        if (dimension) {
          counter = counter + 1
          widthSum = widthSum + dimension.width

          if (dimension.ymin < ymin) {
            ymin = dimension.ymin
          }

          if (dimension.ymax > ymax) {
            ymax = dimension.ymax
          }
        }
      }
    }

    avgWidth = widthSum / counter
    return {
      avgWidth,
      ymin,
      ymax
    }
  }

  initEmptyGapDimension(avgGapWidth, ymin, ymax) {
    let busObjList = this.busObjList
    for (let busObj of busObjList) {
      busObj.initEmptyGapDimension(avgGapWidth, ymin, ymax)
    }
  }

  init() {
    let graph = this.graph
    let model = this.model
    let busMap = this.busMap
    let groupCell = this.groupCell

    let busObjList = this.busObjList

    // 检测站房是否有设备，没有设备不处理，没有参考
    let isValidate = this.checkStationValidate()
    if (!isValidate) {
      return
    }

    // 获取母线列表
    let busCellList = GraphTool.getBus(graph, groupCell)

    // 注意：初始化后，对于母联间隔还没有计算归属
    // 获取最大母线高度
    let maxBusHeight = -1
    for (let busCell of busCellList) {
      // 创建母线，初始化母线，间隔
      let busObj = new Bus(graph, busCell)
      busObjList.push(busObj)
      busMap.set(busObj.id, busObj)

      if (maxBusHeight == -1) {
        maxBusHeight = busObj.busDimension.height
      } else if (maxBusHeight < busObj.busDimension.height) {
        maxBusHeight = busObj.busDimension.height
      }
    }

    this.maxBusHeight = maxBusHeight

    // 母线分组，排序
    this.groupAndSortBus()

    // 母联设备分配
    this.classifyBusConnectionLine()

    // 计算平均间隔宽度，及正常的间隔y坐标范围，用于没有设备的间隔
    let { avgWidth: avgGapWidth, ymin, ymax } = this.initGapDimenstion()
    this.initEmptyGapDimension(avgGapWidth, ymin, ymax)

    // 重新计算间隔距离
    this.reCalculateGapDistance(avgGapWidth)

    GraphTool.autosize(graph, [groupCell])
  }
}
