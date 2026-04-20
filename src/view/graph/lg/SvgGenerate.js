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

SvgGenerate.prototype.parseSubstation = function (cell, tranx, trany) {
    let graph = this.graph;
    let view = graph.getView();
    let model = graph.getModel();
    let attrMap = this.attrMap;
    let svgParser = this.svgParser;

    let scale = svgParser.getScale();

    let propMap = attrMap.get(cell.id);
    let layer2ListMap = this.layer2ListMap;

    let cls = propMap['cls'];
    let stroke = propMap['stroke'];
    let strokeWidth = propMap['strokeWidth'];

    // 根据设备所属图层来归类
    let layerName = propMap['cge:Layer_Ref'] && propMap['cge:Layer_Ref']['ObjectName'];
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

    let propMap = attrMap.get(cell.id);
    let layer2ListMap = this.layer2ListMap;

    let scale = svgParser.getScale();

    // 根据设备所属图层来归类
    let layerName = propMap['cge:Layer_Ref'] && propMap['cge:Layer_Ref']['ObjectName'];
    if (!layer2ListMap[layerName]) {
        layer2ListMap[layerName] = [];
    }

    let preStrokeWidth = propMap && propMap['strokeWidth'];

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

        if (stroke) {
            sb.push(`stroke="${stroke}" ` )
        }

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

    let propMap = attrMap.get(cell.id) || {}
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
        // 根据设备所属图层来归类
        let layerName = propMap['cge:Layer_Ref'] && propMap['cge:Layer_Ref']['ObjectName']
        if (!layer2ListMap[layerName]) {
            layer2ListMap[layerName] = []
        }
        id = cell.id
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

            let { initWidth, initHeight, xratio, yratio, w, h } = symbolMap[shape]
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

            sb.push(`xlink:href="#${cell.symbolId}" `)
            let cx = v.x
            let cy = v.y
            let scale = width / initWidth

            let symbol = cell.symbol
            let symbolAttr = symbolMap[symbol]

            let stepx = cx + symbolAttr.xmin + initWidth * xratio
            let stepy = cy + symbolAttr.ymin + initHeight * yratio

            sb.push(`x="${cx}" y="${cy}" `)
            sb.push(`w="${initWidth}" h="${initHeight}" `)
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

    let propMap = attrMap.get(cell.id) || {};
    let layer2ListMap = this.layer2ListMap;

    let styleObj = graph.getCurrentCellStyle(cell);
    let {id, shape, rotation} = styleObj;  // shape -> powertransformer_pms25_11000000_2030020

    // 根据设备所属图层来归类
    let layerName = 'customLayer';
    if (!layer2ListMap[layerName]) {
        layer2ListMap[layerName] = [];
    }
    id = cell.id;
    let sb = [];

    // 设备转字符串开始
    sb.push(`<g id="${id}">`);
    // 添加设备数据
    {
        sb.push('<use ');

        let state = view.getState(cell);

        let {initWidth, initHeight, xratio, yratio} = symbolMap[shape];
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

        sb.push(`xlink:href="#${cell.symbolId}" `);
        let cx = v.x;
        let cy = v.y;
        let scale = width / initWidth;

        let symbol = cell.symbol;
        let symbolAttr = symbolMap[symbol];

        let stepx = cx + symbolAttr.xmin + initWidth * xratio;
        let stepy = cy + symbolAttr.ymin + initHeight * yratio;

        sb.push(`x="${cx}" y="${cy}" `);
        sb.push(`w="${initWidth}" h="${initHeight}" `);
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
    let propMap = attrMap.get(edge.id) || {}

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
        if (strokeWidth) {
            sb.push(`stroke-width="${strokeWidth}" `)
        }
        if (strokeDasharray) {
            sb.push(`stroke-dasharray="${strokeDasharray}" `)
        }
        if (stroke) {
            sb.push(`stroke="${stroke}"`)
        }
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

        let propMap = attrMap.get(edge.id) || {}

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
                    // this.parseCustomCell(cell, tranx, trany);
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
    return {
        dkxid: svgParser.id,
        svg: buffer.join(''),
        txt: ''
    }
}