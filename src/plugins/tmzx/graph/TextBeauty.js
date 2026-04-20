import DeviceCategoryUtil from '@/plugins/tmzx/graph/DeviceCategoryUtil.js'
import GraphTool from '@/plugins/tmzx/graph/GraphTool.js'
import TextUtil from '@/plugins/tmzx/graph/TextUtil.js'
import mathutil from '@/plugins/tmzx/mathutil.js'
import GridTool from '@/plugins/tmzx/graph/GridTool.js'

export default class TextBeauty {
    graph = null
    model = null
    symbolMap = null
    cellList = null
    graphBounds = null
    cellMap = null
    txtGap = null
    gridMap = null
    gridSet = null
    minFontSize = 8 // 最小文本大小
    gridList = [];

    constructor(graph, symbolMap) {
        this.graph = graph
        this.symbolMap = symbolMap
        this.model = graph.getModel()
        this.cellMap = new Map()
        this.gridMap = new Map()
        this.gridSet = new Set()
        this.gridTool = new GridTool();
        this.cell2GridSet = new Map();
        this.initGeometry()
    }


    // 初始化设备占用
    initGrid() {
        let gridTool = this.gridTool
        let graph = this.graph
        let view = graph.view
        let model = this.model

        let bounds = this.graphBounds
        let cell2GridSet = this.cell2GridSet;

        let xmin_bounds = bounds.x
        let ymin_bounds = bounds.y
        let width_bounds = bounds.width
        let height_bounds = bounds.height

        // let cellMinLen = Number.MAX_VALUE,
        //     cellMaxLen = Number.MIN_VALUE

        // 设备与线分类列表
        let vertexlist = [];
        let lineList = [];
        let stationList = [];

        for (let cell of this.cellList) {
            // let geo = model.getGeometry(cell)

            // 寻找设备最小、最大长度
            // if (cell.isVertex())
            // {
            //     let _height = geo.height
            //     let _width = geo.width
            //     // 查找设备最大最小长度
            //     if (
            //         cell.symbol != 'station' &&
            //         cell.symbol != 'busbar' &&
            //         !GraphTool.isGroupCell(graph, cell) &&
            //         !DeviceCategoryUtil.isTextCell(cell)
            //     ) {
            //         let minLen = Math.min(_width, _height)
            //         if (minLen < cellMinLen) {
            //             cellMinLen = minLen
            //         }
            //
            //         if (minLen > cellMaxLen) {
            //             cellMaxLen = minLen
            //         }
            //     }
            // }

            let isGroup = GraphTool.isGroupCell(graph, cell);
            // 分类设备与线
            if (cell.isVertex() && !DeviceCategoryUtil.isTextCell(cell) && !isGroup)
            {
                if (cell.symbol == 'station') {
                    stationList.push(cell);
                } else {
                    vertexlist.push(cell)
                }
            }
            else if (cell.isEdge())
            {
                lineList.push(cell)
            }
        }

        // let avgWidth = (cellMinLen + cellMaxLen) / 2
        let gridSize = this.gridSize = 2;

        this.txtGap = 5

        let offset = this.offset = 10 * gridSize;

        let originX = xmin_bounds - width_bounds
        let originY = ymin_bounds - height_bounds

        // 测试用
        originX = xmin_bounds - offset
        originY =  ymin_bounds - offset;

        this.originX = originX;
        this.originY = originY;


        gridTool.init(gridSize, originX, originY)
        cell2GridSet.clear();

        for(let cell of vertexlist) {
            let polygon = this.getCellPolygon(cell)
            let gridSet = gridTool.setGridOccupiedByPolygon(polygon)
            cell2GridSet.set(cell, gridSet)
        }

        for(let line of lineList) {
            let ls = GraphTool.getEdgePointsVec(graph, line)
            gridTool.setGridOccupiedByLine(ls);
        }

        for(let cell of stationList) {
            let geo = model.getGeometry(cell);
            let width = geo.width;
            let height = geo.height;

            let state = view.getState(cell);
            let origin = state.origin;
            let x = origin.x;
            let y = origin.y;
            let ls = [
                new Vector2(x, y),
                new Vector2(x + width, y),
                new Vector2(x + width, y + height),
                new Vector2(x, y + height),
                new Vector2(x, y),
            ]
            let gridSet = gridTool.setGridOccupiedByLine(ls);
            cell2GridSet.set(cell, gridSet)
        }
    }

