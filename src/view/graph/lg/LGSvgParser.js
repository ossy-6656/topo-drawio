// 力光 正交图解析
import TextUtil from '@/plugins/tmzx/graph/TextUtil.js'

import StencilParse from './StencilParse.js'
import mathutil from '@/plugins/tmzx/mathutil'

import GraphTool from '@/plugins/tmzx/graph/GraphTool.js'
import GraphHandler from '@/plugins/tmzx/graph/GraphHandler.js'
import StationHandler from '@/plugins/tmzx/graph/StationHandler.js'
import DeviceCategoryUtil from '@/plugins/tmzx/graph/DeviceCategoryUtil.js'
import PoleHandler from '@/plugins/tmzx/graph/PoleHandler'
import { sbzlx2nameMap } from '@/plugins/tmzx/graph/graph.js'
import { customShapeLs } from './Constants.js'
import SvgBase from '../common/SvgBase.js'
import SVGFinder from '@/plugins/tmzx/graph/SVGFinder.js'
import Line2LineUtil  from '../common/Line2LineUtil.js'
import TextBeauty from '@/plugins/tmzx/graph/TextBeauty.js'
import $ from 'jquery'

// symbol：对应draw io中的图元；symbolId：对应svg中的图元
let pathReg = /[MLAH]([^MLAH])+/ig;
let emptyReg = / +/;



BaseFormatPanel.prototype.isFloatUnit = function() {
    return true
}

export default class LGSvgParser extends SvgBase {
    scale = 1 // 默认缩放级别
    themecut = null
    constructor(id) {
        super()
        this.id = id
        this.groupMap = new Map() // 设备分组，站房ID与子设备对应关系
        this.widgetMap = new Map() // 用于存储图元，结构为 id -> cell/edge
        this.txtMap = new Map() // 设备文本，设备ID与文本对应关系
        this.attrMap = new Map()
        this.metaMap = new Map() // 存储 metadata下的html字符串
        this.cellLinkMap = new Map()
        this.poleHelper = 1
    }

    initEvt() {
        let graph = this.graph
        let view = graph.view
        let model = graph.getModel()

        // 说明：目前只处理移动
        // --------------------------------------------拖动处理--------------------------------------------
        // 获取非文本节点
        let getNonTextVertexFun = (group) => {
            let list = model.getChildVertices(group)
            let ls = []
            for (let cell of list) {
                if (cell.style.indexOf('group') != -1) {
                    // 组设备
                    let tmplist = getNonTextVertexFun(cell)
                    ls.push(...tmplist)
                } // 不要文本
                else {
                    if (cell.style.indexOf('label') == -1) {
                        ls.push(cell)
                    }
                }
            }
            return ls
        }

        // 处理单设备移动
        let cellMoveHandler = (txtid, dx, dy) => {
            let txtCell = model.getCell(txtid)
            let p = model.getParent(txtCell)
            let df = graph.getDefaultParent()

            let geometry = model.getGeometry(txtCell)
            if (geometry) {
                let newGeometry = geometry.clone()
                newGeometry.x += dx
                newGeometry.y += dy
                model.setGeometry(txtCell, newGeometry)
            }
        }

        // 检查移动的设备中是否有设备连接设备的
        let isDev2DevCellMove = (cells) => {
            for (let cell of cells) {
                if (!cell.isVertex()) {
                    continue
                }

                let edges = model.getEdges(cell)

                for (let edge of edges) {
                    if (edge.flag == 'virtualLine') {
                        return true
                    }
                }
            }
            return false
        }

        // 重置设备连接设备
        let resetDev2DevHandler = (cells) => {
            let keys = new Set()

            let isCommonCell = (cell) => {
                let edges = model.getEdges(cell)
                for (let edge of edges) {
                    if (edge.flag == 'virtualLine') {
                        return false
                    }
                }
                return true
            }

            let findDev2DevCell = (list) => {
                let rs = new Set()
                for (let cell of list) {
                    keys.clear()

                    let edges = model.getEdges(cell)

                    for (let edge of edges) {
                        if (edge.flag == 'virtualLine') {
                            rs.add(cell)
                            break
                        }
                    }
                }
                return rs
            }

            let removeDuplicateCell = (vsets) => {
                let localSet = new Set()

                let findedList = []
                let findNext = (cell) => {
                    if (localSet.has(cell)) {
                        return
                    }

                    if (isCommonCell(cell)) {
                        return
                    }

                    localSet.add(cell)

                    if (vsets.has(cell)) {
                        findedList.push(cell)
                    }

                    let edges = model.getEdges(cell)
                    for (let edge of edges) {
                        let oppositeCell = GraphTool.getAdjacentCellOfEdge(graph, edge, cell)
                        findNext(oppositeCell)
                    }
                }

                for (let cell of vsets) {
                    localSet.clear()
                    localSet.add(cell)
                    let edges = model.getEdges(cell)
                    for (let edge of edges) {
                        let oppositeCell = GraphTool.getAdjacentCellOfEdge(graph, edge, cell)
                        findNext(oppositeCell)
                    }
                }

                for (let cell of findedList) {
                    vsets.remove(cell)
                }
            }

            let resetConnect = (preCell, edge, curCell) => {
                if (keys.has(curCell)) {
                    return
                }

                if (isCommonCell(curCell)) {
                    return
                }

                keys.add(curCell)

                let p1 = GraphTool.getTouchPointByRelation(graph, preCell, edge)
                let p2 = GraphTool.getTouchPointByRelation(graph, curCell, edge)

                let vec = p1.clone().sub(p2)

                let geo = model.getGeometry(curCell).clone()
                geo.x = geo.x + vec.x
                geo.y = geo.y + vec.y

                model.setGeometry(curCell, geo)

                let edges = model.getEdges(curCell)
                for (let line of edges) {
                    let oppositeCell = GraphTool.getAdjacentCellOfEdge(graph, line, curCell)
                    resetConnect(curCell, line, oppositeCell)
                }
            }

            let cellSet = findDev2DevCell(cells)
            removeDuplicateCell(cellSet)

            for (let cell of cellSet) {
                let edges = model.getEdges(cell)

                keys.add(cell)
                for (let edge of edges) {
                    let oppositeCell = GraphTool.getAdjacentCellOfEdge(graph, edge, cell)
                    resetConnect(cell, edge, oppositeCell)
                }
            }
        }
        /**
         * 添加cell移动事件
         * @param obj Graph
         * @param eo  mxEventObject
         */
        let cellMoveEventHandler = (obj, eo) => {
            if (!eo.properties.event) {
                // 程序触发的不处理，比如autosize时
                return
            }

            let widgetMap = this.widgetMap
            let scale = graph.view.scale

            let cells = eo.getProperty('cells')
            let dx = eo.getProperty('dx')
            let dy = eo.getProperty('dy')

            // 最后检查移动的cell是否有设备连接设备的
            if (isDev2DevCellMove(cells)) {
                resetDev2DevHandler(cells)
            }

            // 拖动杆塔、终端头时移动与其关联的柱上设备
            if (this.poleHelper && cells && cells.length == 1) {
                let cell = cells[0]
                if (
                    DeviceCategoryUtil.isPoleCell(cell) ||
                    DeviceCategoryUtil.isCableTerminalCell(cell)
                ) {
                    model.beginUpdate()
                    try {
                        PoleHandler.moveCellsOfPoleOrCable(graph, cell, dx, dy)
                    } finally {
                        model.endUpdate()
                    }
                    return
                }
            }

            // 如果启用柱上辅助功能
            if (this.poleHelper && cells && cells.length == 1) {
                let cell = cells[0]
                let sourceCell = PoleHandler.getLinkedPoleOrCableFromSelection(graph, cell)
                // 如果超出限制的长度退出

                if (sourceCell && PoleHandler.checkRouterPass(graph, sourceCell, cell, 5)) {
                    let { width } = sourceCell.geometry
                    let gap = width // 设置2米间距
                    let gapTxt = width / 4 // 设置1米间距
                    model.beginUpdate()
                    try {
                        PoleHandler.rayArrangeForPole(
                            graph,
                            this.getSymbolMap(),
                            sourceCell,
                            cell,
                            gap,
                            gapTxt
                        )
                    } finally {
                        model.endUpdate()
                    }
                    return
                }
            }

            // 查找非文本节点，并找到关联的文本
            model.beginUpdate()
            try {
                // 查找拖动站内与母线相连接的第一个设备时，与母线连接的所有连接线

                if (cells && cells.length > 0) {
                    let firstCell = cells[0]
                    if (DeviceCategoryUtil.isBusCell(firstCell)) {
                        // 处理只移动母线情况
                        StationHandler.moveBusAndRest(graph, firstCell, dx, dy)
                        return
                    } else {
                        let lineList = GraphTool.getLine2Bus(graph, cells)
                        if (lineList && lineList.length > 0) {
                            StationHandler.recalculateBusConnectedLine(graph, lineList, dx, dy)
                            return
                        }
                    }
                }

                // ----------------------文本处理--------------------------
                // 查找非文本节点，并找到关联的文本
                let list = []
                let txtSet = new Set() // 用于检测如果有文本时不再程序移动
                for (let cell of cells) {
                    if (DeviceCategoryUtil.isTextCell(cell)) {
                        txtSet.add(cell.id)
                    } else {
                        list.push(cell)
                    }
                }

                for (let item of list) {
                    let sbid = item.id

                    let styleStr = item.style
                    if (styleStr.indexOf('group') != -1) {
                        // 如果移动的是组设备
                        let stationCell = GraphTool.getStationCell(graph, item)
                        if (stationCell) {
                            sbid = stationCell.id
                        } else {
                            sbid = null
                        }
                    }

                    let txtIdList = []

                    // 下面是假定有
                    // txtIdList.push(`TXT-ARR-${sbid}`);

                    if (!this.xifu) {
                        let txtId = `TXT-${sbid}`
                        if (!txtSet.has(txtId)) {
                            txtIdList.push(txtId)
                        }
                    }

                    let pointId = `Point-${sbid}`
                    if (!txtSet.has(pointId)) {
                        txtIdList.push(pointId)
                    }

                    if (txtIdList.length > 0) {
                        for (let txtId of txtIdList) {
                            cellMoveHandler(txtId, dx, dy)
                        }
                    }
                }
            } finally {
                model.endUpdate()
            }
        }
        // MY_MOVE_CELLS
        graph.addListener(mxEvent.MOVE_CELLS, cellMoveEventHandler) // CELLS_MOVED, MOVE_CELLS

        // --------------------------------------------resize处理--------------------------------------------
        // 监控文本变化后，重设边框大小
        graph.addListener(mxEvent.LABEL_CHANGED, function (obj, eo) {
            let cell = eo.getProperty('cell')

            if (cell) {
                GraphTool.autosize(graph, [cell])
            }
        })

        this.ui.addListener(
            'styleChanged',
            mxUtils.bind(this, function (sender, evt) {
                let keys = evt.getProperty('keys')
                if (!keys || keys.length == 0) {
                    return
                }
                if (keys[0] != 'fontSize') {
                    return
                }
                let cells = evt.getProperty('cells')
                if (cells && cells.length > 0) {
                    let list = cells.filter((cell) => {
                        return DeviceCategoryUtil.isTextCell(cell)
                    })
                    GraphTool.autosize(graph, list)
                }
            })
        )

        // resize处理
        let cellResizeEventHandlerCommon = function (obj, eo) {
            let cells = eo.getProperty('cells')
            let cell = cells[0]
            let state = view.getState(cell)
            let styleObj = state.style
            let flag = styleObj.flag
            if (flag == 'busbar') {
                // 母线
                // 计算母线两端坐标
                let p0 = GraphTool.getTouchPoint(graph, cell, 0, 0.5)
                let p1 = GraphTool.getTouchPoint(graph, cell, 1, 0.5)

                model.beginUpdate()
                try {
                    let edges = model.getEdges(cell) // 获取与母线关联的所有连接线
                    for (let edge of edges) {
                        GraphHandler.computeLine2BusConnectionCommon(graph, p0, p1, cell, edge)
                    }
                } finally {
                    model.endUpdate()
                }
            } else if (cell.style.indexOf('group;') != -1) {
                let count = model.getChildCount(cell)
                if (count > 0) {
                    model.beginUpdate()
                    try {
                        let stationCell = null
                        for (let i = 0; i < count; i++) {
                            let childCell = model.getChildAt(cell, i)
                            let cellStyle = this.getCurrentCellStyle(childCell)
                            if (childCell.symbol == 'station') {
                                stationCell = childCell
                            }

                            if (childCell.resizeFlag == 1) {
                                if (cellStyle['flag'] === 'busbar') {
                                    let curGeo = childCell.geometry
                                    let cx = curGeo.getCenterX()
                                    let cy = curGeo.getCenterY()

                                    let geoClone = curGeo.clone()
                                    let initHeight = childCell.initHeight
                                    geoClone.height = childCell.initHeight
                                    geoClone.y = cy - initHeight / 2

                                    model.setGeometry(childCell, geoClone)

                                    childCell.initHeight = null
                                } else if (childCell.style.indexOf('text;') != -1) {
                                    graph.updateCellSize(childCell)
                                } else if (childCell.symbol == 'terminal') {
                                    let curGeo = childCell.geometry
                                    let cx = curGeo.getCenterX()
                                    let cy = curGeo.getCenterY()

                                    let geoClone = curGeo.clone()

                                    geoClone.width = childCell.initWidth
                                    geoClone.height = childCell.initHeight
                                    geoClone.x = cx - geoClone.width / 2
                                    geoClone.y = cy - geoClone.height / 2

                                    model.setGeometry(childCell, geoClone)

                                    childCell.initWidth = null
                                    childCell.initHeight = null
                                }
                                childCell.resizeFlag = null
                            }
                        }

                        // 处理站房对应文本
                        if (stationCell) {
                            let stationGeo = stationCell.geometry
                            let stationId = stationCell.id
                            let txtId = 'TXT-' + stationId
                            let txtCell = model.getCell(txtId)
                            if (txtCell) {
                                let geoGroup = cell.geometry
                                let initStepY = cell.initStepY
                                let x = geoGroup.x + stationGeo.width / 2
                                let y = geoGroup.y + stationGeo.y

                                let txtGeo = txtCell.geometry.clone()
                                txtGeo.x = x - txtGeo.width / 2
                                txtGeo.y = y - initStepY - txtGeo.height
                                model.setGeometry(txtCell, txtGeo)
                            }
                        }
                    } finally {
                        model.endUpdate()
                    }
                }
            } else {
                if (DeviceCategoryUtil.isTextCell(cell)) {
                    GraphTool.autosize(graph)
                }
            }
        }

        // 监控cell改变大小后事件
        graph.addListener(mxEvent.RESIZE_CELLS, cellResizeEventHandlerCommon)

        // 禁用双击编辑
        graph.addListener(mxEvent.DOUBLE_CLICK, function (sender, evt) {
            let event = evt.getProperty('event')
            let cell = evt.getProperty('cell')
            if (cell && !DeviceCategoryUtil.isTextCell(cell)) {
                mxEvent.consume(event)
            }
        })
    }

