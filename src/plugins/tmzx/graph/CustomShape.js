import mathutil from "../mathutil.js";
import PathParser from "./PathParser.js";

let rgbReg = /rgb\(([^)]+)\)/i;

// 中心点比率，这个用于力光的图
let ratioMap = {
    compositeswitch: {xratio: .5, yratio: .885} ,
}


export default class CustomShape extends Konva.Shape {
    constructor(config, symbol, symbolMap, flag) {
        super(config);
        this.symbol = symbol;
        this.symbolMap = symbolMap;
        this.flag = flag;
        this.className = 'CustomShape'; // 必须指定类名，用于反序列化识别
    }

    isColor(color) {
        let flag = color && color != 'none'
        return flag;
    }

    /**
     * 重设rgb透明度
     * @param rgb
     * @param opacity
     */
    opaciyRgb(rgb, opacity) {
        let test = rgbReg.exec(rgb)
        if (test) {
            let tmp = test[1];
            return 'rgba(' + tmp + ',.6)';
        }
        return rgb;
    }

    use(ctx, shape, scale, matrix) {
        let symbolMap = this.symbolMap
        let terminalShape = symbolMap.get('terminal');

        // 获取到terminal图元
        let symbolShape = terminalShape.dom.shapes[0]

        ctx.beginPath();
        let highlightAttr = this.highlightAttr;
        let stroke = symbolShape.penColor;

        let strokeWidth = shape.penWidth;

        let centerPoint = shape.centerPoint;

        let cx = centerPoint[0];
        let cy = centerPoint[1];
        // let r = +dom.getAttribute('r');

        let _r = terminalShape.initWidth / 2 * scale;

        let p = new Vector2(cx, cy);
        let vec = p.clone().applyMatrix3(matrix);
        let _cx = vec.x;
        let _cy = vec.y;

        ctx.lineWidth = this.getScaledStrokeWidth();

        if (highlightAttr && highlightAttr['stroke']) {
            stroke = highlightAttr.stroke;
        }

        ctx.strokeStyle = stroke
        //ctx.fillStyle = '#2ad8ff';
        // arc(x, y, r, sAngle, eAngle，counterclockwise)
        // 圆心X坐标、Y坐标、半径、开始角度、结束角度、绘制方向(true:顺时针，flase:逆时针)
        ctx.arc(_cx, _cy, _r, 0, 360)

        ctx.closePath();

        // ctx.fill();
        ctx.stroke()
    }

    line(ctx, shape, matrix) {
        let highlightAttr = this.highlightAttr;

        ctx.beginPath();

        // 自带样式
        let stroke = shape.penColor;
        let strokeWidth = shape.penWidth;

        let p1 = shape.startPoint;
        let p2 = shape.endPoint;

        let v1 = new Vector2(p1[0], p1[1]);
        let v11 = v1.clone().applyMatrix3(matrix);

        let v2 = new Vector2(p2[0], p2[1]);
        let v22 = v2.clone().applyMatrix3(matrix);

        let _x1 = v11.x;
        let _y1 = v11.y;

        let _x2 = v22.x;
        let _y2 = v22.y;

        let stroke_cls = this.stroke();


        if (highlightAttr && highlightAttr['stroke']) {
            stroke = highlightAttr.stroke;
        } else if (stroke_cls) {
            stroke = stroke_cls
        }

        ctx.lineWidth = this.getScaledStrokeWidth();
        // ctx.strokeStyle = this.stroke();

        ctx.strokeStyle = stroke;
        // ctx.strokeStyle = 'green';

        ctx.moveTo(_x1, _y1);
        ctx.lineTo(_x2, _y2);

        ctx.stroke();
    }

