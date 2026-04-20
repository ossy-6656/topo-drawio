import DeviceCategoryUtil from '@/plugins/tmzx/graph/DeviceCategoryUtil'
import TextUtil from '@/plugins/tmzx/graph/TextUtil'
import mathutil from '@/plugins/tmzx/mathutil'
import GraphTool from '@/plugins/tmzx/graph/GraphTool'

let TextHandler = {
  // 设置杆塔文本
  repositionPoleCellText() {},

  // 设置一个连接点设备文本
  repositionOneTouchCellText(graph, devCell, txtCell, gapTxt) {
    let model = graph.getModel()
    let devGeo = model.getGeometry(devCell)

    let txtGeo = model.getGeometry(txtCell).clone()

    let devCx = devGeo.getCenterX()
    let devCy = devGeo.getCenterY()

    let devHeight = devGeo.height
    let devWidth = devGeo.width
    let devX = devGeo.x
    let devY = devGeo.y

    let x = devX + devWidth
    let y = devY + devHeight

    txtGeo.x = x
    txtGeo.y = y

    model.setGeometry(txtCell, txtGeo)
  },

  // 设置两个连接的设备文本
  repositionTwoTouchCellText(graph, devCell, txtCell, gapTxt) {
    let model = graph.getModel()

    let devGeo = model.getGeometry(devCell)
    let devStyle = TextUtil.parseDrawioStyle(devCell.style)
    let angle = mathutil.negativeAngle2Positive(+devStyle.rotation)

    let txtGeo = model.getGeometry(txtCell).clone()

    let devCx = devGeo.getCenterX()
    let devCy = devGeo.getCenterY()
    let devHeight = devGeo.height
    let devWidth = devGeo.width

    let vecDev = new Vector2(devCx, devCy)

    if (mathutil.isHorizontalOrVertical(angle) == 'H') {
      // 文本放下面
      let x = devCx - txtGeo.width / 2
      let y = devCy + devHeight / 2 + gapTxt

      txtGeo.x = x
      txtGeo.y = y
      graph.setCellStyles('rotation', 0, [txtCell])
    } else if (mathutil.isHorizontalOrVertical(angle) == 'V') {
      // 文本放左边
      let x = devCx - devGeo.height / 2 - gapTxt - txtGeo.width / 2
      let y = devCy

      txtGeo.x = x - txtGeo.width / 2
      txtGeo.y = y - txtGeo.height / 2

      graph.setCellStyles('rotation', 0, [txtCell])
    } else {
      let aVec = GraphTool.getTouchPoint(graph, devCell, 0, 0.5)
      let bVec = GraphTool.getTouchPoint(graph, devCell, 1, 0.5)

      let lineAngle = mathutil.lineAngle(aVec.x, aVec.y, bVec.x, bVec.y)

      if (lineAngle > 90) {
        lineAngle = lineAngle - 180
      }

      let initX = 0
      let initY = devHeight / 2 + gapTxt + txtGeo.height / 2

      let vecInt = new Vector2(initX, initY)
      let vecTran = new Vector2(devCx, devCy)

      let radian = -mathutil.angle2Radian(lineAngle)
      let m = mathutil.commonMatrix(null, radian, null)

      let vec1 = vecInt.applyMatrix3(m)

      let vec2 = vec1.clone().add(vecTran)

      txtGeo.x = vec2.x - txtGeo.width / 2
      txtGeo.y = vec2.y - txtGeo.height / 2

      graph.setCellStyles('rotation', lineAngle, [txtCell])
    }

    model.setGeometry(txtCell, txtGeo)
  },

  // 设置文本位置
  _repostionText(graph, devCell, symbolObj, txtCell, gapTxt) {
    if (symbolObj.touchs == 1 && !DeviceCategoryUtil.isArresterCell(devCell)) {
      // 不能是避雷器
      this.repositionOneTouchCellText(graph, devCell, txtCell, gapTxt)
    } else {
      this.repositionTwoTouchCellText(graph, devCell, txtCell, gapTxt)
    }
  },

  // 设置一个连接点的设备文本
  repositionOneTouchCellPointText(graph, devCell, txtCell, gapTxt) {},

  // 设备两个连接点的测点文本
  repositionTwoTouchCellPointText(graph, devCell, txtCell, gapTxt) {
    let model = graph.getModel()
    let devGeo = model.getGeometry(devCell)
    let devStyle = TextUtil.parseDrawioStyle(devCell.style)
    let angle = mathutil.negativeAngle2Positive(+devStyle.rotation)

    let txtGeo = model.getGeometry(txtCell).clone()

    let devCx = devGeo.getCenterX()
    let devCy = devGeo.getCenterY()
    let devHeight = devGeo.height
    let devWidth = devGeo.width

    // let vecDev = new Vector2(devCx, devCy);

    if (mathutil.isHorizontalOrVertical(angle) == 'H') {
      // 文本放上面
      let x = devCx
      let y = devCy - devHeight / 2 - gapTxt - txtGeo.height / 2

      txtGeo.x = x - txtGeo.width / 2
      txtGeo.y = y - txtGeo.height / 2
      graph.setCellStyles('rotation', 0, [txtCell])
    } else if (mathutil.isHorizontalOrVertical(angle) == 'V') {
      // 文本放左边
      let x = devCx + devGeo.height / 2 + gapTxt + txtGeo.width / 2
      let y = devCy

      txtGeo.x = x - txtGeo.width / 2
      txtGeo.y = y - txtGeo.height / 2

      graph.setCellStyles('rotation', 0, [txtCell])
    } else {
      let aVec = GraphTool.getTouchPoint(graph, devCell, 0, 0.5)
      let bVec = GraphTool.getTouchPoint(graph, devCell, 1, 0.5)

      let lineAngle = mathutil.lineAngle(aVec.x, aVec.y, bVec.x, bVec.y)

      if (lineAngle > 90) {
        lineAngle = lineAngle - 180
      }

      let initX = 0
      let initY = -devHeight / 2 - gapTxt - txtGeo.height / 2

      let vecInt = new Vector2(initX, initY)
      let vecTran = new Vector2(devCx, devCy)

      let radian = -mathutil.angle2Radian(lineAngle)
      let m = mathutil.commonMatrix(null, radian, null)

      let vec1 = vecInt.applyMatrix3(m)

      let vec2 = vec1.clone().add(vecTran)

      txtGeo.x = vec2.x - txtGeo.width / 2
      txtGeo.y = vec2.y - txtGeo.height / 2

      graph.setCellStyles('rotation', lineAngle, [txtCell])
    }

    model.setGeometry(txtCell, txtGeo)
  },

  // 设置测点位置
  _repostionPointText(graph, devCell, symbolObj, txtCell, gapTxt) {
    if (symbolObj.touchs == 1 && !DeviceCategoryUtil.isArresterCell(devCell)) {
      // 不能是避雷器
      this.repositionOneTouchCellPointText(graph, devCell, txtCell, gapTxt)
    } else {
      this.repositionTwoTouchCellPointText(graph, devCell, txtCell, gapTxt)
    }
  },

  // 重算文本位置
  repositionText(graph, devCell, symbolObj, txtCell, gapTxt) {
    if (DeviceCategoryUtil.isPointCell(txtCell)) {
      this._repostionPointText(graph, devCell, symbolObj, txtCell, gapTxt)
    } else {
      this._repostionText(graph, devCell, symbolObj, txtCell, gapTxt)
    }
  }
}

export default TextHandler
