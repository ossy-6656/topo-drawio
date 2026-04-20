import mathutil from '../mathutil.js'

let GraphUtil = {
  // 重新设置终端头角度
  // 电缆段（0201）  0202(终端头)
  resetTerminal(graph, symbolProp, cell = null) {
    let model = graph.getModel()
    let view = graph.getView()
    cell = cell || graph.getSelectionCell()
    let edges = model.getEdges(cell)

    let lineCell
    for (let edge of edges) {
      if (edge.psrtype == '0201') {
        lineCell = edge
        break
      }
    }
    if (!lineCell) {
      return
    }
    let cellState = view.getState(cell)
    let rotation = cellState.style.rotation || 0
    let cx = cellState.x + cellState.width / 2
    let cy = cellState.y + cellState.height / 2

    let co = new Vector2(cx, cy)
    let state = view.getState(lineCell)
    let absPointLs = state.absolutePoints // 这种方式可以减少计算量
    let len = absPointLs.length
    let p1 = absPointLs[0]
    let p2 = absPointLs[len - 1]

    let len1 = mathutil.pixelLen(co, p1)
    let len2 = mathutil.pixelLen(co, p2)
    let pa, pb
    let vec1, vec2
    if (len1 < len2) {
      pa = absPointLs[0]
      pb = absPointLs[1]
    } else {
      pa = absPointLs[len - 1]
      pb = absPointLs[len - 2]
    }
    vec1 = new Vector2(pa.x, pa.y)
    vec2 = new Vector2(pb.x, pb.y)
    let radian = vec2.clone().sub(vec1).angle()
    let angle = mathutil.radian2Angle(radian)
    // let a = 180 - angle;
    model.beginUpdate()
    try {
      graph.setCellStyles('rotation', angle, [cell])

      // 设置旋转后位置
      let symbol = cell.symbol
      let symbObj = symbolProp[symbol]
      let { initWidth, initHeight, xratio, yratio } = symbObj
      let geometry = cell.geometry
      let { width, height } = geometry
      let cx2 = geometry.getCenterX()
      let cy2 = geometry.getCenterY()

      let xinit = width * xratio - width / 2
      let yinit = height * yratio - height / 2
      let rad = -mathutil.angle2Radian(rotation)
      let vecInit = new Vector2(xinit, yinit)
      let tran = { x: cx2, y: cy2 }
      let m = mathutil.commonMatrix(tran, rad, null)

      let vecTarget = vecInit.clone().applyMatrix3(m)

      let m2 = mathutil.commonMatrix(tran, -radian, null)

      let veccur = vecInit.clone().applyMatrix3(m2)
      let stepx = veccur.x - vecTarget.x
      let stepy = veccur.y - vecTarget.y

      let geoClone = geometry.clone()
      geoClone.x = cx2 - stepx - width / 2
      geoClone.y = cy2 - stepy - height / 2
      model.setGeometry(cell, geoClone)
    } finally {
      model.endUpdate()
    }
  },
  // 0203，水平方向和任意连接线平行即可
  resetTerminal2(graph, symbolProp, cell = null) {
    let model = graph.getModel()
    let view = graph.getView()

    let scale = view.scale
    cell = cell || graph.getSelectionCell()
    if (!cell) {
      return
    }
    let edges = model.getEdges(cell)

    if (edges.length == 0) {
      return
    }

    let lineCell = edges[0]

    let cellState = view.getState(cell)
    let rotation = cellState.style.rotation || 0
    let cx = cellState.x + cellState.width / 2
    let cy = cellState.y + cellState.height / 2

    let co = new Vector2(cx, cy)
    let state = view.getState(lineCell)
    let absPointLs = state.absolutePoints // 这种方式可以减少计算量
    let len = absPointLs.length
    let p1 = absPointLs[0]
    let p2 = absPointLs[len - 1]

    // 计算线的哪一端与设备相连接
    let len1 = mathutil.pixelLen(co, p1)
    let len2 = mathutil.pixelLen(co, p2)
    let pa, pb
    let vec1, vec2
    if (len1 < len2) {
      pa = absPointLs[0]
      pb = absPointLs[1]
    } else {
      pa = absPointLs[len - 1]
      pb = absPointLs[len - 2]
    }
    vec1 = new Vector2(pa.x, pa.y)
    vec2 = new Vector2(pb.x, pb.y)
    let radian = vec2.clone().sub(vec1).angle()
    let angle = mathutil.radian2Angle(radian)
    // let a = 180 - angle;
    model.beginUpdate()
    try {
      graph.setCellStyles('rotation', angle, [cell])
    } finally {
      model.endUpdate()
    }
  },
  resetTerminalAll(graph, symbolProp) {
    let model = graph.getModel()
    let list = graph.getVerticesAndEdges()
    model.beginUpdate()
    try {
      for (let cell of list) {
        if (cell.psrtype == '0202') {
          this.resetTerminal(graph, symbolProp, cell)
        } else if (cell.psrtype == '0203') {
          this.resetTerminal2(graph, symbolProp, cell)
        }
      }
    } finally {
      model.endUpdate()
    }
  },
  // 显示或者隐藏设备文本（目前是删除操作）
  txtShowOrHide(graph) {
    let model = graph.getModel()
    let cells = graph.getSelectionCells()

    model.beginUpdate()
    try {
      let delList = []
      for (let cell of cells) {
        let id = cell.id
        let txtId = 'TXT-' + id
        let txtCell = model.getCell(txtId)

        if (txtCell) {
          // if (txtCell.visible) {
          //     model.setVisible(txtCell, false);
          // } else {
          //     model.setVisible(txtCell, true);
          // }
          delList.push(txtCell)
        }
      }
      if (delList.length > 0) {
        graph.removeCells(delList)
      }
    } finally {
      model.endUpdate()
    }
  },
  // 删除测点
  deletePOI(graph) {
    let model = graph.getModel()
    let cells = graph.getSelectionCells()

    model.beginUpdate()
    try {
      let delList = []
      if (cells.length == 1) {
        let cell = cells[0]
        let style = cell.style

        if (style.indexOf('group;') != -1) {
          let list = model.getChildVertices(cell)
          for (let cell of list) {
            let id = cell.id
            let txtId = 'Point-' + id
            let txtCell = model.getCell(txtId)

            if (txtCell) {
              let edges = model.getEdges(txtCell)
              delList.push(txtCell, ...edges)
            }
          }
        } else {
          let id = cell.id
          let txtId = 'Point-' + id
          let txtCell = model.getCell(txtId)

          if (txtCell) {
            let edges = model.getEdges(txtCell)
            delList.push(txtCell, ...edges)
          }
        }
      } else {
        for (let cell of cells) {
          let id = cell.id
          let txtId = 'Point-' + id
          let txtCell = model.getCell(txtId)

          if (txtCell) {
            let edges = model.getEdges(txtCell)
            delList.push(txtCell, ...edges)
          }
        }
      }
      if (delList.length > 0) {
        graph.removeCells(delList)
      }
    } finally {
      model.endUpdate()
    }
  }
}

export default GraphUtil