    polyline(ctx, shape, matrix) {
        let highlightAttr = this.highlightAttr;

        ctx.beginPath();

        let stroke = shape.penColor;
        // let strokeWidth = shape.penWidth;
        let fill = shape.backgroundColor;

        let points = shape.points;

        ctx.lineWidth = this.getScaledStrokeWidth();

        for (let i = 0; i < points.length; i++) {
            let arr = points[i];

            let v1 = new Vector2(arr[0], arr[1]);
            let v = v1.clone().applyMatrix3(matrix);

            if (i == 0) {
                ctx.moveTo(v.x, v.y);
            } else {
                ctx.lineTo(v.x, v.y);
            }
        }

        if (this.isColor(stroke)) // 有描边
        {
            let stroke_cls = this.stroke();
            if (highlightAttr && highlightAttr['stroke']) {
                stroke = highlightAttr.stroke;
            } else if (this.isColor(stroke_cls)) {
                stroke = stroke_cls;
            }

            // ctx.strokeStyle = this.stroke();
            ctx.strokeStyle = stroke;
            // ctx.strokeStyle = 'yellow';
            ctx.stroke();
        }


        if (this.isColor(fill)) // 有填充色
        {
            let fill_cls = this.fill();
            // ctx.fillStyle = this.fill();

            if (highlightAttr && highlightAttr['fill']) {
                fill = highlightAttr.fill;
            } else if (this.isColor(fill_cls)) {
                fill = fill_cls;
            }

            ctx.fillStyle = fill;
            ctx.fill();
        }
    }

    circle(ctx, shape, scale, matrix) {
        let highlightAttr = this.highlightAttr;
        ctx.beginPath();

        let stroke = shape.penColor;
        let strokeWidth = shape.penWidth;
        let fill = shape.backgroundColor;

        let [cx, cy] = shape.centerPoint
        let r = shape.radius

        // fill = this.opaciyRgb(fill);

        let _r = r * scale;

        let p = new Vector2(cx, cy);
        let vec = p.clone().applyMatrix3(matrix);
        let _cx = vec.x;
        let _cy = vec.y;

        ctx.lineWidth = this.getScaledStrokeWidth();

        // arc(x, y, r, sAngle, eAngle，counterclockwise)
        // 圆心X坐标、Y坐标、半径、开始角度、结束角度、绘制方向(true:顺时针，flase:逆时针)
        ctx.arc(_cx, _cy, _r, 0, 360)
        ctx.closePath();

        if (this.isColor(stroke)) {
            let stroke_cls = this.stroke()
            if (highlightAttr && highlightAttr['stroke']) {
                stroke = highlightAttr.stroke;
            } else if (this.isColor(stroke_cls)) {
                stroke = stroke_cls
            }
            // ctx.strokeStyle = this.stroke();
            ctx.strokeStyle = stroke;
            ctx.stroke();
        }

        if (this.isColor(fill)) {
            let fill_cls = this.fill()

            if (highlightAttr && highlightAttr['fill']) {
                fill = highlightAttr.fill;
            } else if (this.isColor(fill_cls)) {
                fill = fill_cls;
            }
            // ctx.fillStyle = this.fill();
            ctx.fillStyle = fill;
            ctx.fill();
        }
    }

    // 目前没有用到这个
    ellipse(ctx, dom, scale, matrix) {
        let highlightAttr = this.highlightAttr;
        let fill = dom.getAttribute('fill');
        let stroke = dom.getAttribute('stroke');

        let cx = +dom.getAttribute('cx');
        let cy = +dom.getAttribute('cy');
        let rx = +dom.getAttribute('rx');
        let ry = +dom.getAttribute('ry');

        let _rx = rx * scale;
        let _ry = ry * scale;

        let p = new Vector2(cx, cy);
        let vec = p.clone().applyMatrix3(matrix);
        let _cx = vec.x;
        let _cy = vec.y;

        ctx.lineWidth = this.getScaledStrokeWidth();

        ctx.ellipse(_cx, _cy, _rx, _ry, 0, 0, Math.PI * 2);

        if (stroke && stroke != 'none') {
            if (highlightAttr && highlightAttr['stroke']) {
                stroke = highlightAttr.stroke;
            }
            // ctx.strokeStyle = this.stroke();
            ctx.strokeStyle = stroke;
            ctx.stroke();
        }

        if (fill && fill != 'none') {
            if (highlightAttr && highlightAttr['fill']) {
                fill = highlightAttr.fill;
            }
            // ctx.fillStyle = this.fill();
            ctx.fillStyle = fill;
            ctx.fill();
        }
    }