    initGridHelp() {

        let graph = this.graph
        let model = this.model
        let originX = this.originX;
        let originY = this.originY;
        let offset = this.offset;
        let gridTool = this.gridTool;
        let gridSet = gridTool.gridSet;

        let bounds = this.graphBounds

        let width = bounds.width
        let height = bounds.height

        let gridSize = this.gridSize;


        let sb = [];
        let c = 'rgba(57,211,100,0.51)'
        sb.push(`shape=rect;rotation=0;strokeWidth=.2;strokeColor=#d8d8d8;fontColor=#fff;fontSize=6;`)
        let commonColor = 'fillColor=none;'
        let specitalColor = 'fillColor=rgba(57,211,100,0.51);'


        this.clearHelper();
        let list = this.gridList;

        model.beginUpdate();
        try
        {
            let imax = originX + width + offset;
            let jmax = originY + height + offset;
            // 初始化grid
            let parent = graph.getDefaultParent()

            let tol = gridSize / 3;
            for(let i = originX; i <= imax; i = i + gridSize) {
                for(let j = originY; j <= jmax; j = j + gridSize) {
                    let gridObj = gridTool.getGridCoorByPixelCoor(i + tol, j + tol);
                    let gridId = gridObj.x + ',' + gridObj.y;

                    // if (keys.has(gridId)) {
                    //     continue;
                    // }
                    // keys.add(gridId);


                    let flag = `id_${i.toFixed(2)}_${j.toFixed(2)}`
                    let v = `${gridObj.y + '_' + gridObj.x}`
                    flag = `id_${v}`

                    let style = `id=${flag};` + sb.join('')
                    if (gridSet.has(gridId)) {
                        style = style + specitalColor;
                    } else {
                        style = style + commonColor;
                    }
                    let cell = graph.insertVertex(parent, flag, v, i, j, gridSize, gridSize, style)
                    list.push(cell)
                }
            }
            graph.orderCells(true, list)

        } finally {
            model.endUpdate();
        }
    }

    clearHelper() {
        let graph = this.graph
        let list = this.gridList;

        if (list.length > 0) {
            graph.removeCells(list);
            this.gridList = [];
        }
    }

    release() {
        let graph = this.graph
        let model = this.model
        let list = this.gridList;
        if (list.length > 0) {
            graph.removeCells(list);
            this.gridList = [];
        }
    }

    initGeometry() {
        let graph = this.graph
        let model = this.model
        let cellList = (this.cellList = graph.getVerticesAndEdges(true, true))
        this.graphBounds = graph.getBoundingBoxFromGeometry(cellList, false)
    }

    /**
     * 获取cell的四角坐标（全局四角坐标）
     * @param cell
     * @returns {*[][]}
     */
    getCellPolygon(cell) {
        let graph = this.graph
        let model = this.model

        let pCell = model.getParent(cell);
        let isParentGroup = GraphTool.isGroupCell(graph, pCell) ? true : false;

        let origin = {x: 0, y: 0};
        if (isParentGroup) {
            let pgeo = model.getGeometry(pCell);
            origin.x = pgeo.x;
            origin.y = pgeo.y;
        }

        let geo = model.getGeometry(cell)

        let width = geo.width
        let height = geo.height

        let styleObj = TextUtil.parseDrawioStyle(cell.style)
        let angle = +styleObj.rotation

        let cx = origin.x + geo.x + width / 2
        let cy = origin.y + geo.y + height / 2

        let tran = new Vector2(cx, cy)
        let rad = mathutil.angle2Radian(angle)

        let m = mathutil.commonMatrix(tran, -rad, null)

        let p1 = new Vector2(-width / 2, -height / 2)
        let p2 = new Vector2(width / 2, -height / 2)
        let p3 = new Vector2(width / 2, height / 2)
        let p4 = new Vector2(-width / 2, height / 2)

        let v1 = p1.clone().applyMatrix3(m)
        let v2 = p2.clone().applyMatrix3(m)
        let v3 = p3.clone().applyMatrix3(m)
        let v4 = p4.clone().applyMatrix3(m)


        let ls = [
            [v1.x, v1.y],
            [v2.x, v2.y],
            [v3.x, v3.y],
            [v4.x, v4.y]
        ]

        return ls
    }