    initValidateEvt() {
        let graph = this.graph
        let view = graph.view
        let model = graph.getModel()
        // --------------------------------------------禁止断开线与设备的连接关系--------------------------------------------
        // 这个事件会监控edge连接
        graph.addListener(mxEvent.CELL_CONNECTED, function (sender, evt) {
            let edge = evt.getProperty('edge')

            if (!edge) {
                return
            }

            model.beginUpdate()
            try {
                if (edge.id_sc) {
                    let id_sc = edge.id_sc
                    let sc_cell = model.getCell(id_sc)

                    if (edge.source != sc_cell) {
                        graph.setCellStyles('exitX', edge.exitX_sc, [edge])
                        graph.setCellStyles('exitY', edge.exitY_sc, [edge])
                        graph.setCellStyles('exitPerimeter', 0, [edge])
                        model.setTerminal(edge, sc_cell, true)
                    }
                }

                if (edge.id_tc) {
                    let id_tc = edge.id_tc
                    let tc_cell = model.getCell(id_tc)

                    if (edge.target != tc_cell) {
                        graph.setCellStyles('entryX', edge.entryX_tc, [edge])
                        graph.setCellStyles('entryY', edge.entryY_tc, [edge])
                        graph.setCellStyles('entryPerimeter', 0, [edge])
                        model.setTerminal(edge, tc_cell, false)
                    }
                }
            } finally {
                model.endUpdate()
            }
        })
    }

    addEvent() {
        let graph = this.graph
        let model = graph.getModel()

        // 检测插入的图元为自定义图元
        graph.addListener(mxEvent.CELLS_ADDED, function (sender, eo) {
            let list = eo.getProperty('cells')
            if (!list || list.length == 0) {
                return
            }

            let ls = []
            let deletedList = []
            for (let cell of list) {
                let obj = TextUtil.parseDrawioStyle(cell.style)
                let shape = obj.shape
                if (customShapeLs.indexOf(shape) == -1 && obj.flag != 'tmpLine') {
                    deletedList.push(cell)
                    continue
                }
                ls.push(cell)
                cell.symbol = shape
                cell.symbolId = shape
                cell.flag = 'custom'
            }

            if (ls.length > 0) {
                graph.setCellStyles('aspect', 'fixed', ls)
            }

            if (deletedList.length > 0) {
                graph.removeCells(deletedList)
            }
        })
    }

    setTaskId(taskId) {
        this.taskId = taskId
    }

    getTaskId() {
        return this.taskId
    }

    setThemecut(themecut) {
        this.themecut = themecut
    }

    getThemecut() {
        return this.themecut
    }

    setScale(scale) {
        this.scale = scale
    }

    getScale() {
        return this.scale
    }