    rect(ctx, shape, scale, matrix) {
        let highlightAttr = this.highlightAttr;

        ctx.beginPath();
        let graphics = this;

        let stroke = shape.penColor;
        let strokeWidth = shape.penWidth;
        let fill = shape.backgroundColor;

        let p1 = shape.startPoint;
        let p2 = shape.endPoint;

        let x = p1[0];
        let y = p1[1];
        let width = Math.abs(p2[0] - p1[0]);
        let height = Math.abs(p2[1] - p1[1]);

        // fill = this.opaciyRgb(fill);

        let _width = width * scale;
        let _height = height * scale;

        let p = new Vector2(x, y);
        let v = p.clone().applyMatrix3(matrix);

        let _x = v.x;
        let _y = v.y;

        ctx.lineWidth = this.getScaledStrokeWidth();

        ctx.rect(_x, _y, _width, _height);

        if (this.isColor(stroke)) {
            let stroke_cls = this.stroke()
            if (highlightAttr && highlightAttr['stroke']) {
                stroke = highlightAttr.stroke;
            } else if (this.isColor(stroke_cls)) {
                stroke = stroke_cls
            }
            // ctx.strokeStyle = this.stroke();
            ctx.strokeStyle = stroke;
            ctx.stroke();
        }

        if (this.isColor(fill)) {
            let fill_cls = this.fill()
            if (highlightAttr && highlightAttr['fill']) {
                fill = highlightAttr.fill;
            } else if (this.isColor(fill_cls)) {
                fill = fill_cls;
            }
            // ctx.fillStyle = this.fill();
            ctx.fillStyle = fill;
            ctx.fill();
        }
    }

    text(ctx, shape, scale, matrix) {
        let highlightAttr = this.highlightAttr;

        let fill = shape.penColor;
        let fontSize = shape.fontSize;
        let insertPoint = shape.insertPoint

        let x = insertPoint[0];
        let y = insertPoint[1];
        let fontFamily = shape.fontFamily;
        let text = shape.strs[0]
        let _fs = fontSize * scale;
        let v2 = new Vector2(x, y);
        let v = v2.clone().applyMatrix3(matrix);
        let _x = v.x;
        let _y = v.y;

        fill = '#fff'

        // let fontColor = '#ffffff';
        if (highlightAttr && highlightAttr['fontColor']) {
            fill = highlightAttr.fontColor;
        }

        ctx.font = `${_fs}px ${fontFamily}`;
        ctx.fillStyle = fill;

        // 设置水平剧中对齐
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // let measureText = ctx.measureText(text);
        // let width = measureText.width;
        // let {width, height} = this.calculateTextDim(text, fontFamily, _fs);

        ctx.fillText(text, _x, _y);
    }

    polygon(ctx, shape, matrix) {
        let highlightAttr = this.highlightAttr;
        let stroke = shape.penColor;
        let strokeWidth = shape.penWidth;
        let fill = shape.backgroundColor;

        ctx.beginPath();

        ctx.lineWidth = this.getScaledStrokeWidth();

        let points = shape.points;

        for (let i = 0; i < points.length; i++) {
            let arr = points[i];
            let x = arr[0];
            let y = arr[1];

            let v1 = new Vector2(x, y);
            let v = v1.clone().applyMatrix3(matrix);

            let x1 = v.x;
            let y1 = v.y;
            if (i == 0) {
                ctx.moveTo(x1, y1);
            } else {
                ctx.lineTo(x1, y1);
            }
        }
        ctx.closePath()

        if (this.isColor(stroke)) {
            let stroke_cls = this.stroke()
            if (highlightAttr && highlightAttr['stroke']) {
                stroke = highlightAttr.stroke;
            } else if (this.isColor(stroke_cls)) {
                stroke = stroke_cls
            }

            // ctx.strokeStyle = this.stroke();
            ctx.strokeStyle = stroke;
            ctx.stroke();
        }

        if (this.isColor(fill)) {
            let fill_cls = this.fill()
            if (highlightAttr && highlightAttr['fill']) {
                fill = highlightAttr.fill;
            } else if (this.isColor(fill_cls)) {
                fill = fill_cls;
            }
            // ctx.fillStyle = this.fill();
            ctx.fillStyle = fill;
            ctx.fill();
        }
    }

