import mathutil from "@/plugins/tmzx/mathutil.js";
import SymbolUtil from "@/plugins/tmzx/graph/SymbolUtil.js";
import Mathutil from '@/plugins/tmzx/mathutil.js'
import DeviceCategoryUtil from '@/plugins/tmzx/graph/DeviceCategoryUtil.js'
import TextUtil from '@/plugins/tmzx/graph/TextUtil.js'


export default function SvgGenerate(ui, svgTxtObj, svgParser) {
    this.svgParser = svgParser;
    this.ui = ui;
    this.svgTxtObj = svgTxtObj;
    this.graph = ui.editor.graph;
    this.buffer = [];
    // this.jsonBuffer = [];
    this.layer2ListMap = {};
    this.cellMap = new Map();
    //this.init();
}
SvgGenerate.prototype.init = function () {
    let svgTxtObj = this.svgTxtObj;
    let buffer = this.buffer;
    buffer.push(svgTxtObj['xmlDec']);
    buffer.push(svgTxtObj['svgTag']);
    buffer.push(svgTxtObj['defsContent']);
    // buffer.push(svgTxtObj['bgColor']);
}

/** 读取图元属性：cell → 样式 → XML value */
SvgGenerate.prototype.pickCellAttr = function (cell, key) {
    let graph = this.graph
    let model = graph.getModel()
    let v = cell[key]
    if (v != null && v !== '') {
        return String(v)
    }
    let cellStyle = graph.getCurrentCellStyle(cell) || {}
    if (cellStyle[key] != null && cellStyle[key] !== '') {
        return String(cellStyle[key])
    }
    let valueNode = model.getValue(cell)
    if (mxUtils.isNode(valueNode)) {
        let a = valueNode.getAttribute(key)
        if (a != null && a !== '') {
            return a
        }
    }
    return ''
}

/** 将「1,2,3,4」或 JSON 数组字符串解析为数字数组；失败返回 [] */
SvgGenerate.prototype.parseBracketNumberArray = function (str) {
    if (str == null || str === '') {
        return []
    }
    let s = String(str).trim()
    try {
        if (s.startsWith('[') && s.endsWith(']')) {
            let arr = JSON.parse(s)
            if (Array.isArray(arr)) {
                return arr.map((x) => (typeof x === 'number' ? x : parseFloat(x))).filter((x) => !isNaN(x))
            }
        }
    } catch (e) {
        /* ignore */
    }
    let parts = s.split(/[,，;\s]+/).map((p) => parseFloat(p.trim()))
    if (parts.length && parts.every((p) => !isNaN(p))) {
        return parts
    }
    return []
}

/** 与顶点相连的母线列表（去重，按 id 排序） */
SvgGenerate.prototype.getBusesAdjacentToVertex = function (cell) {
    let graph = this.graph
    let model = graph.getModel()
    let edges = model.getEdges(cell) || []
    let seen = new Set()
    let out = []
    for (let ei = 0; ei < edges.length; ei++) {
        let edge = edges[ei]
        let s = model.getTerminal(edge, true)
        let t = model.getTerminal(edge, false)
        let o = s === cell ? t : t === cell ? s : null
        if (!o || !DeviceCategoryUtil.isBusCell(o)) {
            continue
        }
        let oid = String(o.id || '')
        if (seen.has(oid)) {
            continue
        }
        seen.add(oid)
        let busid = this.pickCellAttr(o, 'busid')
        if (!busid) {
            busid = o.busid != null && o.busid !== '' ? String(o.busid) : String(o.id || '')
        }
        busid = String(busid).replace(/-/g, '')
        let nm = this.getBusNameForSubmit(o)
        out.push([busid, nm])
    }
    out.sort(function (a, b) {
        return String(a[0]).localeCompare(String(b[0]))
    })
    return out
}

SvgGenerate.prototype.setCellXmlOrStyleAttr = function (cell, key, val) {
    let graph = this.graph
    let model = graph.getModel()
    let value = model.getValue(cell)
    let obj
    if (!mxUtils.isNode(value)) {
        let doc = mxUtils.createXmlDocument()
        obj = doc.createElement('object')
        if (value != null && value !== '') {
            obj.setAttribute('label', String(value))
        }
    } else {
        obj = value.cloneNode(true)
    }
    obj.setAttribute(key, val)
    model.setValue(cell, obj)
    cell[key] = val
    graph.setCellStyles(key, val, [cell])
}

SvgGenerate.prototype.applyPendingSubmitAttrs = function (pending) {
    if (!pending || pending.length === 0) {
        return
    }
    let graph = this.graph
    let model = graph.getModel()
    model.beginUpdate()
    try {
        for (let i = 0; i < pending.length; i++) {
            let item = pending[i]
            if (!item || !item.attrs) {
                continue
            }
            let cell = item.cell
            let attrs = item.attrs || {}
            for (let k in attrs) {
                if (Object.prototype.hasOwnProperty.call(attrs, k)) {
                    this.setCellXmlOrStyleAttr(cell, k, attrs[k])
                }
            }
        }
    } finally {
        model.endUpdate()
    }
}

/**
 * 获取设备的属性信息
 * @param propMap
 */
SvgGenerate.prototype.getMeta = function (id) {
    let metaMap = this.metaMap;

    let sb = [];
    sb.push('<metadata>');
    sb.push(metaMap.get(id));
    sb.push('</metadata>');
    return sb.join('');
}

// 获取分组的根组，这个用于设备
SvgGenerate.prototype.getRootGroup = function (cell) {
    let graph = this.graph;
    let view = graph.getView();
    let defaultParent = graph.getDefaultParent();
    let model = graph.getModel();

    let state = view.getState(cell);
    let style = state?.style;

    if (cell == defaultParent) {
        return null;
    }

    if (style && style.flag == 'group') {
        return cell;
    }

    let pcell = model.getParent(cell);


    return this.getRootGroup(pcell);
}

/**
 * 根据根分组找到是否有电站
 * @param cell rootGroup
 * @returns {*|null}
 */
SvgGenerate.prototype.getSubstation = function (cell) {
    let graph = this.graph;
    let model = graph.getModel();

    // let cellStyle = graph.getCurrentCellStyle(cell);


    if (DeviceCategoryUtil.isStationCell(cell)) {
        return cell;
    } else {
        let count = model.getChildCount(cell);
        if (count > 0) {
            for(let i = 0; i < count; i++) {
                let childCell = model.getChildAt(cell, i);
                let station = this.getSubstation(childCell);
                if (station) {
                    return station;
                }
            }
            return null;
        }
        return null;
    }
}

// 获取站房ID
SvgGenerate.prototype.getStationId = function (cell) {
    let group = this.getRootGroup(cell);
    if (group) {
        let sub = this.getSubstation(group);
        return sub ? sub.id : null;
    }
    return null;
}

/** 站房类图元（含 useStation） */
SvgGenerate.prototype.isStationLikeCell = function (graph, cell) {
    if (!cell) {
        return false
    }
    if (DeviceCategoryUtil.isStationCell(cell)) {
        return true
    }
    let st = graph.getCurrentCellStyle(cell)
    return !!(st && (st.flag === 'station' || st.flag === 'useStation'))
}

/** 深度收集 scope 下所有站房类顶点 */
SvgGenerate.prototype.collectStationCellsUnder = function (scopeCell, out) {
    if (!scopeCell) {
        return
    }
    let graph = this.graph
    let model = graph.getModel()
    if (this.isStationLikeCell(graph, scopeCell)) {
        out.push(scopeCell)
    }
    let n = model.getChildCount(scopeCell)
    for (let i = 0; i < n; i++) {
        this.collectStationCellsUnder(model.getChildAt(scopeCell, i), out)
    }
}

/**
 * 保存 add.bus 用：station 取「最左端」站房（画布 state.x 最小）。
 * 若母线在分组内，只在该分组子树内比较；否则在全图根下比较。
 */
SvgGenerate.prototype.getLeftmostStationForBusSubmit = function (busCell) {
    let graph = this.graph
    let model = graph.getModel()
    let view = graph.getView()
    let rootGroup = this.getRootGroup(busCell)
    let scope = rootGroup || model.getRoot()
    let candidates = []
    this.collectStationCellsUnder(scope, candidates)
    if (candidates.length === 0) {
        return null
    }
    let best = null
    let bestX = Infinity
    for (let i = 0; i < candidates.length; i++) {
        let c = candidates[i]
        let st = view.getState(c)
        let x = st != null ? st.x : null
        if (x == null || isNaN(x)) {
            let geo = graph.getCellGeometry(c)
            x = geo ? geo.x : Infinity
        }
        if (x < bestX) {
            bestX = x
            best = c
        }
    }
    return best
}

