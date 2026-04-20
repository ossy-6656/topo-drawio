import GraphTool from './GraphTool.js'
import mathutil from '@/plugins/tmzx/mathutil.js'
import TextUtil from './TextUtil.js'
import geometric from '@/plugins/tmzx/geometric.js'
import DeviceCategoryUtil from './DeviceCategoryUtil.js'

let StationHandler = {
    // 是否是站内设备
    isStationInnerCell(graph, cell) {
        let model = graph.getModel()
        let parent = model.getParent(cell)
        let styleStr = parent.style

        // if (!model.isVertex(cell)) {
        //     return false;
        // }

        if (styleStr && styleStr.indexOf('group;') != -1) {
            return true
        }
        return false
    },
    // 获取站内出线点 symbol：junction_pms25_32000000_4300010
    getJunctionCells(graph, group) {
        let model = graph.getModel()
        let count = model.getChildCount(group)
        let list = []
        if (count > 0) {
            for (let i = 0; i < count; i++) {
                let childCell = model.getChildAt(group, i)
                let id = childCell.id
                // let cellStyle = graph.getCurrentCellStyle(childCell);
                if (
                    childCell.symbol === 'junction_pms25_32000000_4300010' ||
                    (id && id.indexOf('_32000000_') != -1)
                ) {
                    list.push(childCell)
                }
            }
        }
        return list
    },
    // 检测母线是水平还是平行
    checkBusVH(graph, busList) {
        let bus1 = busList[0]
        let bus2 = busList[1]
        let geo1 = graph.getCellGeometry(bus1)
        let geo2 = graph.getCellGeometry(bus2)

        let x1 = geo1.getCenterX()
        let y1 = geo1.getCenterY()

        let x2 = geo2.getCenterX()
        let y2 = geo2.getCenterY()

        return Math.abs(x1 - x2) > Math.abs(y1 - y2) ? 'H' : 'V'
    },

    // 优化站房出线
    prettifyOutgoingLine(graph, group, busList, gap) {
        let model = graph.getModel()
        // 获取所有出线点设备
        let junctionList = this.getJunctionCells(graph, group)
        // 获取分组下的站房
        let stationCell = GraphTool.getStationCell(graph, group)
        let groupGeo = graph.getCellGeometry(group)
        let stationGeo = graph.getCellGeometry(stationCell)

        // let busList = GraphTool.getBus(graph, group);

        // 站房左上角x、y坐标
        let x = stationGeo.x + groupGeo.x
        let y = stationGeo.y + groupGeo.y

        let y_stationBottom = y + stationGeo.height
        let xmax = x + stationGeo.width

        let step = gap

        // 获取出线设备的出线数
        let getOuterLineFun = (edgeList) => {
            let tmpList = []
            for (let edge of edgeList) {
                if (!edge.pid) {
                    tmpList.push(edge)
                }
            }
            return tmpList
        }

        // 重设终端头坐标
        let adjustCellFun = (edge, curCell, cor) => {
            // 调整当前cell y坐标
            let geo = graph.getCellGeometry(curCell).clone()
            geo.x = cor.x - geo.width / 2
            geo.y = cor.y - geo.height / 2
            model.setGeometry(curCell, geo)

            // 去掉线的中间连接点
            let edgeGeo = graph.getCellGeometry(edge).clone()
            edgeGeo.points = null
            model.setGeometry(edge, edgeGeo)
        }

        // 查找电缆终端头，最多找三个设备，不能跑到站内
        let findCableCellFun = (preCell, edge, curCell, cor, point) => {
            if (keys.has(curCell)) {
                return
            }

            // 文本退出
            if (DeviceCategoryUtil.isTextCell(curCell)) {
                return
            }

            // 站内设备退出
            if (curCell.pid) {
                return
            }

            keys.add(curCell)

            // 找到终端头退出
            if (DeviceCategoryUtil.isCableTerminalCell(curCell)) {
                cor.y = cor.y + step
                adjustCellFun(edge, curCell, cor)
                return
            } else if (DeviceCategoryUtil.isJrdTerminalCell(curCell)) {
                // 接入点继续查找
                cor.y = cor.y + step
                adjustCellFun(edge, curCell, cor)
            } else {
                return
            }

            let edgeList = model.getEdges(curCell)
            for (let line of edgeList) {
                let scell = model.getTerminal(line, true)
                let tcell = model.getTerminal(line, false)
                findCableCellFun(curCell, line, scell, cor)
                findCableCellFun(curCell, line, tcell, cor)
            }
        }

        let vh_state = 'H'
        if (busList.length > 1) {
            vh_state = this.checkBusVH(graph, busList)
        }

        // 连接点与母线的关系
        let junction2Bus = new Map()

        let tmpSet = new Set()
        let getBusFun = (cell) => {
            if (tmpSet.has(cell)) {
                return null
            }

            if (!cell.pid) {
                return null
            }

            if (DeviceCategoryUtil.isBusCell(cell)) {
                return cell
            }

            tmpSet.add(cell)

            if (model.isVertex(cell)) {
                let edges = model.getEdges(cell)
                for (let edge of edges) {
                    let c = getBusFun(edge)
                    if (c) {
                        return c
                    }
                }
            } else {
                let sc = model.getTerminal(cell, true)
                let tc = model.getTerminal(cell, false)
                let c = getBusFun(sc)
                if (c) {
                    return c
                }

                c = getBusFun(tc)
                if (c) {
                    return c
                }
            }
            return null
        }

        junctionList.sort((cell1, cell2) => {
            let geo1 = model.getGeometry(cell1)
            let geo2 = model.getGeometry(cell2)
            return geo1.x < geo2.x ? -1 : 1
        })

        // 获取出线设备与母线的对应关系
        for (let cell of junctionList) {
            tmpSet.clear()
            let bus = getBusFun(cell)
            junction2Bus.set(cell, bus)
        }

        // 寻找与连接点连接的出线设备，有可能第一个连接的设备不是终端头，再寻找
        let keys = new Set()
        let gapLenSum = 0
        for (let i = 0; i < junctionList.length; i++) {
            let cell = junctionList[i]

            let gapLen = -1

            if (i < junctionList.length - 1) {
                let cell2 = junctionList[i + 1]
                gapLen = Math.abs(cell.geometry.x - cell2.geometry.x)
                gapLenSum = gapLenSum + gapLen
            }

            let busCell = junction2Bus.get(cell)
            let busGeo = graph.getCellGeometry(busCell)
            let busY = busGeo.getCenterY()

            let cellGeo = graph.getCellGeometry(cell) // 连接点设备geometry
            let cellY = cellGeo.getCenterY()

            let edges = model.getEdges(cell)

            // 获取出线设备的出线数
            let outerLineList = getOuterLineFun(edges)
            keys.add(cell)

            let startY = cellY > busY ? y_stationBottom : y
            step = cellY > busY ? gap : -gap

            // step = stepY = cellY > busY ? 200 : -200;
            // if (cellY > busY) // 母线之下
            // {
            //     startY = y_stationBottom;
            //     stepY = 200;
            //     stepX = 0;
            // }
            // else  // 母线之上，放右边
            // {
            //     startY = y_stationBottom;
            //     startX = xmax;
            //
            //     stepY = 0;
            //     stepX = 200;
            // }

            let startX = 0
            let isFirst = true
            for (let edge of outerLineList) {
                let vecList = GraphTool.getEdgePointsVec(graph, edge)

                // 源点是否连接到出线设备
                let isSourceInner = model.getTerminal(edge, true) == cell ? true : false

                let vec = isSourceInner ? vecList[0] : vecList[vecList.length - 1]

                if (startX == 0) {
                    startX = vec.x
                } else {
                    if (gapLen != -1) {
                        startX = startX + gapLen / 2
                    } else {
                        // startX = startX + gapLenSum / (junctionList.length - 1) / 2;
                        // if (startX > xmax) {
                        //     startX = xmax - 40;
                        // }
                        startX = startX + Math.abs(xmax - (x + cell.geometry.getCenterX())) / 2
                    }
                }

                let oppositeCell = GraphTool.getAdjacentCellOfEdge(graph, edge, cell)

                // 寻找出线设备并重设位置
                findCableCellFun(
                    cell,
                    edge,
                    oppositeCell,
                    { x: startX, y: startY },
                    { x: startX, y: vec.y }
                )

                if (!isFirst) {
                    let edgeGeo = model.getGeometry(edge).clone()

                    edgeGeo.points = [new mxPoint(startX, vec.y)]
                    model.setGeometry(edge, edgeGeo)
                }
                isFirst = false
            }
        }
    },
    /**
     * 获取间隔设备集合
     * flag=busbar;
     * @param firstLine
     */
    getGapCells(graph, firstLine) {
        let model = graph.getModel()
        let list = []

        let keys = new Set()
        let isPassHandler = (cell) => {
            let styleObj = TextUtil.parseDrawioStyle(cell.style)
            if (styleObj.flag == 'busbar') {
                return false
            }

            if (!cell.pid) {
                return
            }
            if (keys.has(cell)) {
                return false
            }

            return true
        }

        // 递归搜索所有间隔设备
        let rescueSearch = (cell) => {
            if (!isPassHandler(cell)) {
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

        return list
    },
    /**
     * 获取间隔设备
     * @param graph
     * @param busCell
     * @param firstLine
     * @returns {{flag: boolean, list: *[]}} flag:是否是两个母线之间的间隔
     */
    getGapCells2(graph, busCell, firstLine) {
        let model = graph.getModel()
        let list = []

        let keys = new Set()

        let isBusConnectionGap = false
        // 递归搜索所有间隔设备
        let rescueSearch = (cell) => {
            let styleObj = TextUtil.parseDrawioStyle(cell.style)

            if (styleObj.flag == 'busbar') {
                // 如果是母线
                if (cell != busCell) {
                    // 如果是两个母线之间的间隔
                    isBusConnectionGap = true
                }
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
        rescueSearch(firstLine)

        return { list, flag: isBusConnectionGap }
    },

    /**
     * 检查当前设备是否在母联间隔
     * @param graph
     * @param cell
     */
    isBusConnectLine(graph, cell) {
        let model = graph.getModel()
        let busNums = 0

        let busSet = new Set()

        let keys = new Set()

        let findNext = (c) => {
            if (!c) {
                return
            }
            if (!c.pid) {
                return
            }

            if (keys.has(c)) {
                return
            }

            if (DeviceCategoryUtil.isBusCell(c)) {
                busSet.add(c)
                return
            }

            keys.add(c)

            if (model.isVertex(c)) {
                let edges = model.getEdges(c)
                for (let edge of edges) {
                    findNext(edge)
                }
            } else {
                let scell = model.getTerminal(c, true)
                let tcell = model.getTerminal(c, false)
                findNext(scell)
                findNext(tcell)
            }
        }

        findNext(cell)

        return busSet.size == 2
    },

    /**
     * 计算所有设备的坐标范围
     * @param graph
     * @param list
     */
    getCellsDimenstion(graph, list) {
        let vecList = []
        let model = graph.getModel()

        for (let cell of list) {
            if (model.isVertex(cell)) {
                let list = GraphTool.getVertexPointsCommon(graph, cell)
                vecList.push(...list)
            } else if (model.isEdge(cell)) {
                let list = GraphTool.getEdgePointsCommon(graph, cell)
                vecList.push(...list)
            }
        }
        return mathutil.vecListBounds(vecList)
    },
    /**
     * 平移gap
     * @param list
     * @param vecStep 平移向量
     */
    moveGap(graph, list, vecStep) {
        let model = graph.getModel()

        for (let cell of list) {
            let geo = model.getGeometry(cell)
            let geoClone = geo.clone()
            if (model.isVertex(cell)) {
                let { width, height } = geo
                let vec = new Vector2(geo.getCenterX(), geo.getCenterY())
                let vec2 = vec.clone().add(vecStep)

                geoClone.x = vec2.x - width / 2
                geoClone.y = vec2.y - height / 2
                model.setGeometry(cell, geoClone)
            } else if (model.isEdge(cell)) {
                let vecLs = []
                let vecList = GraphTool.getEdgePointsCommon(graph, cell)
                for (let vec of vecList) {
                    let vec2 = vec.clone().add(vecStep)
                    vecLs.push(vec2)
                }

                let firstVec = vecLs[0]
                let lastVec = vecLs[vecList.length - 1]
                geoClone.sourcePoint = new mxPoint(firstVec.x, firstVec.y)
                geoClone.targetPoint = new mxPoint(lastVec.x, lastVec.y)

                if (vecList.length > 2) {
                    let points = []
                    let tmpList = vecLs.slice(1, vecList.length - 1)
                    for (let vec of tmpList) {
                        points.push(new mxPoint(vec.x, vec.y))
                    }
                    geoClone.points = points
                }
                model.setGeometry(cell, geoClone)
            }
        }
    },
    moveGap2(graph, list, vecStep) {
        let model = graph.getModel()

        for (let cell of list) {
            let geo = model.getGeometry(cell)
            let geoClone = geo.clone()
            if (model.isVertex(cell)) {
                let { width, height } = geo
                let vec = new Vector2(geo.getCenterX(), geo.getCenterY())
                let vec2 = vec.clone().add(vecStep)

                geoClone.x = vec2.x - width / 2
                geoClone.y = vec2.y - height / 2
                model.setGeometry(cell, geoClone)
            } else if (model.isEdge(cell)) {
                let vecLs = []
                let vecList = GraphTool.getEdgePointsCommon(graph, cell)
                for (let vec of vecList) {
                    let vec2 = vec.clone().add(vecStep)
                    vecLs.push(vec2)
                }

                let firstVec = vecLs[0]
                let lastVec = vecLs[vecList.length - 1]
                geoClone.sourcePoint = new mxPoint(firstVec.x, firstVec.y)
                geoClone.targetPoint = new mxPoint(lastVec.x, lastVec.y)

                if (vecList.length > 2) {
                    let points = []
                    let tmpList = vecLs.slice(1, vecList.length - 1)
                    for (let vec of tmpList) {
                        points.push(new mxPoint(vec.x, vec.y))
                    }
                    geoClone.points = points
                }
                model.setGeometry(cell, geoClone)
            }
        }
    },
    // 仅移动母线连接线
    moveBusLinkedLine(graph, lineCell, vecStep) {
        let model = graph.getModel()
        let vecLs = []
        let vecList = GraphTool.getEdgePointsCommon(graph, lineCell)
        for (let vec of vecList) {
            let vec2 = vec.clone().add(vecStep)
            vecLs.push(vec2)
        }

        let sc = model.getTerminal(lineCell, true)
        // let tc = model.getTerminal(lineCell, false);
        let isSource = false
        if (sc.symbol == 'busbar') {
            isSource = true
        }

        let geoClone = model.getGeometry(lineCell)

        let firstVec = vecLs[0]
        let lastVec = vecLs[vecList.length - 1]
        if (isSource) {
            geoClone.sourcePoint = new mxPoint(firstVec.x, firstVec.y)
        } else {
            geoClone.targetPoint = new mxPoint(lastVec.x, lastVec.y)
        }

        if (vecList.length > 2) {
            let points = []
            let tmpList = vecLs.slice(1, vecList.length - 1)
            for (let vec of tmpList) {
                points.push(new mxPoint(vec.x, vec.y))
            }
            geoClone.points = points
        }
        model.setGeometry(lineCell, geoClone)
    },
    // 移动当前母线连接的间隔，但不处理对面母线连接线
    moveGapExceptOtherBusLinkedLine(graph, busCell, list, vecStep) {
        let model = graph.getModel()
        // 过滤掉另外一个母线的连接线
        let list2 = []
        // 找出连接到另外一个母线的连接线
        for (let cell of list) {
            if (model.isEdge(cell)) {
                let scell = model.getTerminal(cell, true)
                let tcell = model.getTerminal(cell, false)

                let styleObjS = TextUtil.parseDrawioStyle(scell.style)
                let styleObjT = TextUtil.parseDrawioStyle(tcell.style)
                let isOtherLine = false
                if (styleObjS.flag == 'busbar' && scell != busCell) {
                    isOtherLine = true
                } else if (styleObjT.flag == 'busbar' && tcell != busCell) {
                    isOtherLine = true
                }
                if (!isOtherLine) {
                    list2.push(cell)
                }
            } else {
                list2.push(cell)
            }
        }
        this.moveGap2(graph, list2, vecStep)
    },
    /**
     * 紧凑化母线
     * @param graph
     * @param busCell
     */
    compactBus(graph, busCell) {
        let model = graph.getModel()
        let edgeList = model.getEdges(busCell)
        let gapList = []

        // 1、计算间隔占用空间
        let gapWidth = 0
        for (let firstLine of edgeList) {
            let cellList = this.getGapCells(graph, firstLine)
            let dimension = this.getCellsDimenstion(graph, cellList)
            gapList.push({ dimension, firstLine, cellList })
            gapWidth = gapWidth + dimension.width
        }
        let spaceWidth = 100 // 间隔间的空隙大小
        // 200是母线两边的头总宽度
        gapWidth = gapWidth + (gapList.length - 1) * spaceWidth + 200

        // 2、排序间隔，按x从左至右排序
        gapList.sort((item1, item2) => {
            let dimension1 = item1.dimension
            let dimension2 = item2.dimension

            return dimension1.xmin - dimension2.xmin
        })
        let isFirst = true
        let startX

        // 测试计算范围
        // let groupCell = model.getParent(busCell);
        // for(let {dimension, firstLine, cellList} of gapList) {
        //     let {xmin, ymin, width, height} = dimension;
        //     graph.insertVertex(groupCell, null, null, xmin, ymin, width, height, 'fillColor=none;strokeColor=green;strokeWidth=1;');
        // }

        // 3、平移间隔，使其平均分布，并且重新计算间隔所占用空间
        for (let { dimension, firstLine, cellList } of gapList) {
            if (isFirst) {
                isFirst = false
                startX = dimension.xmax + spaceWidth
            } else {
                let curXmin = dimension.xmin
                let width = dimension.width
                let step = startX - curXmin
                let vecStep = new Vector2(step, 0)
                this.moveGap(graph, cellList, vecStep)
                dimension.xmin = startX
                dimension.xmax = startX + width
                startX = startX + width + spaceWidth
            }
        }

        // 4、计算当前间隔总范围，重算母线位置
        let vecDimensionList = []
        for (let { dimension } of gapList) {
            let { xmin, ymin, xmax, ymax } = dimension
            vecDimensionList.push(new Vector2(xmin, ymin))
            vecDimensionList.push(new Vector2(xmax, ymax))
        }
        let cellsDimension = mathutil.vecListBounds(vecDimensionList)
        let xmid = cellsDimension.xmin + cellsDimension.width / 2
        let busGeoClone = busCell.geometry.clone()
        busGeoClone.width = gapWidth
        busGeoClone.x = xmid - gapWidth / 2

        model.setGeometry(busCell, busGeoClone)

        // 5、重新计算连接线与母线的连接位置
        let width_bus = busGeoClone.width
        let height_bus = busGeoClone.height
        let x_bus = busGeoClone.x
        let y_bus = busGeoClone.y

        for (let { dimension, firstLine, cellList } of gapList) {
            let isSource = model.getTerminal(firstLine, true) == busCell ? true : false

            let lineGeo = model.getGeometry(firstLine)
            let p = lineGeo.sourcePoint

            let ratioX = Math.abs(p.x - x_bus) / width_bus
            if (isSource) {
                graph.setCellStyles('exitX', ratioX, [firstLine])
                graph.setCellStyles('exitY', 0.5, [firstLine])
            } else {
                graph.setCellStyles('entryX', ratioX, [firstLine])
                graph.setCellStyles('entryY', 0.5, [firstLine])
            }
        }

        // 6、算出当前母线与关联设备占用总空间
        vecDimensionList.push(new Vector2(x_bus, y_bus))
        vecDimensionList.push(new Vector2(x_bus + width_bus, y_bus + height_bus))

        return mathutil.vecListBounds(vecDimensionList)
    },
    compactBus2(graph, busCell, busStartX) {
        let model = graph.getModel()
        let edgeList = model.getEdges(busCell)
        let gapList = []

        // 1、计算间隔占用空间
        let gapWidth = 0
        let gapNum = 0
        let gapBusConnectObj = null
        let ymin = Number.MAX_VALUE,
            ymax = Number.MIN_VALUE
        for (let firstLine of edgeList) {
            let { list: cellList, flag } = this.getGapCells2(graph, busCell, firstLine)
            if (flag) {
                // 母线连接线
                gapBusConnectObj = { firstLine, cellList, flag }
                gapList.push(gapBusConnectObj)
            } else {
                let dimension = this.getCellsDimenstion(graph, cellList)
                gapList.push({ dimension, firstLine, cellList, flag })

                if (dimension.ymin < ymin) {
                    ymin = dimension.ymin
                }
                if (dimension.ymax > ymax) {
                    ymax = dimension.ymax
                }

                gapWidth = gapWidth + dimension.width
                gapNum = gapNum + 1
            }
        }

        // 处理母线连接线的情况
        if (gapBusConnectObj) {
            let avgWidth = gapWidth / gapNum
            gapBusConnectObj.dimension = {
                width: avgWidth
            }
            gapWidth = gapWidth + avgWidth
        }

        let spaceWidth = 300 // 间隔间的空隙大小
        // 200是母线两边的头总宽度
        gapWidth = gapWidth + (gapList.length - 1) * spaceWidth

        // 2、排序间隔，按x从左至右排序
        // gapList.sort((item1, item2) => {
        //     let dimension1 = item1.dimension;
        //     let dimension2 = item2.dimension;
        //
        //     return dimension1.xmin - dimension2.xmin;
        // });
        // 以母线与连接线的连接点排序
        gapList.sort((item1, item2) => {
            let firstLine1 = item1.firstLine
            let firstLine2 = item2.firstLine
            let vec1 = GraphTool.getBusTouchPointCommon(graph, firstLine1)
            let vec2 = GraphTool.getBusTouchPointCommon(graph, firstLine2)
            return vec1.x - vec2.x
        })

        // 计算母线连接线是开始还是结束
        if (gapBusConnectObj) {
            let gapBusLinkIsFirst = gapList[0].flag ? true : false

            if (gapBusLinkIsFirst) {
                let gapObj = gapList[0]
                let pos = GraphTool.getBusTouchPointCommon(graph, gapObj.firstLine)
                let dim = gapObj.dimension

                gapObj.dimension.xmin = pos.x - dim.width / 2
                gapObj.dimension.xmax = pos.x + dim.width / 2
                gapObj.dimension.ymin = ymin
                gapObj.dimension.ymax = ymax
                gapObj.dimension.height = ymax - ymin
            } else {
                let len = gapList.length
                let gapObj = gapList[len - 1]
                let pos = GraphTool.getBusTouchPointCommon(graph, gapObj.firstLine)
                let dim = gapObj.dimension

                gapObj.dimension.xmin = pos.x - dim.width / 2
                gapObj.dimension.xmax = pos.x + dim.width / 2
                gapObj.dimension.ymin = ymin
                gapObj.dimension.ymax = ymax
                gapObj.dimension.height = ymax - ymin
            }
        }

        // 测试计算范围
        // let groupCell = model.getParent(busCell);
        // for(let {dimension, firstLine, cellList, flag} of gapList) {
        //     let {xmin, ymin, width, height} = dimension;
        //     if (flag) {
        //         graph.insertVertex(groupCell, null, null, xmin, ymin, width, height, 'fillColor=none;strokeColor=blue;strokeWidth=1;');
        //     } else {
        //         graph.insertVertex(groupCell, null, null, xmin, ymin, width, height, 'fillColor=none;strokeColor=green;strokeWidth=1;');
        //     }
        //
        // }

        // 3、平移间隔，使其平均分布，并且重新计算间隔所占用空间
        let startX = busStartX
        let index = 0
        for (let { dimension, firstLine, cellList, flag } of gapList) {
            if (busStartX == -1) {
                busStartX = 0
                startX = dimension.xmax + spaceWidth
            } else {
                let curXmin = dimension.xmin
                let width = dimension.width
                let step = startX - curXmin
                let vecStep = new Vector2(step, 0)

                if (index == 0 && flag) {
                    // 下一个母线首个间隔为母线连接线
                    this.moveBusLinkedLine(graph, firstLine, vecStep)
                } else if (flag) {
                    // 母线最后一个间隔为母线连接线
                    this.moveGapExceptOtherBusLinkedLine(graph, busCell, cellList, vecStep)
                } // 普通间隔
                else {
                    this.moveGap2(graph, cellList, vecStep)
                }
                // 重算x轴范围
                dimension.xmin = startX
                dimension.xmax = startX + width
                startX = startX + width + spaceWidth
            }
            index++
        }

        // 4、计算当前间隔总范围，重算母线位置
        let vecDimensionList = []
        for (let { dimension } of gapList) {
            let { xmin, ymin, xmax, ymax } = dimension
            vecDimensionList.push(new Vector2(xmin, ymin))
            vecDimensionList.push(new Vector2(xmax, ymax))
        }
        let cellsDimension = mathutil.vecListBounds(vecDimensionList)
        let xmid = cellsDimension.xmin + cellsDimension.width / 2
        let busGeoClone = busCell.geometry.clone()
        busGeoClone.width = gapWidth
        busGeoClone.x = xmid - gapWidth / 2

        model.setGeometry(busCell, busGeoClone)

        // 5、重新计算连接线与母线的连接位置
        let width_bus = busGeoClone.width
        let height_bus = busGeoClone.height
        let x_bus = busGeoClone.x
        let y_bus = busGeoClone.y

        for (let { dimension, firstLine, cellList, flag } of gapList) {
            let isSource = model.getTerminal(firstLine, true) == busCell ? true : false

            let lineGeo = model.getGeometry(firstLine)

            let p
            if (isSource) {
                p = lineGeo.sourcePoint
            } else {
                p = lineGeo.targetPoint
            }

            let ratioX = Math.abs(p.x - x_bus) / width_bus
            if (isSource) {
                graph.setCellStyles('exitX', ratioX, [firstLine])
                graph.setCellStyles('exitY', 0.5, [firstLine])
            } else {
                graph.setCellStyles('entryX', ratioX, [firstLine])
                graph.setCellStyles('entryY', 0.5, [firstLine])
            }
        }

        // 6、算出当前母线与关联设备占用总空间
        vecDimensionList.push(new Vector2(x_bus, y_bus))
        vecDimensionList.push(new Vector2(x_bus + width_bus, y_bus + height_bus))

        return mathutil.vecListBounds(vecDimensionList)
    },
    /**
     * 站房紧凑化（仅处理单母线）
     * @param graph
     * @param groupCell
     */
    compactStation(graph, groupCell) {
        let model = graph.getModel()

        // 获取母线列表，并按x坐标从左至右
        let busList = GraphTool.getBus(graph, groupCell)
        if (busList.length == 0) {
            return
        }
        let busCell = busList[0]

        model.beginUpdate()
        let vecList = []
        try {
            let dimension = this.compactBus(graph, busCell)
            vecList.push(new Vector2(dimension.xmin, dimension.ymin))
            vecList.push(new Vector2(dimension.xmax, dimension.ymax))

            // 重算站房大小
            let innerDim = mathutil.vecListBounds(vecList)
            let { xmin, ymin, width, height } = innerDim
            let stationCell = GraphTool.getStationCell(graph, groupCell)
            // 处理关联文本
            let txtId = 'TXT-' + stationCell.id
            let txtCell = model.getCell(txtId)
            let vecRel = null,
                txtGeo = null
            if (txtCell) {
                let groupGeo = model.getGeometry(groupCell)
                txtGeo = model.getGeometry(txtCell)
                let vec1 = new Vector2(txtGeo.x + txtGeo.width / 2, txtGeo.y + txtGeo.height / 2)

                let vec2 = new Vector2(groupGeo.x + groupGeo.width / 2, groupGeo.y)
                vecRel = vec1.clone().sub(vec2)
            }

            let stationGeo = model.getGeometry(stationCell).clone()
            stationGeo.x = xmin - 100
            stationGeo.y = ymin - 50
            stationGeo.width = width + 200
            stationGeo.height = height + 100
            model.setGeometry(stationCell, stationGeo)
            GraphTool.autosize(graph)

            if (vecRel) {
                let groupGeo = model.getGeometry(groupCell)
                let vec = new Vector2(groupGeo.x + groupGeo.width / 2, groupGeo.y)
                let v = vec.clone().add(vecRel)
                let txtGeo = txtCell.geometry.clone()
                txtGeo.x = v.x - txtGeo.width / 2
                txtGeo.y = txtGeo.y - txtGeo.height / 2
                model.setGeometry(txtCell, txtGeo)
            }
        } finally {
            model.endUpdate()
        }
    },

    /**
     * 站房紧凑化（多母线，目前处理水平方向多母线）
     * @param graph
     * @param groupCell
     */
    compactMultiBusStation(graph, groupCell) {
        let model = graph.getModel()

        // 获取母线列表，并按x坐标从左至右
        let busList = GraphTool.getBus(graph, groupCell)
        busList.sort((bus1, bus2) => {
            let busGeo1 = model.getGeometry(bus1)
            let busGeo2 = model.getGeometry(bus2)
            return busGeo1.x - busGeo2.x
        })

        model.beginUpdate()
        let vecList = []
        try {
            // 分别计算每个母线下的间隔，并平均分布
            let dimension = null
            let busStartX = -1
            for (let busCell of busList) {
                dimension = this.compactBus2(graph, busCell, busStartX)
                vecList.push(new Vector2(dimension.xmin, dimension.ymin))
                vecList.push(new Vector2(dimension.xmax, dimension.ymax))
                busStartX = dimension.xmax + 200
            }

            // 重算站房大小
            let innerDim = mathutil.vecListBounds(vecList)
            let { xmin, ymin, width, height } = innerDim
            let stationCell = GraphTool.getStationCell(graph, groupCell) // 站房cell

            // 处理关联文本
            let txtId = 'TXT-' + stationCell.id
            let txtCell = model.getCell(txtId)
            let vecRel = null,
                txtGeo = null

            let stationGeo = model.getGeometry(stationCell)
            if (txtCell) {
                let groupGeo = model.getGeometry(groupCell)
                let origin = {
                    x: groupGeo.x,
                    y: groupGeo.y
                }
                txtGeo = model.getGeometry(txtCell)
                let vec1 = new Vector2(txtGeo.x + txtGeo.width / 2, txtGeo.y + txtGeo.height / 2) // 文本中心向量

                let vec2 = new Vector2(
                    origin.x + stationGeo.x + stationGeo.width / 2,
                    origin.y + stationGeo.y
                ) // 站房上方中心向量
                vecRel = vec1.clone().sub(vec2)
            }

            let stationGeoClone = model.getGeometry(stationCell).clone()
            stationGeoClone.x = xmin - 100
            stationGeoClone.y = ymin - 50
            stationGeoClone.width = width + 200
            stationGeoClone.height = height + 100
            model.setGeometry(stationCell, stationGeoClone)
            GraphTool.autosize(graph)

            if (vecRel) {
                let groupGeo = model.getGeometry(groupCell)
                let origin = {
                    x: groupGeo.x,
                    y: groupGeo.y
                }

                let stationGeo2 = model.getGeometry(stationCell)
                let vec = new Vector2(
                    origin.x + stationGeo2.x + stationGeo2.width / 2,
                    origin.y + stationGeo2.y
                )

                let v = vec.clone().add(vecRel)
                let txtGeo = txtCell.geometry.clone()
                txtGeo.x = v.x - txtGeo.width / 2
                txtGeo.y = v.y - txtGeo.height / 2
                model.setGeometry(txtCell, txtGeo)
            }
        } finally {
            model.endUpdate()
        }
    },
    /**
     * 重新计算母线连接线与母线连接位置
     * @param graph
     * @param lineList
     * @param dx       拖动设备偏移量x
     * @param dy       拖动设备偏移量y
     */
    recalculateBusConnectedLine_bak: function (graph, lineList, dx, dy) {
        let model = graph.getModel()
        let view = graph.getView()

        // 查找除母线连接与第一个连接的设备外的，所有间隔设备
        let findRestDeviceList = (cell) => {
            if (keys.has(cell) || !cell.pid) {
                return
            }

            keys.add(cell)
            restCellList.push(cell)

            // 查找对应文本
            let sbid = cell.id
            let txtId = `TXT-${sbid}`
            let txtCell = model.getCell(txtId)
            if (txtCell) {
                restCellList.push(txtCell)
            }

            if (model.isVertex(cell)) {
                let edgeList = model.getEdges(cell)
                for (let edge of edgeList) {
                    findRestDeviceList(edge)
                }
            } else {
                let sCell = model.getTerminal(cell, true)
                let tCell = model.getTerminal(cell, false)

                findRestDeviceList(sCell)
                findRestDeviceList(tCell)
            }
        }

        let moveRestCellList = () => {
            if (restCellList.length < 1) {
                return
            }
            let geoClone
            for (let cell of restCellList) {
                if (model.isVertex(cell)) {
                    geoClone = model.getGeometry(cell).clone()
                    geoClone.x = geoClone.x + dx
                    geoClone.y = geoClone.y + dy
                } else {
                    geoClone = model.getGeometry(cell).clone()
                    let points = geoClone.points
                    if (points && points.length > 0) {
                        for (let p of points) {
                            p.x = p.x + dx
                            p.y = p.y + dy
                        }
                    }
                }
                model.setGeometry(cell, geoClone)
            }
        }

        // 重算母线连接线位置
        let adjustBusConnectLine = (busCell, lineCell, devCell, isSourceConnect) => {
            let busState = view.getState(busCell)
            let busAngle = busState.style.rotation || 0
            let rot = -mathutil.angle2Radian(busAngle)
            let busGeometry = busCell.geometry

            // 1、计算母线两端坐标
            let { width, height } = busGeometry
            let v1 = new Vector2(-width / 2, height / 2)
            let v2 = new Vector2(width / 2, height / 2)

            let tran = new Vector2(busGeometry.getCenterX(), busGeometry.getCenterY())
            let m = mathutil.commonMatrix(tran, rot, null)

            // 计算出母线【从上至下】或者【从左至右】的坐标
            let vstart = v1.clone().applyMatrix3(m)
            let vend = v2.clone().applyMatrix3(m)

            // 计算线的相对坐标
            let parent = model.getParent(lineCell)
            let points = GraphTool.getEdgePoints(graph, lineCell) // 这个地获取的是绝对坐标
            let pointLs = []
            let pos = [parent.geometry.x, parent.geometry.y]
            for (let p of points) {
                pointLs.push(new Vector2(p.x - pos[0], p.y - pos[1]))
            }

            // 连接线的0点坐标与末点坐标
            let p1 = pointLs[0]
            let p2 = pointLs[pointLs.length - 1]

            let p = null
            if (isSourceConnect) {
                p = mathutil.closestPointOnLineSegment(p2, vstart, vend)
            } else {
                p = mathutil.closestPointOnLineSegment(p1, vstart, vend)
            }

            let len1 = mathutil.pixelLen(vstart, p)
            let ratio = len1 / width
            if (isSourceConnect) {
                graph.setCellStyles('exitX', ratio, [lineCell])
            } else {
                graph.setCellStyles('entryX', ratio, [lineCell])
            }
        }

        let keys = new Set()
        let restCellList = []
        // 查找与母线连接线相连接的第一个设备
        for (let line of lineList) {
            let sCell = model.getTerminal(line, true)
            let tCell = model.getTerminal(line, false)

            let curDevCell, busCell, isSourceConnect

            if (DeviceCategoryUtil.isBusCell(sCell)) {
                curDevCell = tCell
                busCell = sCell
                isSourceConnect = true
            } else {
                curDevCell = sCell
                busCell = tCell
                isSourceConnect = false
            }

            // 调整母线连接线
            adjustBusConnectLine(busCell, line, curDevCell, isSourceConnect)

            restCellList = []
            keys.clear()
            keys.add(curDevCell)

            // 查找与当前设备相连接的非母线连接线
            let oppositeLine
            let edgeList = model.getEdges(curDevCell)
            for (let edge of edgeList) {
                if (edge != line && !DeviceCategoryUtil.isUselessLine(edge)) {
                    oppositeLine = edge
                    break
                }
            }

            findRestDeviceList(oppositeLine)

            moveRestCellList()
        }
    },
    /**
     *
     * @param graph
     * @param lineList
     * @param dx
     * @param dy
     */
    recalculateBusConnectedLine: function (graph, lineList, dx, dy) {
        let model = graph.getModel()
        let view = graph.getView()

        let busGeo
        let isSpecialGap = false

        // 查找除母线连接与第一个连接的设备外的，所有间隔设备
        let findRestDeviceList = (cell) => {
            if (!cell) {
                return
            }
            if (keys.has(cell) || !cell.pid) {
                return
            }

            if (DeviceCategoryUtil.isBusCell(cell)) {
                return
            }

            keys.add(cell)

            let isPass = true
            if (isSpecialGap) {
                let xmin = busGeo.x
                let xmax = busGeo.x + busGeo.width

                if (model.isVertex(cell)) {
                    let cellGeo = model.getGeometry(cell)
                    let cx = cellGeo.getCenterX()
                    if (cx >= xmin && cx <= xmax) {
                        restCellList.push(cell)
                        isPass = true
                    } else {
                        isPass = false
                    }
                } else {
                    let list = GraphTool.getEdgePointsCommon(graph, cell)
                    for (let p of list) {
                        if (p.x < xmin || p.x > xmax) {
                            isPass = false
                            break
                        }
                    }

                    if (isPass) {
                        restCellList.push(cell)
                    }
                }
            } else {
                restCellList.push(cell)
            }

            // 查找对应文本
            let sbid = cell.id

            let txtId = `TXT-${sbid}`
            let txtCell = model.getCell(txtId)
            if (txtCell && isPass) {
                restCellList.push(txtCell)
            }

            let pointId = `Point-${sbid}`
            let pointCell = model.getCell(pointId)
            if (pointCell && isPass) {
                restCellList.push(pointCell)
            }

            if (model.isVertex(cell)) {
                let edgeList = model.getEdges(cell)
                for (let edge of edgeList) {
                    findRestDeviceList(edge)
                }
            } else {
                let sCell = model.getTerminal(cell, true)
                let tCell = model.getTerminal(cell, false)

                findRestDeviceList(sCell)
                findRestDeviceList(tCell)
            }
        }

        let moveRestCellList = () => {
            if (restCellList.length < 1) {
                return
            }
            let geoClone
            for (let cell of restCellList) {
                if (cell == curDevCell) {
                    continue
                }
                if (model.isVertex(cell)) {
                    geoClone = model.getGeometry(cell).clone()
                    geoClone.x = geoClone.x + dx
                    geoClone.y = geoClone.y + dy
                } else {
                    geoClone = model.getGeometry(cell).clone()
                    let points = geoClone.points
                    if (points && points.length > 0) {
                        for (let p of points) {
                            p.x = p.x + dx
                            p.y = p.y + dy
                        }
                    }
                }
                model.setGeometry(cell, geoClone)
            }
        }

        // 重算母线连接线位置
        let adjustBusConnectLine = (busCell, lineCell, isSourceConnect) => {
            let busState = view.getState(busCell)
            let busAngle = busState.style.rotation || 0
            let rot = -mathutil.angle2Radian(busAngle)
            let busGeometry = busCell.geometry

            // 1、计算母线两端坐标
            let { width, height } = busGeometry
            let v1 = new Vector2(-width / 2, height / 2)
            let v2 = new Vector2(width / 2, height / 2)

            let tran = new Vector2(busGeometry.getCenterX(), busGeometry.getCenterY())
            let m = mathutil.commonMatrix(tran, rot, null)

            // 计算出母线【从上至下】或者【从左至右】的坐标
            let vstart = v1.clone().applyMatrix3(m)
            let vend = v2.clone().applyMatrix3(m)

            let lineStyleObj = TextUtil.parseDrawioStyle(lineCell.style)
            let ratioX, ratioY
            // 计算线的相对坐标
            if (isSourceConnect) {
                // 连接线源点连接到母线
                ratioX = +lineStyleObj.entryX
                ratioY = +lineStyleObj.entryY
            } // 连接线终点连接到母线
            else {
                ratioX = +lineStyleObj.exitX
                ratioY = +lineStyleObj.exitY
            }
            let vecPos = GraphTool.getTouchPoint(graph, curDevCell, ratioX, ratioY)

            let p = mathutil.closestPointOnLineSegment(vecPos, vstart, vend)

            let len1 = mathutil.pixelLen(vstart, p)
            let ratio = len1 / width
            if (isSourceConnect) {
                graph.setCellStyles('exitX', ratio, [lineCell])
            } else {
                graph.setCellStyles('entryX', ratio, [lineCell])
            }
        }

        let keys = new Set()
        let restCellList = []
        let curDevCell
        // 查找与母线连接线相连接的第一个设备
        for (let line of lineList) {
            let sCell = model.getTerminal(line, true)
            let tCell = model.getTerminal(line, false)

            let busCell, isSourceConnect

            if (DeviceCategoryUtil.isBusCell(sCell)) {
                curDevCell = tCell
                busCell = sCell
                isSourceConnect = true
            } else {
                curDevCell = sCell
                busCell = tCell
                isSourceConnect = false
            }

            isSpecialGap = this.isBusConnectLine(graph, line)

            restCellList = []
            keys.clear()
            keys.add(busCell)

            busGeo = model.getGeometry(busCell)

            // if (isSpecialGap) {
            //     let connectionPoint = GraphTool.getBusTouchPointCommon(graph, line);
            //     if (connectionPoint.x > busCell.x) {
            //         gapPosition = 'R';
            //     }
            // }

            findRestDeviceList(line, isSpecialGap, busCell)

            moveRestCellList()

            // 调整母线连接线
            adjustBusConnectLine(busCell, line, isSourceConnect)
        }
    },
    /**
     * 如果拖动的是母线，则移动整体
     * @param graph
     * @param busCell
     * @param dx
     * @param dy
     */
    moveBusAndRest(graph, busCell, dx, dy) {
        let model = graph.getModel()
        let list = GraphTool.getBusGroup(graph, busCell)

        for (let cell of list) {
            if (cell == busCell) {
                continue
            }

            let geoClone = model.getGeometry(cell).clone()
            if (model.isVertex(cell)) {
                geoClone.x = geoClone.x + dx
                geoClone.y = geoClone.y + dy
            } else {
                let points = geoClone.points
                if (points && points.length > 0) {
                    for (let p of points) {
                        p.x = p.x + dx
                        p.y = p.y + dy
                    }
                }
            }
            model.setGeometry(cell, geoClone)
        }
    },

    // 选中同类站内设备
    selectSimilarCell(graph, cell) {
        let model = graph.getModel()
        let parent = model.getParent(cell)
        let styleStr = parent.style
        if (!styleStr || styleStr.indexOf('group;') == -1) {
            return
        }
        let list = []
        let symbol = cell.symbol
        let count = model.getChildCount(parent)
        if (count > 0) {
            for (let i = 0; i < count; i++) {
                let childCell = model.getChildAt(parent, i)
                if (childCell.symbol == symbol) {
                    list.push(childCell)
                }
            }
        }
        return list
    },

    // 选中同类设备文本
    selectSimilarCellText(graph, cell) {
        let model = graph.getModel()
        let parent = model.getParent(cell)
        let styleStr = parent.style
        if (!styleStr || styleStr.indexOf('group;') == -1) {
            return
        }
        let list = []
        let symbol = cell.symbol
        let count = model.getChildCount(parent)
        if (count > 0) {
            for (let i = 0; i < count; i++) {
                let childCell = model.getChildAt(parent, i)
                if (childCell.symbol == symbol) {
                    let id = childCell.id
                    let txtId = 'TXT-' + id
                    let txtCell = model.getCell(txtId)
                    if (txtCell) {
                        list.push(txtCell)
                    }
                }
            }
        }
        return list
    },

    // 选中同类设备测点
    selectSimilarCellPoint(graph, cell) {
        let model = graph.getModel()
        let parent = model.getParent(cell)
        let styleStr = parent.style
        if (!styleStr || styleStr.indexOf('group;') == -1) {
            return
        }
        let list = []
        let symbol = cell.symbol
        let count = model.getChildCount(parent)
        if (count > 0) {
            for (let i = 0; i < count; i++) {
                let childCell = model.getChildAt(parent, i)
                if (childCell.symbol == symbol) {
                    let id = childCell.id
                    let txtId = 'Point-' + id
                    let txtCell = model.getCell(txtId)
                    if (txtCell) {
                        list.push(txtCell)
                    }
                }
            }
        }
        return list
    },
    /**
     *  选中站内文本
     * @param graph
     * @param groupCell
     * @param flag null: 所有文本， name：名称标签，point：测点
     * @returns {*[]}
     */
    getAllText(graph, groupCell, flag) {
        let model = graph.getModel()

        let list = []
        let count = model.getChildCount(groupCell)
        if (count > 0) {
            for (let i = 0; i < count; i++) {
                let childCell = model.getChildAt(groupCell, i)

                if (!flag) {
                    if (DeviceCategoryUtil.isTextCell(childCell)) {
                        list.push(childCell)
                    }
                } else if (flag == 'name') {
                    if (
                        DeviceCategoryUtil.isTextCell(childCell) &&
                        !DeviceCategoryUtil.isPointCell(childCell)
                    ) {
                        list.push(childCell)
                    }
                } else if (flag == 'point') {
                    if (
                        DeviceCategoryUtil.isTextCell(childCell) &&
                        DeviceCategoryUtil.isPointCell(childCell)
                    ) {
                        list.push(childCell)
                    }
                }
            }
        }
        return list
    },
    /**
     * 获取变电站或者开关站出线设备
     * @param graph
     * @param substation
     */
    getOutlineCellsOfSubstation(graph, substation) {
        let model = graph.getModel()
        // junction_pms25_32000000_4300010，breaker_pms25_30500000_4100010
        // zf04，zf01
        // 要求是出线点和开关
        let isNeededCellFun = (cell) => {
            let symbol = cell.symbol
            if (cell.psrtype == 'zf01' || cell.psrtype == 'zf04') {
                return true
            }

            if (cell.id.indexOf('32000000') != -1 || cell.id.indexOf('30500000') != -1) {
                return true
            }

            return false
        }

        let keys = new Set()

        let list = []

        let fun = (cell) => {
            if (cell.pid) {
                // 不处理站内设备，会出异常
                return
            }

            if (cell && keys.has(cell)) {
                // 已遍历过退出
                return
            }

            if (DeviceCategoryUtil.isTextCell(cell)) {
                // 文本设备退出
                return
            }

            if (!isNeededCellFun(cell)) {
                // 非处理设备退出
                return
            }

            keys.add(cell)
            if (cell != substation) {
                // 不处理变电站或者开闭所，已拖动
                list.push(cell)
            }

            let edges = model.getEdges(cell)
            for (let edge of edges) {
                let scell = model.getTerminal(edge, true)
                let tcell = model.getTerminal(edge, false)
                fun(scell)
                fun(tcell)
            }
        }

        fun(substation)

        return list
    },

    /**
     * 移动母线时，移动与母线相连接的所有设备
     * @param graph
     * @param busCell
     * @param dx
     * @param dy
     */
    moveBus(graph, busCell, dx, dy) {
        let model = graph.getModel()

        let keys = new Set()

        keys.add(busCell.id)

        // 先找到与母线相连接的线
        let lineList = model.getEdges(busCell)

        let txtMoveHandler = (cell) => {
            let txtId = 'TXT-' + cell.id

            let txtCell = model.getCell(txtId)
            if (!txtCell) {
                return
            }

            let geo = model.getGeometry(txtCell).clone()
            geo.x = geo.x + dx
            geo.y = geo.y + dy
            model.setGeometry(txtCell, geo)
        }

        let vertexMoveHandler = (vertex) => {
            let geo = model.getGeometry(vertex).clone()
            geo.x = geo.x + dx
            geo.y = geo.y + dy
            model.setGeometry(vertex, geo)

            txtMoveHandler(vertex)
        }

        let edgeMoveHandler = (edge) => {
            let points = GraphTool.getEdgePointsCommon(graph, edge)

            let geo = model.getGeometry(edge).clone()

            if (points.length > 2) {
                let list = points.slice(1, points.length - 1)
                let arr = list.map((vec) => new mxPoint(vec.x + dx, vec.y + dy))
                geo.points = arr
                model.setGeometry(edge, geo)

                txtMoveHandler(edge)
            }
        }

        let moveHandler = (cell) => {
            if (!cell) {
                return
            }

            if (keys.has(cell.id)) {
                return
            }

            if (!cell.pid) {
                return;
            }

            if (DeviceCategoryUtil.isBusCell(cell)) {
                // 防止查找到另外一个母线
                return
            }

            keys.add(cell.id)

            if (cell.isVertex()) {
                vertexMoveHandler(cell)

                let edgeList = model.getEdges(cell)
                for (let edge of edgeList) {
                    moveHandler(edge)
                }
            } else {
                edgeMoveHandler(cell)

                let sourceVertex = model.getTerminal(cell, true)
                let targetVertex = model.getTerminal(cell, false)
                moveHandler(sourceVertex)
                moveHandler(targetVertex)
            }
        }

        for (let edge of lineList) {
            moveHandler(edge)
        }

        txtMoveHandler(busCell)
    },

    // 重置站房文本
    resetStationTxt(graph, groupCell) {
        let model = graph.getModel()

        let stationCell = GraphTool.getStationCell(graph, groupCell) // 站房cell

        // 处理关联文本
        let txtId = 'TXT-' + stationCell.id
        let txtCell = model.getCell(txtId)

        let stationGeo = model.getGeometry(stationCell)
        if (txtCell) {
            let groupGeo = model.getGeometry(groupCell)

            let origin = {
                x: groupGeo.x,
                y: groupGeo.y
            }

            let txtGeo = model.getGeometry(txtCell).clone()

            let cx = stationGeo.getCenterX()

            let x = origin.x + cx
            let y = origin.y + stationGeo.y - txtGeo.height - txtGeo.height / 2

            txtGeo.x = x - txtGeo.width / 2
            txtGeo.y = y
            model.setGeometry(txtCell, txtGeo)
        }
    }
}

export default StationHandler
