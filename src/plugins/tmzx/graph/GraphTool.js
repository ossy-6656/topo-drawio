// 用于设备查询
import mathutil from '../mathutil.js'
import geometric from '../geometric.js'
import TextUtil from './TextUtil.js'
import DeviceCategoryUtil from './DeviceCategoryUtil.js'
import SymbolUtil from './SymbolUtil.js'

let GraphTool = {
    isHorizontal(graph, cell) {},
    // 根据文本ID获取设备ID
    getDevIdByTxtId(id) {
        let newId = ''
        if (id.indexOf('TXT-') == 0) {
            newId = id.substring(4)
        } else {
            newId = id.substring(6)
        }
        return newId
    },
    // 判断cell是否是组
    isGroupCell(graph, cell) {
        if (!cell) {
            return false
        }

        if (!cell.style) {
            return false
        }

        if (cell.flag == 'group') {
            return true
        }

        let style = cell.style

        let styleObj = TextUtil.parseDrawioStyle(style)
        if (styleObj.flag == 'group') {
            return true
        }

        let strArr = style.split(';')

        if (strArr.includes('group')) {
            return true
        }

        return false
    },
    /**
     * 计算向量的角度
     * @param vec
     * @returns {*}
     */
    vecAngle(vec) {
        let radian = vec.angle()
        return mathutil.radian2Angle(radian)
    },
    // 获取cell多边形数组
    cellPolygon(graph, cell) {
        let model = graph.getModel()
        let { x, y, width, height } = model.getGeometry(cell)
        return [
            [x, y],
            [x + width, y],
            [x + width, y + height],
            [x, y + height]
        ]
    },
    /**
     * mercator长度转drawio长度
     * @param merLne
     * @param param
     * @returns {number}
     */
    merLen2Drawio(merLen, param) {
        let { width, height, mlt, mrb } = param
        let ratiox = width / (mrb[0] - mlt[0])
        // let ratioy = sh / (mlt[1] -  mrb[1]);
        return ratiox * merLen
    },
    getRootGroup(graph, cell) {
        let defaultParent = graph.getDefaultParent()
        let model = graph.getModel()
        let pcell = model.getParent(cell)

        if (pcell == defaultParent && cell.style.indexOf('group;') != -1) {
            return cell
        } else if (pcell.style && pcell.style.indexOf('group;') != -1) {
            return this.getRootGroup(pcell)
        } else {
            return null
        }
    },
    // 全为水平状态
    busVH(graph, busCell) {
        // let view = graph.getView();
        // let busState = view.getState(busCell);
        // let geometry = graph.getCellGeometry(busCell); // 母线几何体
        // let rotation = busState?.style?.rotation || 0;
        //
        //
        // let {x, y, width, height} = geometry;
        // let v1 = new Vector2(-width / 2, 0);
        // let v2 = new Vector2(width / 2, 0);
        //
        // let tran = new Vector2(geometry.getCenterX(), geometry.getCenterY());
        //
        // let rot = mathutil.angle2Radian(rotation);
        // let m = mathutil.commonMatrix(tran, rot, null);
        //
        // let vleft = v1.clone().applyMatrix3(m);
        // let vright = v2.clone().applyMatrix3(m);
        // let angle = Math.abs(PositionTool.getSvgAngle(vleft, vright));
        // angle = angle % 180;
        //
        // if (angle < 20) {
        // 	return 0;
        // } else {
        // 	return 90
        // }
        return 0
    },
    isLjx(id) {
        // ['36000000', '13000000', '14000000']
        if (
            id.indexOf('36000000') != -1 ||
            id.indexOf('13000000') != -1 ||
            id.indexOf('14000000') != -1
        ) {
            return true
        }
        return false
    },
    isDlDx(id) {
        // 电缆导线
        if (id.indexOf('20100000') != -1 || id.indexOf('10100000') != -1) {
            return true
        }
        return false
    },
    /**
     * 重新调整选中cell的大小
     * @param graph
     */
    autosize(graph, cells) {
        // var cells = graph.getSelectionCells();

        if (!cells) {
            cells = graph.getSelectionCells()
        }

        if (cells != null) {
            graph.getModel().beginUpdate()
            try {
                for (var i = 0; i < cells.length; i++) {
                    var cell = cells[i]

                    if (graph.getModel().isVertex(cell)) {
                        if (graph.getModel().getChildCount(cell) > 0) {
                            graph.updateGroupBounds([cell], 0, true)
                        } else {
                            graph.updateCellSize(cell)
                        }
                    }
                }
            } finally {
                graph.getModel().endUpdate()
            }
        }
    },
    // 编组选中设备
    group(graph, list) {
        if (graph.isEnabled()) {
            var cells = mxUtils.sortCells(list, true)

            if (cells.length == 1 && !graph.isTable(cells[0]) && !graph.isTableRow(cells[0])) {
                graph.setCellStyles('container', '1')
            } else {
                cells = graph.getCellsForGroup(cells)

                if (cells.length > 1) {
                    graph.setSelectionCell(graph.groupCells(null, 0, cells))
                }
            }
        }
    },
    // 解组选中设备
    ungroup(graph) {
        if (graph.isEnabled()) {
            var cells = graph.getSelectionCells()

            graph.model.beginUpdate()
            try {
                var temp = graph.ungroupCells()

                // Clears container flag for remaining cells
                if (cells != null) {
                    for (var i = 0; i < cells.length; i++) {
                        if (graph.model.contains(cells[i])) {
                            if (
                                graph.model.getChildCount(cells[i]) == 0 &&
                                graph.model.isVertex(cells[i])
                            ) {
                                graph.setCellStyles('container', '0', [cells[i]])
                            }

                            temp.push(cells[i])
                        }
                    }
                }
            } finally {
                graph.model.endUpdate()
            }

            graph.setSelectionCells(temp)
        }
    },
    /**
     * 判断设备是否在母线之下
     * @param graph
     * @param vertex
     * @param busCell
     */
    isCellUnderBus(graph, vertex, busCell) {
        let model = graph.getModel()
        let cellGeo = model.getGeometry(vertex)
        let busGeo = model.getGeometry(busCell)

        let cx = cellGeo.getCenterX()

        let xmin = busGeo.x
        let xmax = xmin + busGeo.width

        let isPass = cx >= xmin && cx <= xmax
        return isPass
    },
    /**
     * 查找拖动站内与母线相连接的第一个设备时，与母线连接的所有连接线
     * @param cells
     */
    getLine2Bus(graph, cells) {
        let model = graph.getModel()
        let list = []
        for (let cell of cells) {
            let edges = model.getEdges(cell)
            for (let edge of edges) {
                let sourceCell = model.getTerminal(edge, true)
                let targetCell = model.getTerminal(edge, false)

                if (sourceCell && DeviceCategoryUtil.isBusCell(sourceCell)) {
                    if (this.isCellUnderBus(graph, cell, sourceCell)) {
                        list.push(edge)
                    }
                }

                if (targetCell && DeviceCategoryUtil.isBusCell(targetCell)) {
                    if (this.isCellUnderBus(graph, cell, targetCell)) {
                        list.push(edge)
                    }
                }
            }
        }
        return list
    },
    /**
     * 获取站房组cell
     * @param graph
     * @param cell
     * @returns {*|null}
     */
    getStationGroup(graph, cell) {
        let model = graph.getModel()
        let view = graph.getView()
        let parent = graph.getDefaultParent()

        let state = view.getState(cell)
        if (!state) {
            return null
        }
        let styleObj = state.style
        let flag = styleObj.flag
        if (cell == parent) {
            return null
        }
        if (flag == 'group') {
            return cell
        }
        let p = model.getParent(cell)
        return this.getStationGroup(graph, p)
    },

    // 根据编组获取组下的站房
    getStationCell(graph, group) {
        let view = graph.view
        let model = graph.getModel()

        let list = []
        let count = model.getChildCount(group)
        if (count > 0) {
            for (let i = 0; i < count; i++) {
                let childCell = model.getChildAt(group, i)
                let cellStyle = graph.getCurrentCellStyle(childCell)
                if (cellStyle['flag'] === 'station' || cellStyle['flag'] == 'useStation') {
                    return childCell
                }
            }
        }
        return null
    },

    // 获取站房组下的所有设备，包括站房
    getCellsOfStation(graph, group) {
        let view = graph.view
        let model = graph.getModel()

        let list = []
        let count = model.getChildCount(group)
        if (count > 0) {
            for (let i = 0; i < count; i++) {
                let childCell = model.getChildAt(group, i)
                // let cellStyle = graph.getCurrentCellStyle(childCell);
                // if (cellStyle['flag'] != 'substation')
                // {
                // 	list.push(childCell);
                // }
                list.push(childCell)
            }
        }
        return list
    },

    // 获取连接两个母线的连接线，这么写也不行
    busConnectLine_bak(graph, busList, lineList) {
        let view = graph.view
        let targetLine = null

        let lineStateList = lineList.map((lineCell) => view.getState(lineCell))

        let angleState = this.busVH(graph, busList[0])
        let busBounds = busList.map((busCell) => {
            let state = view.getState(busCell)
            let param = {}
            if (angleState == 0) {
                // 水平
                param.x1 = state.x
                param.y1 = state.y

                param.x2 = state.x + state.width
                param.y2 = state.y
            } // 垂直
            else {
                param.x1 = state.x
                param.y1 = state.y

                param.x2 = state.x
                param.y2 = state.y + state.height
            }
            return param
        })
        let rangeParam = {}
        if (angleState == 0) {
            busBounds.sort((item1, item2) => {
                return item1.x < item2.x ? -1 : 1
            })
            rangeParam.xmin = busBounds[0].x2
            rangeParam.xmax = busBounds[1].x1
            rangeParam.y = busBounds[0].y1
        } else {
            busBounds.sort((item1, item2) => {
                return item1.y < item2.y ? -1 : 1
            })
            rangeParam.ymin = busBounds[0].y2
            rangeParam.ymax = busBounds[1].y1
            rangeParam.x = busBounds[0].x1
        }

        if (angleState == 0) {
            for (let lineState of lineStateList) {
                let points = lineState.absolutePoints

                debugger
            }
        } else {
        }

        return targetLine
    },
    /**
     * 查找连接两个母线的连接线，这个查找有待优化
     * @param graph
     * @param busList
     * @param cellMap
     * @returns {*|null}
     */
    busConnectLine(graph, busList, cellMap) {
        let model = graph.getModel()
        let view = graph.view

        let angleState = this.busVH(graph, busList[0])

        let busBounds = busList.map((busCell) => {
            let state = view.getState(busCell)
            let param = {}
            if (angleState == 0) {
                // 水平
                param.x1 = state.x
                param.y1 = state.y

                param.x2 = state.x + state.width
                param.y2 = state.y
            } // 垂直
            else {
                param.x1 = state.x
                param.y1 = state.y

                param.x2 = state.x
                param.y2 = state.y + state.height
            }
            return param
        })

        let rangeParam = {}
        if (angleState == 0) {
            busBounds.sort((item1, item2) => {
                return item1.x < item2.x ? -1 : 1
            })
            rangeParam.xmin = busBounds[0].x2
            rangeParam.xmax = busBounds[1].x1
            rangeParam.y = busBounds[0].y1
        } else {
            busBounds.sort((item1, item2) => {
                return item1.y < item2.y ? -1 : 1
            })
            rangeParam.ymin = busBounds[0].y2
            rangeParam.ymax = busBounds[1].y1
            rangeParam.x = busBounds[0].x1
        }

        let isPointInBusList = (pointList) => {
            let minFlag = false
            let maxFlag = false

            if (angleState == 0) {
                for (let p of pointList) {
                    if (p.x < rangeParam.xmin) {
                        minFlag = true
                    }
                    if (p.x > rangeParam.xmax) {
                        maxFlag = true
                    }
                }
            } else {
                for (let p of pointList) {
                    if (p.y < rangeParam.ymin) {
                        minFlag = true
                    }
                    if (p.y > rangeParam.ymax) {
                        return true
                    }
                }
            }
            return minFlag && maxFlag
        }

        for (let key in cellMap) {
            let cell = cellMap[key]
            if (model.isEdge(cell)) {
                let state = view.getState(cell)
                let absolutePoints = state.absolutePoints
                if (isPointInBusList(absolutePoints)) {
                    return cell
                }
            }
        }

        return null
    },

    // 获取母线与连接线的连接点坐标
    getBusTouchPoint(graph, linkedLine) {
        let model = graph.getModel()
        let lineGeometry = graph.getCellGeometry(linkedLine)

        let sourceCell = model.getTerminal(linkedLine, true)
        let targetCell = model.getTerminal(linkedLine, false)

        let lineState = graph.view.getState(linkedLine)
        let lineStyle = lineState.style
        let { exitX, exitY, entryX, entryY } = lineStyle
        let busCell = null

        let ratioX = 0,
            ratioY = 0
        if (sourceCell && sourceCell.symbol == 'busbar') {
            busCell = sourceCell
            ratioX = exitX
            ratioY = exitY
        } else {
            busCell = targetCell
            ratioX = entryX
            ratioY = entryY
        }
        let busGeometry = graph.getCellGeometry(busCell)
        let { x, y, width, height } = busGeometry
        let busAngleState = this.busVH(graph, busCell)

        if (busAngleState == 0) {
            // 水平
            let line = [
                [x, y + height / 2],
                [x + width, y + height / 2]
            ]
            let interpolate = geometric.lineInterpolate(line)
            let p = interpolate(ratioX)
            return {
                x: p[0],
                y: p[1]
            }
        } // 垂直
        else {
            let line = [
                [x + width / 2, y],
                [x + width / 2, y + height]
            ]
            let interpolate = geometric.lineInterpolate(line)
            let p = interpolate(ratioX)
            return {
                x: p[0],
                y: p[1]
            }
        }
    },
    /**
     * 计算母线与某个连接线的连接点坐标
     * @param graph
     * @param linkedLine
     * @returns {*}
     */
    getBusTouchPointCommon(graph, linkedLine) {
        let model = graph.getModel()

        let sourceCell = model.getTerminal(linkedLine, true)
        let targetCell = model.getTerminal(linkedLine, false)

        let lineState = graph.view.getState(linkedLine)
        let lineStyle = lineState.style
        let { exitX, exitY, entryX, entryY } = lineStyle
        let busCell = null

        let ratioX = 0,
            ratioY = 0
        if (sourceCell && sourceCell.symbol == 'busbar') {
            busCell = sourceCell
            ratioX = exitX
            ratioY = exitY
        } else {
            busCell = targetCell
            ratioX = entryX
            ratioY = entryY
        }

        return this.getTouchPoint(graph, busCell, ratioX, ratioY)
    },
    /**
     * 获取组下的母线
     * @param cell
     * @returns {*|null}
     */
    getBus_bak(graph, cell) {
        let view = graph.view
        let model = graph.getModel()

        let cellStyle = graph.getCurrentCellStyle(cell)

        if (cellStyle['flag'] === 'busbar') {
            return [cell]
        } else {
            let list = []
            let count = model.getChildCount(cell)
            if (count > 0) {
                for (let i = 0; i < count; i++) {
                    let childCell = model.getChildAt(cell, i)
                    let busCell = this.getBus(graph, childCell)
                    if (busCell != null) {
                        return busCell
                    }
                }
            } else {
                return null
            }
        }
    },

    /**
     * 获取站房下的母线
     * @param graph
     * @param groupCell   站房组容器
     * @returns {*[]}
     */
    getBus(graph, groupCell) {
        let view = graph.view
        let model = graph.getModel()

        let list = []
        let count = model.getChildCount(groupCell)
        if (count > 0) {
            for (let i = 0; i < count; i++) {
                let childCell = model.getChildAt(groupCell, i)
                let cellStyle = graph.getCurrentCellStyle(childCell)
                if (cellStyle['flag'] === 'busbar') {
                    list.push(childCell)
                }
            }
        }
        return list
    },
    /**
     * 获取母线及关联的站内设备
     * @param graph
     * @param busCell
     */
    getBusGroup(graph, busCell) {
        let model = graph.getModel()
        let list = [busCell]

        let keys = new Set()
        // 递归搜索所有间隔设备
        let rescueSearch = (cell) => {
            let styleObj = TextUtil.parseDrawioStyle(cell.style)

            if (styleObj.flag == 'busbar') {
                // 如果是母线
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

        let firstLineList = model.getEdges(busCell)
        for (let firstLineCell of firstLineList) {
            rescueSearch(firstLineCell)
        }

        let txtId = 'TXT-' + busCell.id
        let txtCell = model.getCell(txtId)
        if (txtCell) {
            list.push(txtCell)
        }

        return list
    },
    /**
     * 获取间隔数据
     * @param graph
     * @param cell    与母线连接的设备
     * @param busCell 母线
     * @param cellMap 要得到的间隔数据map
     */
    getJgDevMap(graph, cell, busCell, cellMap) {
        let model = graph.getModel()
        let view = graph.getView()

        if (!cell) {
            return
        }
        let cellState = view.getState(cell)
        let { flag, pid } = cellState.style
        if (cell == busCell) {
            // 找到自个的母线
            return
        }
        // 找到对面的母线
        if (flag == 'busbar' && cell != busCell) {
            cellMap['bus'] = true // 标识此间隔是母线连接母线
            return
        }
        // 确保cell存在，且为组内设备
        if (cell && !cellMap[cell.id] && pid && cell != busCell) {
            cellMap[cell.id] = cell
        } else {
            return
        }

        if (model.isVertex(cell)) {
            let list = model.getEdges(cell)
            for (let edge of list) {
                this.getJgDevMap(graph, edge, busCell, cellMap)
            }
        } else if (model.isEdge(cell)) {
            let sourceCell = model.getTerminal(cell, true)
            let targetCell = model.getTerminal(cell, false)
            this.getJgDevMap(graph, sourceCell, busCell, cellMap)
            this.getJgDevMap(graph, targetCell, busCell, cellMap)
        }
    },

    /**
     * 检查当前连接线是否连接两个母线
     * @param graph
     * @param line
     * @param busCell
     * @param cellMap
     */
    isMultiBusConnection(graph, line, busCell) {
        let model = graph.getModel()
        let view = graph.getView()

        let cellMap = {}
        let isFind = false
        let findDeathHandler = (cell) => {
            let cellState = view.getState(cell)
            let { flag, pid } = cellState.style

            if (cell == busCell || !pid || cellMap[cell.id]) {
                return
            }

            if (flag == 'busbar' && cell != busCell) {
                isFind = true
                return
            }

            cellMap[cell.id] = cell

            if (model.isVertex(cell)) {
                let list = model.getEdges(cell)
                for (let edge of list) {
                    findDeathHandler(edge)
                }
            } else if (model.isEdge(cell)) {
                let sourceCell = model.getTerminal(cell, true)
                let targetCell = model.getTerminal(cell, false)
                findDeathHandler(sourceCell)
                findDeathHandler(targetCell)
            }
        }
        findDeathHandler(line)
        return isFind
    },
    /**
     * 获取线与设备的连接点 - 不用管是不是母线问题，因为计算的方式一样
     * @param graph
     * @param edge
     * @param isRelative   保留参数，是否为相对
     */
    getLinkedPointsOfEdge_bak(graph, edge, isRelative) {
        let model = graph.getModel()
        let view = graph.view

        let state = view.getState(edge)
        let style = state.style

        let edgeGeometry = graph.getCellGeometry(edge)
        let sourceCell = model.getTerminal(edge, true)
        let targetCell = model.getTerminal(edge, false)

        let { exitX, exitY, entryX, entryY } = style

        let param = {}
        if (sourceCell) {
            let sourceState = view.getState(sourceCell)
            let sourceStyle = sourceState.style
            let sourceGeometry = graph.getCellGeometry(sourceCell)
            let { width, height } = sourceGeometry

            let angle = sourceStyle.rotation || 0
            let rad = -mathutil.angle2Radian(angle)

            let cx = sourceGeometry.getCenterX()
            let cy = sourceGeometry.getCenterY()
            let tran = { x: cx, y: cy }
            let m = mathutil.commonMatrix(tran, rad, null)

            let originalX = width * exitX - width / 2
            let originalY = height * exitY - height / 2

            let voriginal = new Vector2(originalX, originalY)
            let sourcePoint = voriginal.clone().applyMatrix3(m)

            param.sourcePoint = new mxPoint(sourcePoint.x, sourcePoint.y)
        } // 获取一个不准确值
        else {
            param.sourcePoint = edgeGeometry.sourcePoint
        }

        if (targetCell) {
            let targetState = view.getState(targetCell)
            let targetStyle = targetState.style
            let targetGeometry = graph.getCellGeometry(targetCell)
            let { width, height } = targetGeometry

            let angle = targetStyle.rotation || 0
            let rad = -mathutil.angle2Radian(angle)

            let cx = targetGeometry.getCenterX()
            let cy = targetGeometry.getCenterY()
            let tran = { x: cx, y: cy }
            let m = mathutil.commonMatrix(tran, rad, null)

            let originalX = width * entryX - width / 2
            let originalY = height * entryY - height / 2

            let voriginal = new Vector2(originalX, originalY)
            let targetPoint = voriginal.clone().applyMatrix3(m)

            param.targetPoint = new mxPoint(targetPoint.x, targetPoint.y)
        } else {
            param.targetPoint = edgeGeometry.targetPoint
        }

        return param
    },
    /**
     *  获取线与站房相对坐标，下面是简化写法
     * @param graph
     * @param edge
     * @param group
     * @returns {*[]}
     */
    getLinkedPointsOfEdge(graph, edge, group) {
        let view = graph.getView()
        let state = view.getState(edge)
        let absPointLs = state.absolutePoints // 这种方式可以减少计算量
        let scale = view.scale
        let pointLs = []
        for (let p of absPointLs) {
            let _x = (p.x - group.x) / scale
            let _y = (p.y - group.y) / scale
            pointLs.push(new mxPoint(_x, _y))
        }
        return {
            sourcePoint: pointLs[0],
            targetPoint: pointLs[pointLs.length - 1]
        }
    },
    getLineRelativeCor(graph, edge, group) {
        let view = graph.getView()
        let state = view.getState(edge)
        let absPointLs = state.absolutePoints // 这种方式可以减少计算量
        let scale = view.scale
        let pointLs = []
        for (let p of absPointLs) {
            let _x = (p.x - group.x) / scale
            let _y = (p.y - group.y) / scale
            pointLs.push(new mxPoint(_x, _y))
        }
        return pointLs
    },
    /**
     * 获取线路坐标
     * @param graph
     * @param edge
     */
    getEdgePoints(graph, edge) {
        let view = graph.getView()
        let state = view.getState(edge)
        let absPointLs = state.absolutePoints // 这种方式可以减少计算量
        let scale = view.scale
        let pointLs = []
        for (let p of absPointLs) {
            let _x = p.x / scale - view.translate.x
            let _y = p.y / scale - view.translate.y
            pointLs.push(new mxPoint(_x, _y))
        }
        return pointLs
    },
    /**
     * 获取边的绝对坐标
     * @param graph
     * @param edge
     * @returns {*[]}
     */
    getEdgePointsVec(graph, edge) {
        let view = graph.getView()
        let state = view.getState(edge)
        let absPointLs = state.absolutePoints // 这种方式可以减少计算量
        let scale = view.scale
        let pointLs = []
        for (let p of absPointLs) {
            let _x = p.x / scale - view.translate.x
            let _y = p.y / scale - view.translate.y
            pointLs.push(new Vector2(_x, _y))
        }
        return pointLs
    },
    getCellAngle(cell) {
        let style = cell.style
        let styleObj = TextUtil.parseDrawioStyle(style)
        let angle = +styleObj['rotation'] || 0
        angle = mathutil.negativeAngle2Positive(angle)
        return angle
    },

    // 计算cell真实中心点
    getCellCenter(graph, cell, symbol) {
        let model = graph.getModel(cell)
        let geo = model.getGeometry(cell)

        let { x, y, width, height } = geo
        let { xratio, yratio } = symbol

        let cx = geo.getCenterX()
        let cy = geo.getCenterY()

        // 计算左上侧所占位置
        let leftWidth = width * xratio
        let topHeight = height * yratio

        let angle = this.getCellAngle(cell)
        let radian = mathutil.angle2Radian(angle)

        let tran = { x: cx, y: cy }

        // 计算图元实际中心点的初始位置(以屏幕坐标系统为准)，默认旋转方向：y -> x
        let vecPre = new Vector2(leftWidth - width / 2, topHeight - height / 2)
        let mc = mathutil.commonMatrix(tran, -radian, null)
        let vec = vecPre.clone().applyMatrix3(mc)

        return vec
    },

    getCellCenterAbs(graph, cell, symbol) {
        let model = graph.getModel(cell)
        let geo = model.getGeometry(cell)
        let view = graph.view;

        let { x, y, width, height } = geo
        let { xratio, yratio } = symbol

        let state = view.getState(cell)
        let origin = state.origin;

        let cx = origin.x + width / 2;
        let cy = origin.y + height / 2;

        // 计算左上侧所占位置
        let leftWidth = width * xratio
        let topHeight = height * yratio

        let angle = this.getCellAngle(cell)
        let radian = mathutil.angle2Radian(angle)

        let tran = { x: cx, y: cy }

        // 计算图元实际中心点的初始位置(以屏幕坐标系统为准)，默认旋转方向：y -> x
        let vecPre = new Vector2(leftWidth - width / 2, topHeight - height / 2)
        let mc = mathutil.commonMatrix(tran, -radian, null)
        let vec = vecPre.clone().applyMatrix3(mc)

        return vec
    },
    /**
     * 计算连接点坐标
     * @param cell
     * @param xratio 宽度占比
     * @param yratio 高度占比
     */
    getTouchPoint(graph, cell, xratio, yratio) {
        // let view = graph.getView();
        // let state = view.getState(cell);
        //let style = state.style;
        // let style = graph.getCurrentCellStyle(cell);
        let style = TextUtil.parseDrawioStyle(cell.style)
        let geometry = cell.geometry
        let { width, height } = geometry

        let rot = -mathutil.angle2Radian(style.rotation || 0)
        let tran = new Vector2(geometry.getCenterX(), geometry.getCenterY())

        let m = mathutil.commonMatrix(tran, rot, null)
        let x = width * xratio - width / 2
        let y = height * yratio - height / 2
        let vecOrigin = new Vector2(x, y)
        return vecOrigin.applyMatrix3(m)
    },
    /**
     * 计算cell绝对位置
     * @param graph
     * @param cell
     * @param xratio
     * @param yratio
     * @returns {Vector2}
     */
    getTouchPointAbs(graph, cell, xratio, yratio) {
        let view = graph.getView();
        // let state = view.getState(cell);
        //let style = state.style;
        // let style = graph.getCurrentCellStyle(cell);

        let state = view.getState(cell)
        let origin = state.origin;
        let style = TextUtil.parseDrawioStyle(cell.style)
        let geometry = cell.geometry
        let { width, height } = geometry

        let cx = origin.x + width / 2;
        let cy = origin.y + height / 2;

        let rot = -mathutil.angle2Radian(style.rotation || 0)
        let tran = new Vector2(cx, cy)

        let m = mathutil.commonMatrix(tran, rot, null)
        let x = width * xratio - width / 2
        let y = height * yratio - height / 2
        let vecOrigin = new Vector2(x, y)
        return vecOrigin.applyMatrix3(m)
    },

    /**
     * 计算连接点相对cell左上角位置 [0, 1]
     * @param graph
     * @param cell
     * @param pos    drawio坐标
     * @returns {{x: number, y: number}}
     */
    getTouchRel(graph, cell, pos) {
        let geometry = cell.geometry
        let { width, height } = geometry
        let style = graph.getCellStyle(cell)
        let rotation = style['rotation'] || 0
        let rad = -mathutil.angle2Radian(rotation)
        let x = geometry.getCenterX()
        let y = geometry.getCenterY()
        let tran = { x, y }
        let m = mathutil.commonMatrix(tran, rad, null)
        let im = new Matrix3().getInverse(m)

        let vp = new Vector2(pos.x, pos.y)
        let v = vp.applyMatrix3(im)
        let stepx = v.x - -width / 2
        let stepy = v.y - -height / 2

        let rx = stepx / width
        let ry = stepy / height
        return {
            x: rx,
            y: ry
        }
    },
    /**
     * 计算变电站的连接相对位置
     * @param graph
     * @param cell   变电站
     * @param pos    连接点
     * @returns {{x: number, y: number}}
     */
    getSubStationRel(graph, cell, startPoint, endPoint) {
        let geometry = cell.geometry
        let { width, height } = geometry
        // let style = graph.getCellStyle(cell);
        let cx = geometry.getCenterX()
        let cy = geometry.getCenterY()

        let r = width / 2

        let centerPoint = new Vector2(cx, cy)
        let len = mathutil.pixelLen(centerPoint, startPoint)

        let ratio = len / r

        let ratioX, ratioY
        if (ratio > 1.02 || ratio < 0.98) {
            // 判断线与圆是否有交点
            let { A, B, C } = mathutil.lineEquationFromTwoPoints(
                startPoint.x,
                startPoint.y,
                endPoint.x,
                endPoint.y
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

                    let len1 = startPoint.clone().sub(vec1).length()
                    let len2 = startPoint.clone().sub(vec2).length()

                    point = len1 < len2 ? p1 : p2
                } else {
                    let p = intersections[0]
                    point = new Vector2(p.x, p.y)
                }

                let vecLT = new Vector2(geometry.x, geometry.y)
                let dx = Math.abs(point.x - vecLT.x)
                let dy = Math.abs(point.y - vecLT.y)
                ratioX = dx / geometry.width
                ratioY = dy / geometry.height
            } // 起始点与圆心连接的线与圆交点
            else {
                let { A, B, C } = mathutil.lineEquationFromTwoPoints(
                    centerPoint.x,
                    centerPoint.y,
                    startPoint.x,
                    startPoint.y
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

                        let len1 = startPoint.clone().sub(vec1).length()
                        let len2 = startPoint.clone().sub(vec2).length()

                        point = len1 < len2 ? p1 : p2
                    } else {
                        let p = intersections[0]
                        point = new Vector2(p.x, p.y)
                    }

                    let vecLT = new Vector2(geometry.x, geometry.y)
                    let dx = Math.abs(point.x - vecLT.x)
                    let dy = Math.abs(point.y - vecLT.y)
                    ratioX = dx / geometry.width
                    ratioY = dy / geometry.height
                }
            }
        } else {
            let obj = this.getTouchRel(graph, cell, startPoint)
            ratioX = obj.x
            ratioY = obj.y
        }

        return {
            x: ratioX,
            y: ratioY
        }
    },

    /**
     * 计算连接点占比
     * @param graph
     * @param cell
     * @param edge
     * @returns {{x: number, y: number}}
     */
    getTouchRatio(graph, cell, edge) {
        // 查找线路与设备连接位置比率，用于查找连接位置
        let xratio, yratio
        let styleEdgeObj = graph.getCurrentCellStyle(edge)

        if (edge.source == cell) {
            xratio = +styleEdgeObj.exitX
            yratio = +styleEdgeObj.exitY
        } else {
            xratio = +styleEdgeObj.entryX
            yratio = +styleEdgeObj.entryY
        }
        return {
            x: xratio,
            y: yratio
        }
    },
    /**
     * 根据cell与edge的关系计算连接点drawio坐标，edge并没有什么用，只为了取连接点比率
     * @param graph
     * @param cell
     * @param edge
     * @param symbolProp
     * @returns vector2
     */
    getTouchPointByRelation(graph, cell, edge) {
        // let symbolArr = symbolProp[cell.symbol];

        // 实际中心点比率
        // let xratio_center_pre = symbolArr['xratio'];
        // let yratio_center_pre = symbolArr['yratio'];

        // let vecPoint;

        // 查找线路与设备连接位置比率，用于查找连接位置
        let xratio, yratio
        let styleEdgeObj = graph.getCurrentCellStyle(edge)

        if (edge.source == cell) {
            xratio = +styleEdgeObj.exitX
            yratio = +styleEdgeObj.exitY
        } else {
            xratio = +styleEdgeObj.entryX
            yratio = +styleEdgeObj.entryY
        }

        // if (xratio < .3) // preCell左侧连接点
        // {
        // 	vecPoint = GraphTool.getTouchPoint(graph, cell, 0, yratio_center_pre);
        // }
        // else // cell右侧连接点
        // {
        // 	vecPoint = GraphTool.getTouchPoint(graph, cell, 1, yratio_center_pre);
        // }

        return GraphTool.getTouchPoint(graph, cell, xratio, yratio)
    },

    /**
     * 获取连接点属性
     * 包括设备宽度、高度、连接点距离设备左上角距离、连接点坐标
     * @param graph
     * @param cell
     * @param edge
     * @returns {{}}
     */
    getTouchPointAttr(graph, cell, edge) {
        let xratio, yratio
        let styleEdgeObj = graph.getCurrentCellStyle(edge)

        if (edge.source == cell) {
            xratio = +styleEdgeObj.exitX
            yratio = +styleEdgeObj.exitY
        } else {
            xratio = +styleEdgeObj.entryX
            yratio = +styleEdgeObj.entryY
        }

        let touchPoint = GraphTool.getTouchPoint(graph, cell, xratio, yratio)

        let geometry = graph.getCellGeometry(cell)
        let { width, height } = geometry

        let left = width * xratio
        let top = height * yratio
        let right = width - left
        let bottom = height - top

        return {
            width,
            height,
            left,
            right,
            top,
            bottom,
            touchPoint
        }
    },
    /**
     * 获取连接点位置
     * @param graph
     * @param cell
     * @param edge
     */
    getTouchPosition(graph, cell, edge) {
        let xratio, yratio
        let styleEdgeObj = graph.getCurrentCellStyle(edge)

        if (edge.source == cell) {
            xratio = +styleEdgeObj.exitX
            yratio = +styleEdgeObj.exitY
        } else {
            xratio = +styleEdgeObj.entryX
            yratio = +styleEdgeObj.entryY
        }
        return SymbolUtil.touchPosByRatio(xratio, yratio)
    },
    // 计算cell的连接点坐标、当前连接点到对面的连接点向量
    getCellAttr(graph, cell, edge, symbolProp) {
        let symbolArr = symbolProp[cell.symbol]

        // 实际中心点比率
        // let xratio_center = symbolArr['xratio'];
        let yratio_center = symbolArr['yratio']

        // 查找线路与设备连接位置比率，用于查找连接位置
        let xratioTouch
        let styleEdgeObj = graph.getCurrentCellStyle(edge)

        if (edge.source == cell) {
            xratioTouch = +styleEdgeObj.exitX
        } else {
            xratioTouch = +styleEdgeObj.entryX
        }
        let vecTouchPoint
        let vecOppPoint

        if (xratioTouch < 0.3) {
            // preCell左侧连接点
            vecTouchPoint = GraphTool.getTouchPoint(graph, cell, 0, yratio_center)
            vecOppPoint = GraphTool.getTouchPoint(graph, cell, 1, yratio_center)
        } // cell右侧连接点
        else {
            vecTouchPoint = GraphTool.getTouchPoint(graph, cell, 1, yratio_center)
            vecOppPoint = GraphTool.getTouchPoint(graph, cell, 0, yratio_center)
        }

        let dir = vecOppPoint.clone().sub(vecTouchPoint)
        return {
            touchPoint: vecTouchPoint,
            oppositePoint: vecOppPoint,
            dir
        }
    },
    /**
     * 计算cell实际中心坐标
     * @param graph
     * @param cell
     * @param symbolProp
     * @returns {Vector2}
     */
    getRealCenterOfCell(graph, cell, symbolProp) {
        let symbolAttr = symbolProp()

        let geo = cell.geometry

        let { width, height } = geo
        let cx = geo.getCenterX()
        let cy = geo.getCenterY()

        let xratio_center = symbolAttr['xratio']
        let yratio_center = symbolAttr['yratio']
        let cx_vec = xratio_center * width - width / 2
        let cy_vec = yratio_center * height - height / 2

        let styleObj = TextUtil.parseDrawioStyle(cell.style)
        let cellAngle = styleObj.rotation || 0

        let translate = new Vector2(cx, cy)
        let radian = -mathutil.angle2Radian(cellAngle)
        let cen_init_vec = new Vector2(cx_vec, cy_vec)

        let m1 = mathutil.commonMatrix(null, radian, null)
        let vec1 = cen_init_vec.clone().applyMatrix3(m1)

        return vec1.clone().add(translate)
    },

    /**
     * 根据cell实际中心点和角度计算其真实左上角坐标
     * @param graph
     * @param cell         当前cell
     * @param vec          实际中心点
     * @param angle        角度
     * @param symbolProp   图元map
     * @returns {Vector2}
     */
    getCellPosByRealCenterAndAngle(graph, cell, vec, angle, symbolProp) {
        let symbolAttr = symbolProp[cell.symbol]

        let geo = cell.geometry

        let { width, height } = geo

        let xratio_center = symbolAttr['xratio']
        let yratio_center = symbolAttr['yratio']
        let cx_vec = xratio_center * width - width / 2
        let cy_vec = yratio_center * height - height / 2

        // let styleObj = graph.getCurrentCellStyle(cell);

        let radian = -mathutil.angle2Radian(angle)
        let cen_init_vec = new Vector2(cx_vec, cy_vec)

        let m1 = mathutil.commonMatrix(null, radian, null)
        let vecInit = cen_init_vec.clone().applyMatrix3(m1)

        let tranVec = vec.clone().sub(vecInit)

        let topX = tranVec.x - width / 2
        let topY = tranVec.y - height / 2
        return new Vector2(topX, topY)
    },
    /**
     * edge坐标计算通用方法
     * @param graph
     * @param edge
     * @returns {*[]}
     */
    getEdgePointsCommon(graph, edge) {
        let view = graph.getView()
        let model = graph.getModel()
        // let state = view.getState(edge);
        let edgeGeometry = edge.geometry

        let style = TextUtil.parseDrawioStyle(edge.style)

        let sourceCell = model.getTerminal(edge, true)
        let targetCell = model.getTerminal(edge, false)

        let sourcePoint = edgeGeometry.sourcePoint
        let targetPoint = edgeGeometry.targetPoint

        let list = []
        if (sourceCell) {
            let exitX = +style['exitX']
            let exitY = +style['exitY']
            list.push(this.getTouchPoint(graph, sourceCell, exitX, exitY))
        } else {
            list.push(new Vector2(sourcePoint.x, sourcePoint.y))
        }

        let points = edgeGeometry.points
        if (points && points.length > 0) {
            for (let p of points) {
                list.push(new Vector2(p.x, p.y))
            }
        }

        if (targetCell) {
            let entryX = +style['entryX']
            let entryY = +style['entryY']
            list.push(this.getTouchPoint(graph, targetCell, entryX, entryY))
        } else {
            list.push(new Vector2(targetPoint.x, targetPoint.y))
        }

        return list
    },

    /**
     * 计算vertex的实际四角坐标
     * @param graph
     * @param cell
     */
    getVertexPointsCommon(graph, cell) {
        let model = graph.getModel()

        let styleStr = cell.style
        let styleObj = TextUtil.parseDrawioStyle(styleStr)

        let angle = styleObj.rotation || 0

        let geometry = model.getGeometry(cell)
        let { width, height } = geometry

        let vecLt = new Vector2(-width / 2, -height / 2)
        let vecRt = new Vector2(width / 2, -height / 2)
        let vecRb = new Vector2(width / 2, height / 2)
        let vecLb = new Vector2(-width / 2, height / 2)

        let ls = [vecLt, vecRt, vecRb, vecLb]

        let radian = -mathutil.angle2Radian(angle)
        let tran = new Vector2(geometry.getCenterX(), geometry.getCenterY())
        let m = mathutil.commonMatrix(tran, radian, null)

        let list = []
        for (let v of ls) {
            list.push(v.clone().applyMatrix3(m))
        }
        return list
    },

    getCellPointsCommon(graph, cell) {
        let model = graph.getModel()
        let list
        if (model.isVertex(cell)) {
            list = this.getVertexPointsCommon(graph, cell)
        } else {
            list = this.getEdgePointsCommon(graph, cell)
        }

        return list
    },

    /**
     * 根据cell和连接线获取线对面的cell
     * @param edge 当前线
     * @param cell 当前cell
     */
    getAdjacentCellOfEdge(graph, edge, cell) {
        let model = graph.getModel()
        let scell = model.getTerminal(edge, true)
        let tcell = model.getTerminal(edge, false)

        return scell == cell ? tcell : scell
    },
    // 获取两个cell之间的线
    getEdgeBetweenCells(graph, cell1, cell2) {
        let model = graph.getModel()

        let edgeList = model.getEdges(cell1)
        // let edgeList2 = model.getEdges(cell2);

        for (let edge of edgeList) {
            let c1 = model.getTerminal(edge, true)
            let c2 = model.getTerminal(edge, false)

            let b1 = c1 == cell1 || c1 == cell2
            let b2 = c2 == cell1 || c2 == cell2
            if (b1 && b2) {
                return edge
            }
        }
        return null
    },
    /**
     * 检测从preCell至curCell路径的设备数
     * @param graph
     * @param preCell
     * @param curCell
     * @param limit      限制多少个为结束
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
    /**
     * 获取路径上的cell
     * @param graph
     * @param preCell
     * @param curCell
     */
    getPathCells(graph, preCell, curCell) {
        let model = graph.getModel()

        let keys = new Set()
        keys.add(preCell)

        let list = []

        let pathCellCounter = (preCell, curCell) => {
            if (!curCell) {
                return
            }

            if (DeviceCategoryUtil.isTextCell(curCell)) {
                // 文本节点退出
                return
            }

            if (keys.has(curCell)) {
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
    // 同类型设备选择
    selectSameTyepDev(graph, psrtype, isGroup) {
        let rslist = []
        let list = graph.getVerticesAndEdges(true, false) // 非mxGraph方法，由drawio实现
        if (isGroup) {
            for (let cell of list) {
                if (this.isGroupCell(graph, cell)) {
                    rslist.push(cell)
                }
            }
        } else {
            for (let cell of list) {
                if (cell.psrtype == psrtype) {
                    rslist.push(cell)
                }
            }
        }
        return rslist
    },
    /**
     * 计算设备直接相连接的各个设备的设备上的连接位置比率
     * @param graph
     * @param cell1
     * @param cell2
     * @param symbolProp
     * @returns {{cell1RatioVec, cell2RatioVec}}
     */
    getCell2CellLinkRelation(graph, cell1, cell2, symbolProp) {
        let touchList = ['a', 'b', 'c', 'd', 'o']

        let symbol1Attr = symbolProp[cell1.symbol]
        let symbol2Attr = symbolProp[cell2.symbol]

        // 计算设备cell1上的连接点
        let touchCell1List = []
        let touchCell2List = []
        for (let touch of touchList) {
            let item = symbol1Attr[touch]
            if (item) {
                let p = this.getTouchPoint(graph, cell1, item.x, item.y)
                touchCell1List.push({ ratioVec: { ...item }, p })
            }

            let item2 = symbol2Attr[touch]
            if (item2) {
                let p = this.getTouchPoint(graph, cell2, item2.x, item2.y)
                touchCell2List.push({ ratioVec: { ...item2 }, p })
            }
        }

        // 计算最小连接距离
        let vec1
        let vec2
        let minLen
        let isFirst = true
        for (let item of touchCell1List) {
            let { ratioVec: v1, p: p1 } = item
            for (let item2 of touchCell2List) {
                let { ratioVec: v2, p: p2 } = item2
                let tmpLen = mathutil.pixelLen(p1, p2)
                if (isFirst) {
                    isFirst = false
                    minLen = tmpLen
                    vec1 = v1
                    vec2 = v2
                } else {
                    if (tmpLen < minLen) {
                        minLen = tmpLen
                        vec1 = v1
                        vec2 = v2
                    }
                }
            }
        }

        return { cell1RatioVec: vec1, cell2RatioVec: vec2 }
    },
    // 计算线连接线的情况
    getLine2LineRelation(graph, edge1, edge2) {
        let geo1 = edge1.geometry
        let geo2 = edge2.geometry

        let p1_edge1 = new Vector2(geo1.sourcePoint.x, geo1.sourcePoint.y)
        let p2_edge1 = new Vector2(geo1.targetPoint.x, geo1.targetPoint.y)

        let p1_edge2 = new Vector2(geo2.sourcePoint.x, geo2.sourcePoint.y)
        let p2_edge2 = new Vector2(geo2.targetPoint.x, geo2.targetPoint.y)

        let minLen

        let len1 = p1_edge1.clone().sub(p1_edge2)
        let len2 = p2_edge1.clone().sub(p1_edge2)

        let selfTouch, targetTouch
        if (len1 < len2) {
            minLen = len1
            selfTouch = '0'
            targetTouch = '0'
        } else {
            minLen = len2
            selfTouch = '1'
            targetTouch = '0'
        }

        let len3 = p1_edge1.clone().sub(p2_edge2)
        let len4 = p2_edge1.clone().sub(p2_edge2)

        if (len3 < minLen) {
            minLen = len3
            selfTouch = '0'
            targetTouch = '1'
        }

        if (len4 < minLen) {
            selfTouch = '1'
            targetTouch = '1'
        }

        return { selfTouch, targetTouch }
    }
}

export default GraphTool