SvgGenerate.prototype.parseSubstation = function (cell, tranx, trany) {
    let graph = this.graph;
    let view = graph.getView();
    let model = graph.getModel();
    let attrMap = this.attrMap;
    let svgParser = this.svgParser;

    let scale = svgParser.getScale();

    let propMap = (attrMap && attrMap.get(cell.id)) || {};
    let layer2ListMap = this.layer2ListMap;

    let cls = propMap['cls'];
    let stroke = propMap['stroke'];
    let strokeWidth = propMap['strokeWidth'];

    // 根据设备所属图层来归类（新建站房无 SVG 元数据时用默认层）
    let layerName =
        (propMap['cge:Layer_Ref'] && propMap['cge:Layer_Ref']['ObjectName']) || 'Substation_Layer';
    if (!layer2ListMap[layerName]) {
        layer2ListMap[layerName] = [];
    }

    let id = cell.id;

    let cellState = view.getState(cell);

    let origin = cellState.origin;
    let geometry = graph.getCellGeometry(cell);
    let {width, height} = geometry;
    width = width / scale;
    height = height / scale;

    let _x = origin.x / scale + tranx;
    let _y = origin.y / scale + trany;


    let vlt = {
        x: _x,
        y: _y
    }
    let vrt = {
        x: _x + width,
        y: _y
    }
    let vrb = {
        x: _x + width,
        y: _y + height
    }
    let vlb = {
        x: _x,
        y: _y + height
    }

    let sb = [];
    // 设备转字符串开始
    sb.push(`<g id="${id}">`);
    {
        sb.push('<polygon ');
        sb.push('fill="none" ');
        if (cls) {
            sb.push(`class="${cls}" `);
        }
        if (strokeWidth) {
            sb.push(`stroke-width="${strokeWidth}" `);
        }
        if (stroke) {
            sb.push(`stroke="${stroke}" ` )
        }

        let pointLs = [vlt, vrt, vrb, vlb, vlt];
        let corStr = pointLs.map(v => {
            return v.x + ',' + v.y;
        })
        sb.push(`points="${corStr.join(' ')}" />`);
    }
    // 添加元数据
    sb.push(this.getMeta(id));

    sb.push('</g>');
    layer2ListMap[layerName].push(sb.join(''));
}

SvgGenerate.prototype.parseBusbar = function (cell, tranx, trany) {
    let graph = this.graph;
    let view = graph.getView();
    let model = graph.getModel();
    let attrMap = this.attrMap;
    let svgParser = this.svgParser;

    let propMap = (attrMap && attrMap.get(cell.id)) || {};
    let layer2ListMap = this.layer2ListMap;

    let scale = svgParser.getScale();

    // 根据设备所属图层来归类（工具栏新建母线不在 attrMap 中时用默认层）
    let layerName =
        (propMap['cge:Layer_Ref'] && propMap['cge:Layer_Ref']['ObjectName']) ||
        'busbarsection_layer';
    if (!layer2ListMap[layerName]) {
        layer2ListMap[layerName] = [];
    }

    let preStrokeWidth = propMap['strokeWidth'];

    let id = cell.id;

    let sb = [];

    // 设备转字符串开始
    sb.push(`<g id="${id}">`);
    {
        let geometry = graph.getCellGeometry(cell);
        let {width, height} = geometry;
        width = width / scale;
        height = height / scale;

        let cellState = view.getState(cell);

        let origin = cellState.origin;
        let styleObj = cellState.style;
        let rotation = styleObj.rotation || 0;
        let rad = -mathutil.angle2Radian(rotation);

        let tranObj = {
            x: origin.x / scale + tranx,
            y: origin.y / scale + trany
        }

        let vcenter = {
            x: tranObj.x + width / 2,
            y: tranObj.y + height / 2
        }

        let tx = vcenter.x;
        let ty = vcenter.y;

        let vecTran = new Vector2(tx, ty);

        // 只有水平和垂直，目前这个地方不用再这么弄
        let m = mathutil.commonMatrix(vecTran, rad, null);

        let vec1 = new Vector2(-width / 2, 0);
        let vec2 = new Vector2(width / 2, 0);

        let p1 = vec1.clone().applyMatrix3(m);
        let p2 = vec2.clone().applyMatrix3(m);

        let cls = propMap['cls'];
        let stroke = propMap['stroke'];

        sb.push('<polyline ');
        sb.push('fill="none" ');

        if (cls) {
            sb.push(`class="${cls}" `);
        }

        let strokeColor = stroke || 'rgb(185,72,66)'
        sb.push(`stroke="${strokeColor}" `)

        if (preStrokeWidth) {
            sb.push(`stroke-width="${preStrokeWidth}" `);
        } else {
            sb.push(`stroke-width="${height}" `);
        }



        let pointLs = [];
        pointLs.push(p1.x + ',' + p1.y);
        pointLs.push(p2.x + ',' + p2.y);
        sb.push(`points="${pointLs.join(' ')}"/>`);
    }
    // 添加元数据
    sb.push(this.getMeta(cell.id));

    sb.push('</g>');
    layer2ListMap[layerName].push(sb.join(''));
}

/**
 * symbolMap 的键在 StencilParse 中统一为 symbol id 的小写；
 * 图上 style 里的 shape 或 cell.symbol 可能大小写不一致，故做多键回退。
 */
SvgGenerate.prototype.resolveSymbolProp = function (symbolMap, shape, cell) {
    if (!symbolMap) {
        return null
    }
    let tried = new Set()
    let tryKey = (k) => {
        if (k == null || k === '') {
            return null
        }
        let s = String(k)
        if (tried.has(s)) {
            return null
        }
        tried.add(s)
        let v = symbolMap[s]
        return v || null
    }
    let hit = tryKey(shape)
    if (hit) {
        return hit
    }
    if (typeof shape === 'string') {
        hit = tryKey(shape.toLowerCase())
        if (hit) {
            return hit
        }
    }
    if (cell) {
        hit = tryKey(cell.symbol)
        if (hit) {
            return hit
        }
        if (cell.symbol != null && cell.symbol !== '') {
            hit = tryKey(String(cell.symbol).toLowerCase())
            if (hit) {
                return hit
            }
        }
    }
    return null
}

/**
 * 导出 &lt;use&gt; 时与 symbol 坐标系一致的基准边长。
 * lgdata 导入：attrMap 有记录，几何按 Stencil bbox(initWidth) 计算，仍用 bbox。
 * 侧栏新增：无元数据，画布尺寸与 symbol 声明 width/height（symEntry.w/h）对齐；
 * 若仅用 bbox 作 scale 分母会偏小；声明值异常小（力光 PSR 图元）时退回 bbox。
 */
SvgGenerate.prototype.getExportSymbolScaleBaseDim = function (symEntry, cellId, axis) {
    let bbox = Number(axis === 'y' ? symEntry.initHeight : symEntry.initWidth)
    if (isNaN(bbox) || bbox <= 0) {
        return 1
    }
    let attr = parseFloat(axis === 'y' ? symEntry.h : symEntry.w)
    let hasMeta = this.attrMap && this.attrMap.has && this.attrMap.has(cellId)
    if (hasMeta) {
        return bbox
    }
    if (!isNaN(attr) && attr > 0) {
        if (attr < bbox * 0.22) {
            return bbox
        }
        return Math.min(attr, bbox)
    }
    return bbox
}

/**
 * 解析顶点 cell
 * @param cell
 */
