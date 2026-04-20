import mathutil from '@/plugins/tmzx/mathutil.js'
import CustomShape from '@/plugins/tmzx/graph/CustomShape.js'
import SymbolUtilJS from '@/plugins/tmzx/graph/SymbolUtilJS.js'

let regScale = /scale\([^)]+\)/ig;
let regRotate = /rotate\([^)]+\)/ig;
let regTran = /translate\(([^)]+)\)/i;


let rgbReg = /^rgb\s*\(([^)]+)\)$/i;
/**
 * 注意：这里用图形中心点为原点
 */
export default class CanvasViewParser {
    stage = null;
    constructor(stage, flag='lg', vw, vh) {
        this.stage = stage;
        this.flag = flag;
        this.symbolMap = new Map();
        this.vw = vw;
        this.vh = vh;

        this.theme = 'black'

        this.scaleBy = 1.1;
        this.oldScale = 1;
        let layer = this.layer = new Konva.Layer({
            draggable: false
        });
        let bgLayer = this.bgLayer = new Konva.Layer({
            draggable: false
        });

        let waterLayer = this.waterLayer = new Konva.Layer({
            draggable: false
        });

        stage.add(bgLayer);
        stage.add(waterLayer);
        stage.add(layer);

        this.addBg();
        this.resetWaterMarkder();


        this.addEvent()


        let debounce = function (fn, delay = 20) {
            let time = null;
            return (...args) => {
                clearTimeout(time);
                time = setTimeout(() => fn.apply(this, args), delay);
            }
        }

        this.observer = new ResizeObserver(debounce(entries => {
            // console.log('--------------------------> 次数监控', Math.random())
            this.resetDiagram();
        }))
        this.observer.observe(stage.container());
    }

    resetDiagram() {
        let stage = this.getStage();
        let container = stage.container()
        stage.width(container.clientWidth < 200 ? 200: container.clientWidth);
        stage.height(container.clientHeight < 200 ? 200 : container.clientHeight);

        this.resizeBg();
        this.resetWaterMarkder();
        this.bgLayer.batchDraw();
        this.waterLayer.batchDraw();
    }

    addBg() {
        let layer = this.bgLayer;

        let width = this.vw;
        let height = this.vh;
        this.background = new Konva.Rect({
            x: 0, y: 0,
            width,
            height,
            fill: '#000'
        });
        layer.add(this.background);
    }

    resetWaterMarkder() {
        let stage = this.getStage();
        let waterLayer = this.waterLayer;

        waterLayer.destroyChildren();
        let width = stage.width();
        let height = stage.height();

        let watermarkText = '图模中心'
        let fontSize = 20;
        let opacity = 0.1;
        let rotation = 20;
        let spacing = 100;


        let fill = this.theme == 'black' ? '#fff' : '#000';

        for(let y = -200; y < height + 200; y += spacing) {
            for(let x = -200; x < width + 200; x += spacing) {
                let text = new Konva.Text({
                    x, y,
                    text: watermarkText,
                    fontSize: fontSize,
                    fontFamily: 'Arial',
                    fill,
                    opacity: opacity,
                    rotation: rotation
                })
                waterLayer.add(text);
            }
        }
    }

    getLayer() {
        return this.layer;
    }

    getStage() {
        return this.stage;
    }