    path(ctx, shape, scale, matrix) {
        let highlightAttr = this.highlightAttr;

        ctx.beginPath();
        let stroke = shape.penColor;
        let strokeWidth = shape.penWidth;
        let fill = shape.backgroundColor;

        ctx.lineWidth = this.getScaledStrokeWidth();

        let d = shape.d;

        let list = PathParser.parse(d);
        let prePoint;
        for (let item of list) {
            let flag = item.c;
            if (flag == 'M') {
                let p = item.points;
                let tmpP = new Vector2(p[0], p[1]);
                prePoint = tmpP.clone().applyMatrix3(matrix);

                ctx.moveTo(prePoint.x, prePoint.y);
            } else if (flag == 'A') {
                let rx = item.rx * scale;
                let ry = item.ry * scale;

                if (rx.toFixed(1) == ry.toFixed(1))
                {
                    this._circlePath(ctx, prePoint, rx, item, matrix);
                }
                else
                {
                    this._ellipsePath()
                }
            }
        }

        if (this.isColor(stroke)) {
            let stroke_cls = this.stroke()
            if (highlightAttr && highlightAttr['stroke']) {
                stroke = highlightAttr.stroke;
            } else if (this.isColor(stroke_cls)) {
                stroke = stroke_cls
            }
            // ctx.strokeStyle = this.stroke();
            ctx.strokeStyle = stroke;
            ctx.stroke();
        }

        if (fill && fill != 'none') {
            let fill_cls = this.fill()
            if (highlightAttr && highlightAttr['fill']) {
                fill = highlightAttr.fill;
            } else if (this.isColor(fill_cls)) {
                fill = fill_cls;
            }
            // ctx.fillStyle = this.fill();
            ctx.fillStyle = fill;
            ctx.fill();
        }
    }