SvgGenerate.prototype.parseCell = function (cell, tranx, trany) {
    let svgParser = this.svgParser
    let graph = this.graph
    let view = graph.getView()
    let model = graph.getModel()
    let symbolMap = this.svgParser.getSymbolMap()
    let attrMap = this.attrMap
    let s = svgParser.getScale()

    let minWidth = -1

    let propMap = (attrMap && attrMap.get(cell.id)) || {}
    let layer2ListMap = this.layer2ListMap

    if (!cell || cell.style.indexOf('group') != -1 || cell.style.indexOf('text') == 0) {
        return
    }

    let styleObj = graph.getCurrentCellStyle(cell)
    let { id, shape, rotation } = styleObj // shape -> powertransformer_pms25_11000000_2030020

    if (DeviceCategoryUtil.isStationCell(cell)) {
        this.parseSubstation(cell, tranx, trany)
    } else if (DeviceCategoryUtil.isBusCell(cell)) {
        this.parseBusbar(cell, tranx, trany)
    } // 普通设备解析
    else {
        // 根据设备所属图层来归类（无导入元数据时归入 Other_Layer）
        let layerName =
            (propMap['cge:Layer_Ref'] && propMap['cge:Layer_Ref']['ObjectName']) || 'Other_Layer'
        if (!layer2ListMap[layerName]) {
            layer2ListMap[layerName] = []
        }
        id = cell.id
        let symEntry = this.resolveSymbolProp(symbolMap, shape, cell)
        if (!symEntry) {
            console.warn('[SvgGenerate] parseCell: 未注册图元', {
                id: cell.id,
                shape,
                symbol: cell.symbol,
                symbolId: cell.symbolId
            })
            return minWidth
        }
        let sb = []

        // 设备转字符串开始
        sb.push(`<g id="${id}">`)
        // 添加设备数据
        {
            sb.push('<use ')
            // 添加class样式
            let cls

            cls = propMap['cls']

            if (cls) {
                sb.push(`class="${cls}" `)
            }

            let state = view.getState(cell)
            // let pcell = model.getParent(cell);
            // 添加符号引用

            let { initWidth, initHeight, xratio, yratio, w, h } = symEntry
            let geometry = graph.getCellGeometry(cell)
            let { width, height } = geometry

            width = width / s
            height = height / s

            minWidth = width

            let origin = state.origin

            if (!rotation) {
                rotation = 0
            }

            // 寻找真正的中心点，真正的中心点可能并不在symbol中间
            let rad = -mathutil.angle2Radian(rotation)

            let leftWidth = width * xratio
            let topHeight = height * yratio

            // 获取绝对中心点
            let tranObj = {
                x: origin.x / s + tranx + width / 2,
                y: origin.y / s + trany + height / 2
            }

            // 原点初始位置，这个地方要重新计算
            let veco = new Vector2(leftWidth - width / 2, topHeight - height / 2)
            let m = mathutil.commonMatrix(tranObj, rad, null)

            // 计算真实位置
            let v = veco.clone().applyMatrix3(m)

            let hrefId = cell.symbolId || symEntry.hrefId || symEntry.symbolId
            sb.push(`xlink:href="#${hrefId}" `)
            let cx = v.x
            let cy = v.y

            let hasDeviceMeta = this.attrMap && this.attrMap.has && this.attrMap.has(cell.id)
            let xb = Number(initWidth)
            let yb = Number(initHeight)
            let scaleBW = this.getExportSymbolScaleBaseDim(symEntry, cell.id, 'x')
            let scaleBH = this.getExportSymbolScaleBaseDim(symEntry, cell.id, 'y')
            let scale = width / scaleBW

            let xmin = symEntry.xmin != null ? symEntry.xmin : 0
            let ymin = symEntry.ymin != null ? symEntry.ymin : 0

            let stepx
            let stepy
            let useW
            let useH
            if (hasDeviceMeta || !(xb > 0) || !(yb > 0)) {
                stepx = cx + xmin + xb * xratio
                stepy = cy + ymin + yb * yratio
                useW = xb
                useH = yb
            } else {
                let rw = scaleBW / xb
                let rh = scaleBH / yb
                stepx = cx + xmin * rw + scaleBW * xratio
                stepy = cy + ymin * rh + scaleBH * yratio
                useW = scaleBW
                useH = scaleBH
            }

            sb.push(`x="${cx}" y="${cy}" `)
            sb.push(`w="${useW}" h="${useH}" `)
            sb.push(`width="${w}" height="${h}" `)
            sb.push(
                `transform="rotate(${rotation},${cx},${cy}) translate(${cx}, ${cy}) scale(${scale}) translate(${-stepx}, ${-stepy})" `
            )
            sb.push('/>')
        }
        // 添加元数据
        sb.push(this.getMeta(cell.id))

        sb.push('</g>')
        layer2ListMap[layerName].push(sb.join(''))
    }
    return minWidth;
}

// 解析自定义图元
SvgGenerate.prototype.parseCustomCell = function (cell, tranx, trany) {
    let graph = this.graph;
    let view = graph.getView();
    let model = graph.getModel();
    let symbolMap = this.svgParser.getSymbolMap();
    let attrMap = this.attrMap;

    let propMap = (attrMap && attrMap.get(cell.id)) || {};
    let layer2ListMap = this.layer2ListMap;

    let styleObj = graph.getCurrentCellStyle(cell);
    let {id, shape, rotation} = styleObj;  // shape -> powertransformer_pms25_11000000_2030020

    // 根据设备所属图层来归类
    let layerName = 'customLayer';
    if (!layer2ListMap[layerName]) {
        layer2ListMap[layerName] = [];
    }
    id = cell.id;
    let symEntry = this.resolveSymbolProp(symbolMap, shape, cell);
    if (!symEntry) {
        console.warn('[SvgGenerate] parseCustomCell: 未注册图元', {
            id: cell.id,
            shape,
            symbol: cell.symbol,
            symbolId: cell.symbolId
        });
        return;
    }
    let sb = [];

    // 设备转字符串开始
    sb.push(`<g id="${id}">`);
    // 添加设备数据
    {
        sb.push('<use ');

        let state = view.getState(cell);

        let {initWidth, initHeight, xratio, yratio} = symEntry;
        let geometry = graph.getCellGeometry(cell);
        let {x, y, width, height} = geometry;

        let origin = state.origin;

        if (!rotation) {
            rotation = 0;
        }

        // 寻找真正的中心点，真正的中心点可能并不在symbol中间
        let rad = -mathutil.angle2Radian(rotation);

        let leftWidth = width * xratio;
        let topHeight = height * yratio;

        // 获取绝对中心点
        let tranObj = {
            x: origin.x + tranx + width / 2,
            y: origin.y + trany + height / 2
        };

        // 原点初始位置，这个地方要重新计算
        let veco = new Vector2(leftWidth - width / 2, topHeight - height / 2);
        let m = mathutil.commonMatrix(tranObj, rad, null);

        // 计算真实位置
        let v = veco.clone().applyMatrix3(m);

        let hrefId = cell.symbolId || symEntry.hrefId || symEntry.symbolId;
        sb.push(`xlink:href="#${hrefId}" `);
        let cx = v.x;
        let cy = v.y;

        let hasDeviceMeta = this.attrMap && this.attrMap.has && this.attrMap.has(cell.id);
        let xb = Number(initWidth);
        let yb = Number(initHeight);
        let scaleBW = this.getExportSymbolScaleBaseDim(symEntry, cell.id, 'x');
        let scaleBH = this.getExportSymbolScaleBaseDim(symEntry, cell.id, 'y');
        let scale = width / scaleBW;

        let xmin = symEntry.xmin != null ? symEntry.xmin : 0;
        let ymin = symEntry.ymin != null ? symEntry.ymin : 0;

        let stepx;
        let stepy;
        let useW;
        let useH;
        if (hasDeviceMeta || !(xb > 0) || !(yb > 0)) {
            stepx = cx + xmin + xb * xratio;
            stepy = cy + ymin + yb * yratio;
            useW = xb;
            useH = yb;
        } else {
            let rw = scaleBW / xb;
            let rh = scaleBH / yb;
            stepx = cx + xmin * rw + scaleBW * xratio;
            stepy = cy + ymin * rh + scaleBH * yratio;
            useW = scaleBW;
            useH = scaleBH;
        }

        sb.push(`x="${cx}" y="${cy}" `);
        sb.push(`w="${useW}" h="${useH}" `);
        sb.push(`transform="rotate(${rotation},${cx},${cy}) translate(${cx}, ${cy}) scale(${scale}) translate(${-stepx}, ${-stepy})" `);
        sb.push('/>');
    }
    sb.push('</g>');
    layer2ListMap[layerName].push(sb.join(''));
}

SvgGenerate.prototype.parseText_bak = function (cell, tranx, trany) {
    let svgParser = this.svgParser;
    let cellMap = this.cellMap;
    let graph = this.graph;
    let model = graph.getModel();
    let layer2ListMap = this.layer2ListMap;
    // let jsonBuffer = this.jsonBuffer;

    let scale = svgParser.getScale();

    let txt = cell.value;
    let txtArr = txt.split(/\n/);


    let styleObj = graph.getCurrentCellStyle(cell);
    let {id, layer, shape, rotation, fontSize, fontFamily, align, verticalAlign, fontColor, xlink} = styleObj;
    let geometry = graph.getCellGeometry(cell);
    let cellState = graph.view.getState(cell);


    // let pcell = model.getParent(cell);

    let origin = cellState.origin;

    // 根据设备所属图层来归类
    let layerName = layer;
    if (!layer2ListMap[layerName]) {
        layer2ListMap[layerName] = [];
    }



    id = cell.id;
    let sbid = cell.sbid;
    let devCell = model.getCell(sbid);

    let sb = [];

    if (layerName == 'Hot_Layer') {

        let superlinkname = cell.superlinkname;
        let superlinkpsrid = cell.superlinkpsrid;
        let href = cell.href;

        // 设备转字符串开始
        sb.push(`<a `);
        sb.push(`superlinkname="${superlinkname}" `)
        sb.push(`superlinkpsrid="${superlinkpsrid}" `)
        sb.push(`target="${sbid}" `)
        sb.push(`xlink:href="${href}" `)
    } else {
        // 设备转字符串开始
        sb.push(`<g id="${id}" `);
    }

    let pid = this.getStationId(cell);
    if (pid) {
        sb.push(`pid="${pid}" `);
    }
    sb.push('>');
    // 添加transform
    let {width, height} = geometry;

    width = width / scale;
    height = height / scale;

    let vcenter = {
        x: origin.x / scale + tranx + width / 2,
        y: origin.y / scale + trany + height / 2
    }
    let tx = vcenter.x;
    let ty = vcenter.y;

    let vecTran = new Vector2(tx, ty);
    rotation = rotation || 0;
    let rad = mathutil.angle2Radian(rotation);

    let m = mathutil.commonMatrix(vecTran, -rad, null);

    let lineHeight = height / txtArr.length; // 每行字占的高度

    let fc = fontColor ? fontColor : '#fff';

    for(let i = 0; i < txtArr.length; i++)
    {
        let _y = (i + 1) * lineHeight - height / 2;

        let vec = new Vector2(0, _y);
        let v = vec.applyMatrix3(m);

        let cx = v.x;
        let cy = v.y;

        sb.push(`<text fill="${fc}" `);
        // sb.push(`font-family="宋体" `);
        sb.push(`font-size="${fontSize/scale}" `);
        sb.push(`stroke="none" `);
        sb.push(`transform="rotate(${rotation},${cx} ${cy}) translate(${cx},${cy}) translate(${-cx}, ${-cy})" `);
        if (devCell && devCell.layer == 'energyconsumer_layer') {
            sb.push(`style="text-anchor:middle;display:none;" `);
        } else {
            sb.push(`style="text-anchor:middle;" `);
        }

        sb.push(`x="${cx}" `);
        sb.push(`y="${cy}">`);
        sb.push(`${txtArr[i]}`);
        sb.push('</text>');
    }
    // 添加元数据

    sb.push(this.getMeta(id));
    if (layerName == 'Hot_Layer') {
        sb.push('</a>');
    } else {
        sb.push('</g>');
    }

    layer2ListMap[layerName].push(sb.join(''));
}