    // 为双连接点设备查找文本空间
    getPositionOfTwoTouch(cell, txtCell, vhflag) {
        let gridTool = this.gridTool
        let graph = this.graph
        let model = this.model

        // 寻找相对cell四个方向中最大的空间
        let pCell = model.getParent(cell);
        let isParentGroup = GraphTool.isGroupCell(graph, pCell) ? true : false;

        let origin = {x: 0, y: 0};
        if (isParentGroup) {
            let pgeo = model.getGeometry(pCell);
            origin.x = pgeo.x;
            origin.y = pgeo.y;
        }

        let geo_cell = model.getGeometry(cell);

        let width_cell = geo_cell.width;
        let height_cell = geo_cell.height;

        let cx_cell = origin.x + geo_cell.x + width_cell / 2;
        let cy_cell = origin.y + geo_cell.y + height_cell / 2;

        let geo_txt = model.getGeometry(txtCell).clone();
        let width_txt = geo_txt.width;
        let height_txt = geo_txt.height;


        let p1 = GraphTool.getTouchPointAbs(graph, cell, 0, 0.5)
        let p2 = GraphTool.getTouchPointAbs(graph, cell, 1, 0.5)

        let angle = mathutil.lineAngle(p1.x, p1.y, p2.x, p2.y)

        let relAngle = angle

        if (relAngle > 90) {
            relAngle = -(180 - angle)
        }

        let tran = new Vector2(cx_cell, cy_cell);

        let cellPolygon = this.getCellPolygon(cell);
        let cellGridSet = this.cell2GridSet.get(cell);

        let sets;
        if (vhflag == 'V') {
            sets = gridTool.findVEmptySpaceOfText(cellGridSet, cellPolygon, tran, width_txt, height_txt, width_cell, height_cell);
        } else {
            sets = gridTool.findEmptySpaceOfText(cellGridSet, cellPolygon, relAngle, tran, width_txt, height_txt, width_cell, height_cell);
        }

        if (sets.size > 0) // 空间足够
        {
            if (sets.has('T')) {
                return 'T';
            } else if (sets.has('B')) {
                return 'B';
            } else if (sets.has('L')) {
                return 'L';
            } else if (sets.has('R')) {
                return 'R';
            }
        }
        else // 空间不够用，需要缩小文本，查找四周最大空间，并以此空间重算字体大小
        {
            let flag;
            if (vhflag == 'V') {
                flag = gridTool.findVMaxsizeSpace(cellPolygon, tran, width_txt, height_txt, width_cell, height_cell);
            } else {
                flag = gridTool.findMaxsizeSpace(cellPolygon, relAngle, tran, width_txt, height_txt, width_cell, height_cell);
            }
            // if (!flag) {
            //     flag = 'T'
            // }
            return flag;
        }
    }


    getPositionOfOneTouch(cell, txtCell) {
        let gridTool = this.gridTool
        let graph = this.graph
        let view = graph.view
        let model = this.model
        // let txtGap = this.txtGap
        // let cell2GridSet = this.cell2GridSet;

        // 寻找相对cell四个方向中最大的空间
        let geo_cell = model.getGeometry(cell);

        let len = geo_cell.width;

        let geo_txt = model.getGeometry(txtCell).clone();

        let width_txt = geo_txt.width;
        let height_txt = geo_txt.height;

        let cellState = view.getState(cell);
        let originCell = cellState.origin;
        let coor = new Vector2(originCell.x + len / 2, originCell.y + len / 2);


        let cellPolygon = this.getCellPolygon(cell);
        let cellGridSet = this.cell2GridSet.get(cell);

        let sets = gridTool.findEmptySpaceOfText(cellGridSet, cellPolygon, 0, coor, width_txt, height_txt, len, len);

        if (sets.size > 0) // 空间足够
        {
            if (sets.has('B')) {
                return 'B';
            } else if (sets.has('R')) {
                return 'R';
            }  else if (sets.has('L')) {
                return 'L';
            } else if (sets.has('T')) {
                return 'T';
            }
        }
        else // 空间不够用，需要缩小文本，查找四周最大空间，并以此空间重算字体大小
        {
            let flag = gridTool.findMaxsizeSpace(cellPolygon, 0, coor, width_txt, height_txt, len, len);
            // if (!flag) {
            //     flag = 'T'
            // }
            return flag;
        }
    }
    
    getTextCellByDevId(id) {
        let graph = this.graph
        let model = this.model
        let txtId = 'TXT-' + id

        return model.getCell(txtId)
    }

