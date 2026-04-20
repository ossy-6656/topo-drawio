import GraphTool from '@/plugins/tmzx/graph/GraphTool.js'
import mathutil from '@/plugins/tmzx/mathutil.js'

let regScale = /scale\([^)]+\)/gi
let regRotate = /rotate\([^)]+\)/gi

export default class SvgBase {

    setGraph(graph) {
        this.graph = graph;
    }

    getGraph() {
        return this.graph;
    }

    getWidgetMap() {
        return this.widgetMap;
    }

    getMetaMap() {
        return this.metaMap;
    }

    getSymbolMap() {
        return this.symbolMap;
    }

    setSymbolMap(symbolMap) {
        this.symbolMap = symbolMap;
    }

    styleObj2Str(obj) {
        let sb = []
        for (let key in obj) {
            if (key && !obj[key]) {
                sb.push(key)
            } else {
                sb.push(`${key}=${obj[key]};`)
            }
        }
        return sb.join('')
    }

    getTransform(transform) {
        let match1, match2
        if (transform) {
            match1 = transform.match(regScale)
            match2 = transform.match(regRotate)
        }

        let param = {}
        if (match1) {
            let str = match1[0]
            let i1 = str.indexOf('(')
            let i2 = str.indexOf(')')
            let scaleStr = str.substring(i1 + 1, i2)
            let sarr = scaleStr.split(',')
            param['scale'] = parseFloat(sarr[0].trim())
        }
        if (match2) {
            let str = match2[0]
            let i1 = str.indexOf('(')
            let i2 = str.indexOf(')')
            let rotateStr = str.substring(i1 + 1, i2)
            let rarr = rotateStr.split(',')
            param['rotate'] = parseFloat(rarr[0].trim())
        }
        if (!param['scale']) {
            param['scale'] = 1
        }
        if (!param['rotate']) {
            param['rotate'] = 0
        }
        return param
    }

    /**
     * 获取节点下元数据map
     * @param node
     * @returns {{}}
     */
    getPropMap(node) {
        let map = {}
        let list = node.children()
        list.each((index, item) => {
            let nodeName = item.nodeName

            if (!map[nodeName]) {
                if (nodeName == 'cge:GLink_Ref') {
                    map[nodeName] = []
                } else {
                    map[nodeName] = {}
                }
            }

            if (nodeName === 'cge:GLink_Ref') {
                map[nodeName].push({
                    id: item.getAttribute('ObjectID'),
                    rel: item.getAttribute('ObjectLinkPos')
                })
            } else {
                let nameList = item.getAttributeNames()
                for (let name of nameList) {
                    map[nodeName][name] = item.getAttribute(name)
                }
            }
        })
        return map
    }

    // 获取svg的symbol及style，静态的部分
    getSvgSymbolStyle(txt) {
        let xmlDecReg = /<\?.+?(?=\?>)\?>/is
        let svgTagReg = /<svg[^>]+>/is
        let defsContentReg = /<defs>.+?(?=<\/defs>)<\/defs>/is
        let bgColorReg = /<g id="BackGround_Layer">.+?(?=<\/g>)<\/g>/is

        let xmlDec = txt.match(xmlDecReg) // <?xml version="1.0" encoding="UTF-8" standalone="no"?>
        let svgTag = txt.match(svgTagReg) // <svg ...>
        let defsContent = txt.match(defsContentReg) // <defs>...</defs>
        let bgColor = txt.match(bgColorReg) // <g id="BackGround_Layer">...</g>
        return {
            xmlDec: xmlDec ? xmlDec[0].replace(/\t/gs, '').replace(/ {2,}/gs, ' ') : '', // xml声明
            svgTag: svgTag ? svgTag[0].replace(/\t/gs, '').replace(/ {2,}/gs, ' ') : '',
            defsContent: defsContent? defsContent[0].replace(/\t/gs, '').replace(/ {2,}/gs, ' '): '',
            bgColor: bgColor ? bgColor[0] : ''
        }
    }

