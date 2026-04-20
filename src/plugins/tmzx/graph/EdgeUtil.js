import { array } from 'vue-types'
import mathutil from '../mathutil.js'
import GraphMath from '@/plugins/tmzx/graph/GraphMath.js'
import GisUtil from '@/plugins/tmzx/graph/GisUtil.js'
import GraphTool from '@/plugins/tmzx/graph/GraphTool.js'
import DeviceCategoryUtil from './DeviceCategoryUtil.js'
import astar from './aStart.js'
let devUpdateSet = new Set(['0202', '370000'])
let EdgeUtil = {
  symbolProp: null,
  // 优化所有edge控制点，避免压住顶点
  adjustEdge(graph, symbolProp) {
    this.symbolProp = symbolProp
    const model = graph.getModel()
    const parent = graph.getDefaultParent()
    const { vertices, edges } = this.getAllEdgeAndVertices(graph)

    if (edges && edges.length) {
      edges.forEach((edge, index) => {
        const start = model.getTerminal(edge, true)
        const startGeo = model.getTerminal(edge, true).geometry
        const goal = model.getTerminal(edge, false)
        const goalGeo = model.getTerminal(edge, false).geometry
        if (!devUpdateSet.has(start.psrtype || devUpdateSet.has(goal.start))) {
          if (startGeo && goalGeo) {
            const len = mathutil.pixelLen(startGeo, goalGeo)
            if (len > 10000) {
              const { restoredCoordinates, s, g } = astar({
                obstacles: vertices.map((item) => [item.x, item.y]), // 随机生成障碍物
                start: [startGeo.x, startGeo.y], // 起点
                goal: [goalGeo.x, goalGeo.y] // 终点
              })
              console.log('goal,start', restoredCoordinates, s, g)
              if (restoredCoordinates) {
                let geo = edge.geometry
                if (!geo) {
                  geo = new mxGeometry()
                  edge.setGeometry(geo)
                }
                geo.points = []
                restoredCoordinates.forEach(([x, y]) => geo.points.push(new mxPoint(x, y)))
                console.log('geo.points', geo.points)
              }
              graph.refresh()
            }
          }
        }
      })
    }
  },

  // 获取所有连线和顶点
  getAllEdgeAndVertices(graph) {
    const parent = graph.getDefaultParent()
    const vertices = graph.getChildVertices(parent).map((item) => item.geometry)
    const edges = graph.getChildEdges()
    return {
      vertices,
      edges
    }
  }
}

export default EdgeUtil