    // 处理单连接点
    handleOneTouchCell(cell, txtCell) {
        let cell2GridSet = this.cell2GridSet;
        let graph = this.graph
        let view = graph.view
        let model = this.model
        let txtGap = this.txtGap

        let cellGeo = model.getGeometry(cell)
        let txtGeo = model.getGeometry(txtCell).clone()

        let pCell = model.getParent(cell)
        let pState = view.getState(pCell);
        let pOrigin = pState.origin;

        let cellWidth = cellGeo.width
        let cellHeight = cellGeo.height

        let txtWidth = txtGeo.width
        let txtHeight = txtGeo.height

        let posFlag = this.getPositionOfOneTouch(cell, txtCell)

        let cellState = view.getState(cell);
        let originCell = cellState.origin;

        let txtParent = model.getParent(txtCell)
        let isTxtParentGroup = GraphTool.isGroupCell(graph, txtParent) ? true : false;

        let x, y

        if (posFlag == 'L') {
            x = originCell.x - txtGap - txtWidth
            y = originCell.y + cellHeight / 2 - txtHeight / 2
        } else if (posFlag == 'R') {
            x = originCell.x + cellWidth + txtGap;
            y = originCell.y + cellHeight / 2 - txtHeight / 2
        } else if (posFlag == 'T') {
            x = originCell.x + cellWidth / 2 - txtWidth / 2;
            y = originCell.y - txtGap - txtHeight;
        } else {
            x = originCell.x + cellWidth / 2 - txtWidth / 2;
            y = originCell.y + cellWidth + txtGap;
        }

        if (isTxtParentGroup) {
            x = x - pOrigin.x;
            y = y - pOrigin.y;
        }

        txtGeo.x = x
        txtGeo.y = y

        model.setGeometry(txtCell, txtGeo)

        let polygon = this.getCellPolygon(txtCell)
        let gridSet = this.gridTool.setGridOccupiedByPolygon(polygon)
        cell2GridSet.set(txtCell, gridSet)
    }
    
    handleTwoTouchCell(cell, txtCell) {
        let cell2GridSet = this.cell2GridSet;
        let graph = this.graph;
        let view = graph.view
        let model = this.model
        let txtGap = this.txtGap

        let pCell = model.getParent(cell)
        let origin_pCell = view.getState(pCell).origin;

        let cellGeo = model.getGeometry(cell)
        let txtGeo = model.getGeometry(txtCell).clone()

        let cellState = view.getState(cell);
        let originCell = cellState.origin;
        let cellWidth = cellGeo.width
        let cellHeight = cellGeo.height

        let cx_cell = originCell.x + cellWidth / 2;
        let cy_cell = originCell.y + cellHeight / 2;

        let txtWidth = txtGeo.width
        let txtHeight = txtGeo.height

        let p1 = GraphTool.getTouchPointAbs(graph, cell, 0, 0.5)
        let p2 = GraphTool.getTouchPointAbs(graph, cell, 1, 0.5)

        let _angle = mathutil.lineAngle(p1.x, p1.y, p2.x, p2.y)

        let angle = _angle

        if (angle > 90) {
            angle = -(180 - _angle)
        }

        let tran = new Vector2(cx_cell, cy_cell)
        let rad = -mathutil.angle2Radian(angle);

        let vhflag = mathutil.isHorizontalOrVertical(angle, 10);

        let posFlag = this.getPositionOfTwoTouch(cell, txtCell, vhflag);

        let txtParent = model.getParent(txtCell)
        let isTxtParentGroup = GraphTool.isGroupCell(graph, txtParent) ? true : false;
        // let isCellParentGroup = GraphTool.isGroupCell(graph, pCell) ? true : false;

        let cx, cy;

        if (vhflag == 'V') // 垂直的特殊，需要单独处理
        {
            if (isTxtParentGroup) {
                cx = cellHeight / 2 + txtGap + txtWidth / 2;
                cy = 0;
            } else {
                // 优先上下、然后再左右
                if (posFlag == 'T') {
                    cx = 0;
                    cy = -(cellWidth / 2 + txtGap + txtHeight / 2);
                } else if (posFlag == 'B') {
                    cx = 0;
                    cy = cellWidth / 2 + txtGap + txtHeight / 2;
                } else if (posFlag == 'L') {
                    cx = -(cellHeight / 2 + txtGap + txtWidth / 2);
                    cy = 0;
                } else if (posFlag == 'R') {
                    cx = cellHeight / 2 + txtGap + txtWidth / 2;
                    cy = 0;
                }
            }
        }
        else
        {
            if (posFlag == 'T') {
                cx = 0;
                cy = -(cellHeight / 2 + txtGap + txtHeight / 2);
            } else if (posFlag == 'L') {
                cx = -(cellWidth / 2 + txtGap + txtWidth / 2);
                cy = 0;
            } else if (posFlag == 'R') {
                cx = cellWidth / 2 + txtGap + txtWidth / 2;
                cy = 0;
            } else if (posFlag == 'B') {
                cx = 0;
                cy = cellHeight / 2 + txtGap + txtHeight / 2;
            }
        }


        let p = new Vector2(cx, cy);

        let m;
        if (vhflag == 'V') {
            m = mathutil.commonMatrix(tran, 0, null);
        } else {
            m = mathutil.commonMatrix(tran, rad, null);
        }

        let vec = p.applyMatrix3(m);

        if (isTxtParentGroup) {
            txtGeo.x = vec.x - txtWidth / 2 - origin_pCell.x;
            txtGeo.y = vec.y - txtHeight / 2 - origin_pCell.y
        } else {
            txtGeo.x = vec.x - txtWidth / 2
            txtGeo.y = vec.y - txtHeight / 2
        }


        model.setGeometry(txtCell, txtGeo)
        if (vhflag == 'A') {
            graph.setCellStyles('rotation', angle, [txtCell])
        }

        let polygon = this.getCellPolygon(txtCell)
        let gridSet = this.gridTool.setGridOccupiedByPolygon(polygon)
        cell2GridSet.set(txtCell, gridSet)
    }