    _circlePath(ctx, prePoint, r, item, matrix) {
        let arcFlag = item.arcFlag; // large-arc-flag决定弧线是大于还是小于180度，0表示小角度弧，1表示大角度弧。
        let sweepFlag = item.sweepFlag; // sweep-flag表示弧线的方向，0表示从起点到终点沿逆时针画弧，1表示从起点到终点沿顺时针画弧。

        let tmpP = new Vector2(item.endX, item.endY);
        let curPoint = tmpP.clone().applyMatrix3(matrix);

        let [o1, o2] = mathutil.findCircleCenter(prePoint, curPoint, r);

        let cx, cy;

        ctx.beginPath();
        let startAngle, endAngle;
        let antiClockwise = false; // 是否为逆时针绘制，默认为false
        if (arcFlag == 0 && sweepFlag == 0) // 小角度弧、逆时针
        {
            let isFind = false;
            // 先计算以o1为中心寻找
            if (!isFind) {
                let startVec = prePoint.clone().sub(o1);
                let endVec = curPoint.clone().sub(o1);

                // 计算向量夹角
                // let angle = mathutil.vecAngle(startVec, endVec);

                let angle1 = mathutil.radian2Angle(startVec.angle());
                let angle2 = mathutil.radian2Angle(endVec.angle());


                if (angle1 > angle2 && angle1 - angle2 <= 180) // 正常
                {
                    antiClockwise = true;
                    isFind = true;
                    cx = o1.x;
                    cy = o1.y;

                    startAngle = startVec.angle();
                    endAngle = endVec.angle();
                }
                else if (angle1 < angle2 && angle2 - angle1 > 180)
                {
                    isFind = true;
                    cx = o1.x;
                    cy = o1.y;
                    startAngle = startVec.angle();
                    endAngle = endVec.angle();
                }
            }
            // 先计算以o2为中心寻找
            if (!isFind) {
                let startVec = prePoint.clone().sub(o2);
                let endVec = curPoint.clone().sub(o2);

                // 计算向量夹角
                // let angle = mathutil.vecAngle(startVec, endVec);

                let angle1 = mathutil.radian2Angle(startVec.angle());
                let angle2 = mathutil.radian2Angle(endVec.angle());


                if (angle1 > angle2 && angle1 - angle2 <= 180) // 正常
                {
                    antiClockwise = true;
                    cx = o2.x;
                    cy = o2.y;
                    startAngle = startVec.angle();
                    endAngle = endVec.angle();
                }
                else if (angle1 < angle2 && angle2 - angle1 > 180)
                {
                    isFind = true;
                    cx = o2.x;
                    cy = o2.y;
                    startAngle = startVec.angle();
                    endAngle = endVec.angle();
                }
            }
        }
        else if (arcFlag == 0 && sweepFlag == 1) // 小角度弧、顺时针
        {
            let isFind = false;
            antiClockwise = false;
            // 先计算以o1为中心寻找
            if (!isFind) {
                let startVec = prePoint.clone().sub(o1);
                let endVec = curPoint.clone().sub(o1);

                // 计算向量夹角
                // let angle = mathutil.vecAngle(startVec, endVec);

                // 从angle1 至 angle2 绘制
                let angle1 = mathutil.radian2Angle(startVec.angle());
                let angle2 = mathutil.radian2Angle(endVec.angle());

                if (angle1 > angle2 && angle1 - angle2 > 180) // 正常
                {
                    isFind = true;
                    cx = o1.x;
                    cy = o1.y;

                    startAngle = startVec.angle();
                    endAngle = endVec.angle();
                }
                else if (angle1 < angle2 && angle2 - angle1 <= 180)
                {
                    isFind = true;
                    cx = o1.x;
                    cy = o1.y;
                    startAngle = startVec.angle();
                    endAngle = endVec.angle();
                }
            }

            // 先计算以o2为中心寻找
            if (!isFind) {
                let startVec = prePoint.clone().sub(o2);
                let endVec = curPoint.clone().sub(o2);

                // 计算向量夹角
                // let angle = mathutil.vecAngle(startVec, endVec);

                let angle1 = mathutil.radian2Angle(startVec.angle());
                let angle2 = mathutil.radian2Angle(endVec.angle());


                if (angle1 > angle2 && angle1 - angle2 > 180) // 正常
                {
                    antiClockwise = false;
                    isFind = true;
                    cx = o2.x;
                    cy = o2.y;
                    startAngle = startVec.angle();
                    endAngle = endVec.angle();
                }
                else if (angle1 < angle2 && angle2 - angle1 <= 180)
                {
                    isFind = true;
                    cx = o2.x;
                    cy = o2.y;
                    startAngle = startVec.angle();
                    endAngle = endVec.angle();
                }
            }
        }
        else if (arcFlag == 1 && sweepFlag == 0) // 大角度弧、逆时针
        {
            let isFind = false;
            // 先计算以o1为中心寻找
            if (!isFind) {
                let startVec = prePoint.clone().sub(o1);
                let endVec = curPoint.clone().sub(o1);

                // 计算向量夹角
                let angle = mathutil.vecAngle(startVec, endVec);

                let angle1 = mathutil.radian2Angle(startVec.angle());
                let angle2 = mathutil.radian2Angle(endVec.angle());


                if (angle1 > angle2 && angle1 - angle2 > 180) // 正常
                {
                    antiClockwise = true;
                    isFind = true;
                    cx = o1.x;
                    cy = o1.y;

                    startAngle = startVec.angle();
                    endAngle = endVec.angle();
                }
                else if (angle1 < angle2 && angle2 - angle1 <= 180)
                {
                    isFind = true;
                    cx = o1.x;
                    cy = o1.y;
                    startAngle = startVec.angle();
                    endAngle = endVec.angle();
                }
            }
            // 先计算以o2为中心寻找
            if (!isFind) {
                let startVec = prePoint.clone().sub(o2);
                let endVec = curPoint.clone().sub(o2);

                // 计算向量夹角
                let angle = mathutil.vecAngle(startVec, endVec);

                let angle1 = mathutil.radian2Angle(startVec.angle());
                let angle2 = mathutil.radian2Angle(endVec.angle());


                if (angle1 > angle2 && angle1 - angle2 > 180) // 正常
                {
                    antiClockwise = true;
                    cx = o2.x;
                    cy = o2.y;
                    startAngle = startVec.angle();
                    endAngle = endVec.angle();
                }
                else if (angle1 < angle2 && angle2 - angle1 <= 180)
                {
                    isFind = true;
                    cx = o2.x;
                    cy = o2.y;
                    startAngle = startVec.angle();
                    endAngle = endVec.angle();
                }
            }
        }
        else if (arcFlag == 1 && sweepFlag == 1) // 大角度弧、顺时针
        {
            let isFind = false;
            // 先计算以o1为中心寻找
            if (!isFind) {
                let startVec = prePoint.clone().sub(o1);
                let endVec = curPoint.clone().sub(o1);

                // 计算向量夹角
                let angle = mathutil.vecAngle(startVec, endVec);

                let angle1 = mathutil.radian2Angle(startVec.angle());
                let angle2 = mathutil.radian2Angle(endVec.angle());


                if (angle1 > angle2 && angle1 - angle2 <= 180) // 正常
                {
                    antiClockwise = true;
                    isFind = true;
                    cx = o1.x;
                    cy = o1.y;

                    startAngle = startVec.angle();
                    endAngle = endVec.angle();
                }
                else if (angle1 < angle2 && angle2 - angle1 > 180)
                {
                    isFind = true;
                    cx = o1.x;
                    cy = o1.y;
                    startAngle = startVec.angle();
                    endAngle = endVec.angle();
                }
            }
            // 先计算以o2为中心寻找
            if (!isFind) {
                let startVec = prePoint.clone().sub(o2);
                let endVec = curPoint.clone().sub(o2);

                // 计算向量夹角
                let angle = mathutil.vecAngle(startVec, endVec);

                let angle1 = mathutil.radian2Angle(startVec.angle());
                let angle2 = mathutil.radian2Angle(endVec.angle());


                if (angle1 > angle2 && angle1 - angle2 <= 180) // 正常
                {
                    antiClockwise = true;
                    cx = o2.x;
                    cy = o2.y;
                    startAngle = startVec.angle();
                    endAngle = endVec.angle();
                }
                else if (angle1 < angle2 && angle2 - angle1 > 180)
                {
                    isFind = true;
                    cx = o2.x;
                    cy = o2.y;
                    startAngle = startVec.angle();
                    endAngle = endVec.angle();
                }
            }
        }

        ctx.arc(cx, cy, r, startAngle, endAngle, antiClockwise);

    }