SvgGenerate.prototype.parseText = function (cell, tranx, trany) {
    let svgParser = this.svgParser;
    let cellMap = this.cellMap;
    let graph = this.graph;
    let model = graph.getModel();
    let layer2ListMap = this.layer2ListMap;
    // let jsonBuffer = this.jsonBuffer;

    let scale = svgParser.getScale();

    let txt = cell.value;
    let txtArr = txt.split(/\n/);


    let styleObj = graph.getCurrentCellStyle(cell);
    let {id, layer, shape, rotation, fontSize, fontFamily, align, verticalAlign, fontColor, xlink} = styleObj;
    let geometry = graph.getCellGeometry(cell);
    let cellState = graph.view.getState(cell);


    // let pcell = model.getParent(cell);

    let origin = cellState.origin;

    // 根据设备所属图层来归类
    let layerName = layer;
    if (!layer2ListMap[layerName]) {
        layer2ListMap[layerName] = [];
    }

    id = cell.id;
    let sbid = cell.sbid;
    let devCell = model.getCell(sbid);

    let sb = [];

    if (layerName == 'Hot_Layer') {

        let superlinkname = cell.superlinkname;
        let superlinkpsrid = cell.superlinkpsrid;
        let href = cell.href;

        // 设备转字符串开始
        sb.push(`<a `);
        sb.push(`superlinkname="${superlinkname}" `)
        sb.push(`superlinkpsrid="${superlinkpsrid}" `)
        sb.push(`target="${sbid}" `)
        sb.push(`xlink:href="${href}" `)
    } else {
        // 设备转字符串开始
        sb.push(`<g id="${id}" `);
    }

    let pid = this.getStationId(cell);
    if (pid) {
        sb.push(`pid="${pid}" `);
    }
    sb.push('>');
    // 添加transform
    let {width, height} = geometry;

    width = width / scale;
    height = height / scale;

    let vcenter = {
        x: origin.x / scale + tranx + width / 2,
        y: origin.y / scale + trany + height / 2
    }
    let tx = vcenter.x;
    let ty = vcenter.y;

    let vecTran = new Vector2(tx, ty);
    rotation = rotation || 0;
    let rad = mathutil.angle2Radian(rotation);

    let m = mathutil.commonMatrix(vecTran, -rad, null);

    let lineHeight = height / txtArr.length; // 每行字占的高度

    let fc = fontColor ? fontColor : '#fff';

    let _fs = fontSize/scale;

    for (let i = 0; i < txtArr.length; i++) {
        let str = txtArr[i]
        let _y = (i + 1) * lineHeight - height / 2

        let cx
        let cy

        // 计算单行文本实际中心点（由于所有文本都用了text-anchro=middle）
        if (align == 'left') {
            let w = TextUtil.getStrWidth(_fs, str)
            let vec = new Vector2(w / 2 - width / 2, _y)
            let v = vec.applyMatrix3(m)
            cx = v.x
            cy = v.y
        } else if (align == 'right') {
            let w = TextUtil.getStrWidth(_fs, str)
            let vec = new Vector2(width / 2 - w / 2, _y)
            let v = vec.applyMatrix3(m)
            cx = v.x
            cy = v.y
        } else {
            let vec = new Vector2(0, _y)
            let v = vec.applyMatrix3(m)
            cx = v.x
            cy = v.y
        }

        sb.push(`<text fill="${fc}" `)
        // sb.push(`font-family="宋体" `);
        sb.push(`font-size="${fontSize / scale}" `)
        sb.push(`stroke="none" `)
        sb.push(
            `transform="rotate(${rotation},${cx} ${cy}) translate(${cx},${cy}) translate(${-cx}, ${-cy})" `
        )
        if (devCell && devCell.layer == 'energyconsumer_layer') {
            sb.push(`style="text-anchor:middle;display:none;" `)
        } else {
            sb.push(`style="text-anchor:middle;" `)
        }

        sb.push(`x="${cx}" `)
        sb.push(`y="${cy}">`)
        sb.push(`${txtArr[i]}`)
        sb.push('</text>')
    }
    // 添加元数据

    sb.push(this.getMeta(id))
    if (layerName == 'Hot_Layer') {
        sb.push('</a>')
    } else {
        sb.push('</g>')
    }

    layer2ListMap[layerName].push(sb.join(''));
}

/**
 * 解析线 edge
 * @param edge
 */
SvgGenerate.prototype.getEdgePoints = function (edge, tranx, trany)
{
    let svgParser = this.svgParser;

    let s = svgParser.getScale();

    let graph = this.graph;
    let view = graph.view;

    let state = view.getState(edge);

    let pointLs = [];
    let absPointLs = state.absolutePoints; // 这种方式可以减少计算量
    let scale = view.scale;
    for(let p of absPointLs) {
        let _x = (p.x / scale - view.translate.x) / s + tranx;
        let _y = (p.y / scale - view.translate.y) / s + trany;
        // pointLs.push(_x + ',' + _y);

        pointLs.push(new Vector2(_x, _y));
    }

    return pointLs;
}

/**
 * 解析线 edge
 * @param edge
 */
SvgGenerate.prototype.parseEdge = function (edge, tranx, trany) {
    let layer2ListMap = this.layer2ListMap
    let svgParser = this.svgParser

    let s = svgParser.getScale()

    let graph = this.graph
    let view = graph.view
    let attrMap = this.attrMap
    let model = graph.getModel()
    let propMap = (attrMap && attrMap.get(edge.id)) || {}

    let state = view.getState(edge)

    let pointLs = []
    let absPointLs = state.absolutePoints // 这种方式可以减少计算量
    let scale = view.scale
    for (let p of absPointLs) {
        let _x = (p.x / scale - view.translate.x) / s + tranx
        let _y = (p.y / scale - view.translate.y) / s + trany
        pointLs.push(_x + ',' + _y)
    }

    let cls = propMap['cls']
    let strokeDasharray = propMap['strokeDasharray']
    let strokeWidth = propMap['strokeWidth']
    let stroke = propMap['stroke']
    let cellStyle = graph.getCurrentCellStyle(edge)
    if (strokeWidth == null || strokeWidth === '') {
        let nw = mxUtils.getNumber(cellStyle, mxConstants.STYLE_STROKEWIDTH, NaN)
        if (!isNaN(nw)) {
            strokeWidth = String(nw)
        }
    }
    if (stroke == null || stroke === '') {
        let sc = mxUtils.getValue(cellStyle, mxConstants.STYLE_STROKECOLOR, null)
        if (sc != null && sc !== '') {
            stroke = sc
        }
    }
    let sb = []

    // 根据设备所属图层来归类
    let layerName =
        (propMap['cge:Layer_Ref'] && propMap['cge:Layer_Ref']['ObjectName']) || 'Other_Layer'
    if (!layer2ListMap[layerName]) {
        layer2ListMap[layerName] = []
    }
    let id = edge.id

    // 设备转字符串开始
    sb.push(`<g id="${id}" `)
    if (edge.pid) {
        sb.push(`pid="${edge.pid}"`)
    }
    sb.push('>')
    {
        sb.push('<polyline ')
        sb.push('fill="none" ')
        if (cls) {
            sb.push(`class="${cls}" `)
        }
        let sw = strokeWidth != null && strokeWidth !== '' ? strokeWidth : '0.4'
        sb.push(`stroke-width="${sw}" `)
        if (strokeDasharray) {
            sb.push(`stroke-dasharray="${strokeDasharray}" `)
        }
        let sc = stroke != null && stroke !== '' ? stroke : 'rgb(185,72,66)'
        sb.push(`stroke="${sc}" `)
        sb.push(`points="${pointLs.join(' ')}"/>`)
    }
    // 添加元数据
    sb.push(this.getMeta(id))
    sb.push('</g>')
    layer2ListMap[layerName].push(sb.join(' '))
}