    /**
     * 处理杆塔
     * @param cell
     * @param txtCell
     */
    handlePoleCell(cell, txtCell) {
        let graph = this.graph
        let view = graph.view
        let model = this.model
        let txtGap = this.txtGap

        let defaultParent = graph.getDefaultParent()
        let cellGeo = model.getGeometry(cell)
        let txtGeo = model.getGeometry(txtCell).clone()

        let pCell = model.getParent(cell)
        let pTxtCell = model.getParent(txtCell)

        let cellWidth = cellGeo.width
        let cellHeight = cellGeo.height

        let txtWidth = txtGeo.width
        let txtHeight = txtGeo.height

        let c1 = new Vector2(cellGeo.getCenterX(), cellGeo.getCenterY())
        let c2 = new Vector2(txtGeo.getCenterX(), txtGeo.getCenterY())

        let r = cellWidth / 2
        let len = r + txtGap

        let rad = mathutil.angle2Radian(45)
        let p = new Vector2(Math.cos(rad) * len, Math.sin(rad) * len)

        let m = mathutil.commonMatrix(c1, null, null)

        let v = p.clone().applyMatrix3(m)

        txtGeo.x = v.x
        txtGeo.y = v.y

        model.setGeometry(txtCell, txtGeo)

        let polygon = this.getCellPolygon(txtCell)
        let gridSet = this.gridTool.setGridOccupiedByPolygon(polygon)
    }

    /**
     * 处理站房
     * @param cell
     * @param txtCell
     */
    handleStationCell(cell, txtCell) {
        let graph = this.graph
        let view = graph.view
        let model = this.model
        let txtGap = this.txtGap

        let defaultParent = graph.getDefaultParent()
        let cellGeo = model.getGeometry(cell)
        let txtGeo = model.getGeometry(txtCell).clone()

        let pCell = model.getParent(cell)
        let pTxtCell = model.getParent(txtCell)

        let state = view.getState(cell);
        let origin = state.origin;

        let cellWidth = cellGeo.width
        let cellHeight = cellGeo.height

        let txtWidth = txtGeo.width
        let txtHeight = txtGeo.height

        let topX = origin.x + cellWidth / 2;
        let topY = origin.y;

        let x = topX - txtWidth / 2;
        let y = topY - txtGap - txtHeight;

        txtGeo.x = x
        txtGeo.y = y

        model.setGeometry(txtCell, txtGeo)
    }

    repositionText(cell, txtCell) {
        let symbolMap = this.symbolMap
        let symbol = symbolMap[cell.symbol]


        if (DeviceCategoryUtil.isPoleCell(cell))
        {
            this.handlePoleCell(cell, txtCell)
        }
        else if (DeviceCategoryUtil.isStationCell(cell))
        {
            this.handleStationCell(cell, txtCell)
        }
        else
        {
            let touchs = symbol.touchs
            if (touchs == 1) {
                this.handleOneTouchCell(cell, txtCell)
            } else {
                this.handleTwoTouchCell(cell, txtCell)
            }
        }
    }

    go() {
        let graph = this.graph
        let model = this.model
        model.beginUpdate()
        try {
            for (let cell of this.cellList) {
                if (cell.isVertex() && !DeviceCategoryUtil.isTextCell(cell)) {

                    if (GraphTool.isGroupCell(graph, cell)) // 不处理组设备
                    {
                        continue;
                    }

                    // 文本不存在就跳过
                    let txtCell = this.getTextCellByDevId(cell.id)
                    if (!txtCell) {
                        continue
                    }

                    this.repositionText(cell, txtCell)
                }
            }
        } finally {
            model.endUpdate()
        }
    }
}
