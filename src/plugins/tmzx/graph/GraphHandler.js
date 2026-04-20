// 用于设备计算操作
import mathutil from '@/plugins/tmzx/mathutil.js'
import geometric from '@/plugins/tmzx/geometric.js'
import GraphTool from './GraphTool.js'
import GisUtil from './GisUtil.js'
import TextUtil from './TextUtil.js'
import DeviceCategoryUtil from './DeviceCategoryUtil.js'
import GraphMath from './GraphMath.js'
import StationHandler from '@/plugins/tmzx/graph/StationHandler.js'
import TextHandler from '@/plugins/tmzx/graph/TextHandler'
import PoleHandler from '@/plugins/tmzx/graph/PoleHandler'

let GraphHandler = {
    // 获取直线向量，统一为从起点到终点，感觉这个要用不着
    getStraightEdgeVector(graph, edge) {
        let model = graph.getModel()
        let view = graph.view

        let edgeState = view.getState(edge)
        let edgeStyle = edgeState.style
        let edgeGeometry = graph.getCellGeometry(edge)
        let edgeSourcePoint = edgeGeometry.sourcePoint
        let edgeTargetPoint = edgeGeometry.targetPoint

        let v1 = new Vector2(edgeSourcePoint.x, edgeSourcePoint.y)
        let v2 = new Vector2(edgeTargetPoint.x, edgeTargetPoint.y)
        let v = v2.clone().sub(v1)
        return v
    },

    /**
     * 线路通用正交化方法
     * @param list          线坐标数组
     * @param isSource      线起点是否连接到源设备
     * @param isPreCellBus  前一个设备是是否为bus
     */
    beautifyLine(list, isSource, vec_bus, isPreCellBus = false) {
        if (!isSource) {
            // 反转
            list.reverse()
        }

        let vec_cross = new Vector2(vec_bus.y, -vec_bus.x)
        let vbusNormal = vec_bus.normalize()

        // 线路坐标平移
        let translateLineHandler = (startIndex, stepx, stepy) => {
            for (let i = startIndex; i < list.length; i++) {
                let vec = list[i]
                vec.x = vec.x + stepx
                vec.y = vec.y + stepy
            }
        }

        for (let i = 0; i < list.length - 1; i++) {
            let v1 = list[i]
            let v2 = list[i + 1]

            let x1 = v2.x
            let y1 = v2.y

            let vec_line = v2.clone().sub(v1) // 要偏转的线段
            let vec_line_Len = vec_line.length()

            let vecTarget // 要计算的目标点

            let angle1 = mathutil.vecAngle(vec_line, vec_cross)
            let angle2 = mathutil.vecAngle(vec_line, vec_bus)

            if (angle1 > 90) {
                vec_cross = vec_cross.negate()
            }
            if (angle2 > 90) {
                vec_bus = vec_bus.negate()
            }

            let vcrossNormal = vec_cross.normalize()

            if (isPreCellBus) {
                vecTarget = vcrossNormal.multiplyScalar(vec_line_Len).add(v1)
            } else {
                let a1 = mathutil.vecAngle(vec_bus, vec_line)
                let a2 = mathutil.vecAngle(vec_cross, vec_line)
                let vecTmp =
                    a1 < a2
                        ? vbusNormal.multiplyScalar(vec_line_Len)
                        : vcrossNormal.multiplyScalar(vec_line_Len)
                vecTarget = vecTmp.clone().add(v1)
            }

            v2.x = vecTarget.x
            v2.y = vecTarget.y

            let stepx = vecTarget.x - x1
            let stepy = vecTarget.y - y1
            translateLineHandler(i + 2, stepx, stepy)
        }

        if (!isSource) {
            // 反转回来
            list.reverse()
        }
    },

    /**
     * 边美化
     * @param graph
     * @param preCell
     * @param edge
     * @param vec_bus
     */
    beautifyEdgeCommon(graph, preCell, edge, vec_bus) {
        let model = graph.getModel()
        let view = graph.getView()

        let edgeGeometry = graph.getCellGeometry(edge)

        let sourceCell = model.getTerminal(edge, true)
        // let targetCell = model.getTerminal(edge, false);

        let isPreCellSource = sourceCell == preCell ? true : false
        let list = GraphTool.getEdgePointsCommon(graph, edge)

        let flag = view.getState(preCell)?.style?.flag
        // 美化线路
        this.beautifyLine(list, isPreCellSource, vec_bus, flag == 'busbar')

        let geometryClone = edgeGeometry.clone()

        let p0 = list[0]
        let p1 = list[list.length - 1]
        geometryClone.sourcePoint = new mxPoint(p0.x, p0.y)
        geometryClone.targetPoint = new mxPoint(p1.x, p1.y)

        if (list.length > 2) {
            let arr = []
            for (let i = 1; i < list.length - 1; i++) {
                let { x, y } = list[i]
                arr.push(new mxPoint(x, y))
            }
            geometryClone.points = arr
        }

        model.beginUpdate()
        try {
            model.setGeometry(edge, geometryClone)
        } finally {
            model.endUpdate()
        }
    },

    /**
     * 调整母线水平或者垂直
     * @param graph
     * @param edgeCell
     * @param busCell
     */
    beautifyBus(graph, busCell) {
        let view = graph.view

        // let {x, y, width, height} = graph.getCellGeometry(busCell);
        let state = view.getState(busCell)
        let style = state.style
        let rotation = style.rotation || 0
        rotation = mathutil.negativeAngle2Positive(rotation)
        let angle = 0
        if (rotation < 45 && rotation >= 0) {
            angle = 0
        } else if (rotation < 135 && rotation >= 45) {
            angle = 90
        } else if (rotation < 225 && rotation >= 135) {
            angle = 180
        } else if (rotation < 315 && rotation >= 225) {
            angle = 270
        } else if (rotation >= 315) {
            angle = 360
        }
        graph.setCellStyles('rotation', angle, [busCell])
    },

    beautifyVertex(graph, preCell, vertex) {
        let model = graph.getModel()
        let view = graph.view

        let edgeGeometry = graph.getCellGeometry(preCell)
        let edgeState = view.getState(preCell)
        let edgeStyle = edgeState.style

        let vertexState = view.getState(vertex)
        let vertexStyle = vertexState.style
        let vertexGeometry = graph.getCellGeometry(vertex)
        let { width, height } = vertexGeometry

        let source = model.getTerminal(preCell, true)

        let ratiox, ratioy
        let anchor

        if (source == vertex) {
            ratiox = edgeStyle.exitX
            ratioy = edgeStyle.exitY
            anchor = edgeGeometry.sourcePoint
        } else {
            ratiox = edgeStyle.entryX
            ratioy = edgeStyle.entryY
            anchor = edgeGeometry.targetPoint
        }

        let angle = vertexStyle.rotation || 0
        let rad = -mathutil.angle2Radian(angle)
        let m = mathutil.commonMatrix(null, rad, null)
        let vtouchOriginal = new Vector2(width * ratiox - width / 2, height * ratioy - height / 2)
        let touch = vtouchOriginal.clone().applyMatrix3(m)

        let stepx = anchor.x - touch.x
        let stepy = anchor.y - touch.y

        let geometryClone = vertexGeometry.clone()
        geometryClone.x = stepx - width / 2
        geometryClone.y = stepy - height / 2

        model.beginUpdate()
        try {
            model.setGeometry(vertex, geometryClone)
        } finally {
            model.endUpdate()
        }
    },

    /**
     * 通用间隔美化方法
     * @param graph
     * @param busCell      母线
     * @param linkedEdge   母线连接线
     */
    beautifyGapCommon(graph, busCell, linkedEdge) {
        let cellMap = {}

        this.beautifyBus(graph, busCell) // 先把母线水平或者垂直

        let pstart = GraphTool.getTouchPoint(graph, busCell, 0, 0.5)
        let pend = GraphTool.getTouchPoint(graph, busCell, 1, 0.5)
        let vec_bus = pend.clone().sub(pstart) //参考向量

        cellMap[busCell.id] = true

        let beautifyGap = (preCell, cell) => {
            if (!cell) {
                return
            }
            let model = graph.getModel()

            let state = graph.view.getState(cell)
            let styleObj = state.style
            let flag = styleObj.flag

            if (cellMap[cell.id]) {
                return
            }
            cellMap[cell.id] = true // 标记已经访问过

            if (cell.pid) {
                // 处理站内设备
                if (model.isVertex(cell)) {
                    // 处理vertex
                    if (flag == 'busbar') {
                        this.beautifyBus(graph, cell)
                    } else {
                        // 美化vertex
                        this.beautifyVertex(graph, preCell, cell)

                        // 遍历关联节点
                        let edgeList = model.getEdges(cell)
                        for (let edge of edgeList) {
                            beautifyGap(cell, edge)
                        }
                    }
                } // 处理线
                else {
                    // 美化边
                    this.beautifyEdgeCommon(graph, preCell, cell, vec_bus)

                    // 遍历关联节点
                    let sourceCell = model.getTerminal(cell, true)
                    let targetCell = model.getTerminal(cell, false)

                    beautifyGap(cell, sourceCell)
                    beautifyGap(cell, targetCell)
                }
            }
        }
        beautifyGap(busCell, linkedEdge)
    },

    /**
     * 计算母线与连接线的位置
     * @param graph
     * @param p0        母线起点
     * @param p1        母线终点
     * @param angle     母线角度
     * @param cell      母线
     * @param lineEdge  连接线
     */
    computeLine2BusConnection(graph, p0, p1, angle, cell, lineEdge) {
        let view = graph.view
        let model = graph.getModel()

        let sourceCell = model.getTerminal(lineEdge, true)
        let targetCell = model.getTerminal(lineEdge, false)

        let isSource = null //判断线的源点是否连接到母线
        if (sourceCell == cell) {
            isSource = true
        } else {
            isSource = false
        }
        let geometry = model.getGeometry(lineEdge)
        let { sourcePoint, targetPoint, points } = geometry

        let p = null
        if (angle == 0) {
            // 母线平行
            if (isSource) {
                // 源点连接到母线
                p = new mxPoint(targetPoint.x, sourcePoint.y)
                geometry.setTerminalPoint(p, true)
            } // 目标点连接到母线
            else {
                p = new mxPoint(sourcePoint.x, targetPoint.y)
                geometry.setTerminalPoint(p, false)
            }
        } // 母线垂直
        else {
            if (isSource) {
                // 源点连接到母线
                p = new mxPoint(sourcePoint.x, targetPoint.y)
                geometry.setTerminalPoint(p, true)
            } // 目标点连接到母线
            else {
                p = new mxPoint(targetPoint.x, sourcePoint.y)
                geometry.setTerminalPoint(p, false)
            }
        }
        let lenLeft = mathutil.pixelLen(p0, p)
        let busLen = mathutil.pixelLen(p0, p1)
        let ratio = lenLeft / busLen

        if (isSource) {
            graph.setCellStyles('exitX', ratio, [lineEdge])
        } else {
            graph.setCellStyles('entryX', ratio, [lineEdge])
        }
    },

    /**
     * 计算母线与连接线的位置
     * @param graph
     * @param p0 母线起点
     * @param p1 母线终点
     * @param busCell  母线
     * @param lineEdge 连接线
     */
    computeLine2BusConnectionCommon(graph, p0, p1, busCell, lineEdge) {
        let view = graph.view
        let model = graph.getModel()

        let sourceCell = model.getTerminal(lineEdge, true)
        let targetCell = model.getTerminal(lineEdge, false)

        let geometry = model.getGeometry(lineEdge)
        let geometryClone = geometry.clone()

        // 获取线的相对坐标
        let linePoints = GraphTool.getEdgePointsCommon(graph, lineEdge)

        let isSource = sourceCell == busCell ? true : false //判断线的源点是否连接到母线
        let p = isSource ? linePoints[linePoints.length - 1] : linePoints[0] // 连接到非母线端的点

        let pos = mathutil.closestPointOnLineSegment(p, p0, p1)
        geometryClone.setTerminalPoint(new mxPoint(pos.x, pos.y), isSource)

        let lenLeft = mathutil.pixelLen(p0, pos)
        let busLen = mathutil.pixelLen(p0, p1)
        let ratio = lenLeft / busLen

        model.setGeometry(lineEdge, geometryClone)

        if (isSource) {
            graph.setCellStyles('exitX', ratio, [lineEdge])
        } else {
            graph.setCellStyles('entryX', ratio, [lineEdge])
        }
    },

    /**
     * 间隔平均分布通用方法
     * @param graph
     * @param symbolProp   图元对象map
     * @param ratio        母线上的新连接点比率
     * @param p0           母线起点
     * @param p1           母线终点
     * @param curVec       当前连接点坐标
     * @param busCell      母线
     * @param firstLine    连接线
     * @param flag         当前连接线是否连接两个母线 true:是，false:否
     */
    GapEvenDistributionCommon(graph, symbolProp, ratio, p0, p1, curVec, busCell, firstLine, flag) {
        let model = graph.getModel()
        let view = graph.view

        let sourceCell = model.getTerminal(firstLine, true)

        let vec_init = null // 初始连接点
        let state_firstLine = view.getState(firstLine)
        let style_firstLine = state_firstLine.style

        let ratiox, ratioy
        // 设备连接线母线触点
        if (busCell === sourceCell) {
            ratiox = style_firstLine.exitX
            ratioy = style_firstLine.exitY
            graph.setCellStyles('exitX', ratio, [firstLine])
            graph.setCellStyles('exitY', ratio, [firstLine])
        } else {
            ratiox = style_firstLine.entryX
            ratioy = style_firstLine.entryY

            graph.setCellStyles('entryX', ratio, [firstLine])
            graph.setCellStyles('entryY', ratio, [firstLine])
        }

        if (flag) {
            // 遇到两个母线间的连接线，只设置与母线连接点位置，退出
            return
        }
        let preTouchVec = GraphTool.getTouchPoint(graph, busCell, ratiox, ratioy)

        // 偏移向量值
        let stepVec = curVec.clone().sub(preTouchVec)

        // 移动vetex
        let moveCellHandler = (cell) => {
            let geometry = graph.getCellGeometry(cell)
            let { x, y } = geometry
            let geoClone = geometry.clone()
            let vecPre = new Vector2(x, y)
            let vec = vecPre.clone().add(stepVec)
            // 计算出偏移量
            geoClone.x = vec.x
            geoClone.y = vec.y

            model.setGeometry(cell, geoClone)

            // 处理文字
            let txtid = 'TXT-' + cell.id
            let txtCell = model.getCell(txtid)
            if (txtCell) {
                let txtGeo = graph.getCellGeometry(txtCell)
                let { x, y } = txtGeo
                let vecTxtPre = new Vector2(x, y)
                let vecTxt = vecTxtPre.clone().add(stepVec)
                let txtGeoClone = txtGeo.clone()
                txtGeoClone.x = vecTxt.x
                txtGeoClone.y = vecTxt.y

                model.setGeometry(txtCell, txtGeoClone)
            }

            let pointId = 'Point-' + cell.id
            let pointCell = model.getCell(pointId)
            if (pointCell) {
                let pointGeo = graph.getCellGeometry(pointCell)
                let { x, y } = pointGeo
                let vecTxtPre = new Vector2(x, y)
                let vecTxt = vecTxtPre.clone().add(stepVec)
                let pointGeoClone = pointGeo.clone()
                pointGeoClone.x = vecTxt.x
                pointGeoClone.y = vecTxt.y

                model.setGeometry(pointCell, pointGeoClone)
            }
        }

        // 移动普通线
        let moveEdgeHandler = (cell) => {
            let geometry = graph.getCellGeometry(cell)
            let geoClone = geometry.clone()

            let list = GraphTool.getEdgePointsCommon(graph, cell)
            let rsList = []
            for (let v of list) {
                let vec = v.clone().add(stepVec)
                rsList.push(new mxPoint(vec.x, vec.y))
            }
            geoClone.setTerminalPoint(rsList[0], true)
            geoClone.setTerminalPoint(rsList[rsList.length - 1], false)

            if (geoClone.points && geoClone.points.length > 0) {
                geoClone.points = rsList.slice(1, rsList.length - 1)
            }
            model.setGeometry(cell, geoClone)
        }

        /**
         *
         * @param preCell
         * @param edgeCell
         */
        let moveMidEdgeHandler = (preCell, edgeCell) => {
            let geometry = graph.getCellGeometry(edgeCell)
            let { sourcePoint, targetPoint, points } = geometry
            let geoClone = geometry.clone()

            let _sp = null,
                _points = [],
                _tp = null
            if (points && points.length > 0) {
                _points = points.map((p) => p.clone())
            }

            if (model.getTerminal(edgeCell, true) == preCell) {
                // 源点连接在上一个设备
                _tp = targetPoint.clone()
                if (angleState == 0) {
                    _sp = new mxPoint(sourcePoint.x + stepx, sourcePoint.y)
                    if (_points.length > 0) {
                        _points[0].x = _points[0].x + stepx
                    }
                } else {
                    _sp = new mxPoint(sourcePoint.x, sourcePoint.y + stepy)
                    if (_points.length > 0) {
                        _points[0].y = _points[0].y + stepy
                    }
                }
            } // 目标点连接到上一个设备
            else {
                _sp = sourcePoint.clone()
                if (angleState == 0) {
                    _tp = new mxPoint(targetPoint.x + stepx, targetPoint.y)
                    if (_points.length > 0) {
                        let index = _points.length - 1
                        _points[index].x = _points[index].x + stepx
                    }
                } else {
                    _tp = new mxPoint(targetPoint.x, targetPoint.y + stepy)
                    if (_points.length > 0) {
                        let index = _points.length - 1
                        _points[index].y = _points[index].y + stepy
                    }
                }
            }

            geoClone.setTerminalPoint(_sp, true)
            geoClone.setTerminalPoint(_tp, false)
            if (_points.length > 0) {
                geoClone.points = _points
            }
            model.setGeometry(edgeCell, geoClone)
        }

        // 用于确实已经访问过设备的map变量
        let existMap = {}
        existMap[busCell.id] = true

        // 递归遍历所有cell并更改位置
        let updateCellPostionHandler = (preCell, curCell) => {
            if (!curCell) {
                return
            }
            if (existMap[curCell.id]) {
                // 已经访问过，退出
                return
            }
            existMap[curCell.id] = true

            let state = view.getState(curCell)
            let style = state.style
            if (!state.style['pid']) {
                return
            }

            // if (flag) // 遇到两个母线间的连接线，退出
            // {
            // 	moveMidEdgeHandler(preCell, curCell);
            // 	return;
            // }

            if (model.isVertex(curCell)) {
                moveCellHandler(curCell)
                let list = model.getEdges(curCell)
                for (let cell of list) {
                    updateCellPostionHandler(curCell, cell)
                }
            } else {
                moveEdgeHandler(curCell)

                let _sourceCell = model.getTerminal(curCell, true)
                let _targetCell = model.getTerminal(curCell, false)

                updateCellPostionHandler(curCell, _sourceCell)
                updateCellPostionHandler(curCell, _targetCell)
            }
        }

        updateCellPostionHandler(busCell, firstLine)
    },
    // 主干验证
    validateTrunk(graph, cell_substation, trunkCellSet) {
        let model = graph.getModel()
        let view = graph.view

        // 站内连接线：  36000000
        // 站外连接线：  13000000
        // 站外超连接线：14000000
        let ljxSet = new Set(['36000000', '13000000', '14000000']) // 三种连接线

        // 有一种情况是，手动把连接线设置成主干，这样会错过，需要注意这种情况
        let isLjxFun = (cell) => {
            let id = cell.id
            // if (cell.lineType == 'Trunk') {
            // 	return false;
            // }
            // ['36000000', '13000000', '14000000']
            if (
                id.indexOf('36000000') != -1 ||
                id.indexOf('13000000') != -1 ||
                id.indexOf('14000000') != -1
            ) {
                return true
            }
            return false
        }
        let keys = new Set()
        let visitorKeys = new Set()

        let sbzlxReg = /PD_([^_]+).+/

        // switchrolename="联络"
        // switchrolename="分支"
        // 检查设备是否为主干线
        let isPreCellTrunk = (cell) => {
            let isPass = false
            if (model.isEdge(cell)) {
                isPass = cell['lineType'] == 'Trunk'
            }
            return isPass
        }

        // 32000000：站内出线设备
        // 回退处理，删除末端连接线及设备
        let fallback = (list) => {
            // pop删除最后一个
            model.beginUpdate()
            let tmplist = []
            try {
                let deleteSet = new Set()
                for (let i = list.length - 1; i >= 0; i--) {
                    let cell = list[i]
                    if (model.isVertex(cell)) {
                        if (
                            cell['switchrolename'] == '联络' ||
                            cell['switchrolename'] == '分支' ||
                            cell.id.indexOf('32000000') != -1
                        ) {
                            // 遇到这种设备要保留
                            break
                        } else {
                            if (i - 1 >= 0) {
                                if (isPreCellTrunk(list[i - 1])) {
                                    // 如果上一个设备为主干
                                    break
                                } else {
                                    deleteSet.add(cell)
                                }
                            }
                        }
                    } else if (model.isEdge(cell)) {
                        // 删除连接线
                        let match = sbzlxReg.exec(cell.id)
                        if (match) {
                            let sbzlx = match[1]
                            if (ljxSet.has(sbzlx)) {
                                // 删除连接线
                                deleteSet.add(cell)
                            }
                        }
                    }
                }

                for (let c of list) {
                    if (!deleteSet.has(c)) {
                        tmplist.push(c)
                    }
                }

                graph.setCellStyles('strokeColor', 'red', [...deleteSet])
            } finally {
                model.endUpdate()
            }
            return tmplist
        }

        // 检测当前cell是否为最后一个叶子节点
        let checkLastCell = (cell) => {
            let len = 0
            if (model.isVertex(cell)) {
                let edges = model.getEdges(cell)
                let len = 0
                for (let edge of edges) {
                    if (!DeviceCategoryUtil.isUselessLine(edge)) {
                        len = len + 1
                    }
                }
                return len == 1
            } else if (model.isEdge(cell)) {
                let sourceVertex = model.getTerminal(cell, true)
                let targetVertex = model.getTerminal(cell, false)
                if (sourceVertex) {
                    len = len + 1
                }
                if (targetVertex) {
                    len = len + 1
                }
                return len < 2
            }

            return false
        }

        let roadList = []

        /**
         * 查找所有路径，即查找到叶子节点
         * @param cell
         * @param list
         */
        let go = (cell, list) => {
            // 1、添加跳出条件
            // 1.1、如果当前cell已经访问过
            if (keys.has(cell)) {
                return
            }

            // 1.2、验证主干是否对应上
            if (model.isEdge(cell)) {
                // 测点连接线退出（这个分支不会过）
                // 如果是无用的线
                if (DeviceCategoryUtil.isUselessLine(cell)) {
                    keys.add(cell)
                    return
                }

                if (!isLjxFun(cell)) {
                    // 如果不是连接线
                    let isTrunk = DeviceCategoryUtil.isTrunkCell(cell)
                    if (isTrunk) {
                        visitorKeys.add(cell.id)
                    } else {
                        keys.add(cell)
                        roadList.push([...list])
                        return // 出口1
                    }
                }
            }

            keys.add(cell)
            list.push(cell)

            // 如果是最后一个设备，即叶子（不能是电站）
            // if (checkLastCell(cell) && !DeviceCategoryUtil.isSubstation(cell)) {
            // 	roadList.push([...list]);
            // 	return; // 出口2
            // }

            if (checkLastCell(cell) && cell != cell_substation) {
                roadList.push([...list])
                return // 出口2
            }

            // 2、循环遍历
            if (model.isVertex(cell)) {
                let edges = model.getEdges(cell)
                for (let edge of edges) {
                    go(edge, [...list])
                }
            } else if (model.isEdge(cell)) {
                let sourceVertex = model.getTerminal(cell, true)
                let targetVertex = model.getTerminal(cell, false)

                go(sourceVertex, [...list])
                go(targetVertex, [...list])
            }
        }

        go(cell_substation, [])

        model.beginUpdate()
        let list = []
        try {
            let keySet = new Set()
            let i = 0
            for (let road of roadList) {
                let tmplist = fallback(road)
                for (let c of tmplist) {
                    if (keySet.has(c)) {
                        continue
                    }
                    keySet.add(c)
                    list.push(c)
                }
                i++
            }

            graph.setCellStyles('strokeColor', 'green', list)
        } finally {
            model.endUpdate()
        }

        let datalist = []
        // 检查是否查找完毕
        for (let id of trunkCellSet) {
            if (!visitorKeys.has(id)) {
                let cell = model.getCell(id)
                datalist.push({
                    id: id,
                    name: cell.name
                })
            }
        }

        return {
            list,
            lostList: datalist
        }
    },
    merLen2pixel(merLne, param) {
        let { lt, sw, sh, scale, mlt, mrb } = param
        let ratiox = sw / (mrb[0] - mlt[0])
        let ratioy = sh / (mlt[1] - mrb[1])
        return (ratiox * merLne) / scale
    },
    fontParse(jsonstr) {
        let dataList = JSON.parse(jsonstr).svgTextArray
        let list = dataList.map((o) => o.text)
        let { xm, ym, rotate, fontSize } = dataList[0]
        // let props = TextUtil.getTextDimensionFromTxtList(fontSize, list);
        // let width_mer = props.width;
        // let height_mer = props.height;
        return { fs: fontSize, cor: { x: xm, y: ym }, rotate }
    },
    fontParse2(dataList) {
        let list = dataList.map((o) => o.text)
        let { xm, ym, rotate, fontSize } = dataList[0]
        // let props = TextUtil.getTextDimensionFromTxtList(fontSize, list);
        // let width_mer = props.width;
        // let height_mer = props.height;
        return { fs: fontSize, cor: { x: xm, y: ym }, rotate, txtArr: list }
    },
    // 重算站房位置
    repositionStation(map, graph, symbolProp, params, group, feature, stationCell) {
        let model = graph.getModel()
        let reg = /^.+?\(\(([^)]+)\)\)/
        let lineReg = reg

        let props = feature.properties
        let pos = props.possj
        if (!pos) {
            return
        }

        let groupGeo = graph.getCellGeometry(group)
        let orgin = { x: groupGeo.x, y: groupGeo.y }

        let getDrawioCor = (corstr) => {
            let list = []
            let lnglatList = corstr.split(',').map((cor) => {
                let sarr = cor.split(' ')
                return [+sarr[0], +sarr[1]]
            })
            for (let cor of lnglatList) {
                // let cor_pixel = this.wg842drawio(cor, params, map);
                let cor_pixel = GisUtil.sg2drawio(params, cor[0], cor[1])
                list.push(cor_pixel)
            }
            return list
        }

        // ---------------------------------------2、处理站房文本名称---------------------------------------
        // {
        // 	let sbsxjsonstr = props.sbsxjsonstr;
        // 	let cellId = 'TXT-' + stationCell.id;
        // 	let txtCell = model.getCell(cellId);
        // 	let {fs, rotate, cor} = this.fontParse(sbsxjsonstr);
        //
        // 	let geoFont = txtCell.geometry.clone();
        // 	geoFont.x = cor.x;
        // 	geoFont.y = cor.y;
        //
        // 	model.setGeometry(txtCell, geoFont);
        // 	graph.setCellStyles('fontSize', fs,  [txtCell]);
        // 	graph.setCellStyles('rotation', rotate,  [txtCell]);
        // }

        let features
        let commonReg = /\(([^)]+)\)/
        let polygonReg = /\(\(([^)]+)\)\)/
        let curGroup
        // ---------------------------------------3、处理站内设备---------------------------------------
        {
            // 设备处理
            let devSymbolHandler = (cell, props) => {
                let { possj, scalex, scaley, rotate } = props // rotate为弧度
                let corstr = possj.match(commonReg)[1]

                if (possj.indexOf('POINT') != -1 || possj.indexOf('LINESTRING') != -1) {
                    corstr = possj.match(commonReg)[1]
                } else if (possj.indexOf('POLYGON') != -1) {
                    corstr = possj.match(polygonReg)[1]
                }
                // 计算出drawio中的像素坐标
                let pixelList = getDrawioCor(corstr)

                if (cell.symbol == 'busbar') {
                    let v1 = pixelList[0]
                    let v2 = pixelList[1]
                    let co = mathutil.midPoint(v1, v2)

                    let preGeo = cell.geometry
                    let preWidth = preGeo.width
                    let preHeight = preGeo.height

                    let width_pixel = v1.clone().sub(v2).length()

                    let geoClone = preGeo.clone()
                    geoClone.x = co.x - width_pixel / 2
                    geoClone.y = co.y - preHeight / 2
                    geoClone.width = width_pixel
                    geoClone.height = preHeight

                    model.setGeometry(cell, geoClone)
                    // graph.setCellStyles('rotation', angle,  [cell]);
                    let i = 1
                } else if (cell.symbol == 'station') {
                    let { xmin, ymin, width, height } = mathutil.vecListBounds(pixelList)
                    let preGeo = cell.geometry
                    let geoClone = preGeo.clone()
                    geoClone.x = xmin
                    geoClone.y = ymin
                    geoClone.width = width
                    geoClone.height = height

                    model.setGeometry(cell, geoClone)
                } else if (pixelList.length > 1) {
                    let preGeo = cell.geometry

                    let prex = preGeo.x
                    let prey = preGeo.y

                    let symbolId = cell.symbol
                    let { initWidth, initHeight, xratio, yratio } = symbolProp[symbolId]

                    let v1 = pixelList[0]
                    let v2 = pixelList[pixelList.length - 1]
                    // let vec = v2.clone().sub(v1);
                    // let angle = mathutil.radian2Angle(vec.angle());
                    let co = mathutil.midPoint(v1, v2)

                    let angle = -mathutil.radian2Angle(rotate)

                    // let width_pixel = this.merLen2pixel(initWidth * scalex, params);
                    // let height_pixel = this.merLen2pixel(initHeight * scaley, params);
                    let width_pixel = GraphTool.merLen2Drawio(initWidth * scalex, params)
                    let height_pixel = GraphTool.merLen2Drawio(initHeight * scaley, params)

                    let leftWidth = width_pixel * xratio
                    let topHeight = height_pixel * yratio

                    let vecPre = new Vector2(
                        leftWidth - width_pixel / 2,
                        topHeight - height_pixel / 2
                    )
                    let mc = mathutil.commonMatrix(null, rotate, null)
                    let vCenterPre = vecPre.clone().applyMatrix3(mc)
                    // 计算偏移
                    let vec = co.clone().sub(vCenterPre)
                    // 计算中心点需要偏移的像素值

                    let x = vec.x - width_pixel / 2
                    let y = vec.y - height_pixel / 2

                    let geoClone = preGeo.clone()
                    geoClone.x = x
                    geoClone.y = y
                    geoClone.width = width_pixel
                    geoClone.height = height_pixel

                    model.setGeometry(cell, geoClone)
                    graph.setCellStyles('rotation', angle, [cell])

                    // 检查测点
                    let dx = x - prex
                    let dy = y - prey

                    let pointId = 'Point-' + cell.id
                    let pointCell = model.getCell(pointId)

                    if (pointCell) {
                        let pointGeo = pointCell.geometry.clone()
                        pointGeo.x = pointGeo.x + dx
                        pointGeo.y = pointGeo.y + dy
                        model.setGeometry(pointCell, pointGeo)
                        // graph.moveCells([pointCell], dx, dy) // 不使用这个方式
                    }

                    // 检查文本
                    // let txtId = 'TXT-' + cell.id;
                    // let txtCell = model.getCell(txtId);
                    // if (txtCell) {
                    // 	let txtGeo = txtCell.geometry.clone();
                    // 	txtGeo.x = txtGeo.x + dx;
                    // 	txtGeo.y = txtGeo.y + dy;
                    // 	model.setGeometry(txtCell, txtGeo);
                    // }
                } else {
                    let preGeo = cell.geometry
                    let angle = -mathutil.radian2Angle(rotate)
                    let symbolId = cell.symbol
                    let { initWidth, initHeight } = symbolProp[symbolId]
                    let width_pixel = this.merLen2pixel(initWidth * scalex, params)
                    let height_pixel = this.merLen2pixel(initHeight * scaley, params)

                    let co = pixelList[0]
                    let geoClone = preGeo.clone()
                    geoClone.x = co.x - width_pixel / 2
                    geoClone.y = co.y - height_pixel / 2
                    geoClone.width = width_pixel
                    geoClone.height = height_pixel

                    model.setGeometry(cell, geoClone)
                    graph.setCellStyles('rotation', angle, [cell])
                }

                // 文本处理-------------------------------------
                let sbsxjsonstr = props.sbsxjsonstr
                if (!sbsxjsonstr) {
                    return
                }

                let txtJson = JSON.parse(sbsxjsonstr)

                let txtCellId = 'TXT-' + cell.id
                let txtCell = model.getCell(txtCellId)
                let dataList = txtJson['svgTextArray']

                if (txtCell && dataList) {
                    let { fs, rotate: fontRotate, cor, txtArr } = this.fontParse2(dataList)

                    let geoFont = txtCell.geometry.clone()

                    geoFont.x = cor.x
                    geoFont.y = cor.y
                    model.setGeometry(txtCell, geoFont)

                    graph.setCellStyles('fontSize', fs, [txtCell])
                    graph.setCellStyles('rotation', fontRotate, [txtCell])

                    let textStr = txtArr.join('')
                    let textContent = txtCell.value

                    if (TextUtil.compareTextContent(textStr, textContent)) {
                        txtCell.value = txtArr.join('\n')
                        GraphTool.autosize(graph, [txtCell])
                    }

                    // txtCell.value = txtArr.join('\n')
                    //
                    // GraphTool.autosize(graph, [txtCell])
                }

                let pointCellId = 'Point-' + cell.id
                let pointCell = model.getCell(pointCellId)
                let dataList2 = txtJson['svgPointArray']

                if (pointCell && dataList2) {
                    let { fs, rotate: fontRotate, cor } = this.fontParse2(dataList2)

                    let geoFont = pointCell.geometry.clone()

                    geoFont.x = cor.x
                    geoFont.y = cor.y

                    graph.setCellStyles('fontSize', fs, [pointCell])
                    graph.setCellStyles('rotation', fontRotate, [pointCell])

                    model.setGeometry(pointCell, geoFont)
                    GraphTool.autosize(graph, [pointCell])
                }
            }

            // 线处理
            let lineHandler = (cell, props) => {
                let { possj } = props
                let str = possj.match(commonReg)[1]
                let corlist = getDrawioCor(str)

                let list = corlist.map((vec) => new mxPoint(vec.x, vec.y))
                let preGeo = cell.geometry
                let geoClone = preGeo.clone()
                geoClone.sourcePoint = list[0]
                geoClone.targetPoint = list[list.length - 1]
                if (list.length > 2) {
                    let midPoints = list.slice(1, list.length - 1)
                    geoClone.points = midPoints
                } else {
                    geoClone.points = null
                }
                model.setGeometry(cell, geoClone)
            }

            // 获取子设备
            let list = GraphTool.getCellsOfStation(graph, group)

            // 根据设备ID查找地图上的设备
            let idList = list.map((cell) => cell.id)
            let psridList = []

            for (let cell of list) {
                let psrid = cell.sbid
                if (psrid) {
                    psridList.push(psrid)
                }
            }

            features = map.queryRenderedFeatures({
                layers: ['vector-sg-layer-line', 'vector-sg-layer-point'],
                filter: [
                    'any',
                    ['in', ['get', 'sbid'], ['literal', psridList]],
                    ['in', ['get', 'handle'], ['literal', idList]]
                ]
            })

            let styleStr = group.style
            // 解组
            graph.ungroupCells([group])

            // let cellList = []; // 用于测试的的数组
            for (let fe of features) {
                let props = fe.properties
                let { handle } = props

                let cell = model.getCell(handle)

                if (!cell) {
                    let psrid = props.sbid
                    let psrtype = props.psrtype

                    if (psrtype && psrid) {
                        let tmpId = 'PD_' + psrtype + '_' + psrid
                        cell = model.getCell(tmpId)
                    }
                }

                if (model.isVertex(cell)) {
                    devSymbolHandler(cell, props)
                } else {
                    lineHandler(cell, props)
                }
                // cellList.push(cell);
            }

            // 下面两行用于测试
            // graph.setCellStyles('strokeColor', 'green',  cellList);
            // graph.setCellStyles('fillColor', 'green',  cellList);

            curGroup = graph.groupCells(null, 0, list)
            // 把原始编组属性添加到新生成的组
            let styleObj = TextUtil.parseDrawioStyle(styleStr)
            for (let key in styleObj) {
                let v = styleObj[key]
                if (v) {
                    graph.setCellStyles(key, v, [curGroup])
                }
            }
        }

        // ---------------------------------------4、重设母线与连接线位置---------------------------------------
        {
            let getFeatureProps = (id) => {
                for (let fe of features) {
                    let props = fe.properties
                    if (props.handle == id) {
                        return props
                    }
                }
                return null
            }
            let mxList = GraphTool.getBus(graph, curGroup)
            // 重算连接线与母线的垂直连接点
            let resetConnectPoint = (mx) => {
                // let props = getFeatureProps(mx.id);
                // resetMx(mx, props);

                let edges = model.getEdges(mx)
                let mxgeo = mx.geometry
                let x_mx = mxgeo.x
                let y_mx = mxgeo.y
                let w_mx = mxgeo.width
                let h_mx = mxgeo.height

                let lineStart = new Vector2(x_mx, y_mx + h_mx / 2)
                let lineEnd = new Vector2(x_mx + w_mx, y_mx + h_mx / 2)
                let width = lineStart.clone().sub(lineEnd).length()
                for (let edge of edges) {
                    // let vecList = GraphTool.getEdgePointsCommon(graph, edge); // 不能用这种方式，sourcePoint与targetPoint的问题
                    // let len = vecList.length;

                    // let geometry = edge.geometry
                    // let point
                    // if (edge.source == mx) {
                    //     let { x, y } = geometry.sourcePoint
                    //     point = new Vector2(x, y)
                    // } else {
                    //     let { x, y } = geometry.targetPoint
                    //     point = new Vector2(x, y)
                    // }

                    let cellAdjacent = GraphTool.getAdjacentCellOfEdge(graph, edge, mx) // 获取连接线对面的cell
                    // 计算线与对面设备连接点坐标
                    let point = GraphTool.getTouchPointByRelation(graph, cellAdjacent, edge)

                    let closetPoint = mathutil.closestPointOnLineSegment(point, lineStart, lineEnd)

                    let leftLen = lineStart.clone().sub(closetPoint).length()
                    let ratio = leftLen / width
                    if (edge.source == mx) {
                        graph.setCellStyles('exitX', ratio, [edge])
                    } else {
                        graph.setCellStyles('entryX', ratio, [edge])
                    }
                }
            }
            for (let mx of mxList) {
                resetConnectPoint(mx)
            }
        }
    },

    // 根据闭合的站房重算站房位置
    repositionStationByClosed(map, graph, symbolProp, params, group, feature, stationCell) {
        let model = graph.getModel()
        let reg = /\(([^()]+)\)/

        let props = feature.properties
        let possj = props.possj
        if (!possj) {
            return
        }

        let corstr = possj.match(reg)[1]
        let lnglatList = corstr.split(',').map((cor) => {
            let sarr = cor.split(' ')
            return [+sarr[0], +sarr[1]]
        })
        let pixelList = []
        for (let cor of lnglatList) {
            pixelList.push(GisUtil.sg2drawio(params, cor[0], cor[1]))
        }

        let p1 = pixelList[0]
        let p2 = pixelList[1]
        let p3 = pixelList[2]

        let width = p1.clone().sub(p2).length()

        let groupGeo = graph.getCellGeometry(group).clone()

        let pCenter = mathutil.midPoint(p1, p3)

        let x = pCenter.x - width / 2
        let y = pCenter.y - width / 2

        groupGeo.x = x
        groupGeo.y = y
        groupGeo.width = width
        groupGeo.height = width

        graph.resizeCell(group, groupGeo, true)

        // 处理文字
        let sbsxjsonstr = props.sbsxjsonstr
        if (!sbsxjsonstr) {
            return
        }

        let txtJson = JSON.parse(sbsxjsonstr)

        let txtCellId = 'TXT-' + stationCell.id
        let txtCell = model.getCell(txtCellId)
        let dataList = txtJson['svgTextArray']

        if (txtCell && dataList) {
            let { fs, rotate: fontRotate, cor, txtArr } = this.fontParse2(dataList)

            let textStr = txtArr.join('')
            let textContent = txtCell.value

            let geoFont = txtCell.geometry.clone()

            graph.setCellStyles('fontSize', fs, [txtCell])
            graph.setCellStyles('rotation', fontRotate, [txtCell])

            // txtCell.value = txtArr.join('\n')
            // GraphTool.autosize(graph, [txtCell])

            geoFont.x = cor.x
            geoFont.y = cor.y
            model.setGeometry(txtCell, geoFont)

            if (TextUtil.compareTextContent(textStr, textContent)) {
                txtCell.value = txtArr.join('\n')
                GraphTool.autosize(graph, [txtCell])
            }

            // window.setTimeout(() => {
            //     model.setGeometry(txtCell, geoFont.clone())
            // }, 200)
        }
    },

    // 图元对齐
    repositionDev(map, graph, symbolProp, params, cell, feature) {
        let model = graph.getModel()

        // 1、设备处理 ----------------------------------------
        // "POINT(113.6203491 34.7636215)"
        let regPoint = /^.+?\(([^)]+)\)/
        let regLineString = /\(([^()]+)\)/
        let props = feature.properties
        let { possj, symbolrotate, symbolsize } = props
        let corstr = possj.match(regLineString)[1]

        let lnglatList = corstr.split(',').map((cor) => {
            let sarr = cor.split(' ')
            return [+sarr[0], +sarr[1]]
        })
        let pixelList = []
        for (let cor of lnglatList) {
            pixelList.push(GisUtil.sg2drawio(params, cor[0], cor[1]))
        }

        let preGeo = cell.geometry
        let preWidth = preGeo.width
        let preHeight = preGeo.height

        let v1 = pixelList[0]
        let v2 = pixelList[pixelList.length - 1]

        let vec = v2.clone().sub(v1)

        // let angle = mathutil.radian2Angle(vec.angle())

        let angle = symbolrotate
        let co = mathutil.midPoint(v1, v2)

        let width_pixel = vec.length()
        let ratio = width_pixel / preWidth
        let height_pixel = preHeight * ratio

        let geoClone = preGeo.clone()
        geoClone.x = co.x - width_pixel / 2
        geoClone.y = co.y - height_pixel / 2
        geoClone.width = width_pixel
        geoClone.height = height_pixel

        model.setGeometry(cell, geoClone)
        graph.setCellStyles('rotation', angle, [cell])

        // 2、文字处理 ----------------------------------------
        let sbsxjsonstr = props.sbsxjsonstr
        if (!sbsxjsonstr) {
            return
        }

        let txtJson = JSON.parse(sbsxjsonstr)

        let txtCellId = 'TXT-' + cell.id
        let txtCell = model.getCell(txtCellId)
        let dataList = txtJson['svgTextArray']

        if (txtCell && dataList) {
            let { fs, rotate: fontRotate, cor, txtArr } = this.fontParse2(dataList)

            let textStr = txtArr.join('')
            let textContent = txtCell.value

            graph.setCellStyles('fontSize', fs, [txtCell])
            graph.setCellStyles('rotation', fontRotate, [txtCell])

            if (TextUtil.compareTextContent(textStr, textContent)) {
                txtCell.value = txtArr.join('\n')
                GraphTool.autosize(graph, [txtCell])
            }

            // txtCell.value = txtArr.join('\n')
            GraphTool.autosize(graph, [txtCell])

            let geoFont = txtCell.geometry.clone()
            geoFont.x = cor.x
            geoFont.y = cor.y

            model.setGeometry(txtCell, geoFont)
        }

        let pointCellId = 'Point-' + cell.id
        let pointCell = model.getCell(pointCellId)
        let dataList2 = txtJson['svgPointArray']

        if (pointCell && dataList2) {
            let { fs, rotate: fontRotate, cor, txtArr } = this.fontParse2(dataList2)

            // let textStr = txtArr.join('');
            //
            // let textContent = pointCell.value;

            let geoFont = pointCell.geometry.clone()
            model.setGeometry(pointCell, geoFont)

            graph.setCellStyles('fontSize', fs, [pointCell])
            graph.setCellStyles('rotation', fontRotate, [pointCell])

            GraphTool.autosize(graph, [pointCell])

            geoFont.x = cor.x
            geoFont.y = cor.y
        }
    },
    /**
     * 变电站对齐，不处理文本大小，只做平移
     * @param map
     * @param graph
     * @param symbolProp
     * @param params
     * @param cell
     * @param feature
     */
    repositionSubstation(map, graph, symbolProp, params, cell, feature) {
        let model = graph.getModel()

        let gapTxt = GisUtil.meter2drawio(params, 0.5) // 设置.5米间距

        // 1、设备处理 ----------------------------------------
        // "POINT(113.6203491 34.7636215)"
        let regLineString = /\(([^()]+)\)/
        let props = feature.properties
        let { possj } = props
        let corstr = possj.match(regLineString)[1]

        let lnglatList = corstr.split(',').map((cor) => {
            let sarr = cor.split(' ')
            return [+sarr[0], +sarr[1]]
        })
        let pixelList = []
        for (let cor of lnglatList) {
            pixelList.push(GisUtil.sg2drawio(params, cor[0], cor[1]))
        }

        let stationGeo = cell.geometry.clone()

        let p1 = pixelList[0]
        let p2 = pixelList[1]
        let p3 = pixelList[2]

        let width = p1.clone().sub(p2).length()

        let pCenter = mathutil.midPoint(p1, p3)

        let x = pCenter.x - width / 2
        let y = pCenter.y - width / 2

        stationGeo.x = x
        stationGeo.y = y
        stationGeo.width = width
        stationGeo.height = width

        model.setGeometry(cell, stationGeo)

        // 处理文字
        let txtId = 'TXT-' + cell.id
        let txtCell = model.getCell(txtId)
        if (txtCell) {
            let txtGeo = model.getGeometry(txtCell).clone()

            let txtCenterX = stationGeo.x + width / 2
            let txtCenterY = stationGeo.y + width + gapTxt + txtGeo.height / 2

            txtGeo.x = txtCenterX - txtGeo.width / 2
            txtGeo.y = txtCenterY - txtGeo.height / 2

            model.setGeometry(txtCell, txtGeo)
        }
    },
    // 闭合的站房对齐
    repositionClosedStationDev(map, graph, symbolProp, params, cell, feature) {
        let model = graph.getModel()

        // 1、设备处理 ----------------------------------------
        // "POINT(113.6203491 34.7636215)"
        let regPoint = /^.+?\(([^)]+)\)/
        let regLineString = /.+?\(([^)]+)\)/

        let commonReg = /\(([^()]+)\)/

        let props = feature.properties
        let { possj, symbolrotate, symbolsize } = props
        let corstr = possj.match(commonReg)[1]

        let lnglatList = corstr.split(',').map((cor) => {
            let sarr = cor.split(' ')
            return [+sarr[0], +sarr[1]]
        })
        let pixelList = []
        for (let cor of lnglatList) {
            pixelList.push(GisUtil.sg2drawio(params, cor[0], cor[1]))
        }

        let preGeo = cell.geometry
        // let preWidth = preGeo.width;
        // let preHeight = preGeo.height;

        let v1 = pixelList[0]
        let v2 = pixelList[1]
        let v3 = pixelList[2]

        let vec = v2.clone().sub(v1)
        let co = mathutil.midPoint(v1, v3)

        let width_pixel = vec.length()

        let geoClone = preGeo.clone()
        geoClone.x = co.x - width_pixel / 2
        geoClone.y = co.y - width_pixel / 2
        geoClone.width = width_pixel
        geoClone.height = width_pixel

        model.setGeometry(cell, geoClone)
        // graph.setCellStyles('rotation', angle,  [cell]);

        // 2、文字处理 ----------------------------------------
        let sbsxjsonstr = props.sbsxjsonstr
        if (!sbsxjsonstr) {
            return
        }

        let txtJson = JSON.parse(sbsxjsonstr)

        let txtCellId = 'TXT-' + cell.id
        let txtCell = model.getCell(txtCellId)
        let dataList = txtJson['svgTextArray']

        if (txtCell && dataList) {
            let { fs, rotate: fontRotate, cor, txtArr } = this.fontParse2(dataList)

            let textStr = txtArr.join('')
            let textContent = txtCell.value

            graph.setCellStyles('fontSize', fs, [txtCell])
            graph.setCellStyles('rotation', fontRotate, [txtCell])

            if (TextUtil.compareTextContent(textStr, textContent)) {
                txtCell.value = txtArr.join('\n')
                GraphTool.autosize(graph, [txtCell])
            }

            // txtCell.value = txtArr.join('\n');

            let geoFont = txtCell.geometry.clone()
            geoFont.x = cor.x
            geoFont.y = cor.y

            model.setGeometry(txtCell, geoFont)
        }

        let pointCellId = 'Point-' + cell.id
        let pointCell = model.getCell(pointCellId)
        let dataList2 = txtJson['svgPointArray']

        if (pointCell && dataList2) {
            let { fs, rotate: fontRotate, cor, txtArr } = this.fontParse2(dataList2)

            let geoFont = pointCell.geometry.clone()
            geoFont.x = cor.x
            geoFont.y = cor.y

            model.setGeometry(pointCell, geoFont)
            graph.setCellStyles('fontSize', fs, [pointCell])
            graph.setCellStyles('rotation', fontRotate, [pointCell])

            GraphTool.autosize(graph, [pointCell])
        }
    },
    /**
     * 方法已弃用
     * 在没有保存，首次由下次图转化为地理接线图，首次初始化时遍历所有指定设备，缩短或者拉伸与杆的间距
     * @param graph
     */
    reCalculatePoleMountedTransformer_bak(graph, symbolProp, param) {
        let model = graph.getModel()
        let view = graph.getView()

        let polePsrtype = '0103' // 杆塔类型

        let cellList = graph.getVerticesAndEdges()
        // let poleTransformerList = [];

        // 用于滤重
        let keys = new Set()

        // 查找根结点杆塔(0103)
        let findLastestPole = (cell) => {
            if (!cell) {
                return null
            }
            if (keys.has(cell)) {
                return null
            }
            keys.add(cell)

            if (cell.psrtype == polePsrtype) {
                return cell
            }

            if (model.isVertex(cell)) {
                let edgeList = model.getEdges(cell)
                for (let edge of edgeList) {
                    let tmpCell = findLastestPole(edge)
                    if (tmpCell && tmpCell.psrtype == polePsrtype) {
                        return tmpCell
                    }
                }
            } else if (model.isEdge(cell)) {
                let scell = model.getTerminal(cell, true)
                let tcell = model.getTerminal(cell, false)

                let tmpCell = findLastestPole(scell)
                if (tmpCell && tmpCell.psrtype == polePsrtype) {
                    return tmpCell
                }

                tmpCell = findLastestPole(tcell)

                if (tmpCell && tmpCell.psrtype == polePsrtype) {
                    return tmpCell
                }
            }

            return null
        }

        /**
         * 要求只允许下面设备可以做计算
         * 0116：避雷器
         * 0103：杆塔
         * 0115：跌落式熔断器
         * 0110：柱变
         * 0115：跌落
         * 0111：柱上断路器
         * @param cell
         */
        let devSet = new Set(['0116', '0103', '0115', '0110', '0115', '0111'])

        let gap = 50 // 设备间隔
        /**
         * 重算curCell距离preCell的位置
         * @param preCell 这个是相对cell，不处理
         * @param edge    两个cell之间的连接线
         * @param curCell  相对preCell要移动的cell
         */
        let resetDistance = (preCell, edge, curCell) => {
            // symbol中心及连接位置
            let preSymbolArr = symbolProp[preCell.symbol]
            let curSymbolArr = symbolProp[curCell.symbol]

            // 实际中心点比率
            let xratio_center_pre = preSymbolArr['xratio']
            let yratio_center_pre = preSymbolArr['yratio']

            let xratio_center_cur = curSymbolArr['xratio']
            let yratio_center_cur = curSymbolArr['yratio']

            // 当前设备curCell左右连接点坐标
            let left_point_cur = GraphTool.getTouchPoint(graph, curCell, 0, yratio_center_cur)
            let right_point_cur = GraphTool.getTouchPoint(graph, curCell, 1, yratio_center_cur)

            // 查找线路与设备连接位置比率，用于查找连接位置
            let xratioPre, yratioPre
            let xratioCur, yratioCur
            let styleEdgeObj = graph.getCurrentCellStyle(edge)
            if (edge.source == curCell) {
                xratioCur = +styleEdgeObj.exitX
                yratioCur = +styleEdgeObj.exitY

                xratioPre = +styleEdgeObj.entryX
                yratioPre = +styleEdgeObj.entryY
            } else {
                xratioCur = +styleEdgeObj.entryX
                yratioCur = +styleEdgeObj.entryY

                xratioPre = +styleEdgeObj.exitX
                yratioPre = +styleEdgeObj.exitY
            }

            // 计算curCell方向向量与单位向量
            let vecCur, vecCurNor // 方向向量与单位向量
            let vecPointCur // curCell的连接点
            if (xratioCur < 0.3) {
                // curCell左侧连接点
                vecPointCur = left_point_cur
                vecCur = right_point_cur.clone().sub(left_point_cur)
            } // curCell右侧连接点
            else {
                vecPointCur = right_point_cur
                vecCur = left_point_cur.clone().sub(right_point_cur)
            }
            vecCurNor = vecCur.clone().normalize()
            // graph.insertVertex(graph.getDefaultParent(), null, null, vecPointCur.x - 10, vecPointCur.y - 10, 20, 20, 'rounded;fillColor=green;');

            let preGeo = preCell.geometry
            let geoClone = curCell.geometry

            let vecPointTarget // 最终连接点
            if (preCell.psrtype == polePsrtype) {
                // 如果是杆塔，与杆塔相连接的是矩形
                let { width } = preGeo
                let preCenterVec = new Vector2(preGeo.getCenterX(), preGeo.getCenterY())
                vecPointTarget = preCenterVec
                    .clone()
                    .add(vecCurNor.clone().multiplyScalar(width / 2 + gap))
            } else {
                let vecPointPre // preCell的连接点
                // preCell的左右连接点
                let left_point_pre = GraphTool.getTouchPoint(graph, preCell, 0, yratio_center_pre)
                let right_point_pre = GraphTool.getTouchPoint(graph, preCell, 1, yratio_center_pre)

                let vecDirNor // 方向单位向量 （非连接点 至 连接点 的方向）
                if (xratioPre < 0.3) {
                    // preCell左侧连接点
                    vecPointPre = left_point_pre
                    vecDirNor = left_point_pre.clone().sub(right_point_pre).normalize()
                } // preCell右侧连接点
                else {
                    vecPointPre = right_point_pre
                    vecDirNor = right_point_pre.clone().sub(left_point_pre).normalize()
                }
                // graph.insertVertex(graph.getDefaultParent(), null, null, vecPointPre.x - 10, vecPointPre.y - 10, 20, 20, 'rounded;fillColor=blue;');
                // 按照前一个设备延伸的方向计算新的连接点
                vecPointTarget = vecPointPre.clone().add(vecDirNor.multiplyScalar(gap))
            }
            // 开始最终平移操作
            let vecStep = vecPointTarget.clone().sub(vecPointCur) // 平移向量

            // A:平移设备
            let vecCurLeftTop = new Vector2(geoClone.x, geoClone.y)
            let vecTarget = vecStep.clone().add(vecCurLeftTop)
            geoClone.x = vecTarget.x
            geoClone.y = vecTarget.y
            model.setGeometry(curCell, geoClone)

            // B:平移文本
            let devId = curCell.id
            let txtId = 'TXT-' + devId
            let txtCell = model.getCell(txtId)
            if (txtCell) {
                let txtGeo = txtCell.geometry.clone()
                let vecTxtLT = new Vector2(txtGeo.x, txtGeo.y)
                vecTarget = vecStep.clone().add(vecTxtLT)
                txtGeo.x = vecTarget.x
                txtGeo.y = vecTarget.y
                model.setGeometry(txtCell, txtGeo)
            }
            // 平移测点
            let pointId = 'Point-' + devId
            let pointCell = model.getCell(pointId)
            if (pointCell) {
                let txtGeo = pointCell.geometry.clone()
                let vecTxtLT = new Vector2(txtGeo.x, txtGeo.y)
                vecTarget = vecStep.clone().add(vecTxtLT)
                txtGeo.x = vecTarget.x
                txtGeo.y = vecTarget.y
                model.setGeometry(pointCell, txtGeo)
            }
        }
        /**
         * 开始重新计算位置
         * @param cell
         */
        let calculateHandler = (cell) => {
            if (cell.pid) {
                return
            }
            if (cell && keys.has(cell)) {
                return
            }

            let psrtype = cell.psrtype
            if (!devSet.has(psrtype)) {
                return
            }

            if (!model.isVertex(cell)) {
                return
            }

            if (cell.isText) {
                return
            }

            keys.add(cell)

            let edgeList = model.getEdges(cell)
            // 寻找相邻节点
            for (let edge of edgeList) {
                let adjacentCell = GraphTool.getAdjacentCellOfEdge(graph, edge, cell) // 获取当前cell相连接的cell
                if (adjacentCell.pid) {
                    // 如果设备在站房，超出处理范围
                    continue
                }
                if (keys.has(adjacentCell)) {
                    continue
                }
                if (
                    adjacentCell &&
                    adjacentCell.psrtype == cell.psrtype &&
                    cell.psrtype == polePsrtype
                ) {
                    // 如果相邻的设备都是杆塔，不做处理
                    continue
                }
                if (adjacentCell.isText) {
                    continue
                }
                // 重设两个设备之前的位置
                resetDistance(cell, edge, adjacentCell)
                // 继续遍历
                calculateHandler(adjacentCell)
            }
        }
        model.beginUpdate()
        try {
            // 开始遍历所有设备并重算位置
            for (let cell of cellList) {
                // if (cell.psrtype == '0110') {
                if (devSet.has(cell.psrtype)) {
                    let poleCell = findLastestPole(cell)
                    if (poleCell) {
                        keys.clear() // 重置过滤变量，避免冲突
                        calculateHandler(poleCell) // 开始优化显示
                    }
                }
            }
        } finally {
            model.endUpdate()
        }
    },

    /**
     * 重新设备设备与设备的距离（直线方式）
     * @param graph
     * @param symbolMap
     * @param preCell
     * @param edge
     * @param curCell
     * @param lineAngle
     * @param gap 设备之间的距离
     * @param gapTxt 文本与设备的距离
     */
    resetDistanceStraightLine(graph, symbolMap, preCell, edge, curCell, lineAngle, gap, gapTxt) {
        let model = graph.getModel()

        let symbolPre = symbolMap[preCell.symbol]
        let symbolCur = symbolMap[curCell.symbol]

        // 根据 lineAngle 计算方向向量
        let radian = mathutil.angle2Radian(lineAngle)

        // 计算线的方向单位向量
        let dirLineVecNor = new Vector2(Math.cos(radian), Math.sin(radian)).normalize()

        // 1、preCell的连接点
        let vecPointPre = GraphTool.getTouchPointByRelation(graph, preCell, edge, symbolMap)
        let touchAttrPre = GraphTool.getTouchPointAttr(graph, preCell, edge)

        let preGeoClone = preCell.geometry
        let curGeoClone = curCell.geometry.clone()

        // 计算出线长度
        let len = 0
        // 避雷器是单连接点，但连接在左边边缘
        if (symbolPre.touchs == 1 && !DeviceCategoryUtil.isArresterCell(preCell)) {
            len = preGeoClone.width / 2 + gap
        } else {
            len = gap
        }

        // 如果当前连接点是一个，且不是避雷器（圆形或矩形设备）
        if (symbolCur.touchs == 1 && !DeviceCategoryUtil.isArresterCell(curCell)) {
            len = len + curGeoClone.width / 2
        }

        // 根据前一个设备的坐标及方向向量计算出当前设备连接点坐标
        let vecPointTarget = dirLineVecNor.clone().multiplyScalar(len).add(vecPointPre)

        // 当前设备左上角初始坐标
        let vec_center_init_cur = new Vector2(curGeoClone.getCenterX(), curGeoClone.getCenterY())

        if (symbolCur.touchs == 1 && !DeviceCategoryUtil.isArresterCell(curCell)) {
            // 对于圆形设备
            let { width, height } = curGeoClone
            curGeoClone.x = vecPointTarget.x - width / 2
            curGeoClone.y = vecPointTarget.y - height / 2
        } else {
            // cellDir：当前cell的连接点到对面连接点的向量
            let {
                touchPoint,
                oppositePoint,
                dir: cellDir
            } = GraphTool.getCellAttr(graph, curCell, edge, symbolMap)
            let vecAngle = mathutil.vecAngle(dirLineVecNor, cellDir) // 向量夹角

            let curCellAngle = GraphTool.getCellAngle(curCell)

            let vecRelation = mathutil.vecRelation(cellDir, dirLineVecNor)

            let cellAngle = vecRelation > 0 ? curCellAngle + vecAngle : curCellAngle - vecAngle

            // 计算实际中心点
            let vecRealCen = vecPointTarget
                .clone()
                .add(dirLineVecNor.multiplyScalar(curGeoClone.width / 2))

            // 根据实际中心点计算左上角坐标
            let ltVec = GraphTool.getCellPosByRealCenterAndAngle(
                graph,
                curCell,
                vecRealCen,
                cellAngle,
                symbolMap
            )

            curGeoClone.x = ltVec.x
            curGeoClone.y = ltVec.y

            graph.setCellStyles('rotation', cellAngle, [curCell])
        }

        model.setGeometry(curCell, curGeoClone)

        let curVecCenter = new Vector2(curGeoClone.getCenterX(), curGeoClone.getCenterY())
        let vecStep = curVecCenter.clone().sub(vec_center_init_cur)

        // B:平移文本
        let devId = curCell.id
        let txtId = 'TXT-' + devId
        let txtCell = model.getCell(txtId)
        if (txtCell) {
            // let txtGeo = txtCell.geometry.clone();
            // let vecTxtCenter = new Vector2(txtGeo.getCenterX(), txtGeo.getCenterY());
            // let vecTarget = vecStep.clone().add(vecTxtCenter);
            // txtGeo.x = vecTarget.x - txtGeo.width / 2;
            // txtGeo.y = vecTarget.y - txtGeo.height / 2;
            // model.setGeometry(txtCell, txtGeo);

            let symbolObj = symbolMap[curCell.symbol]
            TextHandler.repositionText(graph, curCell, symbolObj, txtCell, gapTxt)
        }

        // 平移测点
        let pointId = 'Point-' + devId
        let pointCell = model.getCell(pointId)
        if (pointCell) {
            // let txtGeo = pointCell.geometry.clone();
            // let vecTxtLT = new Vector2(txtGeo.getCenterX(), txtGeo.getCenterY());
            // let vecTarget = vecStep.clone().add(vecTxtLT);
            // txtGeo.x = vecTarget.x - txtGeo.width / 2;
            // txtGeo.y = vecTarget.y - txtGeo.height / 2;
            // model.setGeometry(pointCell, txtGeo);

            let symbolObj = symbolMap[curCell.symbol]
            TextHandler.repositionText(graph, curCell, symbolObj, pointCell, gapTxt)
        }
    },

    // 单个柱上设备优化测试版本
    reCalculateOnePoleMountedTransformer(graph, poleCell, symbolProp, gap, gapTxt) {
        let model = graph.getModel()

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
        let devUpdateSet = new Set(['0116', '0110', '0115', '0111', '0113', '370000', '0811003'])

        // 初始化杆塔连接线，需要找到已存角度
        let getExistAngle = (cell, list) => {
            let arr = []
            for (let { edge, isSource, lineAngle, vecList, dir } of list) {
                let adjacentCell = GraphTool.getAdjacentCellOfEdge(graph, edge, cell) // 获取当前cell相连接的cell
                // 不需要修改的设备
                if (!devUpdateSet.has(adjacentCell.psrtype)) {
                    arr.push(dir)
                }
            }
            return arr
        }

        /**
         * 开始重新计算位置
         * @param cell
         */
        let calculateHandler = (preCell, linkedEdge, curCell, perfectAngle) => {
            if (curCell.pid) {
                // 不处理站内设备，会出异常
                return
            }

            if (curCell && keys.has(curCell)) {
                // 已遍历过退出
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
            this.resetDistanceStraightLine(
                graph,
                symbolProp,
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

        // 杆塔的处理
        let cellAttrMap = GraphMath.getEdgeAttrOfTouch(graph, poleCell, symbolProp)
        let edgeAttrList = cellAttrMap.get('o')
        let existDirList = getExistAngle(poleCell, edgeAttrList)
        keys.add(poleCell)

        let keysCounter = new Set()
        let counter = 0

        // 查找当前路径柱上设备个数
        let getZssbCounter = (preCell, curCell) => {
            if (!curCell) {
                return
            }

            if (DeviceCategoryUtil.isTextCell(curCell)) {
                return
            }

            if (keysCounter.has(curCell)) {
                return
            }

            keysCounter.add(curCell)

            if (counter > 5) {
                return
            }
            counter++

            let edges = model.getEdges(curCell)

            for (let edge of edges) {
                let adjacentCell = GraphTool.getAdjacentCellOfEdge(graph, edge, curCell)
                getZssbCounter(curCell, adjacentCell)
            }
        }

        let limit = 5
        for (let { isSource, edge, lineAngle, vecList } of edgeAttrList) {
            // 获取当前cell相连接的cell
            // 检查是否是柱上设备，当前判断条件为，低于5个断线
            let adjacentCell = GraphTool.getAdjacentCellOfEdge(graph, edge, poleCell)

            // 如果当前相邻设备是杆塔，跳过
            // if (adjacentCell)
            // {
            // 	let counter = GraphTool.getPathCellCounter(graph, poleCell, adjacentCell, limit);
            // 	// 不能是杆塔、非处理设备、及站内设备
            // 	if (!devUpdateSet.has(adjacentCell.psrtype) || adjacentCell.pid || counter > limit) {
            // 		continue;
            // 	}
            // }

            if (!adjacentCell) {
                continue
            }
            let isPass = PoleHandler.checkRouterPass(graph, poleCell, adjacentCell, 5)
            if (!isPass) {
                continue
            }

            let { angle: perfectAngle, dir } = GraphMath.getOptimalAngle(existDirList)
            existDirList.push(dir)

            // 处理当前分支
            calculateHandler(poleCell, edge, adjacentCell, perfectAngle) // 开始优化连接
        }
    },

    /**
     * 在没有保存，首次由下次图转化为地理接线图，首次初始化时遍历所有指定设备，缩短或者拉伸与杆的间距
     * @param graph
     * @param symbolProp
     */
    reCalculatePoleMountedTransformer(graph, symbolProp, gap, gapTxt, isGlobal) {
        let cellList = graph.getVerticesAndEdges(true)
        // 开始遍历所有设备并重算位置
        for (let cell of cellList) {
            if (
                DeviceCategoryUtil.isPoleCell(cell) ||
                DeviceCategoryUtil.isCableTerminalCell(cell)
            ) {
                if (isGlobal) {
                    // 全局优化
                    this.reCalculateOnePoleMountedTransformer(graph, cell, symbolProp, gap, gapTxt)
                } else if (!isGlobal && cell.upFlag == 2) {
                    // 增量优化
                    // cell.upFlag = 1;
                    this.reCalculateOnePoleMountedTransformer(graph, cell, symbolProp, gap, gapTxt)
                }
            }
        }
    },

    /**
     * 优化变电站出线
     * @param graph
     * @param substationCell
     * @param gap
     */
    optimizeOutgoingLineOfSubstation(graph, substationCell, gap) {
        let model = graph.getModel()

        let stationGeo = model.getGeometry(substationCell)
        let { width, height } = stationGeo
        let cx = stationGeo.getCenterX()
        let cy = stationGeo.getCenterY()

        let stationPolygon = GraphTool.cellPolygon(graph, substationCell)

        let keys = new Set()
        keys.add(substationCell)

        // 查找第一个在变电站外面的与变电站连接的设备
        let findOuterCellFirstHandler = (cell) => {
            if (keys.has(cell)) {
                return null
            }

            keys.add(cell)

            let cellPolygon = GraphTool.cellPolygon(graph, cell)

            // 当前cell不和变电站相交切在变电站中则返回
            if (
                !geometric.polygonInPolygon(cellPolygon, stationPolygon) &&
                !geometric.polygonIntersectsPolygon(cellPolygon, stationPolygon)
            ) {
                return cell
            }

            let edgeList = model.getEdges(cell)
            let tmpCell
            for (let edge of edgeList) {
                let scell = model.getTerminal(edge, true)
                let tcell = model.getTerminal(edge, false)

                tmpCell = findOuterCellFirstHandler(scell)
                if (tmpCell) {
                    return tmpCell
                }

                tmpCell = findOuterCellFirstHandler(tcell)
                if (tmpCell) {
                    return tmpCell
                }
            }
            return null
        }

        let edges = model.getEdges(substationCell)

        let lineCell = edges[0]

        if (!lineCell) {
            return
        }
        // 第一个和变电站连接的设备
        let adjacentCell = GraphTool.getAdjacentCellOfEdge(graph, lineCell, substationCell)
        if (!adjacentCell) {
            return
        }
        let firstOuterCell = findOuterCellFirstHandler(adjacentCell)

        if (!firstOuterCell) {
            return
        }

        // 查看第一个在变电站外面的设备与变电站的位置关系（left、right、top、bottom）
        // 注意：firstOuterCell可能并不是与变电站连接的断路器，如果断路器在变电站内部
        let position = GraphMath.getCellRegion(graph, firstOuterCell, substationCell)

        let geoClone = model.getGeometry(adjacentCell).clone()
        let { width: kgWidth, height: kgHeight } = geoClone

        // 检查连接线源点是否是变电站
        let isSourceStation = model.getTerminal(lineCell, true) == substationCell ? true : false

        // 检测连接到断路器哪个端点，用以确定旋转角度
        let touch = GraphTool.getTouchPosition(graph, adjacentCell, lineCell)

        let devId = adjacentCell.id

        let txtId = `TXT-${devId}`
        let pointId = `Point-${devId}`

        let txtCell = model.getCell(txtId)
        let pointCell = model.getCell(pointId)

        // 线与变电站连接位置关系
        let connectX, connectY
        if (isSourceStation) {
            connectX = 'exitX'
            connectY = 'exitY'
        } else {
            connectX = 'entryX'
            connectY = 'entryY'
        }

        if (position == 'left') {
            let angle = touch == 'a' ? 180 : 0
            graph.setCellStyles('rotation', angle, [adjacentCell])

            graph.setCellStyles(connectX, 0, [lineCell])
            graph.setCellStyles(connectY, 0.5, [lineCell])

            geoClone.x = cx - gap - width / 2 - geoClone.width / 2
            geoClone.y = cy - geoClone.height / 2
        } else if (position == 'right') {
            let angle = touch == 'a' ? 0 : 180
            graph.setCellStyles('rotation', angle, [adjacentCell])

            graph.setCellStyles(connectX, 1, [lineCell])
            graph.setCellStyles(connectY, 0.5, [lineCell])

            geoClone.x = cx + gap + width / 2 - geoClone.width / 2
            geoClone.y = cy - geoClone.height / 2
        } else if (position == 'top') {
            let angle = touch == 'a' ? 270 : 90
            graph.setCellStyles('rotation', angle, [adjacentCell])

            graph.setCellStyles(connectX, 0.5, [lineCell])
            graph.setCellStyles(connectY, 0, [lineCell])

            geoClone.x = cx - geoClone.width / 2
            geoClone.y = cy - gap - height / 2 - geoClone.height / 2
        } else {
            let angle = touch == 'a' ? 90 : 270
            graph.setCellStyles('rotation', angle, [adjacentCell])

            graph.setCellStyles(connectX, 0.5, [lineCell])
            graph.setCellStyles(connectY, 1, [lineCell])

            geoClone.x = cx - geoClone.width / 2
            geoClone.y = cy + gap + height / 2 - geoClone.height / 2
        }
        model.setGeometry(adjacentCell, geoClone)

        let geo = model.getGeometry(adjacentCell)

        let x = geo.getCenterX()
        let y = geo.getCenterY()

        // 重设文本位置
        if (position == 'left' || position == 'right') {
            // 水平方向处理
            if (txtCell) {
                let txtGeo = model.getGeometry(txtCell).clone()
                txtGeo.x = x - txtGeo.width / 2
                txtGeo.y = y + kgHeight / 2 + kgHeight / 4
                model.setGeometry(txtCell, txtGeo)
            }

            if (pointCell) {
                let pointGeo = model.getGeometry(pointCell).clone()
                pointGeo.x = x - pointGeo.width / 2
                pointGeo.y = y - kgHeight / 2 - kgHeight / 4 - pointGeo.height
                model.setGeometry(pointCell, pointGeo)
            }
        } //垂直方向处理
        else {
            if (txtCell) {
                let txtGeo = model.getGeometry(txtCell).clone()
                txtGeo.x = x - kgHeight / 2 - kgHeight / 4 - txtGeo.width
                txtGeo.y = y - txtGeo.height / 2
                model.setGeometry(txtCell, txtGeo)
            }

            if (pointCell) {
                let pointGeo = model.getGeometry(pointCell).clone()
                pointGeo.x = x + kgHeight / 2 + kgHeight / 4
                pointGeo.y = y - pointGeo.height / 2
                model.setGeometry(pointCell, pointGeo)
            }
        }
    },

    /**
     * 优化站房出线
     * @param graph
     * @param gap
     */
    prettifyStationOutterLine(graph, gap, isGlobal) {
        let list = graph.getVerticesAndEdges(true) // 非mxGraph方法，由drawio实现
        // 查找所有的group
        let groupList = list.filter((item) => {
            let styleStr = item.style
            let styleObj = TextUtil.parseDrawioStyle(styleStr)
            return styleObj.flag == 'station'
        })

        for (let group of groupList) {
            let stationCell = GraphTool.getStationCell(graph, group)

            let busList = GraphTool.getBus(graph, group)
            if (busList == 0) {
                // 站房缺失母线，无法定位
                continue
            }
            if (isGlobal) {
                StationHandler.prettifyOutgoingLine(graph, group, busList, gap)
            } else if (!isGlobal && stationCell.upFlag == 2) {
                // stationCell.upFlag = 1;
                // 获取站内连接点 symbol：junction_pms25_32000000_4300010
                StationHandler.prettifyOutgoingLine(graph, group, busList, gap)
            }
        }
    },

    /**
     * 拓扑验证
     * 检查所有边中缺失设备的线
     * @param graph
     * @returns {*[]}
     */
    topoValidateHandler(graph) {
        let model = graph.getModel()
        let edgeList = graph.getVerticesAndEdges(false, true)

        let list = []
        for (let edge of edgeList) {
            if (DeviceCategoryUtil.isPointLine(edge)) {
                continue
            }
            let sourceCell = model.getTerminal(edge, true)
            let targetCell = model.getTerminal(edge, false)
            if (!sourceCell || !targetCell) {
                if (!sourceCell && !targetCell) {
                    list.push({
                        id: edge.id,
                        name: edge.name || '未命名'
                    })
                } else if (sourceCell && sourceCell.symbol != 'terminal') {
                    list.push({
                        id: edge.id,
                        name: edge.name || '未命名'
                    })
                } else if (targetCell && targetCell.symbol != 'terminal') {
                    list.push({
                        id: edge.id,
                        name: edge.name || '未命名'
                    })
                }
            } else if (sourceCell == targetCell) {
                list.push({
                    id: edge.id,
                    name: '线路连接到同一个设备'
                })
            }
        }

        return list
    },
    // 设置同类型设备的文字大小
    setFontSizeOfSameTypeDev(graph, fontSize) {
        let model = graph.getModel()
        let selCells = graph.getSelectionCells()
        let symbolSet = new Set()
        for (let cell of selCells) {
            if (!symbolSet.has(cell.symbol)) {
                symbolSet.add(cell.symbol)
            }
        }

        let cellList = graph.getVerticesAndEdges(true, false)

        let list = cellList.filter((cell) => symbolSet.has(cell.symbol))

        let txtList = []

        for (let cell of list) {
            let id = cell.id
            let txtId = 'TXT-' + id

            let txtCell = model.getCell(txtId)
            if (txtCell) {
                txtList.push(txtCell)
            }
        }

        graph.setCellStyles('fontSize', fontSize, txtList)
        GraphTool.autosize(graph, txtList)
    },
    // 让设备沿连接的两端设备形成一条线
    deviceLineStraight(graph, cell, symbol, gapTxt) {
        let model = graph.getModel(cell)

        let edgeList = model.getEdges(cell).filter((item) => {
            return !DeviceCategoryUtil.isUselessLine(item)
        })

        if (edgeList.length != 2) {
            return
        }

        // 计算cell连接线与另外两个设备的连接点
        let edge1 = edgeList[0]
        let edge2 = edgeList[1]

        let cell1 = GraphTool.getAdjacentCellOfEdge(graph, edge1, cell)
        let cell2 = GraphTool.getAdjacentCellOfEdge(graph, edge2, cell)

        let p1 = GraphTool.getTouchPointByRelation(graph, cell1, edge1)
        let p2 = GraphTool.getTouchPointByRelation(graph, cell2, edge2)

        // 中心坐标
        let midVec = mathutil.midPoint(p1, p2)

        let cellStyleObj = TextUtil.parseDrawioStyle(cell.style)
        let rot = +cellStyleObj.rotation
        // 连接点大于1计算角度
        if (symbol.touchs > 1) {
            let cellAngle = +cellStyleObj.rotation

            // cell1 至 cell2 的向量及角度
            let vec1 = p2.clone().sub(p1)

            // 计算cell和edge1的连接点，与cell和edge2的连接点
            let p3 = GraphTool.getTouchPointByRelation(graph, cell, edge1)
            let p4 = GraphTool.getTouchPointByRelation(graph, cell, edge2)

            // 计算设备向量与角度
            let vec2 = p4.clone().sub(p3)

            let flag = mathutil.vecRelation(vec2, vec1)

            let angle = mathutil.vecAngle(vec1, vec2)

            if (flag > 0) {
                rot = cellAngle + angle
            } else {
                rot = cellAngle - angle
            }

            graph.setCellStyles('rotation', rot, [cell])
        }

        // 计算需要平移的位置
        {
            let cellGeo = model.getGeometry(cell).clone()

            let { width, height } = cellGeo

            let xratio = symbol['xratio']
            let yratio = symbol['yratio']

            let p5 = new Vector2(xratio * width, yratio * height)
            let p6 = new Vector2(width / 2, height / 2)

            let p = p5.clone().sub(p6)

            let radian = -mathutil.angle2Radian(rot)
            let m = mathutil.commonMatrix(null, radian, null)
            let pInit = p.applyMatrix3(m)

            let tran = midVec.clone().sub(pInit)

            let x = tran.x - width / 2
            let y = tran.y - height / 2

            cellGeo.x = x
            cellGeo.y = y
            model.setGeometry(cell, cellGeo)
        }

        // 处理文本
        {
            // B:平移文本
            let devId = cell.id
            let txtId = 'TXT-' + devId
            let txtCell = model.getCell(txtId)
            if (txtCell) {
                TextHandler.repositionText(graph, cell, symbol, txtCell, gapTxt)
            }

            // 平移测点
            let pointId = 'Point-' + devId
            let pointCell = model.getCell(pointId)
            if (pointCell) {
                TextHandler.repositionText(graph, cell, symbol, pointCell, gapTxt)
            }
        }
    },

    // 多设备缩放
    scaleMulti(graph, s, scaleMap, scaleList) {
        let model = graph.getModel()
        let txtList = []

        let scaleTxtCell = (cell, isGroup) => {
            let id
            let cellObj = scaleMap.get(cell)
            let posCell = new Vector2(cellObj.cx, cellObj.cy)

            if (isGroup) {
                let stationCell = GraphTool.getStationCell(graph, cell)
                id = stationCell.id
            } else {
                id = cell.id
            }
            let txtId = 'TXT-' + id
            let txtCell = model.getCell(txtId)
            if (txtCell) {
                let obj = scaleMap.get(txtCell)
                if (obj) {
                    let txtGeo = model.getGeometry(txtCell).clone()
                    let w = obj.width * s
                    let h = obj.height * s
                    txtGeo.x = obj.cx - w / 2
                    txtGeo.y = obj.cy - h / 2
                    txtGeo.width = w
                    txtGeo.height = h

                    // 文字

                    graph.setCellStyles('fontSize', obj.fs * s, [txtCell])

                    // 位置
                    let posTxt = new Vector2(obj.cx, obj.cy)

                    let vec = posTxt.clone().sub(posCell)
                    let vecNor = vec.clone().normalize()
                    let len = vec.length()

                    let curLen = len * s
                    let vecTarget = vecNor.multiplyScalar(curLen).add(posCell)
                    txtGeo.x = vecTarget.x - txtGeo.width / 2
                    txtGeo.y = vecTarget.y - txtGeo.height / 2

                    model.setGeometry(txtCell, txtGeo)
                }
            }

            let pointId = 'Point-' + id
            let pointCell = model.getCell(pointId)
            if (pointCell) {
                let obj = scaleMap.get(pointCell)
                if (obj) {
                    let pointGeo = model.getGeometry(pointCell).clone()

                    let w = obj.width * s
                    let h = obj.height * s
                    pointGeo.x = obj.cx - w / 2
                    pointGeo.y = obj.cy - h / 2
                    pointGeo.width = w
                    pointGeo.height = h

                    // 文字

                    graph.setCellStyles('fontSize', obj.fs * s, [pointCell])

                    // 位置
                    let posTxt = new Vector2(obj.cx, obj.cy)

                    let vec = posTxt.clone().sub(posCell)
                    let vecNor = vec.clone().normalize()
                    let len = vec.length()

                    let curLen = len * s
                    let vecTarget = vecNor.multiplyScalar(curLen).add(posCell)
                    pointGeo.x = vecTarget.x - pointGeo.width / 2
                    pointGeo.y = vecTarget.y - pointGeo.height / 2

                    model.setGeometry(pointCell, pointGeo)
                }
            }
        }

        for (let cell of scaleList) {
            let obj = scaleMap.get(cell)
            if (obj) {
                let geoClone = model.getGeometry(cell).clone()
                let w = obj.width * s
                let h = obj.height * s
                geoClone.x = obj.cx - w / 2
                geoClone.y = obj.cy - h / 2
                geoClone.width = w
                geoClone.height = h

                if (obj.isGroup) {
                    graph.resizeCell(cell, geoClone, true)
                    scaleTxtCell(cell, true)
                } else {
                    model.setGeometry(cell, geoClone)
                    scaleTxtCell(cell, false)
                }
            }
        }
    },

    // 多设备相同基数缩放
    scaleMultiEqualRatio(graph, s, scaleMap, scaleList, symbolProp) {
        let model = graph.getModel()
        let scaleSum = 0;
        let scaleCount = 0;

        let scaleLineTxt = (txtCell, _s) => {
            // debugger
            let txtObj = scaleMap.get(txtCell.id)
            let txtGeo = model.getGeometry(txtCell).clone()
            let w = txtObj.width * _s
            let h = txtObj.height * _s

            txtGeo.x = txtObj.cx - w / 2
            txtGeo.y = txtObj.cy - h / 2
            txtGeo.width = w
            txtGeo.height = h

            // 文字

            graph.setCellStyles('fontSize', txtObj.fs * _s, [txtCell])
            model.setGeometry(txtCell, txtGeo)
        }
        // 缩放文本
        let scaleTxtCell = (cell, isGroup) => {
            let id
            let cellObj = scaleMap.get(cell.id)
            let geo = model.getGeometry(cell)
            let curWidth = geo.width
            let curScale = curWidth / cellObj.width
            scaleSum = scaleSum + curScale;
            scaleCount = scaleCount + 1;

            let posCell = new Vector2(cellObj.cx, cellObj.cy)

            if (isGroup) {
                let stationCell = GraphTool.getStationCell(graph, cell)
                id = stationCell.id
            } else {
                id = cell.id
            }

            let txtId = 'TXT-' + id
            let txtCell = model.getCell(txtId)
            if (txtCell) {
                let txtObj = scaleMap.get(txtCell.id)

                if (txtObj) {
                    let txtGeo = model.getGeometry(txtCell).clone()
                    let w = txtObj.width * curScale
                    let h = txtObj.height * curScale

                    txtGeo.x = txtObj.cx - w / 2
                    txtGeo.y = txtObj.cy - h / 2
                    txtGeo.width = w
                    txtGeo.height = h

                    // 文字

                    graph.setCellStyles('fontSize', txtObj.fs * curScale, [txtCell])

                    // 位置
                    let posTxt = new Vector2(txtObj.cx, txtObj.cy)

                    let vec = posTxt.clone().sub(posCell)
                    let vecNor = vec.clone().normalize()
                    let len = vec.length()

                    let curLen = len * curScale
                    let vecTarget = vecNor.multiplyScalar(curLen).add(posCell)
                    txtGeo.x = vecTarget.x - txtGeo.width / 2
                    txtGeo.y = vecTarget.y - txtGeo.height / 2

                    model.setGeometry(txtCell, txtGeo)
                }
            }
        }

        /**
         * 缩放站内文本
         * @param cell     文本
         * @param scale    缩放位数
         */
        let scaleStationTxt = (cell, scale) => {
            let txtGeo = model.getGeometry(cell).clone()

            let preCx = txtGeo.getCenterX()
            let preCy = txtGeo.getCenterY()
            let preW = txtGeo.width
            let preH = txtGeo.height

            let curWidth = preW * scale
            let curHiehgt = preH * scale

            txtGeo.width = curWidth
            txtGeo.height = curHiehgt

            let styleObj = TextUtil.parseDrawioStyle(cell.style)
            let fs = +styleObj.fontSize

            // 文字
            graph.setCellStyles('fontSize', fs * scale, [cell])

            txtGeo.x = preCx - curWidth / 2
            txtGeo.y = preCy - curHiehgt / 2

            model.setGeometry(cell, txtGeo)
        }

        // 缩放站房
        let scaleGroup = (group, obj) => {
            let list = GraphTool.getCellsOfStation(graph, group)

            let cellList = []
            let minRatio
            for (let cell of list) {
                if (DeviceCategoryUtil.isTextCell(cell)) {
                    cellList.push(cell)
                    continue
                }
                if (!model.isVertex(cell)) {
                    continue
                }

                if (DeviceCategoryUtil.isStationCell(cell)) {
                    continue;
                }


                let symbolId = cell.symbol
                let symbolAttr = symbolProp[symbolId]

                if (!symbolAttr) {
                    continue
                }

                let initWidth = symbolAttr['initWidth']

                let geo = model.getGeometry(cell)
                let { width, height } = geo

                let ratio = width / initWidth

                let tmpRatio = s / ratio

                if (!minRatio || tmpRatio < minRatio) {
                    minRatio = tmpRatio
                }
            }

            if (!minRatio) {
                minRatio = 1
            }

            let geoClone = model.getGeometry(group).clone()

            let width = geoClone.width * minRatio
            let height = geoClone.height * minRatio

            geoClone.x = obj.cx - width / 2
            geoClone.y = obj.cy - height / 2
            geoClone.width = width
            geoClone.height = height

            graph.resizeCell(group, geoClone, true)

            // 处理站房文本
            let stationCell = GraphTool.getStationCell(graph, group)

            {
                let stationId = stationCell.id
                let txtId = 'TXT-' + stationId
                let txtCell = model.getCell(txtId)
                if (txtCell) {
                    let stationGeo = model.getGeometry(stationCell)

                    let vecGroupCenter = new Vector2(
                        stationGeo.getCenterX() + geoClone.x,
                        stationGeo.getCenterY() + geoClone.y
                    )

                    let txtGeo = model.getGeometry(txtCell).clone()

                    let styleObj = TextUtil.parseDrawioStyle(txtCell.style)
                    let fs = +styleObj.fontSize
                    let curFs = fs * minRatio
                    graph.setCellStyles('fontSize', curFs, [txtCell])

                    let txtCurWidth = txtGeo.width * minRatio
                    let txtCurHeight = txtGeo.height * minRatio

                    let x = vecGroupCenter.x - txtCurWidth / 2
                    let y = vecGroupCenter.y - height / 2 - txtCurHeight - curFs / 3
                    txtGeo.x = x
                    txtGeo.y = y
                    txtGeo.width = txtCurWidth
                    txtGeo.height = txtCurHeight

                    model.setGeometry(txtCell, txtGeo)
                }
            }

            // 处理站内文本
            for (let cell of cellList) {
                scaleStationTxt(cell, minRatio)
            }
        }



        // 缩放普通设备
        let scaleCell = (cell, obj) => {
            let symbolId = cell.symbol
            let symbolAttr = symbolProp[symbolId]

            if (!symbolAttr) {
                return
            }
            let initWidth = symbolAttr['initWidth']
            let initHeight = symbolAttr['initHeight']
            let width = initWidth * s
            let height = initHeight * s

            let geoClone = model.getGeometry(cell).clone()

            geoClone.x = obj.cx - width / 2
            geoClone.y = obj.cy - height / 2
            geoClone.width = width
            geoClone.height = height
            model.setGeometry(cell, geoClone)
            scaleTxtCell(cell, false)
        }

        let lineTxtList = [];
        // 循环缩放
        for (let cell of scaleList) {
            let obj = scaleMap.get(cell.id)
            if (!obj) {
                continue
            }
            let isTxt = DeviceCategoryUtil.isTextCell(cell)
            // let isLineTxt = false;
            // if (isTxt) {
            //     let txtId = cell.id;
            //     let sbid;
            //
            //     if (txtId.indexOf('ARR') == -1) {
            //         sbid = txtId.substring(4)
            //     } else {
            //         sbid = txtId.substring(8)
            //     }
            //
            // }


            if (obj.isGroup) {
                scaleGroup(cell, obj)
            }
            else if (isTxt) {
                lineTxtList.push(cell);
                // scaleLineTxt(cell)
            }
            else {
                scaleCell(cell, obj)
            }
        }

        let avgScale = scaleSum / scaleCount;
        if (avgScale == 0 || !avgScale) {
            avgScale = s;
        }
        for(let txtCell of lineTxtList) {
            scaleLineTxt(txtCell, avgScale)
        }
    },

    // 对齐两端之间的设备
    alignDeviceBetweenBothEnd(graph, cell1, cell2, symbolMap, gapTxt, limit = 10) {
        let model = graph.getModel()

        let keys = new Set()

        let pathList = []

        let resetCellPositionHandler = (cell, edge, p1, p2, dirVec) => {
            let symbolProp = symbolMap[cell.symbol]
            let { xratio, yratio } = symbolProp

            let geoClone = model.getGeometry(cell).clone()

            let cx1 = geoClone.getCenterX()
            let cy1 = geoClone.getCenterY()

            // 计算当前真实中心到dirVec的交点
            let pOrigin = GraphTool.getCellCenter(graph, cell, symbolProp) // 处理前实中心点
            let closetPoint = mathutil.closestPointOnLineSegment(pOrigin, p1, p2) // dirVec上的落点

            let width = geoClone.width
            let height = geoClone.height

            // 计算左上侧所占位置
            let leftWidth = width * xratio
            let topHeight = height * yratio

            let vecPre = new Vector2(leftWidth - width / 2, topHeight - height / 2)

            let cellAttr = TextUtil.parseDrawioStyle(cell.style)
            let angle = +cellAttr.rotation || 0

            if (symbolProp.touchs == 1) {
                // 单连接点
                let radian = -mathutil.angle2Radian(angle)

                let m = mathutil.commonMatrix(null, radian, null)

                let vec1 = vecPre.clone().applyMatrix3(m)

                let tran1 = closetPoint.clone().sub(vec1)

                let x = tran1.x - width / 2
                let y = tran1.y - height / 2
                geoClone.x = x
                geoClone.y = y

                model.setGeometry(cell, geoClone)

                // let pOrigin_cur = GraphTool.getCellCenter(graph, cell, symbolProp); // 当前实际中心点
                let cx2 = geoClone.getCenterX()
                let cy2 = geoClone.getCenterY()

                let tran = {
                    x: cx2 - cx1,
                    y: cy2 - cy1
                }

                // let tran = pOrigin_cur.clone().sub(pOrigin);

                let devId = cell.id
                let txtId = 'TXT-' + devId
                let txtCell = model.getCell(txtId)
                if (txtCell) {
                    TextHandler.repositionText(graph, cell, symbolProp, txtCell, gapTxt)
                }

                // 平移测点
                let pointId = 'Point-' + devId
                let pointCell = model.getCell(pointId)
                if (pointCell) {
                    TextHandler.repositionText(graph, cell, symbolProp, pointCell, gapTxt)
                }
            } // 双连接点
            else {
                let touchPoint = GraphTool.getTouchPointByRelation(graph, cell, edge)

                let preDir = touchPoint.clone().sub(pOrigin)

                let _angle = mathutil.vecAngle(preDir, dirVec)

                let flag = mathutil.vecRelation(preDir, dirVec)

                let curAngle = flag > 0 ? angle + _angle : angle - _angle
                graph.setCellStyles('rotation', curAngle, [cell])

                let radian = -mathutil.angle2Radian(curAngle)
                let m = mathutil.commonMatrix(null, radian, null)

                let vec1 = vecPre.clone().applyMatrix3(m)

                let tran1 = closetPoint.clone().sub(vec1)

                let x = tran1.x - width / 2
                let y = tran1.y - height / 2
                geoClone.x = x
                geoClone.y = y

                model.setGeometry(cell, geoClone)

                let devId = cell.id
                let txtId = 'TXT-' + devId
                let txtCell = model.getCell(txtId)
                if (txtCell) {
                    TextHandler.repositionText(graph, cell, symbolProp, txtCell, gapTxt)
                }

                // 平移测点
                let pointId = 'Point-' + devId
                let pointCell = model.getCell(pointId)
                if (pointCell) {
                    TextHandler.repositionText(graph, cell, symbolProp, pointCell, gapTxt)
                }
            }
        }

        // 当前cell是否通过
        let isPassHandler = (curCell) => {
            if (!curCell) {
                return false
            }

            if (keys.has(curCell)) {
                return false
            }

            if (DeviceCategoryUtil.isTextCell(curCell)) {
                return false
            }

            return true
        }

        // 递归查找
        let findNextHandler = (curCell, list) => {
            if (!isPassHandler(curCell)) {
                return
            }

            if (list.length > limit) {
                return
            }

            keys.add(curCell)

            if (curCell == cell2) {
                pathList.push(list)
                return
            }

            list.push(curCell)

            let edges = model.getEdges(curCell)

            for (let edge of edges) {
                let oppositeCell = GraphTool.getAdjacentCellOfEdge(graph, edge, curCell)

                if (!isPassHandler(oppositeCell)) {
                    continue
                }

                findNextHandler(oppositeCell, [...list])
            }
        }

        // 查找两端之间的设备
        let edges = model.getEdges(cell1)
        for (let edge of edges) {
            keys.clear()
            keys.add(cell1)
            let oppositeCell = GraphTool.getAdjacentCellOfEdge(graph, edge, cell1)
            findNextHandler(oppositeCell, [])
        }

        if (pathList.length == 0) {
            return
        }

        let list = pathList[0]

        // graph.setSelectionCells (list);

        let symbol1 = symbolMap[cell1.symbol]
        let symbol2 = symbolMap[cell2.symbol]

        // 实际中心点
        let p1 = GraphTool.getCellCenter(graph, cell1, symbol1)
        let p2 = GraphTool.getCellCenter(graph, cell2, symbol1)

        let dirVec = p2.clone().sub(p1)

        let list2 = [cell1, ...list, cell2]

        for (let i = 0; i < list2.length - 1; i++) {
            let curCell = list2[i]
            let nextCell = list2[i + 1]
            let edge = GraphTool.getEdgeBetweenCells(graph, curCell, nextCell)
            resetCellPositionHandler(curCell, edge, p1, p2, dirVec.clone())
        }

        // 处理最后一个设备
        let cellLast = list[list.length - 1]
        let edge = GraphTool.getEdgeBetweenCells(graph, cellLast, cell2)
        resetCellPositionHandler(cell2, edge, p1, p2, dirVec.clone())
    }
}

export default GraphHandler