    addEvent() {
        let stage = this.stage;
        let layer = this.layer;
        // 1、缩放控制--------------------------------------------


        let scaleBy = this.scaleBy;



        let container = stage.container();

        // let zoomStage = (scale, point) => {
        //     // 获取当前缩放级别
        //     const oldScale = layer.scaleX();
        //
        //     // 计算相对于 layer 的鼠标位置
        //     const mousePointTo = {
        //         x: (point.x - layer.x()) / oldScale,
        //         y: (point.y - layer.y()) / oldScale
        //     };
        //
        //     // 设置新的缩放级别
        //     layer.scale({ x: scale, y: scale });
        //
        //     // 计算新的位置，使鼠标点保持在同一位置
        //     const newPos = {
        //         x: point.x - mousePointTo.x * scale,
        //         y: point.y - mousePointTo.y * scale
        //     };
        //
        //     layer.position(newPos);
        //     layer.batchDraw();
        // }
        // stage.container().on('wheel', (e) => {
        //     e.evt.preventDefault(); // 阻止默认滚动行为
        //
        //     // 获取当前缩放级别
        //     const oldScale = layer.scaleX();
        //
        //     // 获取鼠标指针位置
        //     const pointer = layer.getPointerPosition();
        //
        //     if (!pointer) return; // 如果没有获取到指针位置则返回
        //
        //     // 确定缩放方向（放大或缩小）
        //     const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
        //
        //     // 限制最小和最大缩放级别（可选）
        //     const minScale = 0.1;
        //     const maxScale = 40;
        //     const clampedScale = Math.max(minScale, Math.min(maxScale, newScale));
        //
        //     // 执行缩放
        //     zoomStage(clampedScale, pointer);
        //     this.redrawBgText()
        //     layer.batchDraw()
        // })

        // 1、 添加缩放事件
        container.addEventListener('wheel', e => {
            e.preventDefault(); // 阻止页面滚动
            // 获取鼠标指针位置
            const stagePos = stage.getPointerPosition();

            if (!stagePos) return; // 如果没有获取到指针位置则返回

            let mouseX = stagePos.x;
            let mouseY = stagePos.y;

            let point = {
                x: (mouseX - layer.x()) / this.oldScale,
                y: (mouseY - layer.y()) / this.oldScale
            }

            const newScale = e.deltaY > 0 ? this.oldScale / scaleBy : this.oldScale * scaleBy;


            // console.log('------>', e.deltaY, newScale)

            layer.x(mouseX - point.x * newScale);
            layer.y(mouseY - point.y * newScale);

            layer.scale({x: newScale, y: newScale});

            this.oldScale = newScale;

            layer.batchDraw()
        })

        // 2、添加拖动事件
        let isDragging = false
        let lastMousePos = {x: 0, y: 0};

        stage.on('mousedown', e => {
            isDragging = true;
            lastMousePos = stage.getPointerPosition();
        })
        stage.on('mousemove', e => {
            if (!isDragging) {
                return;
            }

            let currentPos = stage.getPointerPosition();
            if (!currentPos) {
                return;
            }

            // 计算鼠标位移差
            let dx = currentPos.x - lastMousePos.x;
            let dy = currentPos.y - lastMousePos.y;

            layer.x(layer.x() + dx)
            layer.y(layer.y() + dy)

            lastMousePos = currentPos;
            layer.batchDraw()
        })

        stage.on('mouseup mouseleave', e => {
            isDragging = false;
        })


        // 3、mouse over--------------------------------------------
        layer.on('mouseover', e => {
            let g = e.target;
            if (g.nodeType == 'Stage') {
                return;
            }

            document.body.style.cursor = "pointer";
        })

        layer.on('mouseout', e => {
            let g = e.target;
            if (g.nodeType == 'Stage') {
                return;
            }
            document.body.style.cursor = "default";
        })

        // 3、resize事件 --------------------------------------------
        // this.resizeEvt = () => {
        //     stage.width(container.clientWidth);
        //     stage.height(container.clientHeight < 100 ? 100 : container.clientHeight);
        //     stage.batchDraw();
        // }
        //
        // window.addEventListener('resize', this.resizeEvt);
    }

    resizeBg() {
        let stage = this.getStage();
        let bg = this.background;
        let width = stage.width();
        let height = stage.height();

        bg.width(width);
        bg.height(height);
    }

    // resizeContainer() {
    //     if (this.resizeEvt) {
    //         this.resizeEvt();
    //         this.resetWaterMarkder();
    //         this.resizeBg();
    //     }
    // }