    parseDefs(node) {
        let reg1 = /\.?[a-zA-Z0-9]+[^{]*\{[^}]+\}/g //全局查找
        let reg2 = /\.?([a-zA-Z0-9]+[^{]*)\{([^}]+)\}/ // 单css查找
        let style = (this.style = {})
        let str = node.innerHTML.replace('<![CDATA[', '').replace(']]>', '').trim()
        let list1 = str.match(reg1)

        let getProps = (css) => {
            let obj = {}
            css = css.trim()
            let list = css.split(';')
            for (let item of list) {
                if (!item) {
                    continue
                }
                let arr = item.split(':')
                let key, v
                try {
                    key = arr[0].trim()
                    v = arr[1].trim().toLowerCase()
                } catch (e) {
                    debugger
                }

                if (key == 'stroke') {
                    // 这玩意不识别rgb
                    v = v.replace('rgb(', '').replace(')', '')
                    let varr = v.split(',').map((c) => +c.trim())
                    v = mathutil.rgb2hex(...varr)
                }
                obj[key] = v
            }
            return obj
        }
        for (let str of list1) {
            str = str.trim()
            let g = reg2.exec(str)
            let key = g[1].trim()
            let v = g[2].trim()
            style[key] = getProps(v)
        }
    }

    loadSvg(svgtxt, callback) {
        let parser = new DOMParser()
        let doc = parser.parseFromString(svgtxt, 'text/xml')

        this.svgDom = doc.getElementsByTagName('svg')[0];
        callback()
    }

