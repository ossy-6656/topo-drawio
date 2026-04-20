import GraphTool from '@/plugins/tmzx/graph/GraphTool'
import mathutil from '@/plugins/tmzx/mathutil'
import TextUtil from '@/plugins/tmzx/graph/TextUtil'
import TextHandler from '@/plugins/tmzx/graph/TextHandler'

/**
 * 这个对象处理与拖动相关的操作
 * @type {{stationBreakerDraggerHandler(*, *, *): void}}
 */
let DragHandler = {
  /**
   * 与变电站相连接的开关拖动处理
   * @param graph
   * @param cell             拖动的开关
   * @param symbolObj        开关图元对象
   * @param substationCell   变电站
   * @param gapDev           设备间间距
   * @param gapTxt           设备与文本之间间距
   */
  stationBreakerDraggerHandler(graph, cell, symbolObj, substationCell, gapDev, gapTxt) {
    let model = graph.getModel()

    // 两个设备之间的连线
    let linkedEdge = model.getEdgesBetween(cell, substationCell)[0]

    let startVec = GraphTool.getTouchPoint(graph, cell, 0, 0.5)
    let endVec = GraphTool.getTouchPoint(graph, cell, 1, 0.5)

    let stationGeo = model.getGeometry(substationCell)

    let r = stationGeo.width / 2
    let cx = stationGeo.getCenterX()
    let cy = stationGeo.getCenterY()

    let cellGeo = model.getGeometry(cell)
    let vecCellCenter = new Vector2(cellGeo.getCenterX(), cellGeo.getCenterY())

    // 1、计算线与变电站的连接点
    if (substationCell.psrtype == 'zf04') {
      let { x, y } = vecCellCenter
      let xinner = x >= stationGeo.x && x <= stationGeo.x + stationGeo.width
      let yinner = y >= stationGeo.y && y <= stationGeo.y + stationGeo.height

      let isStationSource = model.getTerminal(linkedEdge, true) == substationCell ? true : false

      let ratioX = 0.5,
        ratioY = 0.5
      if (xinner && y < stationGeo.y) {
        // 上
        ratioX = (x - stationGeo.x) / stationGeo.width
        ratioY = 0
      } else if (yinner && x > stationGeo.x + stationGeo.width) {
        // 右
        ratioX = 1
        ratioY = (y - stationGeo.y) / stationGeo.height
      } else if (xinner && y > stationGeo.y + stationGeo.height) {
        // 下
        ratioX = (x - stationGeo.x) / stationGeo.width
        ratioY = 1
      } else if (yinner && x < stationGeo.x) {
        //左
        ratioX = 0
        ratioY = (y - stationGeo.y) / stationGeo.height
      }

      if (isStationSource) {
        graph.setCellStyles('exitX', ratioX, [linkedEdge])
        graph.setCellStyles('exitY', ratioY, [linkedEdge])
      } else {
        graph.setCellStyles('entryX', ratioX, [linkedEdge])
        graph.setCellStyles('entryY', ratioY, [linkedEdge])
      }
    } else {
      let { A, B, C } = mathutil.lineEquationFromTwoPoints(
        startVec.x,
        startVec.y,
        endVec.x,
        endVec.y
      )
      const intersections = mathutil.lineCircleIntersection(A, B, C, cx, cy, r)
      if (intersections.length > 0) {
        // 如果与变电站有连接点
        let point
        if (intersections.length == 2) {
          // 如果与变电站有两个连接点
          let p1 = intersections[0]
          let p2 = intersections[1]
          let vec1 = new Vector2(p1.x, p1.y)
          let vec2 = new Vector2(p2.x, p2.y)

          let len1 = vecCellCenter.clone().sub(vec1).length()
          let len2 = vecCellCenter.clone().sub(vec2).length()

          point = len1 < len2 ? p1 : p2
        } else {
          let p = intersections[0]
          point = new Vector2(p.x, p.y)
        }

        let vecLT = new Vector2(stationGeo.x, stationGeo.y)
        let dx = Math.abs(point.x - vecLT.x)
        let dy = Math.abs(point.y - vecLT.y)
        let ratioX = dx / stationGeo.width
        let ratioY = dy / stationGeo.height

        if (model.getTerminal(linkedEdge, true) == substationCell) {
          graph.setCellStyles('exitX', ratioX, [linkedEdge])
          graph.setCellStyles('exitY', ratioY, [linkedEdge])
        } else {
          graph.setCellStyles('entryX', ratioX, [linkedEdge])
          graph.setCellStyles('entryY', ratioY, [linkedEdge])
        }
      } else {
        if (model.getTerminal(linkedEdge, true) == substationCell) {
          graph.setCellStyles('exitX', 0.5, [linkedEdge])
          graph.setCellStyles('exitY', 0.5, [linkedEdge])
        } else {
          graph.setCellStyles('entryX', 0.5, [linkedEdge])
          graph.setCellStyles('entryY', 0.5, [linkedEdge])
        }
      }
    }

    // 处理文字
    let txtId = 'TXT-' + cell.id
    let txtCell = model.getCell(txtId)
    if (txtCell) {
      TextHandler.repositionText(graph, cell, symbolObj, txtCell, gapTxt)
    }

    let pointId = 'Point-' + cell.id
    let pointCell = model.getCell(pointId)
    if (pointCell) {
      TextHandler.repositionText(graph, cell, symbolObj, pointCell, gapTxt)
    }

    // 2、如果有站内出线点则重新计算连接点
    let counter = 0
    let keys = new Set()

    // 查找 出线 点设备
    let findJunctionHandler = (curCell) => {
      if (!curCell) {
        return null
      }

      if (counter > 20) {
        return null
      }

      if (keys.has(curCell)) {
        return null
      }

      let cStyle = TextUtil.parseDrawioStyle(curCell.style)
      if (cStyle.shape && cStyle.shape.indexOf('junction') != -1) {
        return curCell
      }

      keys.add(curCell)
      counter++

      let edges = model.getEdges(curCell)
      for (let edge of edges) {
        let tmpCell = GraphTool.getAdjacentCellOfEdge(graph, edge, curCell)
        let c1 = findJunctionHandler(tmpCell)
        if (c1 != null) {
          return c1
        }
      }
      return null
    }

    let junctionCell = findJunctionHandler(cell)
    if (!junctionCell) {
      return
    }

    let ratioX, ratioY
    let lineStyle = TextUtil.parseDrawioStyle(linkedEdge.style)

    if (model.getTerminal(linkedEdge, true) == cell) {
      // 如果源点连接开关
      ratioX = +lineStyle.exitX
      ratioY = +lineStyle.exitY
    } else {
      ratioX = +lineStyle.entryX
      ratioY = +lineStyle.entryY
    }

    let point
    let width = cellGeo.width
    let dirVec
    if (ratioX < 0.5) {
      dirVec = endVec.clone().sub(startVec).normalize()
      point = endVec
    } else {
      dirVec = startVec.clone().sub(endVec).normalize()
      point = startVec
    }

    let angle = mathutil.radian2Angle(dirVec.angle())

    let vecTarget = dirVec.clone().multiplyScalar(gapDev).add(point)
    graph.setCellStyles('rotation', angle, [junctionCell])

    let junctionCellClone = model.getGeometry(junctionCell).clone()
    junctionCellClone.x = vecTarget.x - junctionCellClone.width / 2
    junctionCellClone.y = vecTarget.y - junctionCellClone.height / 2
    model.setGeometry(junctionCell, junctionCellClone)
  }
}

export default DragHandler