    isWhiteColor(color) {
        let isWhite = false;
        color = color.trim()

        if (color == '#fff') {
            isWhite = true;
        } else if (color == '#ffffff') {
            isWhite = true;
        } else if (color == 'rgb(255,255,255)') {
            isWhite = true;
        }

        if (!isWhite) {
            let m = color.match(rgbReg)
            if (m) {
                let c = m[1].trim()
                let ls = c.split(',').map(v => v.trim());
                let num255 = ls.reduce((r, g) => g == '255' ? r + 1 : r , 0);
                if (num255 == 3) {
                    isWhite = true;
                }
            }
        }

        return isWhite;
    }

    removeEvent() {
        if (this.resizeEvt) {
            window.removeEventListener('resize', this.resizeEvt);
        }
    }



    /**
     * 获取最终样式值
     * @param clsStr
     * @param key
     */
    getStyleValue(clsStr, key) {
        if (!clsStr) {
            return '';
        }
        let styleObj = this.styleObj;
        let v = null;
        let strArr = clsStr.trim().split(' ');
        for(let styleName of strArr) {
            if (!styleName) {
                continue;
            }

            let obj = styleObj[styleName];

            if (!obj) {
                continue
            }

            let tmpV = obj[key];
            if (tmpV) {
                v = tmpV;
            }
        }
        return v;
    }

    /**
     * 解析defs元素中的style样式，用于线的css
     * @param node
     */
    parseStyle(node) {
        let styleObj = this.styleObj = {};
        // node = {
        //     "kv6": "fill:rgb(0,0,139);stroke:rgb(0,0,139);stroke-width:1;",
        //     "kv10": "fill:rgb(185,72,66);stroke:rgb(185,72,66);stroke-width:1;",
        //     "lkv10": "fill:none;stroke:rgb(185,72,66);stroke-width:1;",
        //     "kv35": "fill:rgb(255,255,0);stroke:rgb(255,255,0);stroke-width:1;",
        //     "lkv35": "fill:none;stroke:rgb(255,255,0);stroke-width:1;",
        //     "kv110": "fill:rgb(240,65,85);stroke:rgb(240,65,85);stroke-width:1;",
        //     "lkv110": "fill:none;stroke:rgb(240,65,85);stroke-width:1;",
        //     "kv220": "fill:rgb(128,0,128);stroke:rgb(128,0,128);stroke-width:1;",
        //     "lkv220": "fill:none;stroke:rgb(128,0,128);stroke-width:1;",
        //     "station": "stroke-width:1;",
        //     "busbar": "stroke-width:3;",
        //     "trunk": "stroke-width:2.5;",
        //     "dash-dl": "stroke-dasharray:4 2;",
        //     "dash-cl": "stroke-dasharray:2 2;",
        //     "text-default": "stroke:rgb(255,255,255);",
        //     "text-hot": "stroke:rgb(0,255,0);"
        // }

        let getProps = (css) => {
            let obj = {};
            css = css.trim();
            let list = css.split(';');
            for (let item of list) {
                if (!item) {
                    continue
                }

                let arr = item.split(':');
                let key = arr[0].trim();
                let v = arr[1].trim().toLowerCase();
                obj[key] = v;
            }
            return obj;
        }

        for(let key in node) {
            let css = node[key];
            let obj = getProps(css)
            styleObj[key] = obj;
        }
    }

    parseSymbol(symbolList) {
        let flag = this.flag
        let symbolMap = this.symbolMap

        for (let symbol of symbolList) {
            let id = symbol.id;

            let symbolObj = SymbolUtilJS.getSymbolProps(symbol, flag);
            symbolMap.set(id, symbolObj)
        }

        let i = 1;
    }