    // 动态计算线与设备的连接关系
    getLinkRel(startPoint, endPoint, id) {
        let graph = this.graph;
        let model = graph.getModel();

        let widgetMap = this.getWidgetMap();
        let symbolMap = this.getSymbolMap();

        let vertex = widgetMap.get(id);

        let symbol = vertex.symbol;

        let lineFlag, vertexFlag;
        if (symbol === 'busbar')
        {
            vertexFlag = '0';


            let p1 = GraphTool.getTouchPoint(graph, vertex, 0, .5);
            let p2 = GraphTool.getTouchPoint(graph, vertex, 1, .5);

            let len1 = mathutil.distancePointToLine(startPoint, p1, p2);
            let len2 = mathutil.distancePointToLine(endPoint, p1, p2);

            lineFlag = len1 < len2 ? '0' : '1';
        }
        else if (symbol === 'station') {
            vertexFlag = '0';
            let geo = model.getGeometry(vertex);
            let cx = geo.getCenterX();
            let cy = geo.getCenterY();

            let p = new Vector2(cx, cy);

            let len1 = mathutil.pixelLen(p, startPoint);
            let len2 = mathutil.pixelLen(p, endPoint);

            lineFlag = len1 < len2 ? '0' : '1';
        }
        else
        {
            let symbolAttr = symbolMap[symbol];
            let {initWidth, initHeight, touchs, xratio, yratio} = symbolAttr;

            if (touchs == 1) {
                let touchO = symbolAttr.o || symbolAttr.b || symbolAttr.a;
                let p = GraphTool.getTouchPoint(graph, vertex, touchO.x, touchO.y);
                let lenStart = startPoint.clone().sub(p).length();
                let lenEnd = endPoint.clone().sub(p).length();

                lineFlag = lenStart < lenEnd ? '0': '1';
                vertexFlag = '0';
            } else if (touchs == 2) {
                let touchA = symbolAttr.a;
                let touchB = symbolAttr.b;

                let pa = GraphTool.getTouchPoint(graph, vertex, touchA.x, touchA.y);
                let pb = GraphTool.getTouchPoint(graph, vertex, touchB.x, touchB.y);

                let minLen;

                let len_lineA_2_vertexA = startPoint.clone().sub(pa).length();
                let len_lineA_2_vertexB = startPoint.clone().sub(pb).length();

                let len_lineB_2_vertexA = endPoint.clone().sub(pa).length();
                let len_lineB_2_vertexB = endPoint.clone().sub(pb).length();

                if (len_lineA_2_vertexA < len_lineA_2_vertexB) {
                    minLen = len_lineA_2_vertexA;
                    lineFlag = '0';
                    vertexFlag = '0';
                } else {
                    minLen = len_lineA_2_vertexB;
                    lineFlag = '0';
                    vertexFlag = '1';
                }

                if (len_lineB_2_vertexA < minLen) {
                    minLen = len_lineB_2_vertexA;
                    lineFlag = '1';
                    vertexFlag = '0';
                }

                if (len_lineB_2_vertexB < minLen) {
                    minLen = len_lineB_2_vertexB
                    lineFlag = '1';
                    vertexFlag = '1';
                }
            } else if (touchs == 3) {
                let touchA = symbolAttr.a
                let touchB = symbolAttr.b

                let pa = GraphTool.getTouchPoint(graph, vertex, touchA.x, touchA.y)
                let pb = GraphTool.getTouchPoint(graph, vertex, touchB.x, touchB.y)

                let minLen

                let len_lineA_2_vertexA = startPoint.clone().sub(pa).length()
                let len_lineA_2_vertexB = startPoint.clone().sub(pb).length()



                let len_lineB_2_vertexA = endPoint.clone().sub(pa).length()
                let len_lineB_2_vertexB = endPoint.clone().sub(pb).length()

                if (len_lineA_2_vertexA < len_lineA_2_vertexB) {
                    minLen = len_lineA_2_vertexA
                    lineFlag = '0'
                    vertexFlag = '0'
                } else {
                    minLen = len_lineA_2_vertexB
                    lineFlag = '0'
                    vertexFlag = '1'
                }

                if (len_lineB_2_vertexA < minLen) {
                    minLen = len_lineB_2_vertexA
                    lineFlag = '1'
                    vertexFlag = '0'
                }

                if (len_lineB_2_vertexB < minLen) {
                    minLen = len_lineB_2_vertexB
                    lineFlag = '1'
                    vertexFlag = '1'
                }
            }
        }

        return lineFlag + '_' + vertexFlag;
    }

    // 设备是否在站房中
    isContain (outerDev, innerDev) {
        let graph = this.graph
        let model = graph.getModel()

        let geoOuter = model.getGeometry(outerDev)
        let geoInner = model.getGeometry(innerDev)

        let cx = geoInner.getCenterX()
        let cy = geoInner.getCenterY()

        // cx = geoInner.x
        // cy = geoInner.y

        let xmin = geoOuter.x
        let ymin = geoOuter.y
        let xmax = geoOuter.x + geoOuter.width
        let ymax = geoOuter.y + geoOuter.height

        let b1 = cx > xmin && cx < xmax
        let b2 = cy > ymin && cy < ymax

        return b1 && b2
    }

    // 线是否在站房中
    isContainLine (outerDev, line) {
        let graph = this.graph
        let model = graph.getModel()
        let geoOuter = model.getGeometry(outerDev)

        let xmin = geoOuter.x
        let ymin = geoOuter.y
        let xmax = geoOuter.x + geoOuter.width
        let ymax = geoOuter.y + geoOuter.height

        let geoLine = model.getGeometry(line)

        let pointLs = []
        pointLs.push(geoLine.sourcePoint)
        if (geoLine.points && geoLine.points.length > 0) {
            pointLs.push(...geoLine.points)
        }
        pointLs.push(geoLine.targetPoint)

        let isPass = true

        for (let p of pointLs) {
            let b1 = p.x > xmin && p.x < xmax
            let b2 = p.y > ymin && p.y < ymax

            if (!b1 || !b2) {
                isPass = false
                break
            }
        }
        return isPass
    }
}
