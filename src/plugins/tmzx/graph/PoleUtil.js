import { array } from 'vue-types'
import mathutil from '../mathutil.js'
import GraphMath from '@/plugins/tmzx/graph/GraphMath.js'
import GisUtil from '@/plugins/tmzx/graph/GisUtil.js'
import GraphTool from '@/plugins/tmzx/graph/GraphTool.js'
import DeviceCategoryUtil from './DeviceCategoryUtil.js'
// / 需要处理的设备
// let devUpdateSet = new Set(['0103'])
let devUpdateSet = new Set([])
let PoleUtil = {
  symbolProp: null,
  // 优化所有两个塔杆之间距离 以及塔杆下电缆终端头的位置优化
  getPole2PoleLen(graph, symbolProp, gap) {
    this.symbolProp = symbolProp
    const model = graph.getModel()
    const poleCells = this.getAllPole(graph)
    if (poleCells && poleCells.length) {
      poleCells.reduce((_, cell, index) => {
        const cellRelations = this.getRelation(graph, cell, symbolProp)
        if (cellRelations && cellRelations.length) {
          poleCells.slice(index + 1).forEach((nextCell) => {
            const cellGeometry = cell.geometry.clone()
            const nextCellGeometry = nextCell.geometry.clone()
            const p1Center = mathutil.cellCenter(cellGeometry)
            const p2Center = mathutil.cellCenter(nextCellGeometry)
            const pole2PoleLen = mathutil.pixelLen(p1Center, p2Center)
            const nextCellRelations = this.getRelation(graph, nextCell, symbolProp)
            if (nextCellRelations && nextCellRelations.length) {
              if (pole2PoleLen < gap) {
                // 计算需要移动的距离
                const deltaDistance = gap - pole2PoleLen
                const angle = Math.atan2(p2Center.y - p1Center.y, p2Center.x - p1Center.x)
                const offsetX = (deltaDistance / 2) * Math.cos(angle)
                const offsetY = (deltaDistance / 2) * Math.sin(angle)
                cellGeometry.x -= offsetX
                cellGeometry.y -= offsetY
                nextCellGeometry.x += offsetX
                nextCellGeometry.y += offsetY
                console.log('cell,nextCell,deltaDistance', cell, nextCell, deltaDistance)
                model.setGeometry(cell, cellGeometry)
                model.setGeometry(nextCell, nextCellGeometry)
                this.handel0202(graph, cell, this.getAll0202(graph, cellRelations))
                this.handel0202(graph, nextCell, this.getAll0202(graph, nextCellRelations))
              }
            }
          })
        }
      })
    }
  },
  // 处理塔杆附近电缆终端头
  handel0202(graph, cell, cell0202s) {
    const model = graph.getModel()
    const cellGeometry = cell.geometry.clone()
    const cellCenter = mathutil.cellCenter(cellGeometry)
    const cellx = cellCenter.x
    const celly = cellCenter.y
    if (graph && cell && cell0202s && cell0202s.length) {
      cell0202s.forEach((cell0202) => {
        const cell0202Geometry = cell0202.geometry.clone()
        const cell0202Center = mathutil.cellCenter(cell0202Geometry)
        const cell0202x = cell0202Center.x
        const cell0202y = cell0202Center.y
        // 根据就近原则设置终端头位置和杆塔水平或垂直
        if (Math.abs(cellx - cell0202x) > Math.abs(celly - cell0202y)) {
          cell0202Geometry.y = celly - cell0202Geometry.height / 2
        } else {
          cell0202Geometry.x = cellx - cell0202Geometry.width / 2
        }
        model.setGeometry(cell0202, cell0202Geometry)
        // 获取电缆终端头所有连接顶点
        const cellRelations = this.getAll0202(
          graph,
          this.getRelation(graph, cell0202, this.symbolProp)
        )
        cellRelations &&
          cellRelations.length &&
          cellRelations.forEach((relationCell) => {
            const relationCellGeometry = relationCell.geometry.clone()
            const relationCellCenter = mathutil.cellCenter(relationCellGeometry)
            const relationCellx = relationCellCenter.x
            const relationCelly = relationCellCenter.y
            if (Math.abs(cell0202x - relationCellx) > Math.abs(cell0202y - relationCelly)) {
              cell0202Geometry.y = cell0202y - cell0202Geometry.height / 2
            } else {
              cell0202Geometry.x = cell0202x - cell0202Geometry.width / 2
            }
            model.setGeometry(cell0202, cell0202Geometry)
          })

        console.log('处理塔杆附近电缆终端头', cellRelations)
      })
    }
  },
  // 获取当前顶点连接的其他顶点
  getRelation(graph, cell, symbolProp) {
    let cellAttrMap = GraphMath.getEdgeAttrOfTouch(graph, cell, symbolProp)
    let edgeAttrList = cellAttrMap.get('o')
    return this.getExistAngle(graph, cell, edgeAttrList)
  },
  // 初始化杆塔连接线，需要找到已存角度
  getExistAngle(graph, cell, list) {
    let arr = []
    for (let { edge, isSource, lineAngle, vecList, dir } of list) {
      let adjacentCell = GraphTool.getAdjacentCellOfEdge(graph, edge, cell) // 获取当前cell相连接的cell
      if (!devUpdateSet.has(adjacentCell.psrtype)) {
        arr.push(adjacentCell)
      }
    }
    return arr
  },

  // 获取所有杆塔
  getAllPole(graph) {
    const parent = graph.getDefaultParent()
    const vertices = graph.getChildVertices(parent)
    return (
      vertices &&
      vertices.filter((cell) => {
        return DeviceCategoryUtil.isPoleCell(cell)
      })
    )
  },
  // 过滤电缆终端头
  getAll0202(graph, cells = null) {
    let vertices = cells
    if (!vertices) {
      const parent = graph.getDefaultParent()
      vertices = graph.getChildVertices(parent)
    }
    return (
      vertices &&
      vertices.filter((cell) => {
        return cell.psrtype == '0202'
      })
    )
  }
}

export default PoleUtil