SvgGenerate.prototype.parseEdges = function (intersectMap) {
    let layer2ListMap = this.layer2ListMap
    let graph = this.graph
    let view = graph.view
    let attrMap = this.attrMap
    let model = graph.getModel()
    let arcLen = this.arcLen

    for (let [key, value] of intersectMap) {
        let edge = key
        let map = value

        let propMap = (attrMap && attrMap.get(edge.id)) || {}

        let cls = propMap['cls']
        let strokeDasharray = propMap['strokeDasharray']
        let strokeWidth = propMap['strokeWidth']
        let stroke = propMap['stroke']
        let sb = []

        // 根据设备所属图层来归类
        let layerName =
            (propMap['cge:Layer_Ref'] && propMap['cge:Layer_Ref']['ObjectName']) || 'Other_Layer'
        if (!layer2ListMap[layerName]) {
            layer2ListMap[layerName] = []
        }

        let id = edge.id

        let pathStrLs = []

        // 设备转字符串开始
        sb.push(`<g id="${id}" `)

        if (edge.pid) {
            sb.push(`pid="${edge.pid}"`)
        }
        sb.push('>')

        let list = map.get('list')
        let vcount = map.size;

        let halfArc = arcLen / 2

        let addArcFun = (prePoint, list) => {
            let tmpSb = []
            let preVec = null
            for (let p of list) {
                let vnor = p.clone().sub(prePoint).normalize()
                let startP = vnor.clone().multiplyScalar(-halfArc).add(p)
                let endP = vnor.clone().multiplyScalar(halfArc).add(p)

                if (preVec) {
                    let len1 = startP.clone().sub(prePoint).length()
                    let len2 = preVec.clone().sub(prePoint).length()
                    if (len1 <= len2) {
                        continue
                    }
                }

                tmpSb.push(`L${startP.x + ',' + startP.y}`)
                tmpSb.push(`A${halfArc} ${halfArc} 180 0 1 ${endP.x} ${endP.y}`)

                preVec = endP.clone()
            }
            return tmpSb
        }

        if (vcount > 1)
        {
            sb.push('<path ')
            for (let i = 0; i < list.length; i++) {
                let item = list[i]

                if (i == 0) {
                    pathStrLs.push(`M${item.x + ',' + item.y}`)
                    let pls = map.get(i)

                    if (pls && pls.length > 0) {
                        let tmpSb = addArcFun(item, pls)
                        pathStrLs.push(...tmpSb)
                    }
                } else {
                    let pls = map.get(i)
                    if (pls && pls.length > 0) {
                        pathStrLs.push(`L${item.x + ',' + item.y}`)
                        let tmpSb = addArcFun(item, pls)
                        pathStrLs.push(...tmpSb)
                    } else {
                        pathStrLs.push(`L${item.x + ',' + item.y}`)
                    }
                }
            }
        }
        else
        {
            sb.push('<polyline')
        }



        sb.push('fill="none" ')

        if (cls) {
            sb.push(`class="${cls}" `)
        }

        if (strokeWidth) {
            sb.push(`stroke-width="${strokeWidth}" `)
        }

        if (strokeDasharray) {
            sb.push(`stroke-dasharray="${strokeDasharray}" `)
        }

        if (stroke) {
            sb.push(`stroke="${stroke}"`)
        }

        if (vcount > 1)
        {
            sb.push(`d="${pathStrLs.join(' ')}"/>`)
        }
        else
        {
            let tmpLs = list.map(v => v.x + ',' + v.y)
            sb.push(`points="${tmpLs.join(' ')}"/>`)
        }


        // 添加元数据
        sb.push(this.getMeta(id))
        sb.push('</g>')
        layer2ListMap[layerName].push(sb.join(' '))
    }
}

SvgGenerate.prototype.graphBounds = function (list) {
    let svgParser = this.svgParser
    let graph = this.graph
    let view = graph.getView()
    let model = graph.getModel()

    let vecList = []

    let cellBounds = (cell) => {
        // let styleObj = view.getState(cell)?.style;
        let state = view.getState(cell)
        let origin = state.origin

        let { x, y, width, height } = graph.getCellGeometry(cell) // model.getGeometry(cell)
        // let angle = styleObj?.rotation || 0;
        // let radian = mathutil.radian2Angle(angle);
        // let vecLt = new Vector2()

        let _x = origin.x
        let _y = origin.y

        let v1 = new Vector2(_x, _y)
        let v2 = new Vector2(_x + width, _y + height)
        return [v1, v2]
    }

    let edgeBounds = (edge) => {
        let state = view.getState(edge)
        let pointLs = []
        let absPointLs = state.absolutePoints // 这种方式可以减少计算量
        let scale = view.scale
        for (let p of absPointLs) {
            let x = p.x / scale - view.translate.x
            let y = p.y / scale - view.translate.y
            pointLs.push(new Vector2(x, y))
        }
        return pointLs
    }

    for (let cell of list) {
        if (model.isVertex(cell)) {
            vecList.push(...cellBounds(cell))
        } else {
            vecList.push(...edgeBounds(cell))
        }
    }
    let scale = svgParser.getScale()
    let { xmin, ymin, width, height } = mathutil.vecListBounds(vecList)
    xmin = xmin / scale
    ymin = ymin / scale
    width = width / scale
    height = height / scale
    return { xmin, ymin, width, height }
}

// 计算一条线上的所有交点
SvgGenerate.prototype.checkLineIntersect = function (map) {
    let keys = new Set()

    let keys2 = new Set();
    let params = new Map()

    /**
     * 检查相交点
     * @param tmpMap
     * @param segment     两点形成的线段
     * @param startIndex  起始点索引
     * @param startPoint  线段起点（起始点坐标）
     * @param curId       测试用
     */
    let checkIntersect = (tmpMap, segment, startIndex, startPoint, curId) => {
        let a1 = segment.p1
        let a2 = segment.p2

        let ls = []

        for (let [edge, list] of map) {
            if (keys.has(edge.id)) {
                continue
            }

            // let id1 = edge.id + curId
            // let id2 = curId + edge.id
            // if (keys2.has(id1) || keys2.has(id2)) {
            //     continue
            // }
            // keys2.add(id1)
            // keys2.add(id2)

            for (let i = 0; i < list.length - 1; i = i + 1) {
                let p1 = list[i]
                let p2 = list[i + 1]

                let b1 = p1
                let b2 = p2

                let intersection = mathutil.findSegmentIntersection(a1, a2, b1, b2)
                if (intersection) {
                    // 检查是开始点还是结束点
                    let len1 = mathutil.pixelLen(p1, intersection)
                    let len2 = mathutil.pixelLen(p2, intersection)

                    if (len1 > 0.001 && len2 > 0.001) {
                        ls.push(new Vector2(intersection.x, intersection.y))
                    }
                }
            }
        }

        if (ls.length > 0) {
            ls.sort((a, b) => {
                let len1 = mathutil.pixelLen(a, startPoint)
                let len2 = mathutil.pixelLen(b, startPoint)

                return len1 < len2 ? -1 : 1
            })

            tmpMap.set(startIndex, ls)
        }
    }

    for (let [edgeCell, list] of map) {
        keys.add(edgeCell.id)

        let tmpMap = new Map()
        tmpMap.set('list', list)

        for (let i = 0; i < list.length - 1; i++) {
            let p1 = list[i]
            let p2 = list[i + 1]
            let segment = { p1, p2 }

            checkIntersect(tmpMap, segment, i, p1, edgeCell.id)
        }

        params.set(edgeCell, tmpMap)
    }

    return params
}

/**
 * 母线基准电压：优先解析 dydj（如 10kV），默认 10（kV）
 */
SvgGenerate.prototype.parseVoltFromDydj = function (dydj) {
    if (dydj == null || dydj === '') {
        return 10
    }
    let s = String(dydj).trim()
    let mk = s.match(/(\d+(?:\.\d+)?)\s*k/i)
    if (mk) {
        return parseInt(mk[1], 10)
    }
    let digits = parseInt(s.replace(/[^\d]/g, ''), 10)
    if (!isNaN(digits) && digits > 0) {
        return digits
    }
    return 10
}

/**
 * 提交用母线唯一 ID：已持久化的 busid → CIM GlobeID → PD_0311 段 → 新增 UUID（无横线）
 */
SvgGenerate.prototype.resolveBusSubmitId = function (cell, pending) {
    let model = this.graph.getModel()
    let value = model.getValue(cell)
    if (mxUtils.isNode(value)) {
        let b = value.getAttribute('busid')
        if (b) {
            return String(b).replace(/-/g, '')
        }
    }
    let propMap = this.attrMap && this.attrMap.get(cell.id)
    let psr = propMap && propMap['cge:PSR_Ref']
    if (psr && psr.GlobeID) {
        return String(psr.GlobeID).replace(/-/g, '')
    }
    let cid = cell.id || ''
    let m = cid.match(/^PD_0311_(.+)$/i)
    if (m) {
        return m[1].replace(/-/g, '')
    }
    let newId =
        typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID().replace(/-/g, '')
            : 'bus' + Date.now().toString(36) + Math.random().toString(36).slice(2, 14)
    pending.push({ cell: cell, busid: newId })
    return newId
}

