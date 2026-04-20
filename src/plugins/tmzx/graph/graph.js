import sbzlxList from './sbzlx.js'
import GraphTool from './GraphTool.js'
import StationHandler from './StationHandler.js'
import DeviceCategoryUtil from './DeviceCategoryUtil.js'
import TextUtil from './TextUtil.js'
import mathutil from '@/plugins/tmzx/mathutil.js'

mxGraph.prototype.splitEnabled = false

export let sbzlx2nameMap = new Map()
mxConstants.LINE_HEIGHT = 1
for (let item of sbzlxList) {
    let { sbzlx, sbzlxalias } = item
    sbzlx2nameMap.set(sbzlx + '', sbzlxalias)
}

// 去掉母线预定连接点
let preGetAllConnectionConstraints = Graph.prototype.getAllConnectionConstraints
Graph.prototype.getAllConnectionConstraints = function (terminal, source) {
    if (terminal != null) {
        let cellStyle = this.getCellStyle(terminal.cell)
        if (cellStyle.flag == 'busbar') {
            return null
        }
        return preGetAllConnectionConstraints.apply(this, arguments)
    }
}

// 这个处理tooltip
var graphGetTooltipForCell = Graph.prototype.getTooltipForCell
Graph.prototype.getTooltipForCell = function (cell) {
    let model = this.model
    let view = this.view
    var tip = graphGetTooltipForCell.apply(this, arguments)
    var geo = this.getCellGeometry(cell)

    let sb = []
    // if (tip.length > 0){
    // 	sb.push(tip);
    // }
    sb.push('<table>')
    sb.push(`<tr><td>ID</td><td>${cell.id}</td></tr>`)
    if (geo != null) {
        var state = this.view.getState(cell)
        let cellStyle = state.style

        if (cellStyle) {
            // 开关作用：switchrolename
            // 营配标识：pubprivflag   0 运检  1 营销
            let { name, attr, switchrolename, pubprivflag, psrtype } = cell

            if (name) {
                sb.push(`<tr><td>设备名称：</td><td>${name}</td></tr>`)
            }
            if (attr) {
                sb.push(`<tr><td>设备属性：</td><td>${attr}</td></tr>`)
            }
            if (pubprivflag) {
                sb.push(
                    `<tr><td>营配标识：</td><td>${pubprivflag == 0 ? '运检' : '营销'}</td></tr>`
                )
            }
            if (switchrolename) {
                sb.push(`<tr><td>开关作用：</td><td>${switchrolename}</td></tr>`)
            }
            // PD_14000000_37748
            let _sblx
            let sblxName
            let id = cell.id

            let arr = id.split('_')
            if (id.indexOf('virtual') == -1 && arr.length > 0) {
                let sbzlx = arr[1]
                sblxName = sbzlx2nameMap.get(sbzlx) || sbzlx2nameMap.get(cell.sbzlx)
            }

            if (sblxName) {
                _sblx = sblxName
            } else {
                _sblx = ''
            }
            if (psrtype) {
                if (_sblx) {
                    _sblx = _sblx + '(' + psrtype + ')'
                } else {
                    _sblx = psrtype
                }
            }
            if (_sblx) {
                sb.push(`<tr><td>设备类型：</td><td>${_sblx}</td></tr>`)
            }

            if (cellStyle.shape) {
                sb.push(`<tr><td>symbol：</td><td>${cellStyle.shape}</td></tr>`)
            }

            if (cellStyle.lineType) {
                let lineType = cellStyle.lineType
                if (!lineType) {
                    lineType = ''
                }
                if (lineType == 'undefined') {
                    lineType = ''
                }
                sb.push(`<tr><td>lineType：</td><td>${lineType}</td></tr>`)
            }
        }

        if (model.isEdge(cell)) {
            let sourceVertex = model.getTerminal(cell, true)
            let sourceState = view.getState(sourceVertex)
            let sourceStyle = sourceState ? sourceState.style : null
            let sourceId = sourceVertex ? sourceVertex.id : null

            let targetVertex = model.getTerminal(cell, false)
            let targetState = view.getState(targetVertex)
            let targetStyle = targetState ? targetState.style : null
            let targetId = targetVertex ? targetVertex.id : null

            if (sourceVertex) {
                sb.push(`<tr><td>sourceID：</td><td>${sourceStyle.id}</td></tr>`)
                if (sourceStyle.name) {
                    sb.push(`<tr><td>source：</td><td>${sourceStyle.name}</td></tr>`)
                }
            }
            if (targetStyle) {
                sb.push(`<tr><td>targetID：</td><td>${targetStyle.id}</td></tr>`)
                if (targetStyle.name) {
                    sb.push(`<tr><td>target：</td><td>${targetStyle.name}</td></tr>`)
                }
            }
        }
    }
    sb.push('</table>')
    let str = sb.join('')
    return str
}

