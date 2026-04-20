import DeviceCategoryUtil from '@/plugins/tmzx/graph/DeviceCategoryUtil.js'

let GapUtil = {
  getGapInfo(graph, busCell, firstLine) {
    let model = graph.getModel()
    let list = []
    let keys = new Set()
    keys.add(busCell)

    let oppositeBusCell
    let oppositeFirstLine
    // 递归搜索所有间隔设备
    let rescueSearch = (cell) => {
      if (!cell) {
        return
      }

      if (!cell.pid) {
        // 非站内设备
        return
      }

      if (keys.has(cell)) {
        // 已经访问过
        return
      }

      if (model.isEdge(cell)) {
        let scell = model.getTerminal(cell, true)
        let tcell = model.getTerminal(cell, false)

        if (DeviceCategoryUtil.isBusCell(scell) && scell != busCell) {
          oppositeFirstLine = cell
        } else if (DeviceCategoryUtil.isBusCell(tcell) && tcell != busCell) {
          oppositeFirstLine = cell
        }
      }

      if (DeviceCategoryUtil.isBusCell(cell)) {
        // 如果是母线
        oppositeBusCell = cell
        return
      }

      keys.add(cell)
      list.push(cell)

      let txtId = 'TXT-' + cell.id
      let txtCell = model.getCell(txtId)
      if (txtCell) {
        list.push(txtCell)
      }

      let pointId = 'Point-' + cell.id
      let pointCell = model.getCell(pointId)
      if (pointCell) {
        list.push(pointCell)
      }

      if (model.isVertex(cell)) {
        let edgeList = model.getEdges(cell)
        for (let edgeCell of edgeList) {
          rescueSearch(edgeCell)
        }
      } else if (model.isEdge(cell)) {
        let scell = model.getTerminal(cell, true)
        let tcell = model.getTerminal(cell, false)
        rescueSearch(scell)
        rescueSearch(tcell)
      }
    }

    rescueSearch(firstLine)
    return {
      list,
      oppositeBusCell,
      oppositeFirstLine
    }
  }
}

export default GapUtil
