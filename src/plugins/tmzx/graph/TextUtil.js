import CorUtil from '@/plugins/tmzx/CorUtil.js'
import Mathutil from '@/plugins/tmzx/mathutil.js'
import TextSplitTool from '@/plugins/tmzx/graph/TextSplitTool.js'

let TextUtil = {
    parseStyle(style) {
        let obj = {}
        if (!style) {
            return obj
        }

        let arr = style.split(';')
        for (let item of arr) {
            let arr2 = item.split(':')
            obj[arr2[0]] = arr2[1]
        }
        return obj
    },
    parseDrawioStyle(style) {
        let obj = {}
        if (!style) {
            return obj
        }

        let arr = style.split(';')
        for (let item of arr) {
            let arr2 = item.split('=')
            if (!arr2[0]) {
                continue
            }
            obj[arr2[0]] = arr2[1]
        }
        return obj
    },
    measureTextDimension(text, fontSize, fontFamily, fontWeight = 'normal') {
        let canvas = document.getElementById('textCanvas')
        let context = canvas.getContext('2d')

        context.font = `${fontWeight} ${fontSize}px ${fontFamily}`

        // 计算宽度
        let metrics = context.measureText(text)
        let textWidth = metrics.width

        // 计算文本高度（通过近似方法）
        let textHeight = Math.ceil(
            metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent
        )

        return {
            width: textWidth,
            height: textHeight
        }
    },
    bboxText(svg_d3, str, fs, ff = 'SimSun') {
        let text = svg_d3
            .append('text')
            .attr('style', `font-size:${fs}px; font-family: ${ff};`)
            .attr('y', 100)
            .text(str)

        let textNode = text.node()
        let bbox = textNode.getBBox()
        text.remove()
        return bbox
    },
    // 判断是否为单字节，true:单字节
    isSingleByteChar(char) {
        let code = char.charCodeAt(0)
        return code >= 0 && code <= 0x7f
    },
    /**
     * 计算字符串长度，用于计算font-size，单字节算半个
     * @param str
     * @returns {number}
     */
    strLength(str) {
        let len = 0.0
        for (let i = 0; i < str.length; i++) {
            // let c = str.charCodeAt(i);
            let c = str[i]
            if (this.isSingleByteChar(c)) {
                len += 0.5
            } else {
                len += 1.0
            }
        }
        return len
    },
    // 获取字符串像素大小
    getStrWidth(fs, str) {
        let len = 0.0
        for (let i = 0; i < str.length; i++) {
            // let c = str.charCodeAt(i);
            let c = str[i]
            if (this.isSingleByteChar(c)) {
                len += fs / 2
            } else {
                len += fs
            }
        }
        return len
    },
    /**
     * 计算文本group左上角坐标
     * text-anchor:start, middle
     * @param list 原生dom数组
     */
    getLeftTopCor_bak(list) {
        let x,
            y,
            firstFlag = true

        let fs = +$(list[0]).attr('font-size') // 字体大小

        for (let tmpNode of list) {
            let $node = $(tmpNode)
            let anchor = $node.css('text-anchor')
            let tmpx = +tmpNode.getAttribute('x')
            let _str = tmpNode.innerHTML

            if (anchor != 'start') {
                let txtWidth = this.getStrWidth(fs, _str)
                if (anchor == 'middle') {
                    tmpx = tmpx - txtWidth / 2
                } else if (anchor == 'end') {
                    tmpx = tmpx - txtWidth
                }
            }

            if (firstFlag) {
                firstFlag = false
                x = tmpx
                y = +tmpNode.getAttribute('y') // 第一个y坐标为左上角坐标
            } else {
                if (tmpx < x) {
                    x = tmpx
                }
            }
        }
        return { x, y }
    },
    getLeftTopCor(list, width) {
        let x,
            y,
            firstFlag = true

        let $first = $(list[0])

        let fs = +$first.attr('font-size') // 字体大小
        let style = $first.attr('style')
        let param = this.parseStyle(style)
        let anchor = param['text-anchor']
        x = $first.attr('x')
        y = $first.attr('y')

        if (anchor == 'middle') {
            x = x - width / 2
        } else if (anchor == 'right') {
            x = x - width
        }
        y = y - fs
        return { x, y }
    },
    /**
     * 计算文本组左上角坐标
     * @param list
     * @param dimension
     * @param transform
     * @returns {*}
     */
    getLeftTopCorPlus(list, dimension, transform) {
        let $node = $(list[0])
        let fs = +$node.attr('font-size') // 字体大小
        let style = $node.attr('style')
        let param = this.parseStyle(style)
        let anchor = param['text-anchor']

        let rotate = transform.rotate
        let { width, height } = dimension

        let radian = -Mathutil.angle2Radian(rotate)

        let initX,
            initY = 0
        if (anchor == 'start') {
            // initX = -(width / 2 - fs / 2);
            initX = -(width / 2)
        } else if (anchor == 'middle') {
            initX = 0
        } else if (anchor == 'end') {
            // initX = width / 2 - fs / 2;
            initX = width / 2
        }

        // if (list.length > 1) {
        //     initY = -(height / 2 - fs);
        // }
        initY = -(height / 2 - fs)

        let vecInit = new Vector2(initX, initY)
        let x1 = +$node.attr('x')
        let y1 = +$node.attr('y')

        let vecFinal = new Vector2(x1, y1)
        let m = Mathutil.commonMatrix(null, radian, null)

        let vecRot = vecInit.applyMatrix3(m)

        let tran = vecFinal.clone().sub(vecRot)

        let vecLt = new Vector2(-width / 2, -height / 2)
        return vecLt.clone().add(tran)
    },

    /**
     * 根据字符串范围计算对齐方式
     * @param {{xmin, xmax}[]} list - 字符串最小坐标与最大坐标数组
     * @param {Number}         fontSize     - 字符大小
     * @returns {string}       left、center、right
     */
    checkTextAlign(list, fontSize) {
        let tolarence = fontSize / 3

        let isLeft = true
        // 检查是否居左
        for (let i = 0; i < list.length - 1; i++) {
            let itemPre = list[i]
            let itemNext = list[i + 1]

            if (Math.abs(itemPre.xmin - itemNext.xmin) > tolarence) {
                isLeft = false
                break
            }
        }

        if (isLeft) {
            return 'left'
        }

        let isRight = true
        // 检查是否居右
        for (let i = 0; i < list.length - 1; i++) {
            let itemPre = list[i]
            let itemNext = list[i + 1]

            if (Math.abs(itemPre.xmax - itemNext.xmax) > tolarence) {
                isRight = false
                break
            }
        }

        if (isRight) {
            return 'right'
        }
        return 'center'
    },
    /**
     * 计算svg的文本的宽高
     * @param fs
     * @param list
     */
    getTextDimension(fs, list) {
        let width = 0
        let height = 0

        for (let txt of list) {
            let _str = txt.innerHTML.trim()
            let tmpW = this.getStrWidth(fs, _str)
            if (tmpW > width) {
                width = tmpW
            }
            height += fs
        }

        return { width, height }
    },

    // 使用隐藏dom计算（不如手动计算）
    getTextDimensionHTML(texts, style = {}) {

        // 1、创建隐藏的临时DOM元素（用于渲染文本）
        const tmpSpan = document.createElement('span');
        tmpSpan.style.visibility = 'hidden';
        tmpSpan.style.position = 'absolute';
        tmpSpan.style.whiteSpace = 'nowrap'; // 禁止换行（确保单个字符宽高准确）

        // 2、应用文本样式（默认值适配大多数场景）
        tmpSpan.style.fontFamily = style['fontFamily'] || 'Arial, sans-serif';
        tmpSpan.style.fontSize = style['fontSize'] || '16px'
        tmpSpan.style.letterSpacing = style['letterSpacing'] || '0px'
        tmpSpan.style.lineHeight = style['lineHeight'] || 'normal'

        document.body.appendChild(tmpSpan)
        let totalWidth = 0;
        let totalHeight = 0;
        let singleSizes = []

        // 3、遍历所有字符串，计算单个宽高并汇总
        for(let text of texts) {
            tmpSpan.textContent = text

            // 获取单个字符串的真实宽高
            let width = tmpSpan.offsetWidth
            let height = tmpSpan.offsetHeight
            singleSizes.push({text, width, height})

            totalWidth = Math.max(totalWidth, width)
            totalHeight = totalHeight + height
        }

        document.body.removeChild(tmpSpan)
        return {
            width: totalWidth,
            height: totalHeight,
            singleSizes
        }
    },

    calculateMultiTextSizeByCanvas(texts, style) {
        let canvas = document.createElement('canvas');
        let ctx = canvas.getContext('2d');

        let fontSize = style['fontSize'] || 16;
        ctx.font = `${style.fontWeight || 'normal'} ${fontSize}px ${style.fontFamily || 'Arial, sans-serif'}`;
        ctx.textBaseline = 'top'; // 文本基线设为顶部，方便高度计算


        let totalWidth = 0;
        let totalHeight = 0;
        let singleSizes = []

        for(let text of texts) {

            let measure = ctx.measureText(text);
            // 获取单个字符串的真实宽高
            let width = measure.width
            // 计算高度：字体大小 约等于 文本高度（精确值可通过 measure.）
            let height = measure.actualBoundingBoxAscent + measure.actualBoundingBoxDescent || fontSize * 1.2;
            singleSizes.push({text, width, height})

            totalWidth = Math.max(totalWidth, width)
            totalHeight = totalHeight + height
        }

        return {
            width: totalWidth,
            height: totalHeight,
            singleSizes
        }
    },

    getTextDimensionFromTxtList(fs, list) {
        let width = 0
        let height = 0

        for (let str of list) {
            let tmpW = this.getStrWidth(fs, str)
            if (tmpW > width) {
                width = tmpW
            }
            height += fs
        }

        return { width, height }
    },
    // getTextDimension(svg_container, fs, ff, list) {
    //     let svg_width = 0, svg_height = 0;
    //     for(let txt of list) {
    //         let {width, height} = this.bboxText(svg_container, txt, fs, ff);
    //         svg_width = svg_width + width;
    //         svg_height = svg_height + height;
    //     }
    //     return {
    //         width: svg_width,
    //         height: svg_height
    //     }
    // },
    getTextList(list) {
        let sbtxt = []
        for (let txt of list) {
            let _str = txt.innerHTML.trim()
            sbtxt.push(_str)
        }
        return sbtxt
    },
    getTxtListFromStr(str) {
        return str.split('\\r?\\n')
    },
    /**
     * 计算文本中心坐标
     * @param map_param
     * @param x
     * @param y
     * @param width
     * @param height
     * @returns {{lng: (*|number|number|number), lat: (number|*)}}
     */
    getTextCenterGeo(map_param, x, y, width, height) {
        let geo_mer_x = map_param.minx + (x + width / 2) * map_param.ratio.x_ratio
        let geo_mer_y = map_param.maxy - (y + height / 2) * map_param.ratio.y_ratio
        let [geo_y, geo_x] = CorUtil.webMercator2lonLat(geo_mer_y, geo_mer_x)
        return {
            lng: geo_x,
            lat: geo_y
        }
    },
    /**
     * 根据宽高计算文本大小
     * @param list
     * @param width
     * @param height
     */
    getFontSizeFromDimension(list, width, height) {
        let height_fs = height / list.length

        let width_fs = 0
        let len = 0
        // 寻找最长的字符串
        for (let txt of list) {
            let tmplen = this.strLength(txt)
            if (tmplen > len) {
                len = tmplen
            }
        }
        width_fs = width / len
        return width_fs < height_fs ? width_fs : height_fs
    },

    getVerticalTextArr_bak(name) {
        if (name) {
            name = name.trim().replace(/\n| /g, '')
        }

        let list = []
        // let txtReg = /(?:#?\d+-#?\d+)|(?:\([^)]+\))|(?:（[^）]+）)|(?:#?\d+(?:kva|kv|#|\*|号)?)|(?:[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅪⅫ]+)|变压器|箱变|(?:[^()（）*#0123456789]+?)/ig;
        let txtReg =
            /(?:#?\d+-#?\d+)|(?:[（(][^）)]+[)）])|(?:#?\d+(?:kva|kv|#|\*|号)?)|(?:[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅪⅫ]+)|变压器|箱变|台区|(?:[^-()（）#ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅪⅫ\d]+)/gi
        let arr = name.match(txtReg)

        let num = 0
        while (arr && arr.length > 0) {
            if (num > 30) {
                break
            }
            let len = arr[0].length
            list.push(arr[0])
            name = name.slice(len)
            arr = name.match(txtReg)
            num++
        }
        return list
    },
    getVerticalTextArr(name) {
        if (name) {
            name = name.trim().replace(/\n| /g, '')
        }

        let list = TextSplitTool.split(name)
        return list
    },
    // 仅竖排汉字
    getCVerticalTextArr(name) {
        if (name) {
            name = name.trim().replace(/\n| /g, '')
        }
        let list = TextSplitTool.csplit(name)
        return list
    },
    // 去掉空白符比较
    compareTextContent(txt1, txt2) {
        txt1 = txt1.replace(/\r\n|\r|\n|\r/g, '')
        txt2 = txt2.replace(/\r\n|\r|\n|\r/g, '')
        return txt1 === txt2
    }
}
export default TextUtil