    getPathPoints(d) {
        let pointLs = []
        let ls = d.match(pathReg)

        let getCor = (str) => {
            let strArr
            if (str.indexOf(',') != -1) {
                strArr = str.split(',')
            } else {
                strArr = str.split(' ')
            }
            return strArr
        }

        for (let str of ls) {
            let string = str.trim()
            let firstChar = string.charAt(0)
            let restStr = string.slice(1).replace(emptyReg, ' ').trim()

	        if (firstChar == 'A') // 不处理交点
			{
				continue;
	        }
            // if (firstChar == 'A') {
            //     let strArr = getCor(restStr)
            //     let len = strArr.length
            //     let num1 = +strArr[len - 2]
            //     let num2 = +strArr[len - 1]
            //     pointLs.push([num1, num2])
            // } else {
            //     let strArr = getCor(restStr)
			//
            //     let num1 = +strArr[0]
            //     let num2 = +strArr[1]
			//
            //     if (firstChar == 'M') {
            //         pointLs.push([num1, num2])
            //     } else if (firstChar == 'L') {
            //         pointLs.push([num1, num2])
            //     }
            // }

	        let strArr = getCor(restStr)

	        let num1 = +strArr[0]
	        let num2 = +strArr[1]

	        if (firstChar == 'M') {
		        pointLs.push([num1, num2])
	        } else if (firstChar == 'L') {
		        pointLs.push([num1, num2])
	        }
        }

        return pointLs
    }
    /**
     * 解析线，统一按线坐标顺序的起始索引为原点
     * @param polyNode
     */
    parsePolyline(polyNode, widgetMap, txtMap) {
        let graph = this.graph
        let styleObj = this.style
        let symbolMap = this.getSymbolMap()
        let attrMap = this.attrMap
        let metaMap = this.metaMap
        let cellLinkMap = this.cellLinkMap

        let parent = graph.getDefaultParent()
        let $node = $(polyNode)
        let pid = polyNode.getAttribute('pid')

        let props = $node.find('metadata')

        // 节点属性
        let propMap = this.getPropMap(props)
        let ObjectID, ObjectName, PSRType
        if (propMap['cge:PSR_Ref']) {
            let item = propMap['cge:PSR_Ref']
            ObjectID = item.ObjectID
            ObjectName = item.ObjectName
            PSRType = item.PSRType
        } else {
            ObjectID = $node.attr('id')
        }

        metaMap.set(ObjectID, props.html())

        let LinkedList = propMap['cge:GLink_Ref']
        cellLinkMap.set(ObjectID, LinkedList)

        let lineNode = $node.find('polyline')

        let cors = lineNode.attr('points').trim()
        let stroke = lineNode.attr('stroke')
        let strokeDasharray = lineNode.attr('stroke-dasharray')
        let strokeWidth = lineNode.attr('stroke-width')

        let cls = lineNode.attr('class')

        if (cls) {
            propMap['cls'] = cls
        }
        if (stroke) {
            propMap['stroke'] = stroke
        }
        if (strokeDasharray) {
            propMap['strokeDasharray'] = strokeDasharray
        }
        if (strokeWidth) {
            propMap['strokeWidth'] = strokeWidth
        }

        let corList = []
        let list = cors.split(' ')

        if (list) {
            for (let i = 0; i < list.length; i++) {
                let _scor = list[i].split(',')
                let x = +_scor[0] * this.getScale()
                let y = +_scor[1] * this.getScale()
                corList.push(new mxPoint(x, y))
            }
        }

        // 线的起点与终点
        let startPoint = corList[0].clone()
        let endPoint = corList[corList.length - 1].clone()

        let pa = new Vector2(startPoint.x, startPoint.y)
        let pb = new Vector2(endPoint.x, endPoint.y)

        let sb = []
        sb.push(`id=${ObjectID};`)
        if (pid) {
            sb.push(`pid=${pid};`)
        }

        let txtCell = txtMap[ObjectID]
        if (txtCell) {
            sb.push(`txtid=${'TXT-' + ObjectID};`)
            let txt = txtCell.value
            if (txt) {
                txt = txt.replace(/\n/g, '')
            }
            sb.push(`name=${txt};`)
        }

        let curStyle = styleObj[cls]

        if (curStyle) {
            if (curStyle['stroke']) {
                sb.push(`strokeColor=${curStyle['stroke']};`)
            }

            if (curStyle['stroke-width']) {
                sb.push(`strokeWidth=${curStyle['stroke-width']};`)
            }
        } else {
            sb.push(`strokeColor=#FF0000;`)
        }

        // sb.push(`strokeWidth=0.4;`);
        if (strokeDasharray) {
            sb.push(`dashed=1;`)
        }

        let edgeStyle = 'orthogonalEdgeStyle'
        edgeStyle = 'none'
        sb.push('movable=0;jumpStyle=arc;jumpSize=10;') // 禁止线移动

        // 计算连接点
        let param = {}
        let sourceCell = null;
        let targetCell = null

        if (LinkedList) {
            let counter = 0

            let preSelfPos, preTargetPos
            for (let item of LinkedList) {

                let id = item.id // 要连接的设备
                let relCell = widgetMap.get(id) // 线要连接的设备

                if (!relCell) {
                    continue
                }

                if (relCell.isEdge()) {
                    // 线连线最后处理
                    continue
                }

                // let rel = item.rel // 连接关系
                let rel = this.getLinkRel(pa, pb, id)

                let relArr = rel.split('_')
                let selfPos = relArr[0] // 线的起始点
                let targetPos = relArr[1] // 要连接的设备的连接点

                if (preSelfPos == selfPos) {
                    selfPos = selfPos == '0' ? '1' : '0'
                }
                preSelfPos = selfPos
                preTargetPos = targetPos

                // 如果连接的设备存在
                if (relCell) {
                    counter++
                    let symbol = relCell['symbol']
                    if (symbol) {
                        if (symbol == 'busbar') {
                            // 处理母线连接关系，母线使用矩形模拟
                            let geometry = relCell.geometry
                            let { x, y, width, height } = geometry

                            let angleState = GraphTool.busVH(graph, relCell)
                            let p1, p2
                            if (angleState == 0) {
                                // 水平
                                p1 = {
                                    x: x,
                                    y: y + height / 2
                                }
                                p2 = {
                                    x: x + width,
                                    y: y + height / 2
                                }
                            } // 垂直
                            else {
                                p1 = {
                                    x: x + width / 2,
                                    y: y
                                }
                                p2 = {
                                    x: x + width / 2,
                                    y: y + height
                                }
                            }

                            let lineStart = new Vector2(p1.x, p1.y)
                            let lineEnd = new Vector2(p2.x, p2.y)

                            // 计算当前线哪个离母线最近
                            let point = null
                            let len1 = mathutil.distancePointToLine(startPoint, lineStart, lineEnd)
                            let len2 = mathutil.distancePointToLine(endPoint, lineStart, lineEnd)

                            if (len1 > len2) {
                                point = endPoint
                            } else {
                                point = startPoint
                            }
                            let closetPoint = mathutil.closestPointOnLineSegment(
                                point,
                                lineStart,
                                lineEnd
                            )
                            let leftLen = mathutil.pixelLen(lineStart, closetPoint)
                            let ratio = leftLen / width
                            if (selfPos == '0') {
                                sourceCell = relCell
                                sb.push(`exitX=${ratio};exitY=0.5;exitPerimeter=0;`)
                                param.exitX = ratio
                                param.exitY = 0.5
                            } else {
                                targetCell = relCell
                                sb.push(`entryX=${ratio};entryY=0.5;entryPerimeter=0;`)
                                param.entryX = ratio
                                param.entryY = 0.5
                            }
                        } // 处理普通设备
                        else {
                            let item = symbolMap[symbol]
                            let touchLen = item['touchs'] // 目标设备连接点个数
                            if (touchLen && touchLen > 0) {
                                if (touchLen == 1) {
                                    // 目标有1个连接点
                                    let pos = item.o || item.a || item.b || item.c || item.d

                                    // let exitPerimeter = pos.flag == 'inner' ? 0 : 1;
                                    let exitPerimeter = 0
                                    if (selfPos == '0') {
                                        // 线的左侧
                                        sourceCell = relCell
                                        sb.push(
                                            `exitX=${pos.x};exitY=${pos.y};exitPerimeter=${exitPerimeter};`
                                        )
                                        param.exitX = pos.x
                                        param.exitY = pos.y
                                    } else if (selfPos == '1') {
                                        // 线的右侧
                                        targetCell = relCell
                                        sb.push(
                                            `entryX=${pos.x};entryY=${pos.y};entryPerimeter=${exitPerimeter};`
                                        )
                                        param.entryX = pos.x
                                        param.entryY = pos.y
                                    }
                                } // 目标有2个连接点
                                else {
                                    if (selfPos == '0') {
                                        // 线的左侧
                                        sourceCell = relCell
                                        if (targetPos == '0') {
                                            // 设备左侧
                                            let a = item.a
                                            sb.push(`exitX=${a.x};exitY=${a.y};exitPerimeter=0;`)
                                            param.exitX = a.x
                                            param.exitY = a.y
                                        } else if (targetPos == '1') {
                                            // 设备右侧
                                            let b = item.b
                                            sb.push(`exitX=${b.x};exitY=${b.y};exitPerimeter=0;`)
                                            param.exitX = b.x
                                            param.exitY = b.y
                                        }
                                    } else if (selfPos == '1') {
                                        // 线的右侧
                                        targetCell = relCell
                                        if (targetPos == '0') {
                                            let a = item.a
                                            sb.push(`entryX=${a.x};entryY=${a.y};entryPerimeter=0;`)
                                            param.entryX = a.x
                                            param.entryY = a.y
                                        } else if (targetPos == '1') {
                                            let b = item.b
                                            sb.push(`entryX=${b.x};entryY=${b.y};entryPerimeter=0;`)
                                            param.entryX = b.x
                                            param.entryY = b.y
                                        }
                                    }
                                }
                            } else {
                                console.log(`未找到设备${id}，无法确定连接关系!`)
                            }
                        }
                    }
                }
            }
        }

        let style =
            `id=${ObjectID};flag=line;type=polyline;edgeStyle=${edgeStyle};endArrow=none;html=1;rounded=0;` +
            sb.join('')
        let cell = graph.insertEdge(parent, ObjectID, null, sourceCell, targetCell, style)

        let geometry = cell.geometry
        geometry.setTerminalPoint(startPoint, true)
        geometry.setTerminalPoint(endPoint, false)
        if (corList.length > 2) {
            let pointList = corList.slice(1, corList.length - 1)
            geometry.points = pointList
        }

        if (sourceCell && sourceCell.id) {
            cell.id_sc = sourceCell.id
            cell.exitX_sc = param.exitX
            cell.exitY_sc = param.exitY
        }

        if (targetCell && targetCell.id) {
            cell.id_tc = targetCell.id
            cell.entryX_tc = param.entryX
            cell.entryY_tc = param.entryY
        }

        cell.psrtype = PSRType
        cell.name = ObjectName

        attrMap.set(ObjectID, propMap)
        return cell
    }

