/*
 * 图数学计算
 * drawio坐标系：x右，y下
 */
import GraphTool from './GraphTool.js'
import mathutil from '@/plugins/tmzx/mathutil.js'
import DeviceCategoryUtil from './DeviceCategoryUtil.js'

let priorVecList = []
let minorVecList = []
let thirdVecList = []

let priorAngle = [0, 90, 180, 270]
let minorAngle = [45, 135, 225, 315]
let thirdAngle = [22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5]
setTimeout(()=>{
  for (let degree of priorAngle) {
    let radian = mathutil.angle2Radian(degree)
    let x = Math.cos(radian)
    let y = Math.sin(radian)
    priorVecList.push(new Vector2(x, y))
  }
  for (let degree of minorAngle) {
    let radian = mathutil.angle2Radian(degree)
    let x = Math.cos(radian)
    let y = Math.sin(radian)
    minorVecList.push(new Vector2(x, y))
  }
  for (let degree of thirdAngle) {
    let radian = mathutil.angle2Radian(degree)
    let x = Math.cos(radian)
    let y = Math.sin(radian)
    thirdVecList.push(new Vector2(x, y))
  }
},500)


let GraphMath = {
  priorAngle: [0, 90, 180, 270], // 优先角度
  minorAngle: [45, 135, 225, 315], // 次要角度
  thirdAngle: [22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5],

  /**
   * 获取只有一个连接点的cell相连接的设备及夹角
   * drawio坐标系：x右，y下
   * @param graph
   * @param cell
   * @param symbolProp
   */
  getEdgeAttrOfOneTouchVertex(graph, cell) {
    let model = graph.getModel()

    // let symbolArr = symbolProp[cell.symbol];
    // let {a, b} = symbolArr;

    // 计算设备连接点坐标
    // let a_vec = GraphTool.getTouchPoint(graph, cell, a.x, a.y);
    // let b_vec = GraphTool.getTouchPoint(graph, cell, b.x, b.y);

    let edges = model.getEdges(cell)

    let touch2AttrMap = new Map([['o', []]])

    for (let edge of edges) {
      if (DeviceCategoryUtil.isUselessLine(edge)) {
        // 不处理临时线
        continue
      }
      // 获取线的矢量坐标
      let vecList = GraphTool.getEdgePointsVec(graph, edge)
      let pointsLen = vecList.length

      let isSource // 线的source是否是当前cell
      // 计算当前线的角度
      let p_line_start, p_line_end
      if (model.getTerminal(edge, true) == cell) {
        // 线的source连接cell
        isSource = true
        p_line_start = vecList[0]
        p_line_end = vecList[1]
      } // 线的target连接cell
      else {
        isSource = false
        p_line_start = vecList[pointsLen - 1]
        p_line_end = vecList[pointsLen - 2]
      }

      let vec = p_line_end.clone().sub(p_line_start)
      let lineAngle = mathutil.radian2Angle(vec.angle())

      touch2AttrMap.get('o').push({
        isSource, // 线的source是否是当前cell
        edge, // 当前线
        lineAngle, // 线的角度
        vecList,
        pointStart: p_line_start,
        pointEnd: p_line_end,
        dir: vec.clone().normalize()
      })
    }
    return touch2AttrMap
  },

  /**
   * 获取有两个连接点的cell相连接的设备及夹角
   * @param graph
   * @param cell
   * @param symbolProp
   * @returns {Map<string, *[]>}
   */
  getEdgeAttrOfTwoTouchVertex(graph, cell, symbolProp) {
    let model = graph.getModel()

    let symbolArr = symbolProp[cell.symbol]
    let { a, b } = symbolArr

    // 计算设备连接点坐标
    let a_vec = GraphTool.getTouchPoint(graph, cell, a.x, a.y)
    let b_vec = GraphTool.getTouchPoint(graph, cell, b.x, b.y)

    let edges = model.getEdges(cell)

    let touch2AttrMap = new Map([
      ['a', []],
      ['b', []]
    ])

    for (let edge of edges) {
      if (DeviceCategoryUtil.isUselessLine(edge)) {
        continue
      }
      let vecList = GraphTool.getEdgePointsVec(graph, edge)
      let pointsLen = vecList.length

      let curP = null
      let curTouch

      let isSource // 线的source是否是当前cell
      // 计算当前线的角度
      let p_line_start, p_line_end
      if (model.getTerminal(edge, true) == cell) {
        // 线的source连接cell
        isSource = true
        curP = vecList[0]
        p_line_start = vecList[0]
        p_line_end = vecList[1]
      } // 线的target连接cell
      else {
        isSource = false
        curP = vecList[vecList.length - 1]
        p_line_start = vecList[pointsLen - 1]
        p_line_end = vecList[pointsLen - 2]
      }

      let lineAngle = mathutil.radian2Angle(p_line_end.clone().sub(p_line_start).angle())

      let lenA = a_vec.clone().sub(curP)
      let lenB = b_vec.clone().sub(curP)

      // 计算连接点和设备方向向量
      let vecDir // 从连接点到设备对面的方向向量
      if (lenA < lenB) {
        // 当前线连接到a点
        curTouch = 'a'
        vecDir = b_vec.clone().sub(a_vec)
      } // 当前线连接到b点
      else {
        curTouch = 'b'
        vecDir = a_vec.clone().sub(b_vec)
      }

      touch2AttrMap.get(curTouch).push({
        isSource, // 线的source是否是当前cell
        edge, // 当前线
        vecDir, // 设备方向向量
        lineAngle, // 线的角度
        vecList
      })
    }
    return touch2AttrMap
  },
  /**
   * 获取当前cell连接点的线的属性信息，包括线角度、全局坐标
   * drawio坐标系
   * @param graph
   * @param cell
   * @param symbolProp
   */
  getEdgeAttrOfTouch(graph, cell, symbolProp) {
    let model = graph.getModel()

    let symbolArr = symbolProp[cell.symbol]

    // 获取当前cell的连接点个数
    let touchSize = symbolArr.touchs

    if (touchSize == 1) {
      return this.getEdgeAttrOfOneTouchVertex(graph, cell, symbolProp)
    } else {
      return this.getEdgeAttrOfTwoTouchVertex(graph, cell, symbolProp)
    }
  },
  /**
   * 根据已有角度计算最优角度（对于单连接点设备）
   * @param list 已经存在的线的角度
   */
  getOptimalAngle_bak(list) {
    let step = 10

    // 1、查找最优角度
    for (let angle of this.priorAngle) {
      let isPass = true
      for (let angle2 of list) {
        if (Math.abs(angle - angle2) < step) {
          isPass = false
        }
      }
      if (isPass) {
        return angle
      }
    }

    // 2、查找次优角度
    for (let angle of this.minorAngle) {
      let isPass = true
      for (let angle2 of list) {
        if (Math.abs(angle - angle2) < step) {
          isPass = false
        }
      }
      if (isPass) {
        return angle
      }
    }

    // 3、22.5
    for (let angle of this.thirdAngle) {
      let isPass = true
      for (let angle2 of list) {
        if (Math.abs(angle - angle2) < step) {
          isPass = false
        }
      }
      if (isPass) {
        return angle
      }
    }
    return 0
  },
  getOptimalAngle(dirList) {
    let step = 10
    // 1、查找最优角度
    for (let vec of priorVecList) {
      let isPass = true
      for (let dir of dirList) {
        let angle = mathutil.vecAngle(vec, dir)
        if (angle < step) {
          isPass = false
          break
        }
      }
      if (isPass) {
        let angle = mathutil.radian2Angle(vec.angle())
        return { angle, dir: vec }
      }
    }

    // 2、查找次优角度
    for (let vec of minorVecList) {
      let isPass = true
      for (let dir of dirList) {
        let angle = mathutil.vecAngle(vec, dir)
        if (angle < step) {
          isPass = false
          break
        }
      }
      if (isPass) {
        let angle = mathutil.radian2Angle(vec.angle())
        return { angle, dir: vec }
      }
    }

    // 3、22.5
    for (let vec of thirdVecList) {
      let isPass = true
      for (let dir of dirList) {
        let angle = mathutil.vecAngle(vec, dir)
        if (angle < step) {
          isPass = false
          break
        }
      }
      if (isPass) {
        let angle = mathutil.radian2Angle(vec.angle())
        return { angle, dir: vec }
      }
    }
    return { angle: 0, dir: new Vector2(1, 0) }
  },
  /**
   * 获取targetCell相对中心relCell所在的区域
   * @param graph
   * @param relCell
   * @param targetCell
   */
  getCellRegion(graph, relCell, targetCell) {
    let model = graph.getModel()
    let relGeo = model.getGeometry(relCell)
    let targetGeo = model.getGeometry(targetCell)
    let vecRel = new Vector2(relGeo.getCenterX(), relGeo.getCenterY())
    let vecTarget = new Vector2(targetGeo.getCenterX(), targetGeo.getCenterY())
    let vec = vecRel.clone().sub(vecTarget)

    let angle = mathutil.radian2Angle(vec.angle())

    if ((angle >= 0 && angle <= 45) || (angle <= 360 && angle >= 315)) {
      return 'right'
    } else if (angle >= 45 && angle <= 135) {
      return 'bottom'
    } else if (angle >= 135 && angle <= 225) {
      return 'left'
    } else {
      return 'top'
    }
  }
}
export default GraphMath