SvgGenerate.prototype.getBusNameForSubmit = function (cell) {
    let propMap = this.attrMap && this.attrMap.get(cell.id)
    let psr = propMap && propMap['cge:PSR_Ref']
    if (cell.name) {
        return String(cell.name)
    }
    if (psr && psr.ObjectName) {
        return String(psr.ObjectName)
    }
    let st = this.graph.view.getState(cell)
    if (st && st.style && st.style.name) {
        return String(st.style.name)
    }
    let model = this.graph.getModel()
    let value = model.getValue(cell)
    if (mxUtils.isNode(value) && value.getAttribute('name')) {
        return value.getAttribute('name')
    }
    return ''
}

SvgGenerate.prototype.getDydjFromCell = function (cell) {
    let model = this.graph.getModel()
    let value = model.getValue(cell)
    if (mxUtils.isNode(value)) {
        let d = value.getAttribute('dydj')
        if (d != null && d !== '') {
            return d
        }
    }
    if (cell.dydj != null && cell.dydj !== '') {
        return cell.dydj
    }
    let st = this.graph.view.getState(cell)
    if (st && st.style && st.style.dydj != null) {
        return st.style.dydj
    }
    return ''
}

SvgGenerate.prototype.getBusEndpointPairForSubmit = function (busCell) {
    if (!busCell) {
        return ['', '']
    }
    let bid = this.pickCellAttr(busCell, 'busid')
    bid = bid ? String(bid).replace(/-/g, '') : ''
    if (!bid) {
        let propMap = this.attrMap && this.attrMap.get(busCell.id)
        let psr = propMap && propMap['cge:PSR_Ref']
        if (psr && psr.GlobeID) {
            bid = String(psr.GlobeID).replace(/-/g, '')
        }
    }
    if (!bid) {
        let m = String(busCell.id || '').match(/^PD_0311_(.+)$/i)
        bid = m ? m[1].replace(/-/g, '') : String(busCell.id || '').replace(/-/g, '')
    }
    return [bid, this.getBusNameForSubmit(busCell)]
}

/**
 * 保存接口 add.bus：仅「新增」母线（侧栏拖入等），不含 SVG 导入时已存在的母线。
 * 判定：导入解析时写入 svgParser.attrMap 的为旧数据；无 attrMap 记录的为新数据。
 */
SvgGenerate.prototype.collectBusSubmitPayload = function () {
    let graph = this.graph
    let model = graph.getModel()
    let view = graph.getView()
    let list = graph.getVerticesAndEdges()
    let bus = []
    let pending = []
    let attrMap = this.attrMap

    for (let i = 0; i < list.length; i++) {
        let cell = list[i]
        if (!model.isVertex(cell)) {
            continue
        }
        if (!DeviceCategoryUtil.isBusCell(cell)) {
            continue
        }
        if (
            cell.flag == 'range' ||
            cell.flag == 'pointline' ||
            cell.flag == 'virtualCell' ||
            cell.flag == 'virtualLine'
        ) {
            continue
        }

        // 导入图元已在 attrMap 中登记，不进入「新增」提交列表
        if (attrMap && attrMap.has(cell.id)) {
            continue
        }

        let busid = this.resolveBusSubmitId(cell, pending)
        let name = this.getBusNameForSubmit(cell)
        let dydj = this.getDydjFromCell(cell)
        let volt = this.parseVoltFromDydj(dydj)

        let stationCell = this.getLeftmostStationForBusSubmit(cell)
        let sid = ''
        let sname = ''
        if (stationCell) {
            sid = stationCell.id || ''
            sname = stationCell.name ? String(stationCell.name) : ''
            if (!sname) {
                let sst = view.getState(stationCell)
                if (sst && sst.style && sst.style.name) {
                    sname = String(sst.style.name)
                }
            }
        }

        bus.push({
            name: name,
            busid: busid,
            volt: String(volt),
            station: [sid, sname]
        })
    }

    // 收集母线连接线数据
    let line = this.collectBusConnectorSubmitPayload(pending)

    let transformer = this.collectTransformerSubmitPayload(pending)
    let gen = this.collectGenSubmitPayload(pending)
    let load = this.collectLoadSubmitPayload(pending)

    return { bus: bus, line: line, transformer: transformer, gen: gen, load: load, pending: pending }
}

/**
 * 收集母线连接线提交数据
 * @param {Array} pending 回写 cell 的 AClineid 等
 * @returns {Array} 母线连接线数据列表
 */
SvgGenerate.prototype.collectBusConnectorSubmitPayload = function (pending) {
    let graph = this.graph
    let model = graph.getModel()
    let view = graph.getView()
    let list = graph.getVerticesAndEdges()
    let line = []
    let attrMap = this.attrMap

    for (let i = 0; i < list.length; i++) {
        let cell = list[i]
        // 只处理边（连接线）
        if (!model.isEdge(cell)) {
            continue
        }
        
        // 获取源终端和目标终端
        let sourceCell = model.getTerminal(cell, true)
        let targetCell = model.getTerminal(cell, false)
        
        // 检查是否为母线连接线（两端都是母线）
        let isSourceBusbar = false
        let isTargetBusbar = false
        
        if (sourceCell) {
            let sourceCellStyle = graph.getCurrentCellStyle(sourceCell) || {}
            let sourcePsrtype = sourceCell['psrtype'] || sourceCellStyle['psrtype'] || ''
            isSourceBusbar = sourceCell.symbol == 'busbar' || sourcePsrtype == '0311' || sourceCellStyle['flag'] == 'busbar'
        }
        
        if (targetCell) {
            let targetCellStyle = graph.getCurrentCellStyle(targetCell) || {}
            let targetPsrtype = targetCell['psrtype'] || targetCellStyle['psrtype'] || ''
            isTargetBusbar = targetCell.symbol == 'busbar' || targetPsrtype == '0311' || targetCellStyle['flag'] == 'busbar'
        }
        
        // 不是母线连接线，跳过
        if (!isSourceBusbar || !isTargetBusbar) {
            continue
        }
        
        // 导入图元已在 attrMap 中登记，不进入「新增」提交列表
        if (attrMap && attrMap.has(cell.id)) {
            continue
        }
        
        // 获取连接线样式
        let cellStyle = graph.getCurrentCellStyle(cell) || {}
        let valueNode = model.getValue(cell)
        let pickConn = function (key) {
            let v = cell[key]
            if (v != null && v !== '') {
                return String(v)
            }
            if (cellStyle[key] != null && cellStyle[key] !== '') {
                return String(cellStyle[key])
            }
            if (mxUtils.isNode(valueNode)) {
                let a = valueNode.getAttribute(key)
                if (a != null && a !== '') {
                    return a
                }
            }
            return ''
        }
        
        // 线路唯一 ID：已写入 cell 的 AClineid 则复用，否则生成 UUID（无横线）并加入 pending 回写
        let rawAid = pickConn('AClineid').replace(/-/g, '')
        let AClineid = rawAid
        if (!AClineid) {
            AClineid = this.generateUuid().replace(/-/g, '')
            if (pending) {
                pending.push({ cell: cell, attrs: { AClineid: AClineid } })
            }
        }

        // 获取线路名称及电气参数（与编辑框一致：cell / 样式 / XML）
        let name = pickConn('name')

        // 获取电压等级（从母线获取）
        let voltNum = 10
        if (sourceCell) {
            let dydj = this.getDydjFromCell(sourceCell)
            voltNum = this.parseVoltFromDydj(dydj) || voltNum
        }

        let fromPair = this.getBusEndpointPairForSubmit(sourceCell)
        let toPair = this.getBusEndpointPairForSubmit(targetCell)

        // 获取线路型号和参数
        let modelValue = pickConn('model')
        let modelParasStr = pickConn('model_paras')
        let model_paras = modelParasStr ? this.parseModelParas(modelParasStr) : [0.08, 0.417, 0, 0]

        // 获取额定载流量（kA，字符串）
        let IhStr = pickConn('Ih')
        let IhNum = IhStr !== '' ? parseFloat(IhStr) : 4.0
        if (isNaN(IhNum)) {
            IhNum = 4.0
        }

        // 获取线路长度 [数值字符串, km]
        let lengthValue = pickConn('length') || '100'
        let lenNum = parseFloat(lengthValue)
        if (isNaN(lenNum)) {
            lenNum = 100
        }
        let length = [String(lenNum), 'km']

        line.push({
            name: String(name),
            AClineid: AClineid,
            volt: String(voltNum),
            from_bus: [fromPair[0], String(fromPair[1])],
            to_bus: [toPair[0], String(toPair[1])],
            model: String(modelValue),
            model_paras: model_paras,
            Ih: String(IhNum),
            length: length
        })
    }
    
    return line
}

/**
 * 生成UUID
 * @returns {string} UUID字符串
 */
SvgGenerate.prototype.generateUuid = function () {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8)
        return v.toString(16)
    })
}

/**
 * 解析线路型号参数
 * @param {string} modelParasStr 型号参数字符串
 * @returns {Array} 参数数组
 */