    /**
     * 解析线，统一按线坐标顺序的起始索引为原点
     * @param polyNode
     */
    parsePolyline(shape) {
        let styleObj = this.styleObj;
        let layer = this.layer;


        let {id, name, psrType, psrId, cls, points, strokeWidth, stroke, penDashPattern, strokeDasharray} = shape;

        let corList = [];

        for (let i = 0; i < points.length; i++) {
            let svgcor = points[i];
            let x = svgcor[0];
            let y = svgcor[1];
            corList.push(x, y);
        }


        let clsStroke = this.getStyleValue(cls, 'stroke');
        if (clsStroke) {
            stroke = clsStroke
        }


        let clsStrokeWidth = this.getStyleValue(cls, 'stroke-width');
        if (clsStrokeWidth) {
            strokeWidth = clsStrokeWidth
        }

        if ((!penDashPattern || penDashPattern.length < 2) && strokeDasharray) {
            penDashPattern = strokeDasharray.replace('2,', '4').trim().split(' ').map(v => +v.trim());
        }

        let strokeDash_css = this.getStyleValue(cls, 'stroke-dasharray')
        if (strokeDash_css) {
            penDashPattern = strokeDash_css.trim().split(' ').map(v => +v.trim());
        }

        let graphics = new Konva.Line({
            id, name,
            points: corList,
            stroke,
            strokeWidth,
            hitStrokeWidth: 4,
            lineCap: 'butt',
            lineJoin: 'round',
            strokeScaleEnabled: false,
            psrType, psrId
        });

        if (penDashPattern && penDashPattern.length > 1) {
            graphics.dash(penDashPattern)
        }

        graphics.psrType = psrType;
        graphics.psrId = psrId;

        layer.add(graphics);
    }

    // use symbol解析
    parseUse(shape) {
        let layer = this.layer
        let symbolMap = this.symbolMap;

        let {x, y, id, symbol, name, psrType, psrId, cls, rotate, scale, asso} = shape;

        let _scale = scale

        let symbolObj = symbolMap.get(symbol);

        let initWidth = symbolObj.initWidth;
        let initHeight = symbolObj.initHeight;


        let width = initWidth * _scale;
        let height = initHeight * _scale;

        let stroke = this.getStyleValue(cls, 'stroke');
        let fill = this.getStyleValue(cls, 'fill');

        stroke = null;
        fill = null;

        let graphics = new CustomShape({
            id,
            name,
            width, height,
            rotation: rotate,
            strokeWidth: 1,
            // fill: 'rgba(255,0,0, .5)',
            // stroke: 'rgba(255,0,0,1)',
            strokeScaleEnabled: false,
            draggable: false,
            psrType,psrId, asso
        }, symbolObj, symbolMap, this.flag)

        if (stroke && stroke != 'none') {
            graphics.stroke(stroke)
        }

        if (fill && fill != 'none') {
            graphics.fill(fill)
        }

        graphics.position({x, y})
        graphics.strokeEnabled(false);
        // graphics.draggable(true)
        graphics.psrType = psrType;
        graphics.psrId = psrId;

        layer.add(graphics);
    }

    // 母线解析
    parseBusbar(shape) {
        let layer = this.layer;
        let styleObj = this.styleObj;


        let {id, name, psrType, psrId, cls, points, strokeWidth, stroke} = shape;

        // 计算svg坐标
        // let parr = points.map(v => ({x: v[0], y: v[1]}));

        // let _p1 = parr[0];
        // let _p2 = parr[1];

        // let p1 = new Vector2(_p1.x, _p1.y);
        // let p2 = new Vector2(_p2.x, _p2.y);

        // let vecBus = p2.clone().sub(p1);
        // let randian = vecBus.angle();
        // let angle = mathutil.radian2Angle(randian)
        //
        // let width = vecBus.length();
        // let co = mathutil.midPoint(p1, p2);

        let height = strokeWidth;

        let clsStroke = this.getStyleValue(cls, 'stroke');
        if (clsStroke) {
            stroke = clsStroke;
        }

        let strokeWidth_css = +this.getStyleValue(cls, 'stroke-width');
        if (strokeWidth_css) {
            height = strokeWidth_css;
        }

        // let parr = points.map(v => ({x: v[0], y: v[1]}));
        let parr = [];
        for(let p of points) {
            parr.push(p[0], p[1])
        }

        // let graphics = new Konva.Rect({
        //     id, name,
        //     x: co.x,
        //     y: co.y,
        //     width,
        //     height,
        //     fill: stroke,
        //     strokeWidth: 0,
        //     draggable: false,
        //     rotation: angle,
        //     offsetX: width / 2,
        //     offsetY: height / 2,
        //     strokeScaleEnabled: false,
        // });
        let graphics = new Konva.Line({
            id, name,
            points: parr,
            stroke,
            strokeWidth: height,
            hitStrokeWidth: 4,
            lineCap: 'round',
            lineJoin: 'round',
            strokeScaleEnabled: false,
            psrType, psrId
        });

        graphics.flag = 'busbar'
        graphics.psrType = psrType;
        graphics.psrId = psrId;
        layer.add(graphics);
    }