// 这个保证线的stroke-width
let oldRedrawShape = mxShape.prototype.redrawShape
mxShape.prototype.redrawShape = function (state, force, rendering) {
    let s = this.state
    if (s && !this.isHighLight) {
        let view = s.view

        let graph = view.graph
        let scale = view.scale
        let style = s.style

        let cell = s.cell

        if (style.flag) {
            let w
            if (window.drawflag) {
                if (style.flag == 'text') {
                    w = 1 / scale
                } else if (scale > 0.2) {
                    w = 2.2 / scale
                } else {
                    w = 1 / scale
                }

                if (cell.lineType == 'Trunk' && GraphTool.isDlDx(cell.id)) {
                    w = w * 2
                }

                // if (scale > 0.2) {
                //     w = 2 / scale;
                // } else {
                //     w = 1 / scale;
                // }

                // if (style.flag == 'text') {
                //     w = 1 / scale;
                // } else {
                //     w = 1 / scale;
                //     if (cell.lineType == 'Trunk' && GraphTool.isDlDx(cell.id)) {
                //         w = w * 4;
                //     }
                // }
            } else {
                w = 1 / scale
            }

            style.strokeWidth = w
            this.strokewidth = w
        }
    }
    oldRedrawShape.apply(this, arguments)
}

// 这个保证symbol的stroke-width
let preDrawNode = mxStencil.prototype.drawNode
mxStencil.prototype.drawNode = function (canvas, shape, node, aspect, disableShadow, paint) {
    preDrawNode.apply(this, arguments)
    var name = node.nodeName
    if (paint) {
        if (name == 'strokewidth' || name == 'ellipse') {
            // var s = (node.getAttribute('fixed') == '1') ? 1 : minScale;
            let sw = 1
            if (window.drawflag) {
                if (canvas.state.scale > 0.5) {
                    sw = 2.1 / canvas.state.scale
                } else {
                    sw = 2.1 / canvas.state.scale
                }
            } else {
                sw = 1 / canvas.state.scale
            }

            canvas.setStrokeWidth(sw)
        }
    }
}

let preCreateSelectionShape = mxEdgeHandler.prototype.createSelectionShape

// 高亮线做标记
mxEdgeHandler.prototype.createSelectionShape = function (points) {
    let shape = preCreateSelectionShape.apply(this, arguments)
    if (shape) {
        shape.isHighLight = true
    }
    return shape
}

mxCellHighlight.prototype.repaint = function () {
    if (this.state != null && this.shape != null) {
        this.shape.scale = this.state.view.scale

        if (this.graph.model.isEdge(this.state.cell)) {
            this.shape.strokewidth = this.getStrokeWidth()
            this.shape.points = this.state.absolutePoints
            this.shape.outline = false
        } else {
            this.shape.bounds = new mxRectangle(
                this.state.x - this.spacing,
                this.state.y - this.spacing,
                this.state.width + 2 * this.spacing,
                this.state.height + 2 * this.spacing
            )
            this.shape.rotation = Number(this.state.style[mxConstants.STYLE_ROTATION] || '0')
            // this.shape.strokewidth = this.getStrokeWidth() / this.state.view.scale;

            if (this.state.view.scale > 25) {
                this.shape.strokewidth = 0.1 / this.state.view.scale
            } else if (this.state.view.scale > 20 && this.state.view.scale < 25) {
                this.shape.strokewidth = 0.4 / this.state.view.scale
            } else {
                this.shape.strokewidth = this.getStrokeWidth() / this.state.view.scale
            }

            this.shape.outline = true
        }

        // Uses cursor from shape in highlight
        if (this.state.shape != null) {
            this.shape.setCursor(this.state.shape.getCursor())
        }

        this.shape.redraw()
    }
}