SvgGenerate.prototype.parseModelParas = function (modelParasStr) {
    if (!modelParasStr) {
        return [0.08, 0.417, 0, 0]
    }
    try {
        // 尝试解析为JSON数组
        if (modelParasStr.startsWith('[') && modelParasStr.endsWith(']')) {
            return JSON.parse(modelParasStr)
        }
        // 尝试按逗号分隔
        let parts = modelParasStr.split(',').map(p => parseFloat(p.trim()))
        if (parts.length === 4 && parts.every(p => !isNaN(p))) {
            return parts
        }
    } catch (e) {
        console.warn('解析线路型号参数失败:', e)
    }
    return [0.08, 0.417, 0, 0]
}

/**
 * 新增：发电机组（侧栏拖入，attrMap 中无记录）
 */
SvgGenerate.prototype.collectGenSubmitPayload = function (pending) {
    let graph = this.graph
    let model = graph.getModel()
    let list = graph.getVerticesAndEdges()
    let attrMap = this.attrMap
    let out = []
    for (let i = 0; i < list.length; i++) {
        let cell = list[i]
        if (!model.isVertex(cell)) {
            continue
        }
        if (attrMap && attrMap.has(cell.id)) {
            continue
        }
        if (
            cell.flag == 'range' ||
            cell.flag == 'pointline' ||
            cell.flag == 'virtualCell' ||
            cell.flag == 'virtualLine'
        ) {
            continue
        }
        let st = graph.view.getState(cell)
        let style = st ? st.style : {}
        let shape = ((style.shape || cell.symbol || '') + '').toLowerCase()
        if (shape !== 'generatingunit') {
            continue
        }
        let uid = this.pickCellAttr(cell, 'unitid').replace(/-/g, '')
        if (!uid) {
            uid = this.generateUuid().replace(/-/g, '')
            if (pending) {
                pending.push({ cell: cell, attrs: { unitid: uid } })
            }
        }
        let buses = this.getBusesAdjacentToVertex(cell)
        let busPair = buses[0] || ['', '']
        out.push({
            name:
                this.pickCellAttr(cell, 'name') ||
                (cell.name != null && cell.name !== '' ? String(cell.name) : ''),
            unitid: uid,
            type: this.pickCellAttr(cell, 'type'),
            V_Rate: this.pickCellAttr(cell, 'V_Rate'),
            bus: [busPair[0], busPair[1]],
            P_Rate: this.pickCellAttr(cell, 'P_Rate'),
            P_max: this.pickCellAttr(cell, 'P_max'),
            P_min: this.pickCellAttr(cell, 'P_min'),
            Q_max: this.pickCellAttr(cell, 'Q_max'),
            Q_min: this.pickCellAttr(cell, 'Q_min'),
            P_meas: this.pickCellAttr(cell, 'P_meas'),
        })
    }
    return out
}

/**
 * 新增：负荷（配电站 substation / 箱式变 xb）
 */
SvgGenerate.prototype.collectLoadSubmitPayload = function (pending) {
    let graph = this.graph
    let model = graph.getModel()
    let list = graph.getVerticesAndEdges()
    let attrMap = this.attrMap
    let out = []
    for (let i = 0; i < list.length; i++) {
        let cell = list[i]
        if (!model.isVertex(cell)) {
            continue
        }
        if (attrMap && attrMap.has(cell.id)) {
            continue
        }
        if (
            cell.flag == 'range' ||
            cell.flag == 'pointline' ||
            cell.flag == 'virtualCell' ||
            cell.flag == 'virtualLine'
        ) {
            continue
        }
        let st = graph.view.getState(cell)
        let style = st ? st.style : {}
        let shape = ((style.shape || cell.symbol || '') + '').toLowerCase()
        if (shape !== 'substation' && shape !== 'xb' && shape !== 'ptuser') {
            continue
        }
        let lid = this.pickCellAttr(cell, 'loadid').replace(/-/g, '')
        if (!lid) {
            lid = this.generateUuid().replace(/-/g, '')
            if (pending) {
                pending.push({ cell: cell, attrs: { loadid: lid } })
            }
        }
        let buses = this.getBusesAdjacentToVertex(cell)
        let busPair = buses[0] || ['', '']
        let volt = this.pickCellAttr(cell, 'volt')
        if (!volt && busPair[0]) {
            let bcell = null
            for (let j = 0; j < list.length; j++) {
                if (model.isVertex(list[j]) && DeviceCategoryUtil.isBusCell(list[j])) {
                    let bp = this.getBusEndpointPairForSubmit(list[j])
                    if (bp[0] === busPair[0]) {
                        bcell = list[j]
                        break
                    }
                }
            }
            if (bcell) {
                let dydj = this.getDydjFromCell(bcell)
                volt = String(this.parseVoltFromDydj(dydj))
            }
        }
        out.push({
            name: this.pickCellAttr(cell, 'name') || '',
            loadid: lid,
            volt: volt,
            bus: [busPair[0], busPair[1]],
            P: this.pickCellAttr(cell, 'P'),
            Q: this.pickCellAttr(cell, 'Q'),
        })
    }
    return out
}

/**
 * 新增：电压互感器双绕组/三绕组（力光侧栏）
 */
SvgGenerate.prototype.collectTransformerSubmitPayload = function (pending) {
    let graph = this.graph
    let model = graph.getModel()
    let list = graph.getVerticesAndEdges()
    let attrMap = this.attrMap
    let out = []
    for (let i = 0; i < list.length; i++) {
        let cell = list[i]
        if (!model.isVertex(cell)) {
            continue
        }
        if (attrMap && attrMap.has(cell.id)) {
            continue
        }
        if (
            cell.flag == 'range' ||
            cell.flag == 'pointline' ||
            cell.flag == 'virtualCell' ||
            cell.flag == 'virtualLine'
        ) {
            continue
        }
        let st = graph.view.getState(cell)
        let style = st ? st.style : {}
        let shape = ((style.shape || cell.symbol || '') + '').toLowerCase()
        let is3w =
            shape === 'potentialtransformer3w' || shape.indexOf('potentialtransformer3w_') === 0
        let is2w =
            shape === 'potentialtransformer2w' || shape.indexOf('potentialtransformer2w_') === 0
        if (!is2w && !is3w) {
            continue
        }
        let tid = this.pickCellAttr(cell, 'transformerid').replace(/-/g, '')
        if (!tid) {
            tid = this.generateUuid().replace(/-/g, '')
            if (pending) {
                pending.push({ cell: cell, attrs: { transformerid: tid } })
            }
        }
        let buses = this.getBusesAdjacentToVertex(cell)
        let hv = buses[0] || ['', '']
        let mv = is3w ? buses[1] || ['', ''] : ['', '']
        let lv = is3w ? buses[2] || ['', ''] : buses[1] || ['', '']
        if (is2w && buses[1]) {
            lv = buses[1]
        }
        let hvP = this.parseBracketNumberArray(this.pickCellAttr(cell, 'hv_paras'))
        let mvP = this.parseBracketNumberArray(this.pickCellAttr(cell, 'mv_paras'))
        let lvP = this.parseBracketNumberArray(this.pickCellAttr(cell, 'lv_paras'))
        if (is2w) {
            let base = hvP.length ? hvP : mvP.length ? mvP : lvP
            if (base.length) {
                hvP = base.slice()
                mvP = base.slice()
                lvP = base.slice()
            }
        }
        out.push({
            name: this.pickCellAttr(cell, 'name') || '',
            transformerid: tid,
            type: is3w ? 3 : 2,
            hv_bus: [hv[0], String(hv[1])],
            mv_bus: [mv[0], String(mv[1])],
            lv_bus: [lv[0], String(lv[1])],
            I_Vol: this.pickCellAttr(cell, 'I_Vol'),
            K_Vol: is2w ? '0' : this.pickCellAttr(cell, 'K_Vol'),
            J_Vol: this.pickCellAttr(cell, 'J_Vol'),
            model: this.pickCellAttr(cell, 'model'),
            hv_paras: hvP,
            mv_paras: mvP,
            lv_paras: lvP,
            I_S: this.pickCellAttr(cell, 'I_S'),
            K_S: is2w ? '' : this.pickCellAttr(cell, 'K_S'),
            J_S: this.pickCellAttr(cell, 'J_S'),
        })
    }
    return out
}

/**
 * 删除：相对 parseSvg 完成时的导入快照，图中已不存在的图元。
 */
SvgGenerate.prototype.collectDeleteSubmitPayload = function () {
    let empty = {
        bus: [],
        line: [],
        transformer: [],
        gen: [],
        load: [],
    }
    let snap = this.svgParser && this.svgParser.importedDeviceSnapshot
    if (!snap || snap.length === 0) {
        return empty
    }
    let graph = this.graph
    let model = graph.getModel()
    let cur = new Set()
    let all = graph.getVerticesAndEdges()
    for (let i = 0; i < all.length; i++) {
        cur.add(all[i].id)
    }
    let del = {
        bus: [],
        line: [],
        transformer: [],
        gen: [],
        load: [],
    }
    for (let si = 0; si < snap.length; si++) {
        let rec = snap[si]
        if (cur.has(rec.graphId)) {
            continue
        }
        if (rec.category === 'bus') {
            del.bus.push({ name: rec.name || '', busid: rec.busid || '' })
        } else if (rec.category === 'line') {
            del.line.push({ name: rec.name || '', AClineid: rec.AClineid || '' })
        } else if (rec.category === 'transformer') {
            del.transformer.push({ name: rec.name || '', transformerid: rec.transformerid || '' })
        } else if (rec.category === 'gen') {
            del.gen.push({ name: rec.name || '', unitid: rec.unitid || '' })
        } else if (rec.category === 'load') {
            del.load.push({ name: rec.name || '', loadid: rec.loadid || '' })
        }
    }
    return del
}