    // 解析Path
    parsePath(pathNode, widgetMap, txtMap) {
        let graph = this.graph
        let styleObj = this.style
        let symbolMap = this.getSymbolMap()
        let attrMap = this.attrMap
        let metaMap = this.metaMap
        let cellLinkMap = this.cellLinkMap

        let parent = graph.getDefaultParent()
        let $node = $(pathNode)
        let pid = pathNode.getAttribute('pid')

        let props = $node.find('metadata')

        // 节点属性
        let propMap = this.getPropMap(props)
        let ObjectID, ObjectName, PSRType
        if (propMap['cge:PSR_Ref']) {
            let item = propMap['cge:PSR_Ref']
            ObjectID = item.ObjectID
            ObjectName = item.ObjectName
            PSRType = item.PSRType
        } else {
            ObjectID = $node.attr('id')
        }

        metaMap.set(ObjectID, props.html())

        let LinkedList = propMap['cge:GLink_Ref']
        cellLinkMap.set(ObjectID, LinkedList)

        let lineNode = $node.find('path')

        let cors = lineNode.attr('d').trim()
        let stroke = lineNode.attr('stroke')
        let strokeDasharray = lineNode.attr('stroke-dasharray')
        let strokeWidth = lineNode.attr('stroke-width')

        let cls = lineNode.attr('class')

        if (cls) {
            propMap['cls'] = cls
        }
        if (stroke) {
            propMap['stroke'] = stroke
        }
        if (strokeDasharray) {
            propMap['strokeDasharray'] = strokeDasharray
        }
        if (strokeWidth) {
            propMap['strokeWidth'] = strokeWidth
        }

        let corList = []
        let list = this.getPathPoints(cors)
        if (list) {
            for (let i = 0; i < list.length; i++) {
                let arr = list[i]
                let x = arr[0] * this.getScale()
                let y = arr[1] * this.getScale()
                corList.push(new mxPoint(x, y))
            }
        }

        // 线的起点与终点
        let startPoint = corList[0].clone()
        let endPoint = corList[corList.length - 1].clone()

        let pa = new Vector2(startPoint.x, startPoint.y)
        let pb = new Vector2(endPoint.x, endPoint.y)

        let sb = []
        sb.push(`id=${ObjectID};`)
        if (pid) {
            sb.push(`pid=${pid};`)
        }

        let txtCell = txtMap[ObjectID]
        if (txtCell) {
            sb.push(`txtid=${'TXT-' + ObjectID};`)
            let txt = txtCell.value
            if (txt) {
                txt = txt.replace(/\n/g, '')
            }
            sb.push(`name=${txt};`)
        }

        let curStyle = styleObj[cls]

        if (curStyle) {
            if (curStyle['stroke']) {
                sb.push(`strokeColor=${curStyle['stroke']};`)
            }

            if (curStyle['stroke-width']) {
                sb.push(`strokeWidth=${curStyle['stroke-width']};`)
            }
        } else {
            sb.push(`strokeColor=#FF0000;`)
        }

        // sb.push(`strokeWidth=0.4;`);
        if (strokeDasharray) {
            sb.push(`dashed=1;`)
        }

        let edgeStyle = 'orthogonalEdgeStyle'
        edgeStyle = 'none'
        sb.push('movable=0;jumpStyle=arc;jumpSize=10;') // 禁止线移动

        // 计算连接点
        let param = {}
        let sourceCell = null,
            targetCell = null
        if (LinkedList) {
            let counter = 0
            for (let item of LinkedList) {
                if (counter == 2) {
                    // 一条线可能连接到多个设备上，只处理两个
                    break
                }

                let id = item.id // 要连接的设备
                let relCell = widgetMap.get(id) // 线要连接的设备

                if (!relCell) {
                    continue
                }

                if (relCell.isEdge()) {
                    // 线连线最后处理
                    continue
                }
                // let rel = item.rel // 连接关系
                let rel = this.getLinkRel(pa, pb, id)

                let relArr = rel.split('_')
                let selfPos = relArr[0] // 线的起始点
                let targetPos = relArr[1] // 要连接的设备的连接点

                // 如果连接的设备存在
                if (relCell) {
                    counter++
                    let symbol = relCell['symbol']
                    if (symbol) {
                        if (symbol == 'busbar') {
                            // 处理母线连接关系，母线使用矩形模拟
                            let geometry = relCell.geometry
                            let { x, y, width, height } = geometry

                            let angleState = GraphTool.busVH(graph, relCell)
                            let p1, p2
                            if (angleState == 0) {
                                // 水平
                                p1 = {
                                    x: x,
                                    y: y + height / 2
                                }
                                p2 = {
                                    x: x + width,
                                    y: y + height / 2
                                }
                            } // 垂直
                            else {
                                p1 = {
                                    x: x + width / 2,
                                    y: y
                                }
                                p2 = {
                                    x: x + width / 2,
                                    y: y + height
                                }
                            }

                            let lineStart = new Vector2(p1.x, p1.y)
                            let lineEnd = new Vector2(p2.x, p2.y)

                            // 计算当前线哪个离母线最近
                            let point = null
                            let len1 = mathutil.distancePointToLine(startPoint, lineStart, lineEnd)
                            let len2 = mathutil.distancePointToLine(endPoint, lineStart, lineEnd)

                            if (len1 > len2) {
                                point = endPoint
                            } else {
                                point = startPoint
                            }
                            let closetPoint = mathutil.closestPointOnLineSegment(
                                point,
                                lineStart,
                                lineEnd
                            )
                            let leftLen = mathutil.pixelLen(lineStart, closetPoint)
                            let ratio = leftLen / width
                            if (selfPos == '0') {
                                sourceCell = relCell
                                sb.push(`exitX=${ratio};exitY=0.5;exitPerimeter=0;`)
                                param.exitX = ratio
                                param.exitY = 0.5
                            } else {
                                targetCell = relCell
                                sb.push(`entryX=${ratio};entryY=0.5;entryPerimeter=0;`)
                                param.entryX = ratio
                                param.entryY = 0.5
                            }
                        } // 处理普通设备
                        else {
                            let item = symbolMap[symbol]
                            let touchLen = item['touchs'] // 目标设备连接点个数
                            if (touchLen && touchLen > 0) {
                                if (touchLen == 1) {
                                    // 目标有1个连接点
                                    let pos = item.o || item.a || item.b || item.c || item.d

                                    // let exitPerimeter = pos.flag == 'inner' ? 0 : 1;
                                    let exitPerimeter = 0
                                    if (selfPos == '0') {
                                        // 线的左侧
                                        sourceCell = relCell
                                        sb.push(
                                            `exitX=${pos.x};exitY=${pos.y};exitPerimeter=${exitPerimeter};`
                                        )
                                        param.exitX = pos.x
                                        param.exitY = pos.y
                                    } else if (selfPos == '1') {
                                        // 线的右侧
                                        targetCell = relCell
                                        sb.push(
                                            `entryX=${pos.x};entryY=${pos.y};entryPerimeter=${exitPerimeter};`
                                        )
                                        param.entryX = pos.x
                                        param.entryY = pos.y
                                    }
                                } // 目标有2个连接点
                                else {
                                    if (selfPos == '0') {
                                        // 线的左侧
                                        sourceCell = relCell
                                        if (targetPos == '0') {
                                            // 设备左侧
                                            let a = item.a
                                            sb.push(`exitX=${a.x};exitY=${a.y};exitPerimeter=0;`)
                                            param.exitX = a.x
                                            param.exitY = a.y
                                        } else if (targetPos == '1') {
                                            // 设备右侧
                                            let b = item.b
                                            sb.push(`exitX=${b.x};exitY=${b.y};exitPerimeter=0;`)
                                            param.exitX = b.x
                                            param.exitY = b.y
                                        }
                                    } else if (selfPos == '1') {
                                        // 线的右侧
                                        targetCell = relCell
                                        if (targetPos == '0') {
                                            let a = item.a
                                            sb.push(`entryX=${a.x};entryY=${a.y};entryPerimeter=0;`)
                                            param.entryX = a.x
                                            param.entryY = a.y
                                        } else if (targetPos == '1') {
                                            let b = item.b
                                            sb.push(`entryX=${b.x};entryY=${b.y};entryPerimeter=0;`)
                                            param.entryX = b.x
                                            param.entryY = b.y
                                        }
                                    }
                                }
                            } else {
                                console.log(`未找到设备${id}，无法确定连接关系!`)
                            }
                        }
                    }
                }
            }
        }

        let style =
            `id=${ObjectID};flag=line;type=polyline;edgeStyle=${edgeStyle};endArrow=none;html=1;rounded=0;` +
            sb.join('')
        let cell = graph.insertEdge(parent, ObjectID, null, sourceCell, targetCell, style)

        let geometry = cell.geometry
        geometry.setTerminalPoint(startPoint, true)
        geometry.setTerminalPoint(endPoint, false)
        if (corList.length > 2) {
            let pointList = corList.slice(1, corList.length - 1)
            geometry.points = pointList
        }

        if (sourceCell && sourceCell.id) {
            cell.id_sc = sourceCell.id
            cell.exitX_sc = param.exitX
            cell.exitY_sc = param.exitY
        }

        if (targetCell && targetCell.id) {
            cell.id_tc = targetCell.id
            cell.entryX_tc = param.entryX
            cell.entryY_tc = param.entryY
        }

        cell.psrtype = PSRType
        cell.name = ObjectName

        attrMap.set(ObjectID, propMap)
        return cell
    }