// ------------------------------------拖动文本时显示所属关系-----------------------------------------
// let preGraphHandlerstart = mxGraphHandler.prototype.start;
// mxGraphHandler.prototype.start = function (cell, x, y, cells) {
//     let graph = this.graph;
//     let view = graph.getView();
//     let scale = view.scale;
//     if (cell) {
//         let point = mxUtils.convertPoint(graph.container, x, y);
//         let p = new Vector2(point.x / scale, point.y / scale);
//
//         let relPos = GraphTool.getTouchRel(graph, cell, p);
//         this.relPos = relPos;
//         this.mousePostion = p;
//     }
//     preGraphHandlerstart.apply(this, arguments);
// }

let preMouseMove = mxGraphHandler.prototype.mouseMove
let tmpLineList = []

mxGraphHandler.prototype.mouseMove = function (sender, me) {
    let cell = this.cell
    let graph = this.graph

    let tmpLine = this.tmpLine
    let model = graph.getModel()
    let view = graph.getView()
    let scale = view.scale

    let parent = graph.getDefaultParent()

    if (
        !me.isConsumed() &&
        graph.isMouseDown &&
        this.cell != null &&
        this.first != null &&
        this.bounds != null &&
        !this.suspended
    ) {
        if (DeviceCategoryUtil.isTextCell(cell) && !DeviceCategoryUtil.isPointCell(cell)) {
            let txtState = view.getState(cell)
            let txtStyle = txtState.style

            if (txtStyle && txtStyle.id) {
                // 有名称和属性： TXT-ARR-PD_30000000_1326817, TXT-PD_10200001_15559269
                let tmpId = txtStyle.id
                let sbid
                if (tmpId.indexOf('ARR') == -1) {
                    sbid = txtStyle.id.substring(4)
                } else {
                    sbid = txtStyle.id.substring(8)
                }

                let sourceCell = model.getCell(sbid)
                // let cur = mxUtils.convertPoint(graph.container, x, y);
                if (!tmpLine && sourceCell) {
                    // endArrow=none;startArrow=blockThin;startFill=0;strokeColor=yellow;strokeWidth=0.2;dashed=1;
                    let color = null
                    if (window.drawflag) {
                        color = 'red'
                    } else {
                        color = 'yellow'
                    }
                    let sw = 1 / scale
                    let lineStyle = `endArrow=none;flag=tmpLine;startArrow=none;startFill=0;strokeColor=${color};strokeWidth=${sw};dashed=1;`


                    tmpLine = this.tmpLine = graph.insertEdge(
                        parent,
                        null,
                        null,
                        // sourceCell,
                        null,
                        cell,
                        lineStyle
                    )

                    let geoTmpLine = model.getGeometry(tmpLine).clone()
                    let sourcePoint

                    if (sourceCell.isEdge())
                    {
                        let cellGeo = model.getGeometry(cell)
                        let cx = cellGeo.getCenterX()
                        let cy = cellGeo.getCenterY()
                        let startP = new Vector2(cx, cy)

                        let list = GraphTool.getEdgePoints(graph, sourceCell)

                        // 寻找最近线段中心
                        let len = Number.MAX_VALUE
                        // let pstart
                        // let pend
                        let targetPoint
                        for (let i = 0; i < list.length - 1; i++) {
                            let p1 = list[i]
                            let p2 = list[i + 1]

                            let tmpPoint = mathutil.closestPointOnLineSegment(startP, p1, p2)

                            let tmpLen = mathutil.pixelLen(startP, tmpPoint)
                            if (tmpLen < len) {
                                len = tmpLen
                                // pstart = p1
                                // pend = p2
                                targetPoint = tmpPoint
                            }
                        }

                        // let pmid = mathutil.midPoint(pstart, pend)
                        sourcePoint = new mxPoint(targetPoint.x, targetPoint.y)
                    }
                    else {
                        let view = graph.getView();
                        let state = view.getState(sourceCell);
                        let origin = state.origin;
                        let geo_source = model.getGeometry(sourceCell)
                        let cx = origin.x + geo_source.width / 2;
                        let cy = origin.y + geo_source.height / 2;
                        sourcePoint = new mxPoint(cx, cy)
                    }

                    geoTmpLine.sourcePoint = sourcePoint
                    model.setGeometry(tmpLine, geoTmpLine)

                    tmpLine.flag = 'tmpLine'
                    tmpLineList.push(tmpLine)

                    // model.beginUpdate();
                    // try {
                    //     tmpLine = this.tmpLine = graph.insertEdge(parent, null, null, sourceCell, cell, lineStyle);
                    //     tmpLine.flag = 'tmpLine';
                    //     tmpLineList.push(tmpLine);
                    // } finally {
                    //     model.endUpdate();
                    // }
                }
            }
        }
    }
    preMouseMove.apply(this, arguments)
}