SvgGenerate.prototype.applyPendingBusIds = function (pending) {
    if (!pending || pending.length === 0) {
        return
    }
    let graph = this.graph
    let model = graph.getModel()
    model.beginUpdate()
    try {
        for (let i = 0; i < pending.length; i++) {
            let item = pending[i]
            if (!item || item.busid == null || item.busid === '') {
                continue
            }
            let cell = item.cell
            let busid = item.busid
            let value = model.getValue(cell)
            let obj
            if (!mxUtils.isNode(value)) {
                let doc = mxUtils.createXmlDocument()
                obj = doc.createElement('object')
                obj.setAttribute('label', value || '')
            } else {
                obj = value.cloneNode(true)
            }
            obj.setAttribute('busid', busid)
            model.setValue(cell, obj)
            cell.busid = busid
        }
    } finally {
        model.endUpdate()
    }
}

// 解析drawio数据
SvgGenerate.prototype.parseGraph = function ()
{
    let cellMap = this.cellMap
    let buffer = this.buffer
    let svgTxtObj = this.svgTxtObj
    let layer2ListMap = this.layer2ListMap
    let graph = this.graph
    let view = graph.getView()
    let svgParser = this.svgParser

    this.attrMap = svgParser.attrMap
    this.metaMap = svgParser.getMetaMap()

    graph.refresh()
    let model = graph.getModel()
    let list = graph.getVerticesAndEdges() // 非mxGraph方法，由drawio实现

    let { xmin, ymin, width, height } = this.graphBounds(list)

    let cx = xmin + width / 2
    let cy = ymin + height / 2

    let ratio = 420 / 297

    let minDistance = Math.min(width, height)
    let space = 200
    space = minDistance * 0.03

    let ltx = xmin - space
    let lty = ymin - space

    let rbx = xmin + width + space
    let rby = ymin + height + space

    // 扩展后宽高
    let widthExpand = rbx - ltx
    let heightExpand = rby - lty

    let tmpH = widthExpand / ratio

    let width_print = widthExpand,
        height_print = tmpH

    if (tmpH < heightExpand) {
        height_print = heightExpand
        width_print = heightExpand * ratio
    }

    let w = width_print + space
    let h = height_print + space

    ltx = cx - w / 2
    lty = cy - h / 2

    let tranx = -ltx
    let trany = -lty

    // 左上
    let ltx_print = cx - width_print / 2 + tranx
    let lty_print = cy - height_print / 2 + trany

    // 右下
    let rbx_print = ltx_print + width_print
    let rby_print = lty_print + height_print

    let printPoints = [
        ltx_print + ',' + lty_print, // 左上
        rbx_print + ',' + lty_print, // 右上
        rbx_print + ',' + rby_print, // 右下
        ltx_print + ',' + rby_print, // 左下
        ltx_print + ',' + lty_print
    ]

    buffer.push(svgTxtObj['xmlDec'])
    buffer.push(
        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:cge="http://iec.ch/TC57/2005/SVG-schema#" xmlns:xlink="http://www.w3.org/1999/xlink" '
    )
    buffer.push(
        `width="${w}" height="${h}" coordinateExtent="0 0 ${w} ${h}" viewBox="0 0 ${w} ${h}" `
    )
    buffer.push('preserveAspectRatio="xMidYMid">')

    let defsStr = svgTxtObj['defsContent']
    buffer.push(defsStr)

    // 加背景
    buffer.push(`<g id="BackGround_Layer">`)
    buffer.push(`<rect fill="rgb(0,0,0)" x="${0}" y="${0}" width="${w}" height="${h}"/>`)
    buffer.push('</g>')

    let txtCellList = []

    let edge2Points = new Map();
    let minWidth = Number.MAX_VALUE;
    let maxWidth = Number.MIN_VALUE;

    for (let cell of list) {
        if (
            cell.flag == 'range' ||
            cell.flag == 'pointline' ||
            cell.flag == 'virtualCell' ||
            cell.flag == 'virtualLine'
        ) {
            continue
        }

        if (model.isVertex(cell)) {
            if (DeviceCategoryUtil.isTextCell(cell)) {
                txtCellList.push(cell)
            } else {
                cellMap.set(cell.id, cell)
                if (cell.flag == 'custom') {
                    this.parseCustomCell(cell, tranx, trany);
                } else if (cell.flag == 'busbar' || DeviceCategoryUtil.isBusCell(cell)) {
                    // 母线图元特殊处理
                    this.parseBusbar(cell, tranx, trany);
                } else {
                    let tmpWidth = this.parseCell(cell, tranx, trany)
                    if (tmpWidth && tmpWidth != -1) {
                        minWidth = Math.min(tmpWidth, minWidth)
                        maxWidth = Math.max(tmpWidth, maxWidth)
                    }
                }
            }
        } else {
            let state = view.getState(cell)
            let flag = state.style?.flag
            if (flag == 'pointline') {
                // 不绘制测点连接线
                continue
            }
            this.parseEdge(cell, tranx, trany)
            // let pointList = this.getEdgePoints(cell, tranx, trany);
            // edge2Points.set(cell, pointList);
        }
    }

    // 寻找相交的线
    // let intersectMap = this.checkLineIntersect(edge2Points);
    // this.arcLen = (minWidth + maxWidth) / 2 / 2; // 计算最合适的圆弧半径
    // this.parseEdges(intersectMap);

    for (let cell of txtCellList) {
        this.parseText(cell, tranx, trany)
    }

    // let otherLayerList = layer2ListMap['Other_Layer'];
    // if (!otherLayerList) {
    //     otherLayerList = layer2ListMap['Other_Layer'] = [];
    // }

    // otherLayerList.push(`
    // <g id="PD_100430000_${new Date().getTime()}">
    //     <polygon points="${printPoints.join(' ')}" stroke-width="0.6" stroke="#008000" fill="none" class="a3line"/>
    //     <metadata>
    //         <cge:PSR_Ref PSRType="100430000" LineType="Trunk"/>
    //         <cge:Layer_Ref ObjectName="Other_Layer"/>
    //     </metadata>
    // </g>
    // `)

    let lineLayerList = ['Other_Layer', 'ConnLine_Layer', 'ACLineSegment_Layer']
    for (let layerName of lineLayerList) {
        let list = layer2ListMap[layerName]
        buffer.push(`<g id="${layerName}">`)
        if (layerName == 'Other_Layer') {
            buffer.push(`
            <g id="PD_100430000_${new Date().getTime()}">
                <polygon points="${printPoints.join(' ')}" stroke-width="0.6" stroke="#008000" fill="none" class="a3line"/>
                <metadata>
                    <cge:PSR_Ref PSRType="100430000" LineType="Trunk"/>
                    <cge:Layer_Ref ObjectName="Other_Layer"/>
                </metadata>
            </g>
            `)
        }
        if (list) {
            buffer.push(list.join(''))
        }

        buffer.push('</g>')
    }

    // 最后三层的顺序为
    let lastList = ['Substation_Layer', 'Text_Layer', 'Hot_Layer']

    for (let layerName in layer2ListMap) {
        if (lineLayerList.includes(layerName) || lastList.includes(layerName)) {
            continue
        }

        let list = layer2ListMap[layerName]
        if (list) {
            buffer.push(`<g id="${layerName}">`)
            buffer.push(list.join(''))
            buffer.push('</g>')
        }
    }

    for (let layerName of lastList) {
        let list = layer2ListMap[layerName]
        if (list) {
            buffer.push(`<g id="${layerName}">`)
            buffer.push(list.join(''))
            buffer.push('</g>')
        }
    }

    buffer.push('</svg>')

    let svgStr = buffer.join('')
    let busPayload = this.collectBusSubmitPayload()
    let deletePayload = this.collectDeleteSubmitPayload()
    this.applyPendingBusIds(busPayload.pending)
    this.applyPendingSubmitAttrs(busPayload.pending)

    let addPayload = {
        bus: busPayload.bus,
        line: busPayload.line || [],
        transformer: busPayload.transformer || [],
        gen: busPayload.gen || [],
        load: busPayload.load || [],
    }

    return {
        dkxid: svgParser.id,
        svg: svgStr,
        txt: '',
        svg_file: svgStr,
        cime_file: '',
        add: addPayload,
        delete: deletePayload,
        deviceSubmit: {
            svg_file: '',
            cime_file: '',
            add: addPayload,
            delete: deletePayload,
        },
    }
}