    // 站房
    parseSubstaion(shape) {
        let layer = this.layer;
        let styleObj = this.styleObj;


        let {id, name, psrType, psrId, cls, points, strokeWidth, stroke} = shape;

        // 坐标需要转换
        let p1 = new Vector2(points[0][0], points[0][1]);
        let p2 = new Vector2(points[1][0], points[1][1]);
        let p3 = new Vector2(points[2][0], points[2][1]);

        let width = Math.abs(p1.x - p2.x);
        let height = Math.abs(p2.y - p3.y);
        let co = mathutil.midPoint(p1, p3);

        let angle = 0;

        let clsStroke = this.getStyleValue(cls, 'stroke');
        if (clsStroke) {
            stroke = clsStroke
        }

        let sw = 1;
        let clsStrokeWidth = this.getStyleValue(cls, 'stroke-width');
        if (clsStrokeWidth) {
            sw = +clsStrokeWidth
        }

        let graphics = new Konva.Rect({
            id,
            name,
            x: co.x,
            y: co.y,
            width,
            height,
            fill: 'rgba(0,0,0,0)',
            stroke: stroke,
            strokeWidth: sw,
            draggable: false,
            roration: 0,
            offsetX: width / 2,
            offsetY: height / 2,
            strokeScaleEnabled: false
        });
        graphics.flag = 'station'
        graphics.psrType = psrType;
        graphics.psrId = psrId;

        layer.add(graphics);
    }

    parsePolygon(shape) {
        let layer = this.layer;
        let styleObj = this.styleObj;


        let {id, name, psrType, psrId, cls, points, strokeWidth, stroke} = shape;

        // 坐标需要转换
        let p1 = new Vector2(points[0][0], points[0][1]);
        let p2 = new Vector2(points[1][0], points[1][1]);
        let p3 = new Vector2(points[2][0], points[2][1]);

        let width = Math.abs(p1.x - p2.x);
        let height = Math.abs(p2.y - p3.y);
        let co = mathutil.midPoint(p1, p3);

        let angle = 0;

        let clsStroke = this.getStyleValue(cls, 'stroke');
        if (clsStroke) {
            stroke = clsStroke
        }

        let graphics = new Konva.Rect({
            id,
            name,
            x: co.x,
            y: co.y,
            width,
            height,
            fill: 'rgba(0,0,0,0)',
            stroke: stroke,
            strokeWidth: 1,
            draggable: false,
            roration: 0,
            offsetX: width / 2,
            offsetY: height / 2,
            strokeScaleEnabled: false
        });
        graphics.flag = 'station'

        layer.add(graphics);

    }

    getTxtcontent(list) {
        let sb = [];
        for(let item of list) {
            sb.push(item.str);
        }
        return sb.join('\n')
    }