    // 获取考虑 stage 缩放的线宽
    getScaledStrokeWidth() {
        const layer = this.getLayer();

        // 如果 strokeScaleEnabled 为 false，需要手动处理 stage 缩放
        if (!this.getStrokeScaleEnabled()) {
            const stageScale = layer.scaleX();
            return this.strokeWidth() / stageScale;
        }

        // 如果 strokeScaleEnabled 为 true，使用原来的逻辑
        return this.strokeWidth() / this.scaleX();
    }

    getSelfRect() {
        return {
            x: 0,
            y: 0,
            width: this.width(),
            height: this.height()
        }
    }

    _hitFunc(ctx) {
        let w = this.width();
        let h = this.height();
        ctx.beginPath();
        ctx.rect(0, 0, w, h);
        ctx.closePath();
        ctx.fillStrokeShape(this);
    }

    _sceneFunc (ctx) {
        let flag = this.flag; // 同源和力光svg图标识
        let symbol = this.symbol;
        let symbolDom = symbol.dom;

        let width = this.width();
        let height = this.height();

        let scale = width / symbol.initWidth;

        let offsetX, offsetY;
        let tranX, tranY;

        if (flag == 'ty') {
            offsetX = width * symbol.xratio;
            offsetY = height * symbol.yratio;

            tranX = offsetX;
            tranY = offsetY;
        } else {
            let xmin = symbol.xmin;
            let ymin = symbol.ymin;

            tranX = -xmin * scale;
            tranY = -ymin * scale;

            let tmpSymbolId = symbol.id.toLowerCase();
            let index = tmpSymbolId.indexOf('_')
            let devType = tmpSymbolId.substring(0, index)

            if (ratioMap[devType]) {
                let obj = ratioMap[devType];
                offsetX = obj.xratio * width
                offsetY = obj.yratio * height
            } else {
                offsetX = symbol.xratio * width
                offsetY = symbol.yratio * height
            }
        }

        this.offsetX(offsetX)
        this.offsetY(offsetY)

        let tran = {x: tranX, y: tranY};
        let matrix = mathutil.commonMatrix(tran, null, scale);
        // 绘制图元
        let shapes = symbolDom.shapes;
        let txtShape = null;
        for (let shape of shapes) {
            let name = shape.type.toLowerCase();
            switch (name) {
                case "line":
                    this.line(ctx, shape, matrix.clone());
                    break;
                case 'path':
                    this.path(ctx, shape, scale, matrix.clone(), tranX, tranY);
                    break;
                case 'polyline':
                    this.polyline(ctx, shape, matrix.clone());
                    break;
                case 'circle':
                    this.circle(ctx, shape, scale, matrix.clone());
                    break
                case 'rectangle':
                    this.rect(ctx, shape, scale, matrix.clone());
                    break
                case 'ellipse':
                    this.ellipse(ctx, shape, scale, matrix.clone());
                    break
                case 'polygon':
                    this.polygon(ctx, shape, matrix.clone());
                    break;
                case 'use':
                    this.use(ctx, shape, scale, matrix.clone());
                    break;
                case 'text':
                    // this.text(ctx, shape, scale, matrix.clone());
                    txtShape = shape;
                    break;
            }
        }

        if (txtShape) {
            this.text(ctx, txtShape, scale, matrix.clone());
        }

        ctx.fillStrokeShape(this)
    }