let preMouseUp = mxGraphHandler.prototype.mouseUp
mxGraphHandler.prototype.mouseUp = function (sender, me) {
    let graph = this.graph
    let tmpLine = this.tmpLine
    if (tmpLine) {
        graph.removeCells(tmpLineList)
        tmpLineList = []
        this.tmpLine = null
    }
    preMouseUp.apply(this, arguments)
}
// 引导线不要文本
mxGraphHandler.prototype.getGuideStates = function () {
    var parent = this.graph.getDefaultParent()
    var model = this.graph.getModel()

    let curCell = this.cell

    var filter = mxUtils.bind(this, function (cell) {
        if (curCell && curCell.isText) {
            return (
                this.graph.view.getState(cell) != null &&
                model.isVertex(cell) &&
                model.getGeometry(cell) != null &&
                !model.getGeometry(cell).relative
            )
        } else {
            return (
                this.graph.view.getState(cell) != null &&
                model.isVertex(cell) &&
                model.getGeometry(cell) != null &&
                !model.getGeometry(cell).relative &&
                !cell.isText
            )
        }
    })

    return this.graph.view.getCellStates(model.filterDescendants(filter, parent))
}

// 这个禁止特殊站房内设备移动
let preMouseDown = mxGraphHandler.prototype.mouseDown
// mxGraphHandler.prototype.mouseDown = function (sender, me) {
//     if (window.drawflag) // 只处理地理接线图
//     {
//         if (!me.isConsumed() && this.isEnabled() && this.graph.isEnabled() && me.getState() != null && !mxEvent.isMultiTouchEvent(me.getEvent())) {
//             let cell = this.getInitialCellForEvent(me);
//
//             if (cell) {
//                 if (cell.style.indexOf('text') == -1 && cell.pid) {
//                     this.consumeMouseEvent(mxEvent.MOUSE_DOWN, me);
//                     return;
//                 }
//             }
//         }
//     }
//     preMouseDown.apply(this, arguments);
// }

// ------------------------------------处理组缩放时不更改母线大小-----------------------------------------
let preResizeCell = mxGraph.prototype.resizeCell
mxGraph.prototype.resizeCell = function (cell, bounds, recurse) {
    if (cell.style.indexOf('group') != -1) {
        let model = this.getModel()
        let count = model.getChildCount(cell)
        if (count > 0) {
            let geo = cell.geometry
            let y = geo.y

            let stationCell = null
            for (let i = 0; i < count; i++) {
                let childCell = model.getChildAt(cell, i)
                let cellStyle = this.getCurrentCellStyle(childCell)

                if (childCell.symbol == 'station') {
                    stationCell = childCell
                }

                if (cellStyle['flag'] === 'busbar') {
                    childCell.resizeFlag = 1
                    childCell.initHeight = childCell.geometry.height
                    childCell.initYRatio = childCell.geometry.y / cell.geometry.height
                } else if (childCell.style.indexOf('text;') != -1) {
                    childCell.resizeFlag = 1
                } else if (childCell.symbol == 'terminal') {
                    childCell.resizeFlag = 1
                    childCell.initWidth = childCell.geometry.width
                    childCell.initHeight = childCell.geometry.height
                }
                // if (model.isVertex(childCell)) {
                //     let pointId = 'Point-' + childCell.id;
                //     let pointCell = model.getCell(pointId);
                //     if (pointCell) {
                //         let devGeo = childCell.geometry;
                //         let pointGeo = pointCell.geometry;
                //         let stepx = pointGeo.getCenterX() - devGeo.getCenterX();
                //         let stepy = pointGeo.getCenterY() - devGeo.getCenterY();
                //
                //         childCell.initPointProp = {
                //             stepx,
                //             stepy,
                //             initWidth: devGeo.width
                //         }
                //     }
                // }
            }

            if (stationCell) {
                let txtId = 'TXT-' + stationCell.id
                let txtCell = model.getCell(txtId)
                if (txtCell) {
                    let txtGeo = txtCell.geometry
                    let geoStation = stationCell.geometry
                    let stepY = y + geoStation.y - (txtGeo.y + txtGeo.height)
                    cell.initStepY = stepY
                }
            }
        }
    }
    preResizeCell.apply(this, arguments)
}