    parseTxt(shape) {

        let layer = this.layer;


        let {id, fontFamily, fontSize, backgroundColor, rotate, strs, horizontalAlignment, target, superlinkname, superlinkpsrid, href, cls} = shape;


        let firstTxt = strs[0];
        let x = firstTxt.insertPoint[0];
        let y = firstTxt.insertPoint[1];


        let angle = rotate;

        let fill = backgroundColor;
        // let dimensionTxt = TextUtil.getTextDimension(fontSize, list)
        let fill_cls = this.getStyleValue(cls, 'stroke');
        if (fill_cls) {
            fill = fill_cls;
        }

        let textContent = this.getTxtcontent(strs);
        // let fontColor = '#ffffff';

        let graphics = new Konva.Text({
            id,
            x: 0,
            y: 0,
            text: textContent,
            fontSize: fontSize,
            fontFamily: fontFamily,
            preColor: fill,
            fill,
            padding: 0,
            draggable: false,
            align: 'center',
            verticalAlign: 'middle',
            // textBaseline: 'middle',
            rotation: angle,
            horizontalAlignment, target, superlinkname, superlinkpsrid, href
        });

        let width = graphics.width();
        let height = graphics.height();


        graphics.offsetX(width / 2);
        graphics.offsetY(height / 2);

        let x1 = x; // 中心x坐标
        let y1 = y - fontSize; // 上面y坐标
        // 中心坐标
        let cx = x1;
        let cy = y1 + height / 2;

        graphics.position({x: cx, y: cy})
        layer.add(graphics);
    }

    // 解析svg数据
    parse(jsonObj) {
        this.jsonObj = jsonObj;
        this.parseStyle(jsonObj.style);
        this.parseSymbol(jsonObj.symbols);

        let txtList = [];
        let lineList = [];
        let stationList = [];
        let busbarList = [];
        let devList = [];
        let regionList = [];


        let shapes = jsonObj.shapes;

        // 母线：0311，站房：zf\d+
        // 1、设备分类
        for(let shape of shapes) {
            let type = shape.type;
            let psrytpe = shape.psrType;

            if (type == 'Text') {
                txtList.push(shape)
            } else if (type == 'Polyline') {
                if (psrytpe == '0311') {
                    busbarList.push(shape)
                } else {
                    lineList.push(shape)
                }
            } else if (type == 'Polygon') {

                stationList.push(shape)
            }
            else if (type == 'Insert') {
                devList.push(shape)
            }
        }

        // 2、边界
        for(let node of regionList) {
            this.parsePolygon(node);
        }
        // 3、站房
        for(let node of stationList) {
            this.parseSubstaion(node);
        }
        // 4、线处理
        for(let node of lineList) {
            this.parsePolyline(node);
        }
        // 5、母线
        for(let node of busbarList) {
            this.parseBusbar(node);
        }
        // 6、设备
        for(let node of devList) {
            this.parseUse(node);
        }
        // 7、文本
        for(let node of txtList) {
            this.parseTxt(node);
        }


        this.fitToScreen();
        this.stage.draw();
    }

    // 高亮设备列表
    highlight(ls) {
        let layer = this.getLayer();

        let colorAttr = {
            stroke: 'rgb(0, 255, 255)',
            fill: 'rgb(0, 255, 255)',
            fontColor: '#fff',
        }
        let list = []
        for(let id of ls) {
            const graphics = layer.findOne(`#${id}`);
            if (graphics) {
                list.push(graphics);
            }
        }
        this.clearHighlight(this.curGraphicsList);
        this.curGraphicsList = list;


        for(let g of list) {
            g.highlightAttr = colorAttr
            if (g.className != 'CustomShape') {
                if (g.className == 'Line') {
                    g.preStroke = g.stroke();
                    if (colorAttr['stroke']) {
                        g.stroke(colorAttr['stroke']);
                    }
                } else if (g.className == 'Text') {
                    g.preStroke = g.fill();
                    if (colorAttr['stroke']) {
                        g.fill(colorAttr['stroke']);
                    }
                } else if (g.flag == 'busbar') {
                    g.preFill = g.fill();
                    if (colorAttr['fill']) {
                        g.fill(colorAttr['fill']);
                    }
                } else if (g.flag == 'station') {
                    g.preStroke = g.stroke();
                    if (colorAttr['stroke']) {
                        g.stroke(colorAttr['stroke']);
                    }
                }
            }
        }
        layer.draw();
    }