    toJSON() {
        const obj = super.toJSON(); // 获取基础的 JSON 数据
        obj.customProperty = 'hehe'; // 添加自定义属性
        return obj;
    }

    toObject() {
        let attrs = this.getAttrs(), key, val, getter, defaultValue, nonPlainObject;
        const obj = {
            attrs: {},
            className: this.getClassName(),
        };

        for (key in attrs) {
            val = attrs[key];
            // if value is object and object is not plain
            // like class instance, we should skip it and to not include
            nonPlainObject = Konva.Util.isObject(val) && !Konva.Util._isPlainObject(val) && !Konva.Util._isArray(val);
            if (nonPlainObject) {
                continue;
            }
            getter = typeof this[key] === 'function' && this[key];
            // remove attr value so that we can extract the default value from the getter
            delete attrs[key];
            defaultValue = getter ? getter.call(this) : null;
            // restore attr value
            attrs[key] = val;
            if (defaultValue !== val) {
                obj.attrs[key] = val;
            }
        }
        // obj.symbol = JSON.stringify(this.symbol);

        let symbol = this.symbol;
        let domStr = this.symbol.dom.outerHTML
        obj.symbol = {
            dom: domStr,
            initWidth: symbol._initWidth,
            initHeight: symbol._initHeight,
            xratio: symbol.xratio,
            yratio: symbol.yratio
        };
        return Konva.Util._prepareToStringify(obj);
    }
}






