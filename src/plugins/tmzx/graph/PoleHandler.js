import DeviceCategoryUtil from './DeviceCategoryUtil.js'
import GraphHandler from './GraphHandler.js'
import GisUtil from './GisUtil.js'
import GraphTool from './GraphTool.js'
import mathutil from '../mathutil.js'
import TextUtil from '@/plugins/tmzx/graph/TextUtil'

// 0103：  杆塔

// 所有与杆塔相连接的要处理设备
// 0116：  避雷器
// 0115：  跌落式熔断器
// 0110：  柱变
// 0111：  柱上断路器 （这个不再处理）
// 370000：用户接入点
// 0113：  柱上隔离开关
// 0811003：杆故指

// 需要处理的设备
let devUpdateSet = new Set(['0116', '0110', '0115', '0113', '370000', '0811003'])

let PoleHandler = {
  /**
   * 从选中的cells中查找临接cell数组
   * @param graph
   * @param sections
   * @returns {*[]}
   */
  findAdjacentCellsFromSections(graph, sections) {
    let model = graph.getModel()

    let list = []

    let keyCell = new Set([...sections])

    let findAdjacentCellFun = (cell) => {
      let edges = model.getEdges(cell)
      for (let edge of edges) {
        let c1 = model.getTerminal(edge, true)
        let c2 = model.getTerminal(edge, false)
        if (c1 == cell && !keyCell.has(c2)) {
          return c2
        } else if (c2 == cell && !keyCell.has(c1)) {
          return c1
        }
      }

      return null
    }

    for (let cell of sections) {
      let c = findAdjacentCellFun(cell)
      if (c) {
        list.push(c)
      }
    }

    return list
  },
  /**
   * 从选中的设备找到连接的杆塔
   * @param graph
   * @param list
   * @returns {*}
   */
  getLinkedPoleOrCableFromSelection(graph, cell) {
    let model = graph.getModel()
    if (!cell) {
      return null
    }

    let edges = model.getEdges(cell)
    for (let edge of edges) {
      let c1 = model.getTerminal(edge, true)
      let c2 = model.getTerminal(edge, false)

      if (
        c1 == cell &&
        (DeviceCategoryUtil.isPoleCell(c2) || DeviceCategoryUtil.isCableTerminalCell(c2))
      ) {
        return c2
      } else if (
        c2 == cell &&
        (DeviceCategoryUtil.isPoleCell(c1) || DeviceCategoryUtil.isCableTerminalCell(c1))
      ) {
        return c1
      }
    }
    return null
  },
  // 检测当前路径是否可能通过（限制路径中的cell数量5）
  checkRouterPass(graph, preCell, curCell, limit = 5) {
    let model = graph.getModel()
    let counter = 0

    let psrtypeSet = new Set()

    let keys = new Set()
    keys.add(preCell)

    let isPidExist = false

    let pathCellCounter = (preCell, curCell) => {
      if (!curCell) {
        return
      }

      if (keys.has(curCell)) {
        return
      }

      // 文本退出
      if (DeviceCategoryUtil.isTextCell(curCell)) {
        // 文本节点退出
        return
      }

      if (DeviceCategoryUtil.isUselessLine(curCell)) {
        return
      }

      // 如果是站内设备-退出
      if (curCell.pid || (curCell.parent && curCell.parent.isVertex())) {
        isPidExist = true
        return
      }

      keys.add(curCell)
      psrtypeSet.add(curCell.psrtype)

      if (counter + 1 > limit) {
        counter++
        return
      }
      counter++

      let edges = model.getEdges(curCell)

      for (let edge of edges) {
        let adjacentCell = GraphTool.getAdjacentCellOfEdge(graph, edge, curCell)
        pathCellCounter(curCell, adjacentCell)
      }
    }

    pathCellCounter(preCell, curCell)

    // 没有0103：杆塔、0202：终端头
    let valid = !psrtypeSet.has('0202') || !psrtypeSet.has('0103')

    if (counter <= 5 && valid && !isPidExist) {
      return true
    } else {
      return false
    }
  },
  /**
   * 从选中的设备中获取targetCell的连接设备
   * @param graph
   * @param cell
   * @param sections
   * @returns {*}
   */
  getLinkedCellOfTargetCellFromSelections(graph, targetCell, sections) {
    let model = graph.getModel()

    let keyCell = new Set([...sections])

    let edges = model.getEdges(targetCell)
    for (let edge of edges) {
      let c1 = model.getTerminal(edge, true)
      let c2 = model.getTerminal(edge, false)
      if (c1 == targetCell && keyCell.has(c2)) {
        return c2
      } else if (c2 == targetCell && keyCell.has(c1)) {
        return c1
      }
    }

    return null
  },
  // 计算杆塔至最近cell的角度
  getAngleOfPoleCellToColsedCell(graph, poleCell, closestCell) {
    let model = graph.getModel()

    let edge = GraphTool.getEdgeBetweenCells(graph, poleCell, closestCell)

    let isPoleSource = model.getTerminal(edge, true) == poleCell ? true : false

    let poleRatioX, poleRatioY
    let cellRatioX, cellRatioY

    let styleObj = TextUtil.parseDrawioStyle(edge.style)

    if (isPoleSource) {
      poleRatioX = +styleObj.exitX
      poleRatioY = +styleObj.exitY

      cellRatioX = +styleObj.entryX
      cellRatioY = +styleObj.entryY
    } else {
      poleRatioX = +styleObj.entryX
      poleRatioY = +styleObj.entryY

      cellRatioX = +styleObj.exitX
      cellRatioY = +styleObj.exitY
    }
    let pstart = GraphTool.getTouchPoint(graph, poleCell, poleRatioX, poleRatioY)
    let pend = GraphTool.getTouchPoint(graph, closestCell, cellRatioX, cellRatioY)

    let dir = pend.clone().sub(pstart)

    let angle = mathutil.radian2Angle(dir.angle())

    angle = mathutil.snapAngle(angle)

    return angle
  },

  /**
   * 根据鼠标与杆塔射线排列设备
   * @param graph
   * @param curParam
   * @param symbolMap
   * @param sourceCell
   * @param closestCell
   * @param gap
   * @param gapTxt
   * @param evt
   */
  rayArrangeForPole(graph, symbolMap, sourceCell, closestCell, gap, gapTxt) {
    let model = graph.getModel()
    if (!sourceCell) {
      return
    }
    // let clientX = evt.clientX;
    // let clientY = evt.clientY;

    // let vec = GisUtil.pixel2drawio(curParam, clientX, clientY);

    // let geoPole = model.getGeometry(poleCell);
    // let vecPole = new Vector2(geoPole.getCenterX(), geoPole.getCenterY());

    // let dir = vec.clone().sub(vecPole);
    //
    // let angle = mathutil.radian2Angle(dir.angle());
    //
    // angle = mathutil.snapAngle(angle);

    let angle = this.getAngleOfPoleCellToColsedCell(graph, sourceCell, closestCell)

    let edge = GraphTool.getEdgeBetweenCells(graph, sourceCell, closestCell)

    // 用于滤重
    let keys = new Set()

    // 0103：  杆塔

    // 所有与杆塔相连接的要处理设备
    // 0116：  避雷器
    // 0115：  跌落式熔断器
    // 0110：  柱变
    // 0111：  柱上断路器 （这个不再处理）
    // 370000：用户接入点
    // 0113：  柱上隔离开关
    // 0811003：杆故指

    // 需要处理的设备
    let devUpdateSet = new Set([
      '0116',
      '0110',
      '0115',
      '0112',
      '0111',
      '0113',
      '370000',
      '0811003'
    ])

    /**
     * 开始重新计算位置
     * @param cell
     */
    let calculateHandler = (preCell, linkedEdge, curCell, perfectAngle) => {
      if (!curCell) {
        return
      }

      if (keys.has(curCell)) {
        // 已遍历过退出
        return
      }

      if (curCell.parent && curCell.parent.isVertex()) {
        // 不处理站内设备，会出异常
        return
      }

      if (!devUpdateSet.has(curCell.psrtype)) {
        // 非处理设备退出
        return
      }

      if (!model.isVertex(curCell)) {
        // 非设备退出
        return
      }

      if (DeviceCategoryUtil.isTextCell(curCell)) {
        // 文本设备退出
        return
      }

      keys.add(curCell)

      // resetDistance(preCell, linkedEdge, curCell, perfectAngle);
      GraphHandler.resetDistanceStraightLine(
        graph,
        symbolMap,
        preCell,
        linkedEdge,
        curCell,
        perfectAngle,
        gap,
        gapTxt
      )

      let edgeList = model.getEdges(curCell)

      // 寻找相邻节点
      for (let edge of edgeList) {
        let adjacentCell = GraphTool.getAdjacentCellOfEdge(graph, edge, curCell) // 获取当前cell相连接的cell
        calculateHandler(curCell, edge, adjacentCell, perfectAngle)
      }
    }
    calculateHandler(sourceCell, edge, closestCell, angle)
  },
  /**
   * 计算由preCell（不包括）出发，经curCell的径长度
   * @param graph
   * @param preCell
   * @param curCell
   * @param limit      最高限制查找多少个
   * @returns {number}
   */
  getPathCellCounter(graph, preCell, curCell, limit = 5) {
    let model = graph.getModel()
    let counter = 0

    let keys = new Set()
    keys.add(preCell)

    let pathCellCounter = (preCell, curCell) => {
      if (!curCell) {
        return
      }

      if (DeviceCategoryUtil.isTextCell(curCell)) {
        // 文本节点退出
        return
      }

      if (DeviceCategoryUtil.isUselessLine(curCell)) {
        return
      }

      if (curCell.pid) {
        return
      }

      if (keys.has(curCell)) {
        return
      }

      keys.add(curCell)

      if (counter + 1 > limit) {
        counter++
        return
      }
      counter++

      let edges = model.getEdges(curCell)

      for (let edge of edges) {
        let adjacentCell = GraphTool.getAdjacentCellOfEdge(graph, edge, curCell)
        pathCellCounter(curCell, adjacentCell)
      }
    }

    pathCellCounter(preCell, curCell)

    return counter
  },

  getPathCells(graph, preCell, curCell) {
    let model = graph.getModel()

    let keys = new Set()
    keys.add(preCell)

    let list = []

    let keysStation // 用用判断站房的分支

    let counterJrd = 0
    let checkIsStationExist = (preCell, curCell) => {
      if (keysStation.has(curCell)) {
        return
      }

      // 文本退出
      if (DeviceCategoryUtil.isTextCell(curCell)) {
        // 文本节点退出
        return
      }

      // 临时线也退出
      if (DeviceCategoryUtil.isUselessLine(curCell)) {
        return
      }

      counterJrd = counterJrd + 1
      if (curCell.parent && curCell.parent.isVertex()) {
        return
      }

      if (counterJrd > 3) {
        return
      }

      keysStation.add(curCell)

      let edgeList = model.getEdges(curCell)
      for (let _e of edgeList) {
        let oppositeCell = GraphTool.getAdjacentCellOfEdge(graph, _e, curCell)
        // 如果紧连接站房，不处理
        checkIsStationExist(curCell, oppositeCell)
      }
    }

    let pathCellCounter = (preCell, curCell) => {
      if (!curCell) {
        return
      }

      if (keys.has(curCell)) {
        return
      }

      if (!devUpdateSet.has(curCell.psrtype)) {
        return
      }

      if (curCell.parent && curCell.parent.isVertex()) {
        return
      }

      keys.add(curCell)
      list.push(curCell)

      let edges = model.getEdges(curCell)

      for (let edge of edges) {
        let adjacentCell = GraphTool.getAdjacentCellOfEdge(graph, edge, curCell)
        pathCellCounter(curCell, adjacentCell)
      }
    }

    pathCellCounter(preCell, curCell)

    return list
  },

  /**
   * 移动与杆塔想关联的柱上设备
   * @param graph
   * @param poleCell
   * @param dx
   * @param dy
   */
  moveCellsOfPoleOrCable(graph, poleCell, dx, dy) {
    let model = graph.getModel()
    let edgeList = model.getEdges(poleCell)
    let list = []

    let limit = 5

    for (let edge of edgeList) {
      let curCell = GraphTool.getAdjacentCellOfEdge(graph, edge, poleCell)

      if (!this.checkRouterPass(graph, poleCell, curCell, limit)) {
        // 如果连接设备是杆塔、终端头，跳过
        continue
      }

      let tmpList = this.getPathCells(graph, poleCell, curCell)

      list.push(...tmpList)
    }

    for (let cell of list) {
      // 处理设备
      let geoClone = model.getGeometry(cell).clone()
      geoClone.x = geoClone.x + dx
      geoClone.y = geoClone.y + dy

      model.setGeometry(cell, geoClone)

      // 处理文本
      let txtId = 'TXT-' + cell.id
      let txtCell = model.getCell(txtId)
      if (txtCell) {
        let geoTxtClone = model.getGeometry(txtCell).clone()
        geoTxtClone.x = geoTxtClone.x + dx
        geoTxtClone.y = geoTxtClone.y + dy

        model.setGeometry(txtCell, geoTxtClone)
      }

      let pointId = 'Point-' + cell.id
      let pointCell = model.getCell(pointId)
      if (pointCell) {
        let geoTxtClone = model.getGeometry(pointCell).clone()
        geoTxtClone.x = geoTxtClone.x + dx
        geoTxtClone.y = geoTxtClone.y + dy

        model.setGeometry(pointCell, geoTxtClone)
      }
    }

    // 处理杆塔文本
    let txtId = 'TXT-' + poleCell.id
    let txtCell = model.getCell(txtId)
    if (txtCell) {
      let geoTxtClone = model.getGeometry(txtCell).clone()
      geoTxtClone.x = geoTxtClone.x + dx
      geoTxtClone.y = geoTxtClone.y + dy

      model.setGeometry(txtCell, geoTxtClone)
    }
  }
}

export default PoleHandler