    parseUse(useNode, txtMap, flag, layerId) {
        var graph = this.graph
        let attrMap = this.attrMap
        let symbolMap = this.getSymbolMap()
        let metaMap = this.metaMap
        let cellLinkMap = this.cellLinkMap

        // 设备分组
        let $node = $(useNode)
        let props = $node.find('metadata')

        let propMap = this.getPropMap(props)
        let { ObjectID, ObjectName, PSRType } = propMap['cge:PSR_Ref']
        let LinkedList = propMap['cge:GLink_Ref']

        metaMap.set(ObjectID, props.html())
        cellLinkMap.set(ObjectID, LinkedList)

        let $nodeUse = $node.find('use')
        let nodeUse = $nodeUse[0]
        let cls = $nodeUse.attr('class')

        let symbolId = nodeUse.getAttribute('xlink:href').substring(1)
        propMap.symbolId = symbolId
        propMap.cls = cls

        // 原始连接点，坐标需要转换
        let x = nodeUse.getAttribute('x')
        let y = nodeUse.getAttribute('y')

        let transform = nodeUse.getAttribute('transform')
        let param = this.getTransform(transform)

        if (!param['rotate']) {
            param['rotate'] = 0
        }

        let symbol = symbolId.toLowerCase()

        let symbolArr = symbolMap[symbol]

        let initWidth = symbolArr['initWidth']
        let initHeight = symbolArr['initHeight']

        // 实际中心点
        let xratio = symbolArr['xratio']
        let yratio = symbolArr['yratio']

        if (symbolId === 'terminal') {
            initWidth = 2
            initHeight = 2
        }

        let _x = +x * this.getScale()
        let _y = +y * this.getScale()

        let angle = parseFloat(param['rotate'])
        angle = angle % 360

        let sb = []
        sb.push(`id=${ObjectID};`)
        sb.push(`shape=${symbol};`)

        if (flag == 'useStation') {
            sb.push('flag=useStation;')
        }
        sb.push('whiteSpace=wrap;aspect=fixed;')
        sb.push(`psrtype=${PSRType};`)
        let c = 'rgba(255,0,0,0.68)'
        sb.push(`rotation=${angle};fillColor=rgba(255,0,0,0.4);strokeColor=red;`)

        // 如果有关联的名称
        let txtCell = txtMap.get(ObjectID)
        if (txtCell) {
            sb.push(`txtid=${'TXT-' + ObjectID};`)
            let txt = txtCell.value
            if (txt) {
                txt = txt.replace(/\n/g, '')
            }
            sb.push(`name=${txt};`)
        }

        let parent = graph.getDefaultParent()

        let scale = param['scale']
        let width = initWidth * scale * this.getScale()
        let height = initHeight * scale * this.getScale()

        let rad = mathutil.angle2Radian(angle)
        let leftWidth = width * xratio
        let topHeight = height * yratio

        // 计算图元实际中心点的初始位置(以屏幕坐标系统为准)，默认旋转方向：y -> x
        // 先计算初始位置
        let veco = new Vector2(leftWidth - width / 2, topHeight - height / 2)
        let m = mathutil.commonMatrix(null, -rad, null)
        let v = veco.clone().applyMatrix3(m)

        let virtualX = v.x
        let virtualY = v.y

        // 计算图形中心点与真实偏移点步长
        let stepx = _x - virtualX
        let stepy = _y - virtualY

        let x1 = stepx - width / 2
        let y1 = stepy - height / 2

        let doc = mxUtils.createXmlDocument()
        let node = doc.createElement('attr')
        node.setAttribute('id', ObjectID)
        node.setAttribute('shape', symbol)

        let cell = graph.insertVertex(parent, ObjectID, node, x1, y1, width, height, sb.join(''))

        cell.symbol = symbol
        cell.symbolId = symbolId
        cell.angle = angle
        cell.psrtype = PSRType
        cell.name = ObjectName
        cell.layer = layerId

        attrMap.set(cell.id, propMap)
        return cell
    }

    // 母线
    parseBusbar(node, txtMap) {
        var graph = this.graph
        let attrMap = this.attrMap
        let metaMap = this.metaMap
        let parent = graph.getDefaultParent()

        let styleObj = this.style

        let $node = $(node)
        let props = $node.find('metadata')

        let propMap = this.getPropMap(props)
        let { ObjectID, ObjectName, PSRType } = propMap['cge:PSR_Ref']

        metaMap.set(ObjectID, props.html())
        // 此处不再处理连接关系，在drawio下只有线才有
        // let LinkedList = propMap['cge:GLink_Ref'];

        let $lineNode = $node.find('polyline')

        // 坐标需要转换
        let points = $lineNode.attr('points')
        let parr = points.split(' ')
        let strp1 = parr[0].split(',')
        let strp2 = parr[1].split(',')

        let p1 = new Vector2(
            parseFloat(strp1[0]) * this.getScale(),
            parseFloat(strp1[1]) * this.getScale()
        )
        let p2 = new Vector2(
            parseFloat(strp2[0]) * this.getScale(),
            parseFloat(strp2[1]) * this.getScale()
        )

        let vecBus = p2.clone().sub(p1)
        let radian = vecBus.angle()
        let angle = mathutil.radian2Angle(radian)

        let width = vecBus.length()

        let co = mathutil.midPoint(p1, p2)

        let cls = $lineNode.attr('class')
        let stroke = $lineNode.attr('stroke')
        let strokeWidth = +$lineNode.attr('stroke-width')
        let height = strokeWidth * 2;

        if (cls) {
            propMap['cls'] = cls
        }
        if (stroke) {
            propMap['stroke'] = stroke
        }

        if (strokeWidth) {
            propMap['strokeWidth'] = strokeWidth
        }

        // lmp：左侧垂直方向中心点坐标
        let lmp = { x: co.x - width / 2, y: co.y }

        let sb = []
        let curStyle = styleObj[cls]

        // curStyle['stroke'] = '#770000';
        // stroke = '#770000';

        sb.push(`id=${ObjectID};`)

        sb.push('shape=rect;')
        sb.push('flag=busbar;')
        sb.push('whiteSpace=wrap;')
        if (curStyle && curStyle['stroke']) {
            sb.push(`fillColor=${curStyle['stroke']};`)
        } else {
            sb.push(`fillColor=${stroke};`)
        }
        sb.push('strokeColor=none;')
        sb.push(`rotation=${angle};`)
        sb.push('rotatable=0;')

        //graph.setCellStyles('rotatable', 0,  [cell]);

        // 如果有关联的名称
        let txtCell = txtMap.get(ObjectID)
        if (txtCell) {
            sb.push(`txtid=${'TXT-' + ObjectID};`)
            let txt = txtCell.value
            if (txt) {
                txt = txt.replace(/\n/g, '')
            }
            sb.push(`name=${txt};`)
        }

        let x1 = lmp.x
        let y1 = lmp.y - strokeWidth / 2

        let cell = graph.insertVertex(parent, ObjectID, '', x1, y1, width, height, sb.join(''))
        cell.symbol = 'busbar'
        cell.psrtype = PSRType
        cell.name = ObjectName

        attrMap.set(cell.id, propMap)
        return cell
    }

    // 站房
    parseSubstaion(node, txtMap) {
        var graph = this.graph
        let attrMap = this.attrMap
        let parent = graph.getDefaultParent()
        let metaMap = this.metaMap

        let styleObj = this.style
        let $node = $(node)
        let props = $node.find('metadata')

        let propMap = this.getPropMap(props)
        let { ObjectID, ObjectName, PSRType } = propMap['cge:PSR_Ref']
        // let LinkedList = propMap['cge:GLink_Ref'];

        metaMap.set(ObjectID, props.html())

        let nodeUse = $node.find('use')[0]
        if (nodeUse) {
            // 处理use类型的设备
            return this.parseUse(node, txtMap, 'useStation')
        } else {
            let lineNode = $node.find('polygon')
            // 坐标需要转换
            let points = lineNode.attr('points')
            let parr = points.split(' ')
            let strp1 = parr[0].split(',')
            let strp2 = parr[1].split(',')
            let strp3 = parr[2].split(',')

            let p1 = {
                x: parseFloat(strp1[0]) * this.getScale(),
                y: parseFloat(strp1[1]) * this.getScale()
            }
            let p2 = {
                x: parseFloat(strp2[0]) * this.getScale(),
                y: parseFloat(strp2[1]) * this.getScale()
            }
            let p3 = {
                x: parseFloat(strp3[0]) * this.getScale(),
                y: parseFloat(strp3[1]) * this.getScale()
            }

            let width = mathutil.pixelLen(p1, p2)
            let height = mathutil.pixelLen(p2, p3)

            let angle = 0
            let co = mathutil.midPoint(p1, p3)

            let cls = lineNode.attr('class')
            let stroke = lineNode.attr('stroke')
            let strokeWidth = lineNode.attr('stroke-width')

            propMap['cls'] = cls
            propMap['strokeWidth'] = strokeWidth
            propMap['stroke'] = stroke

            let sb = []
            sb.push(`id=${ObjectID};`)
            sb.push(`shape=rect;`)
            sb.push('flag=station;whiteSpace=wrap;')
            sb.push(`rotation=${angle};`)
            sb.push('rotatable=0;')

            let curStyle = styleObj[cls]
            let c = '#FF0000'

            sb.push(`strokeColor=#FF0000;`)
            sb.push(`strokeWidth=${strokeWidth};`)
            sb.push('fillColor=none;')

            // 如果有关联的名称
            let txtCell = txtMap.get(ObjectID)
            if (txtCell) {
                sb.push(`txtid=${'TXT-' + ObjectID};`)
                let txt = txtCell.value
                if (txt) {
                    txt = txt.replace(/\n/g, '')
                }
                sb.push(`name=${txt};`)
            }

            let lmp = { x: co.x - width / 2, y: co.y - height / 2 }
            let x1 = lmp.x
            let y1 = lmp.y
            let cell = graph.insertVertex(
                parent,
                ObjectID,
                null,
                x1,
                y1,
                width,
                height,
                sb.join('')
            )

            cell.setConnectable(false)
            cell.symbol = 'station'
            cell.psrtype = PSRType
            cell.name = ObjectName

            attrMap.set(cell.id, propMap)
            return cell
        }
    }