    // 清除高亮
    clearHighlight() {
        let curGraphicsList = this.curGraphicsList;
        if (!curGraphicsList) {
            return;
        }
        for(let g of curGraphicsList) {
            if (!g) {
                continue;
            }
            g.highlightAttr = null;
            if (g.className != 'CustomShape') {
                if (g.className == 'Line') {
                    g.stroke(g.preStroke);
                } else if (g.className == 'Text') {
                    g.fill(g.preStroke);
                } else if (g.flag == 'busbar') {
                    g.fill(g.preFill);
                } else if (g.flag == 'station') {
                    g.stroke(g.preStroke);
                }
            }
        }

        this.curGraphicsList = [];
        let layer = this.getLayer();
        layer.draw();
    }

    // 位置定位
    locatePosition(targetX, targetY, scale) {
        let stage = this.getStage();
        // 舞台可视区域的中心点坐标（屏幕中心）
        const stageCenterX = stage.width() / 2;
        const stageCenterY = stage.height() / 2;

        // 计算让目标点居中所需的舞台偏移量（考虑缩放）
        // 公式：stage.x = 舞台中心X - (目标点X * 缩放)
        //       stage.y = 舞台中心Y - (目标点Y * 缩放)
        const newX = stageCenterX - (targetX * scale);
        const newY = stageCenterY - (targetY * scale);

        // 更新舞台的缩放和偏移
        stage.scale({ x: scale, y: scale });
        stage.position({ x: newX, y: newY });

        // 刷新舞台
        stage.draw();
    }

    themeBack() {
        let stage = this.getStage();
        let layer = this.getLayer();
        let waterLayer = this.waterLayer;

        this.theme = 'black'
        this.background.fill('#000')

        for(let node of layer.children) {
            if (node.className == 'Text') {
                let preColor = node.getAttr('preColor');
                node.fill(preColor)
            }
        }

        for(let node of waterLayer.children) {
            node.fill('#fff')
        }

        stage.draw();
    }

    themeWhite() {
        let stage = this.getStage();
        let layer = this.getLayer();
        let waterLayer = this.waterLayer;

        this.theme = 'white'
        this.background.fill('#fff')

        for(let node of layer.children) {
            if (node.className == 'Text') {
                let c = node.getAttr('fill')
                let isWhite = this.isWhiteColor(c)
                if (isWhite) {
                    node.fill('#252525')
                }
            }
        }

        for(let node of waterLayer.children) {
            node.fill('#000')
        }
        stage.draw();
    }

    // 设备定位
    locateGraphics(graphics, scale) {
        if (!graphics) {
            return
        }

        let x = graphics.x();
        let y = graphics.y();

        this.locatePosition(x, y, scale);
    }

    // 按设备id定位
    locateById(id, scale) {
        let layer = this.getLayer();
        const graphics = layer.findOne(`#${id}`);
        if (!graphics) {
            this.locateGraphics(graphics, scale);
        }
    }

    /**
     * 让舞台完整显示指定图形（或所有图形）
     * @param {Konva.Node[]} nodes - 要显示的图形数组（如 layer.children 表示所有图形）
     * @param {number} padding - 边缘留白（可选，默认 20）
     */