// 重写旋转90度，右侧工具栏中的操作
Graph.prototype.turnShapes = function (cells, backwards) {
    var model = this.getModel()
    var select = []

    model.beginUpdate()
    try {
        for (var i = 0; i < cells.length; i++) {
            var cell = cells[i]

            if (model.isVertex(cell)) {
                var geo = this.getCellGeometry(cell)

                if (geo != null) {
                    var state = this.view.getState(cell)

                    if (state != null) {
                        let styleObj = state.style
                        let angle = +styleObj.rotation
                        let rot = angle + 90
                        this.setCellStyles('rotation', rot, [cell])
                    }

                    select.push(cell)
                }
            }
        }
    } finally {
        model.endUpdate()
    }

    return select
}

// 移动cell时标注原来位置
// let preMxGraphHandler_start = mxGraphHandler.prototype.start;
// mxGraphHandler.prototype.start = function (cell, x, y, cells) {
//     let graph = this.graph;
//     let model = graph.getModel();
//
//     preMxGraphHandler_start.apply(this, arguments);
//     let list = this.cells;
//     if (!list) {
//         return;
//     }
//     for(let c of list) {
//         if (model.isVertex(c)) {
//
//         }
//     }
// }
// 重设旋转步长
mxVertexHandler.prototype.rotateVertex = function (me) {
    var point = new mxPoint(me.getGraphX(), me.getGraphY())
    var dx = this.state.x + this.state.width / 2 - point.x
    var dy = this.state.y + this.state.height / 2 - point.y
    this.currentAlpha = dx != 0 ? (Math.atan(dy / dx) * 180) / Math.PI + 90 : dy < 0 ? 180 : 0

    if (dx > 0) {
        this.currentAlpha -= 180
    }

    this.currentAlpha -= this.startAngle

    var raster
    // Rotation raster
    if (this.rotationRaster && this.graph.isGridEnabledEvent(me.getEvent())) {
        var dx = point.x - this.state.getCenterX()
        var dy = point.y - this.state.getCenterY()
        var dist = Math.sqrt(dx * dx + dy * dy)

        if (dist - this.startDist < 2) {
            raster = 90
        } else if (dist - this.startDist < 40) {
            raster = 45
        } else if (dist - this.startDist < 80) {
            raster = 15
        } else {
            raster = 1
        }

        this.currentAlpha = Math.round(this.currentAlpha / raster) * raster
    } else {
        this.currentAlpha = this.roundAngle(this.currentAlpha)
    }

    this.selectionBorder.rotation = this.currentAlpha
    this.selectionBorder.redraw()

    if (this.livePreviewActive) {
        this.redrawHandles()
    }
}

// 文本处理
Graph.prototype.getPreferredSizeForCell = function (cell) {
    let isText = false
    let styleObj = TextUtil.parseDrawioStyle(cell.style)
    if (styleObj.flag == 'text' || DeviceCategoryUtil.isTextCell(cell)) {
        isText = true
    }
    var result

    if (isText) {
        let {
            id,
            shape,
            layer,
            rotation,
            fontSize,
            fontFamily,
            align,
            verticalAlign,
            fontColor,
            xlink
        } = styleObj

        let fs = +fontSize
        let txt = cell.value
        let txtArr = txt.split(/\n/g)

        let props = TextUtil.getTextDimensionFromTxtList(fs, txtArr)
        result = new mxRectangle(0, 0, props.width, props.height)
    } else {
        result = mxGraph.prototype.getPreferredSizeForCell.apply(this, arguments)
        // Adds buffer
        if (result != null) {
            result.width += 10
            result.height += 4

            if (this.gridEnabled) {
                result.width = this.snap(result.width)
                result.height = this.snap(result.height)
            }
        }
    }

    return result
}