    // 处理边界
    parsePolygon(node) {
        var graph = this.graph
        let attrMap = this.attrMap
        let parent = graph.getDefaultParent()
        let metaMap = this.metaMap

        let styleObj = this.style
        let $node = $(node)
        let props = $node.find('metadata')

        let propMap = this.getPropMap(props)

        let ObjectID = $node.attr('id')
        metaMap.set(ObjectID, props.html())

        let lineNode = $node.find('polygon')
        // 坐标需要转换
        let points = lineNode.attr('points')
        let parr = points.split(' ')
        let strp1 = parr[0].split(',')
        let strp2 = parr[1].split(',')
        let strp3 = parr[2].split(',')

        let p1 = {
            x: parseFloat(strp1[0]) * this.getScale(),
            y: parseFloat(strp1[1]) * this.getScale()
        }
        let p2 = {
            x: parseFloat(strp2[0]) * this.getScale(),
            y: parseFloat(strp2[1]) * this.getScale()
        }
        let p3 = {
            x: parseFloat(strp3[0]) * this.getScale(),
            y: parseFloat(strp3[1]) * this.getScale()
        }

        let width = mathutil.pixelLen(p1, p2)
        let height = mathutil.pixelLen(p2, p3)

        let angle = 0
        let co = mathutil.midPoint(p1, p3)

        let cls = lineNode.attr('class')
        let stroke = lineNode.attr('stroke')
        let strokeWidth = lineNode.attr('stroke-width')

        propMap['cls'] = cls
        propMap['strokeWidth'] = strokeWidth
        propMap['stroke'] = stroke

        let sb = []
        sb.push(`id=${ObjectID};`)
        sb.push(`shape=rect;`)
        sb.push('flag=station;whiteSpace=wrap;')
        sb.push(`rotation=${angle};`)
        sb.push('rotatable=0;')

        let curStyle = styleObj[cls]
        if (curStyle['stroke']) {
            stroke = curStyle['stroke']
        }

        sb.push(`strokeColor=${stroke};`)
        sb.push(`strokeWidth=${strokeWidth};`)
        sb.push('fillColor=none;')
        sb.push('expand=0;editable=0;movable=0;resizable=0;deletable=0;locked=1;connectable=0;')

        let lmp = { x: co.x - width / 2, y: co.y - height / 2 }
        let x1 = lmp.x
        let y1 = lmp.y
        let cell = graph.insertVertex(parent, ObjectID, null, x1, y1, width, height, sb.join(''))

        cell.setConnectable(false)
        cell.symbol = 'outerEdge'

        attrMap.set(cell.id, propMap)
        return cell
    }

    // 获取最小字体大小
    getMinFontSize(glist) {
        let minFs = 999
        for (let gNode of glist) {
            let $text = $(gNode).find('text:first')
            let fs = +$text.attr('font-size') || 8
            if (fs < minFs) {
                minFs = fs
            }
        }
        return minFs
    }

    parseTxt(node) {
        var graph = this.graph
        let nodeName = node.nodeName.toLowerCase()
        let parent = graph.getDefaultParent()
        let metaMap = this.metaMap

        let $node = $(node)

        let props = $node.find('metadata')

        let list = Array.from($node.find('text'))
        if (list.length == 0) {
            return
        }

        let id, sbid
        let superlinkname = '',
            superlinkpsrid = '',
            target = '',
            href = ''
        let layerName = ''
        if (nodeName == 'a') {
            layerName = 'Hot_Layer'
            sbid = $node.attr('target')
            id = 'TXT-' + sbid

            superlinkname = $node.attr('superlinkname')
            superlinkpsrid = $node.attr('superlinkpsrid')
            href = $node.attr('xlink:href')
        } else {
            id = $node.attr('id')
            // 关联的设备ID
            sbid = id.substring(4)
            layerName = 'Text_Layer'
        }

        metaMap.set(id, props.html())

        let $firstTxt = $node.find('text:first')
        let transform = list[0].getAttribute('transform')
        let fs = +$firstTxt.attr('font-size') * this.getScale() // 字体大小
        let fill = $firstTxt.attr('fill')
        let cx = +$firstTxt.attr('x') * this.getScale()
        let y = +$firstTxt.attr('y') * this.getScale()

        let { width, height } = TextUtil.getTextDimension(fs, list)

        let param = this.getTransform(transform)
        let angle = param['rotate']

        let dataList = TextUtil.getTextList(list)

        // let tmpData = TextUtil.calculateMultiTextSizeByCanvas(dataList, {
        //     fontSize: fs,
        //     fontFamily: 'Microsoft YaHei'
        // })
        // width = tmpData.width;
        // height = tmpData.height;

        // 根据字体位置计算字体是居左、居中、居右
        let posList = []
        for (let item of list) {
            let str = item.innerHTML.trim()
            let w = TextUtil.getStrWidth(fs, str)
            let x = +item.getAttribute('x') * this.getScale()
            posList.push({
                xmin: x - w / 2,
                xmax: x + w / 2,
                w
            })
        }

        let xmin = Number.MAX_VALUE
        let xmax = Number.MIN_VALUE

        for (let item of posList) {
            if (xmin > item.xmin) {
                xmin = item.xmin
            }

            if (xmax < item.xmax) {
                xmax = item.xmax
            }
        }

        // let _width = Math.abs(xmin - xmax)
        let align_text = TextUtil.checkTextAlign(posList, fs)

        // let _fs = TextUtil.getFontSizeFromDimension(dataList, width, height)
        // y = y - _fs
        y = y - fs
        // let x = cx - width / 2

        let sb = []
        sb.push('text;')
        sb.push(`id=${id};`)
        sb.push('flag=text;')
        sb.push(`layer=${layerName};`)
        // sb.push('rotatable=0;');

        if (fill) {
            sb.push(`fontColor=${fill};`) // 这种情况是a标签的情况（绿色）
        } else {
            sb.push('fontColor=#fff;')
        }

        sb.push(`fontSize=${fs};`)
        // sb.push(`fontFamily=SimSun;`)
        sb.push(`fontFamily=Microsoft YaHei;`)
        // sb.push('recursiveResize=1;');
        sb.push(`rotation=${angle};`)
        sb.push('autosize=0;') // 启用自动大小
        sb.push(`align=${align_text};`)
        sb.push(
            'strokeColor=none;strokeWidth=0;fillColor=none;verticalAlign=middle;spacing=0;html=0;'
        )

        let cell = graph.insertVertex(
            parent,
            id,
            dataList.join('\n'),
            xmin,
            y,
            width,
            height,
            sb.join('')
        )
        cell.sbid = sbid

        cell.superlinkname = superlinkname
        cell.superlinkpsrid = superlinkpsrid
        cell.href = href

        cell.setVertex(true)
        cell.setConnectable(false)
        cell.isText = true
        cell.isPoint = false
        // graph.setCellStyles('rotatable', 0,  [vertex]);
        return cell
    }

    // 测点解析
    parsePQI(node) {
        // Point-PD_30500000_1a651385-5772-4eec-8287-ce795c48c372
        var graph = this.graph
        let parent = graph.getDefaultParent()

        let $node = $(node)

        let id = $node.attr('id')
        // 关联的设备ID
        let sbid = id.substring(6)

        let list = Array.from($node.find('text'))

        let $firstTxt = $node.find('text:first')
        let _fs = 12,
            x = 0,
            y = 0,
            angle = 0
        let width = 10,
            height = 10
        if (list.length > 0) {
            let transform = list[0].getAttribute('transform')
            let fs = +$firstTxt.attr('font-size') // 字体大小
            let cx = +$firstTxt.attr('x')
            y = +$firstTxt.attr('y')

            let dimension = TextUtil.getTextDimension(fs, list)
            width = dimension.width
            height = dimension.height

            let param = this.getTransform(transform)
            angle = param['rotate']

            let dataList = TextUtil.getTextList(list)

            _fs = TextUtil.getFontSizeFromDimension(dataList, width, height)
            y = y + fs / 5
            x = cx - width / 2
        }
        let dataList = ['P:###', 'Q:###', 'I:###']

        let sb = []
        sb.push('text;')
        sb.push(`id=${id};`)
        sb.push('layer=Point_Layer;')
        sb.push('flag=pqi;')
        // sb.push('rotatable=0;');
        sb.push('fontColor=#959595;')
        sb.push(`fontSize=${_fs};`)
        sb.push(`fontFamily=SimSun;`)
        // sb.push('recursiveResize=1;');
        sb.push(`rotation=${angle};`)
        sb.push('autosize=0;') // 启用自动大小
        sb.push('strokeColor=#717171;fillColor=none;align=center;verticalAlign=middle;html=0;') // spacing=0;

        let cell = graph.insertVertex(
            parent,
            id,
            dataList.join('\n'),
            x,
            y,
            width,
            height,
            sb.join('')
        )
        cell.setVertex(true)
        cell.setConnectable(false)
        if (list.length > 0) {
            cell.flag = true
        }
        // graph.setCellStyles('rotatable', 0,  [vertex]);
        cell.sbid = sbid
        cell.isText = true
        cell.isPoint = true
        return cell
    }