    fitToScreen_bak2() {

        // nodes, padding = 20
        let padding = 100;
        let allNodes = this.layer.children;
        let stage = this.getStage();
        let layer = this.getLayer();

        if (allNodes.length == 0) {
            return;
        }

        layer.scale({x: 1, y: 1})
        layer.position({ x: 0, y: 0 });

        // 1. 计算所有图形的边界框（最小x、最小y、最大x、最大y）
        let bounds = allNodes[0].getClientRect();

        // allNodes.forEach(node => {
        //     // 获取图形的全局边界框（考虑父级变换）
        //     // const box = node.getClientRect({ relativeTo: stage });
        //     const rect = node.getClientRect();
        //     if (rect.x) {
        //         bounds.x = Math.min(bounds.x, rect.x);
        //         bounds.y = Math.min(bounds.y, rect.y);
        //         bounds.width = Math.max(bounds.x + bounds.width, rect.x + rect.width) - bounds.x;
        //         bounds.height = Math.max(bounds.y + bounds.height, rect.y + rect.height) - bounds.y;
        //     }
        // });

        let boundsCenterX = bounds.x + bounds.width / 2;
        let boundsCenterY = bounds.y + bounds.height / 2;
        let stageCenterX = stage.width() / 2;
        let stageCenterY = stage.height() / 2;
        let deltaX = stageCenterX - boundsCenterX;
        let deltaY = stageCenterY - boundsCenterY;
        const scaleX = stage.width() / bounds.width;   // 基于宽度的缩放
        const scaleY = stage.height() / bounds.height; // 基于高度的缩放
        const scale = Math.min(scaleX, scaleY);     // 取较小值，确保完整显示



        layer.position({ x: layer.x() + bounds.x + deltaX, y: layer.y() + bounds.y + deltaY });
        layer.scale({ x: scale, y: scale });
        this.oldScale = scale;

        layer.draw();
    }
    fitToScreen() {

        // nodes, padding = 20
        let padding = 50;
        let nodes = this.layer.children;
        let stage = this.getStage();
        let layer = this.getLayer();

        // 1. 计算所有图形的边界框（最小x、最小y、最大x、最大y）
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        // CustomShape
        nodes.forEach(node => {
            // 获取图形的全局边界框（考虑父级变换）
            // const box = node.getClientRect({ relativeTo: stage }); // 视图位置
            // const box = node.getClientRect();
            // if (box.x) {
            //     minX = Math.min(minX, box.x);
            //     minY = Math.min(minY, box.y);
            //     maxX = Math.max(maxX, box.x + box.width);
            //     maxY = Math.max(maxY, box.y + box.height);
            // }

            if (node.className == 'CustomShape' || node.className == 'Text') {
                    minX = Math.min(minX, +node.x());
                    minY = Math.min(minY, +node.y());
                    maxX = Math.max(maxX, +node.x() + node.width());
                    maxY = Math.max(maxY, +node.y() + node.height());
            }

            // if (!box.x) {
            //     if (box.flag == 'station') {
            //         let width = box.width();
            //         let height = box.height();
            //         // let x = box.x();
            //         // let y = box.y();
            //         // console.log(box.flag)
            //         minX = Math.min(minX, box.x - width / 2);
            //         minY = Math.min(minY, box.y - height / 2);
            //         maxX = Math.max(maxX, box.x + width / 2);
            //         maxY = Math.max(maxY, box.y + height / 2);
            //     }
            // }
        });

        // 2. 计算边界框的宽高（加上留白）
        const contentWidth = maxX - minX + padding * 2;
        const contentHeight = maxY - minY + padding * 2;

        // 3. 计算能完整显示边界框的最大缩放比例
        const stageWidth = stage.width();
        const stageHeight = stage.height();
        const scaleX = stageWidth / contentWidth;   // 基于宽度的缩放
        const scaleY = stageHeight / contentHeight; // 基于高度的缩放
        const scale = Math.min(scaleX, scaleY);     // 取较小值，确保完整显示

        // layer.setAttrs({
        //     x: 0, y: 0, scale: 1
        // })
        // 4. 计算边界框的中心点
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        // 5. 计算舞台偏移量，让边界框居中
        const stageCenterX = stageWidth / 2;
        const stageCenterY = stageHeight / 2;
        const offsetX = stageCenterX - centerX * scale;
        const offsetY = stageCenterY - centerY * scale;

        // 6. 更新舞台的缩放和位置
        layer.scale({ x: scale, y: scale });
        layer.position({ x: offsetX, y: offsetY });
        this.oldScale = scale;

        layer.draw();
    }
    fitToScreen_bak() {
        let layer = this.getLayer();
        this.oldScale = 1;
        layer.scale({x: 1, y: 1})
        layer.position({ x: 0, y: 0 });
        layer.draw();
    }

    destroy() {
        if (this.observer) {
            this.observer.disconnect();
        }
        this.layer.off();
        this.stage.off();
        this.layer.destroyChildren()
        this.waterLayer.destroyChildren()
        this.bgLayer.destroyChildren()
        this.stage.destroyChildren()
        this.stage.destroy()

        let container = document.getElementById(this.stage.container().id);
        if (container) {
            container.innerHTML = '';
        }
    }
}