    // 数据打组
    groupData(devList, lineList, txtList, stationRectList, stationUseList) {
        let stationUseInnerDevList = []

        let stationRectInnerDevList = []
        let stationRectInnerLineList = []
        let stationRectInnerTxtList = []

        let groupUseMap = new Map()
        let groupRectMap = new Map()

        // 处理use标签的站房
        for (let stationUse of stationUseList) {
            if (!groupUseMap.has(stationUse.id)) {
                groupUseMap.set(stationUse.id, [])
            }

            for (let useDev of devList) {
                if (this.isContain(stationUse, useDev)) {
                    stationUseInnerDevList.push(useDev)
                    groupUseMap.get(stationUse.id).push(useDev)
                }
            }
        }

        // 处理矩形标签的站房
        for (let stationRect of stationRectList) {
            if (!groupRectMap.has(stationRect.id)) {
                groupRectMap.set(stationRect.id, [])
            }

            for (let txtDev of txtList) {
                if (this.isContain(stationRect, txtDev)) {
                    stationRectInnerTxtList.push(txtDev)
                    groupRectMap.get(stationRect.id).push(txtDev)
                }
            }

            for (let useDev of devList) {
                if (this.isContain(stationRect, useDev)) {
                    stationRectInnerDevList.push(useDev)
                    groupRectMap.get(stationRect.id).push(useDev)
                }
            }

            for (let line of lineList) {
                if (this.isContainLine(stationRect, line)) {
                    stationRectInnerLineList.push(line)
                    groupRectMap.get(stationRect.id).push(line)
                }
            }
        }

        return {
            groupUseMap,
            groupRectMap,
            stationUseInnerDevList,
            stationRectInnerTxtList,
            stationRectInnerDevList,
            stationRectInnerLineList
        }
    }

    // 检查设备连接设备的情况
    checkDev2Dev() {
        var graph = this.graph
        let parent = graph.getDefaultParent()

        let widgetMap = this.widgetMap
        let cellLinkMap = this.cellLinkMap

        let keys = new Set()

        for (let [id, cell] of widgetMap) {
            if (cell.isEdge()) {
                continue
            }

            if (DeviceCategoryUtil.isTextCell(cell)) {
                continue
            }

            let linkList = cellLinkMap.get(id)
            if (!linkList) {
                continue
            }

            for (let item of linkList) {
                let cellId = item.id // 要连接的设备
                let relCell = widgetMap.get(cellId) // 线要连接的设备

                if (relCell && relCell.isVertex() && !DeviceCategoryUtil.isTextCell(relCell)) {
                    // 如果当前连接的设备不为线
                    let key1 = cell.id + '_' + relCell.id
                    let key2 = relCell.id + '_' + cell.id
                    if (keys.has(key1)) {
                        continue
                    }

                    keys.add(key1)
                    keys.add(key2)

                    let { cell1RatioVec, cell2RatioVec } = GraphTool.getCell2CellLinkRelation(
                        graph,
                        cell,
                        relCell,
                        this.getSymbolMap()
                    )

                    let ObjectID = 'virtual-' + key1
                    let sb = []
                    sb.push(
                        `id=${ObjectID};flag=virtualLine;type=polyline;strokeColor=green;strokeWidth=1;`
                    )
                    sb.push('iedgeStyle=none;movable=0;endArrow=none;html=1;rounded=0;')
                    sb.push(`exitX=${cell1RatioVec.x};exitY=${cell1RatioVec.y};`)
                    sb.push(`entryX=${cell2RatioVec.x};entryY=${cell2RatioVec.y};`)
                    let style = sb.join('')
                    let tmpCell = graph.insertEdge(parent, ObjectID, null, cell, relCell, style)
                    tmpCell.flag = 'virtualLine'
                }
            }
        }
    }

    /**
     * 检查线与线相连接的情况
     * @param minLen  设备的最小边
     * @returns {*[]}
     */
    checkLine2Line(minLen) {
        // return;
        var graph = this.graph

        let widgetMap = this.widgetMap
        let cellLinkMap = this.cellLinkMap

        let list = []

        let r = minLen / 3

        // 检查线的连接关系中是否有母线
        let isContainBus = (list) => {
            for (let item of list) {
                let cellId = item.id // 要连接的设备
                let relCell = widgetMap.get(cellId) // 线要连接的设备
                if (relCell) {
                    let isBus = DeviceCategoryUtil.isBusCell(relCell)
                    if (isBus) {
                        return true
                    }
                }
            }
            return false
        }

        for (let [id, cell] of widgetMap) {
            if (cell.isVertex()) {
                continue
            }

            if (DeviceCategoryUtil.isTextCell(cell)) {
                continue
            }

            let linkList = cellLinkMap.get(id)

            if (!linkList) {
                continue
            }

            // 1、如果当前线与母线相连接，不处理
            if (isContainBus(linkList)) {
                continue
            }

            for (let item of linkList) {
                let cellId = item.id // 要连接的设备
                let relCell = widgetMap.get(cellId) // 线要连接的设备
                if (relCell && relCell.isEdge()) {
                    // 如果当前连接的设备为线
                    let virtualCell = Line2LineUtil.connectLine(
                        graph,
                        cellLinkMap,
                        cell,
                        relCell,
                        r
                    )

                    if (virtualCell) {
                        list.push(virtualCell)
                    }
                }
            }
        }

        return list
    }
    // 解析svg中的symbol为图元模板
    parseStencil() {
        let svgDom = this.svgDom
        let parser = new DOMParser()
        let symbolLs = $(svgDom).find('svg>defs>symbol')
        let str = StencilParse.symbol2shape(symbolLs)
        this.symbolMap = StencilParse.symbolProp
        this.stencilDoc = parser.parseFromString(str, 'text/xml')
    }

    // 解析svg数据
    parseSvg() {
        let graph = this.graph
        graph.setGridSize(1)
        // graph.gridEnabled = false;
        // graph.setGridEnabled(false);

        graph.setDropEnabled(false)
        graph.graphHandler.setRemoveCellsFromParent(false)
        graph.graphHandler.setCloneEnabled(false)
        graph.connectionHandler.setEnabled(false)

        this.initEvt()

        let svgDom = this.svgDom
        let $svgDom = $(svgDom)

        // 解析svg数据
        let layerlist = SVGFinder.getChildOfDom(svgDom, 'g')

        let defs = $svgDom.find('svg>defs>style')[0]
        let namelist = $svgDom.find('#Text_Layer').children()
        let nameAlist = $svgDom.find('#Hot_Layer').children() // a标签
        let pointList = $svgDom.find('#Point_Layer').children() // 测点数据

        if (layerlist.length == 0) {
            return
        }

        // 解析样式数据
        this.parseDefs(defs)

        let parent = graph.getDefaultParent()
        let model = graph.getModel()
        model.beginUpdate()

        let widgetMap = this.widgetMap // 用于存储图元，结构为 id -> cell/edge
        let txtMap = this.txtMap // 设备ID与文本对应关系
        let minLen = 999
        try {
            let linePNodeList = [] // 线dom结点数据列表，这个放到设备处理完成后查找相连接的设备
            let pathPNodeList = []
            let txtList = [] // 所有文本列表，包括测点

            let stationRectList = [] // 站房polyline
            let stationUseList = [] // 站房use

            let pqiList = [] // 所有测点列表

            let devList = [] // 设备列表
            let lineList = [] // 线路列表

            let minFs = this.getMinFontSize(namelist)

            if (minFs < 8) {
                this.scale = 8 / minFs
            } else {
                this.scale = 1
            }

            // 这个额外处理左下角标签文字，由于新图已经去了标签，只剩下一个_100410000_标识（出线名称）
            // 但老图还有,现分两类处理方式，老图还是删掉所有带'_100410000_'
            // 新图发现只有一个的话保留
            // let labelList = [];
            // 1、先处理文本数据
            for (let node of namelist) {
                let tid = node.getAttribute('id')

                // if (tid.indexOf('_100410000_') != -1)
                // {
                //     labelList.push(node);
                //     continue;
                // }

                let cell = this.parseTxt(node)
                if (cell) {
                    txtList.push(cell)
                    widgetMap.set(cell.id, cell)
                    if (cell.sbid) {
                        txtMap.set(cell.sbid, cell)
                    }
                }
            }
            // 处理新图只有一个带特殊标识的出线文本情况
            // 如果多于一个带特殊字符的文本，是老图，全丢掉
            // if (labelList.length == 1) {
            //     let node = labelList[0];
            //     let cell = this.parseTxt(node)
            //     if (cell) {
            //         txtList.push(cell)
            //         widgetMap.set(cell.id, cell)
            //         if (cell.sbid) {
            //             txtMap.set(cell.sbid, cell)
            //         }
            //     }
            // }

            // a标签文本处理
            for (let node of nameAlist) {
                let cell = this.parseTxt(node)
                if (cell) {
                    txtList.push(cell)
                    widgetMap.set(cell.id, cell)
                    if (cell.sbid) {
                        txtMap.set(cell.sbid, cell)
                    }
                }
            }

            // 2、测点处理，后面处理相对设备坐标
            for (let node of pointList) {
                let cell = this.parsePQI(node)
                if (cell) {
                    txtList.push(cell)
                    pqiList.push(cell)
                    widgetMap.set(cell.id, cell)
                    // if (cell.sbid) {
                    //     pqiMap.set(cell.sbid, cell);
                    // }
                }
            }

            // 3、遍历设备层
            for (let layer of layerlist) {
                let layerId = layer.getAttribute('id').toLowerCase()

                if (layerId == 'background_layer') {
                    continue
                }
                //遍历所有设备
                let groupLs = layer.children

                for (let devGroupNode of groupLs) {
                    let cell = null
                    // 母线 和 电站 要特殊处理
                    if (layerId === 'substation_layer') {
                        // 站房
                        cell = this.parseSubstaion(devGroupNode, txtMap)
                        if (cell) {
                            if (cell.symbol == 'station') {
                                stationRectList.push(cell)
                            } else {
                                stationUseList.push(cell)
                            }
                        }
                    } else if (layerId === 'busbarsection_layer') {
                        // 母线
                        cell = this.parseBusbar(devGroupNode, txtMap)
                        if (cell) {
                            devList.push(cell)
                        }
                    } // 处理线和设备，文本通过解析json数据处理
                    else {
                        let node = $(devGroupNode).children()[0]
                        if (node) {
                            // 防止没有子结点数据
                            let nodeName = node.nodeName.toLowerCase()
                            if (nodeName === 'polyline') {
                                // 线类最后处理
                                linePNodeList.push(devGroupNode)
                            } else if (nodeName === 'path') {
                                pathPNodeList.push(devGroupNode)
                            } else if (nodeName === 'use') {
                                cell = this.parseUse(devGroupNode, txtMap, null, layerId)
                                if (cell) {
                                    devList.push(cell)
                                    let geo = cell.geometry

                                    let len = geo.width < geo.height ? geo.width : geo.height
                                    if (len < minLen) {
                                        minLen = len
                                    }
                                }
                            }
                            // else if (nodeName == 'polygon') {
                            //     cell = this.parsePolygon(devGroupNode);
                            // }
                        }
                    }

                    if (cell) {
                        widgetMap.set(cell.id, cell)
                    }
                }
            }

            // 根据设备重新计算测点位置
            for (let cell of pqiList) {
                let id = cell.id
                let sbid = id.substring(6)
                let sssb = widgetMap.get(sbid)
                if (!cell.flag) {
                    cell.flag = true

                    let angle = +sssb.angle
                    let sbgeo = sssb.geometry
                    let { x, y, width, height } = sbgeo

                    let fs = (height * 2) / 5
                    let datalist = cell.value.split('\n')
                    let dimension = TextUtil.getTextDimensionFromTxtList(fs, datalist)

                    let vtop = new Vector2(0, -height / 2 - height / 5 - dimension.height)
                    let rad = -mathutil.angle2Radian(angle)
                    let tran = new Vector2(sbgeo.getCenterX(), sbgeo.getCenterY())
                    let m = mathutil.commonMatrix(tran, rad, null)
                    let v1 = vtop.clone().applyMatrix3(m)
                    let cx = v1.x
                    let cy = v1.y

                    let geometryClone = cell.geometry.clone()
                    geometryClone.x = cx - dimension.width / 2
                    geometryClone.y = cy - dimension.height / 2
                    geometryClone.width = dimension.width
                    geometryClone.height = dimension.height
                    model.setGeometry(cell, geometryClone)
                    graph.setCellStyles('fontSize', fs, [cell])
                }

                let style = `flag=pointline;type=polyline;dashed=1;edgeStyle=none;endArrow=none;html=1;rounded=0;storkeWidth=.1;strokeColor=#a1a142;exitPerimeter=0;exitX=0.5;exitY=0.5;`
                let tmpLine = graph.insertEdge(parent, null, null, sssb, cell, style)
                tmpLine.flag = 'pointline'
            }

            this.checkDev2Dev()

            // 画线，这个时候要查找所连接的设备
            for (let i = 0; i < linePNodeList.length; i++) {
                let node = linePNodeList[i]
                let lineId = node.getAttribute('id')
                if (lineId.indexOf('_100430000_') != -1) {
                    // 如表格线、非设备用线
                    continue
                }
                let cell = this.parsePolyline(node, widgetMap, txtMap)
                if (cell) {
                    widgetMap.set(cell.id, cell)
                    lineList.push(cell)
                }
            }

            // 如果有path类型的线
            for (let i = 0; i < pathPNodeList.length; i++) {
                let node = pathPNodeList[i]
                let lineId = node.getAttribute('id')
                if (lineId.indexOf('_100430000_') != -1) {
                    // 如表格线、非设备用线
                    continue
                }
                let cell = this.parsePath(node, widgetMap, txtMap)
                if (cell) {
                    widgetMap.set(cell.id, cell)
                    lineList.push(cell)
                }
            }

            // 处理线连接线的情况
            let virtualList = this.checkLine2Line(minLen)

            // 分组操作
            let filterCell = (cellList) => {
                let ls = []
                let keys = new Set()
                for (let c of cellList) {
                    if (keys.has(c.id)) {
                        continue
                    }
                    ls.push(c)
                    keys.add(c.id)
                }
                return ls
            }

            devList.push(...virtualList)
            let param = this.groupData(devList, lineList, txtList, stationRectList, stationUseList)

            let {
                groupUseMap,
                stationUseInnerDevList,
                groupRectMap,
                stationRectInnerTxtList,
                stationRectInnerDevList,
                stationRectInnerLineList
            } = param

            let findNotExistTxt = (list) => {
                let ls = []
                let keys = new Set(list)
                for (let dev of list) {
                    if (dev.isVertex() && !DeviceCategoryUtil.isTextCell(dev)) {
                        let id = dev.id
                        let txtId = 'TXT-' + id
                        let txtCell = model.getCell(txtId)
                        if (txtCell && !keys.has(txtCell)) {
                            ls.push(txtCell)
                        }
                    }
                }
                if (ls.length > 0) {
                    list.push(...ls)
                }
            }

            // use类型站室组
            let stationUseGroupList = []

            for (let [stationId, list] of groupUseMap) {
                let cell = widgetMap.get(stationId)
                if (list.length > 0) {
                    if (cell.id.indexOf('_zf01_') != -1) {
                        findNotExistTxt(list)
                    }

                    let g = graph.groupCells(null, 0, [cell, ...list])
                    graph.setCellStyles('aspect', 'fixed', [g])
                    graph.setCellStyles('rotatable', 0, [g])
                    graph.setCellStyles('flag', 'group', [g])

                    for (let childCell of list) {
                        childCell.pid = cell.id
                    }
                    graph.setCellStyles('pid', cell.id, list)

                    stationUseGroupList.push(g)
                }
            }

            for (let [stationId, list] of groupRectMap) {
                let cell = widgetMap.get(stationId)
                if (list.length > 0) {
                    findNotExistTxt(list)
                    let g = graph.groupCells(null, 0, [cell, ...list])
                    g.flag = 'group'

                    graph.setCellStyles('aspect', 'fixed', [g])
                    graph.setCellStyles('rotatable', 0, [g])
                    graph.setCellStyles('flag', 'group', [g])

                    for (let childCell of list) {
                        childCell.pid = cell.id
                    }
                    graph.setCellStyles('pid', cell.id, list)
                }
            }

            graph.orderCells(true, lineList) // 线置于最下

            graph.orderCells(false, devList)
            graph.orderCells(false, stationUseGroupList)
            graph.orderCells(false, txtList)

            // 把所有的站房移动到最下面
            graph.orderCells(true, stationRectList) // 站室置于下方
            graph.orderCells(false, stationRectInnerLineList)
            graph.orderCells(false, stationRectInnerDevList)
            graph.orderCells(false, stationRectInnerTxtList)

            // use节点的站房
            graph.orderCells(true, stationUseInnerDevList)
            graph.orderCells(false, stationUseList)
        } finally {
            model.endUpdate()
        }
        this.initValidateEvt()

        this.textBeauty = new TextBeauty(graph, this.getSymbolMap())
        // this.addEvent()
        window.setTimeout(() => {
            // 首次禁止回退，并设置已经保存状态
            this.ui.editor.setStatus(mxUtils.htmlEntities(mxResources.get('allChangesSaved')))
            this.ui.editor.undoManager.clear()
            this.ui.editor.setModified(false)
        }, 300)
    }

    // 多设备缩放操作
    scaleMulti(s, scaleMap, scaleList) {
        let graph = this.graph
        let symbolMap = this.getSymbolMap()

        let model = graph.getModel()

        model.beginUpdate()
        try {
            GraphHandler.scaleMultiEqualRatio(graph, s, scaleMap, scaleList, symbolMap)
        } finally {
            model.endUpdate()
        }
    }

    hideThemecut() {
        let graph = this.graph
        let model = graph.getModel()
        let list = this.getThemecut()

        // noLabel=1;
        // strokeOpacity=100;fillOpacity=100;
        let cellList = []
        let txtList = []

        let ls = graph.getVerticesAndEdges(true, false)
        for (let c of ls) {
            if (c.flag == 'virtualCell') {
                cellList.push(c)
            }
        }

        model.beginUpdate()
        try {
            for (let id of list) {
                let cell = model.getCell(id)
                if (cell) {
                    // model.setVisible(cell, false);
                    cellList.push(cell)
                }

                let txtId = 'TXT-' + id
                let txtCell = model.getCell(txtId)
                if (txtCell) {
                    // model.setVisible(txtCell, false);
                    txtList.push(txtCell)
                }
            }

            graph.setCellStyles('opacity', 0, cellList)
            graph.setCellStyles('noLabel', 1, txtList)
        } finally {
            model.endUpdate()
        }
    }

    showThemecut() {
        let graph = this.graph
        let model = graph.getModel()
        let list = this.getThemecut()

        let cellList = []
        let txtList = []

        let ls = graph.getVerticesAndEdges(true, false)
        for (let c of ls) {
            if (c.flag == 'virtualCell') {
                cellList.push(c)
            }
        }

        model.beginUpdate()
        try {
            for (let id of list) {
                let cell = model.getCell(id)
                if (cell) {
                    // model.setVisible(cell, true);
                    cellList.push(cell)
                }
                let txtId = 'TXT-' + id
                let txtCell = model.getCell(txtId)
                if (txtCell) {
                    // model.setVisible(txtCell, true);
                    txtList.push(txtCell)
                }
                graph.setCellStyles('opacity', 100, cellList)
                graph.setCellStyles('noLabel', 0, txtList)
            }
        } finally {
            model.endUpdate()
        }
    }

    beautyTxt() {
        let graph = this.graph
        let symbolMap = this.getSymbolMap()

        let textBeauty = this.textBeauty
        // textBeauty.release();
        textBeauty.initGrid()
        // textBeauty.initGridHelp();

        textBeauty.go()
    }

    gridInit() {
        let textBeauty = this.textBeauty
        textBeauty.initGrid()
        textBeauty.initGridHelp()
    }

    clearHelper() {
        let textBeauty = this.textBeauty
        textBeauty.clearHelper()
    }
}
