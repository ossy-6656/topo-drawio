var positionTool = {
    radianPerAngle: Math.PI / 180,
    anglePerRadian: 180 / Math.PI,
    map: null,
    constructor: function (map)
    {
        this.map = map;
        this.spatialRef84 = new SpatialReference({wkid: 4326});
    },
    angle2Radian: function (angle) {
        return angle * this.radianPerAngle;
    },
    radian2Angle: function (radian) {
        return radian * this.anglePerRadian;
    },
    //屏幕坐标转地理坐标
    pixel2geo: function (pixel)
    {
        let gCor = this.map.toMap(new ScreenPoint(pixel[0], pixel[1]));
        return [gCor.x, gCor.y];
    },
    //地理坐标转屏幕坐标
    geo2Pixel: function (acor)
    {
        let p = new Point(acor[0], acor[1], this.map.spatialReference);
        let sCor = this.map.toScreen(p);
        return [sCor.x, sCor.y];
    },
    isMercator: function()
    {
        let map = this.map;
        let spatialReference = map.spatialReference;
        return spatialReference.isWebMercator();
    },
    /**
     * 根据两点求一次方程(由x求y)
     * @param p1
     * @param p2
     * @returns 一次方程函数
     */
    linerEquationFromX: function (p1, p2)
    {
        let fun = function (x) {
            return (p2[1] - p1[1]) / (p2[0] - p1[0]) * (x - p1[0]) + p1[1];
        };
        return fun;
    },
    //由Y值求X值
    linerEquationFromY: function (p1, p2)
    {
        let fun = function (y) {
            return (y - p1[1]) * ((p2[0] - p1[0]) / (p2[1] - p1[1])) + p1[0];
        };
        return fun;
    },
    /**
     * 求两直线交点
     * p1,p2第一条直线
     * p3,p4第二条直线
     * @param p1
     * @param p2
     * @param p3
     * @param p4
     * @returns {number[]}
     */
    getIntersectionCor: function(p1, p2, p3, p4)
    {
        let a1 = p1[1] - p2[1];
        let b1 = p2[0] - p1[0];
        let c1 = p1[0] * p2[1] - p2[0] * p1[1];

        let a2 = p3[1] - p4[1];
        let b2 = p4[0] - p3[0];
        let c2 = p3[0] * p4[1] - p4[0] * p3[1];

        let x = (b1 * c2 - b2 * c1) / (a1 * b2 - a2 * b1);
        let y = (a2 * c1 - a1 * c2) / (a1 * b2 - a2 * b1);
        return [x, y];
    },
    /**
     * 根据两直线求相交的点坐标
     * @param p1
     * @param p2
     * @param p11
     * @param p22
     * @returns {number}
     */
    getIntersectionCor2: function(p1, p2, p11, p22)
    {
        let x = 0, y = 0;
        if (p1[1] - p2[1] == 0) //如果线1角度为0
        {
            y = p1[1];
            if (p11[0] - p22[0] == 0) //线2角度为90
            {
                x = p11[0];
            }
            else
            {
                let fun = this.linerEquationFromY(p11, p22);
                x = fun(y);
            }
        }
        else if (p1[0] - p2[0] == 0) //如果线1角度为90
        {
            x = p1[0];
            if (p11[1] - p22[1] == 0) //线2为0度
            {
                y = p11[1];
            }
            else
            {
                let fun = this.linerEquationFromX(p11, p22);
                y = fun(x);
            }
        }


        x = 1 + (p11[1] - p1[1]) / ((p2[1] - p1[1]) / (p2[0] - p1[0]) - (p22[1] - p11[1]) / (p22[0] - p11[0]));
        return [x, y];
    },
    /**
     * 求点到直线的距离
     * @param p1 线的点1
     * @param p2 线的点2
     * @param p  要计算的点
     * @returns {number}
     */
    getPoint2LineLen: function(p1, p2, p)
    {
        let A = - (p2[1] - p1[1]) / (p2[0] - p1[0]);
        let B = 1;
        let C = (p2[1] - p1[1]) / (p2[0] - p1[0]) * p1[0] - p1[1];
        let top = Math.abs(A * p[0] + B * p[1] + C);
        let bottom = Math.sqrt(Math.pow(A, 2) + Math.pow(B, 2));
        return top / bottom;
    },
    createPolyline: function(points) {
        let polyline = new Polyline(points);
        polyline.setSpatialReference(this.map.spatialReference);
        return polyline;
    },
    create84Polyline: function(points) {
        let polyline = new Polyline(points);
        polyline.setSpatialReference(this.spatialRef84);
        return polyline;
    },
    /**
     * 计算两个坐标之间的距离
     * @param p1 [x,y]
     * @param p2 [x,y]
     * @returns {number} 返回米
     */
    distance: function (p1, p2) {
        if (this.isMercator())
        {
            p1 = PositionUtil.webMercator_to_gps84(p1);
            p2 = PositionUtil.webMercator_to_gps84(p2);
        }

        //经纬度转弧度
        let lat1 = this.convertDegreesToRadians(p1[1]);
        let lon1 = this.convertDegreesToRadians(p1[0]);
        let lat2 = this.convertDegreesToRadians(p2[1]);
        let lon2 = this.convertDegreesToRadians(p2[0]);

        let vLon =Math.abs(lon1-lon2);
        let vLat=Math.abs(lat1-lat2);

        let h = this.haverSin(vLat) + Math.cos(lat1) * Math.cos(lat2) * this.haverSin(vLon);
        return 2 * 6371 * Math.asin(Math.sqrt(h)) *1000;
    },
    /**
     * 获取两个屏幕坐标的距离
     * @param p1
     * @param p2
     * @returns {number}
     */
    getPixelLen: function(p1, p2)
    {
        return Math.sqrt(Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2));
    },
    haverSin: function (theta) {
        let v = Math.sin(theta/2);
        return v*v;
    },
    //经纬度转弧度
    convertDegreesToRadians: function (angle) {
        return angle * this.radianPerAngle;
    },
    //弧度转角度
    convertRadiansToDegrees: function (radian) {
        return radian * this.anglePerRadian;
    },
    //计算两个设备间的距离
    calculateLength: function (startPoint, endPoint)
    {
        let polyline = this.create84Polyline([[startPoint.x, startPoint.y], [endPoint.x, endPoint.y]]);
        //let len = geometryEngine.distance(startPoint, endPoint, 'meters');
        let len = geometryEngine.geodesicLength(polyline, 'meters');
        //let len = geodesicUtils.geodesicLengths(polyline, Units.METERS);
        return len;
    },

    //计算一条线的距离
    calculateLineGeoLength: function(points) {
        let polyline = this.create84Polyline(points);
        let len = geometryEngine.geodesicLength(polyline, 'meters');
        return len;
    },
    /**
     * 注：标准坐标系下求角度
     * 根据两屏幕坐标点坐标计算设备角度
     * 起始点和结束点不可反
     * @param startPos [x,y] 起始点
     * @param endPos [x,y]   结束点
     * @returns {number} 0 ~ 360
     */
    getSymbolAngle: function (startPos, endPos)
    {
        // let radian = Math.atan2(endPos[1] - startPos[1], endPos[0] - startPos[0]);
        // //由于Y坐标是反的，所以要取负值
        // radian = -radian;
        // let angle = radian * this.anglePerRadian;
        // return angle;

        // 改为向量求坐标
        let vecStart = new Vector2(startPos[0], startPos[1]);
        let vecEnd = new Vector2(endPos[0], endPos[1]);
        let dir1 = vecEnd.clone().sub(vecStart).normalize();
        let dir2 = new Vector2(1, 0);
        let cosAngle = dir1.dot(dir2);
        let radianAngle = Math.acos(cosAngle);
        let angle = radianAngle * this.anglePerRadian;
        // 判断当大于180时候
        if (dir1.y < 0) {
            angle = 360 - angle;
        }
        return angle;
    },
    /**
     * 绕点旋转矩阵
     * @param p
     * @param angle
     */
    rotateOnPoint(p, angle) {
        let tran1Matrx = new Matrix3();
        tran1Matrx.translate(p[0], p[1]);

        let tran2Matrix = new Matrix3();
        tran2Matrix.translate(-p[0], -p[1]);

        let rotateMatrx = new Matrix3();
        rotateMatrx.rotate(this.radianPerAngle * angle);

        return tran1Matrx.multiply(rotateMatrx).multiply(tran2Matrix);
    },
    /**
     * 获取两个屏幕坐标的距离
     * @param p1
     * @param p2
     * @returns {number}
     */
    getScreenLenOfScreenPoints: function(p1, p2)
    {
        return Math.sqrt(Math.pow(p1[0] - p2[0], 2) + Math.pow(p1[1] - p2[1], 2));
    },
    /**
     * 计算两个地理坐标的屏幕距离
     * @param gp1
     * @param gp2
     */
    getScreenLenOfGeoPoints: function(gp1, gp2)
    {
        let sp1 = this.geo2Pixel(gp1);
        let sp2 = this.geo2Pixel(gp2);
        return this.getScreenLenOfScreenPoints(sp1, sp2);
    },
    /**
     * 获取线的屏幕长度
     * @param lineWidget
     * @returns {*|number}
     */
    getLineScreenLength: function(lineWidget)
    {
        let points = lineWidget.getGeoPoints();
        let gp1 = points[0];
        let gp2 = points[points.length - 1];
        //let sp1 = this.geo2Pixel(gp1);
        //let sp2 = this.geo2Pixel(gp2);
        return this.getScreenLenOfGeoPoints(gp1, gp2);
    },
    //计算两点的中心点
    getCenterPointOfTwoPoint: function(sp1, sp2)
    {
        let cx = (sp1[0] + sp2[0]) / 2;
        let cy = (sp1[1] + sp2[1]) / 2;
        return [cx, cy];
    },
    getTouchPoints: function(sbzlx, o, angle)
    {
        let map = this.map;
        let wkid = map.spatialReference.wkid;
        let symbolScaleAttr = PointDataConfig.getSymbolScaleAttr(wkid);
        let level = this.map.getLevel();
        //获取符号的属性值
        let params = symbolScaleAttr[sbzlx];
        //图元当前缩放级别
        let scaleLevel = (!params['scale']) ? symbolScaleAttr.scale : params['scale'];
        //图元初始大小
        let initWidth = (!params['width']) ? symbolScaleAttr.width : params['width'];
        let scale = scaleLevel[level];
        //获取图元实际大小
        let width = initWidth * scale;

        params = null;
        let touchPoints = PointDataConfig.touchPoints[sbzlx];
        if (touchPoints == 2)
        {   //两触点设备
            let positions = this.getTouchGeoPointsOfSymbol(width, o, angle);
            params = {
                a: positions.a,
                b: positions.b
            }
        }
        return params;
    },
    _getCircleSymbolTouchPosition: function (widget, touchAngle) {
        let dimention = widget.getDimension();
        let width = dimention.width;
        let height = dimention.height;
        //获取图元实际大小
        let radius = width / 2;
        let screenCenter = this.geo2Pixel(widget.o);

        let deg = this.angle2Radian(widget.getAngle() + touchAngle);
        let x = screenCenter[0] + radius * Math.cos(deg);
        let y = screenCenter[1] - radius * Math.sin(deg);
        let pos = this.pixel2geo([x,y]);
        return pos;
    },
    //angle为触点在符号上的角度
    _getRectSymbolTouchPosition: function (widget, touchAngle) {
        let dimention = widget.getDimension();
        let screenCenCor = this.geo2Pixel(widget.getO());

        let width = dimention.width;
        let height = dimention.height;

        let halfWidth = width / 2;
        let halfHeight = height / 2;

        let radian = Math.atan2(halfHeight, halfWidth);
        let stepAngle = this.radian2Angle(radian);

        let widgetRadian = this.angle2Radian(widget.getAngle());

        let len;

        let touchRadian = this.angle2Radian(touchAngle);
        let deg = touchRadian + widgetRadian;

        if ((touchAngle >= stepAngle && touchAngle <= 180 - stepAngle) || (touchAngle >= stepAngle - 180 && touchAngle <= -stepAngle)) {
            len = Math.abs(halfHeight / Math.sin(touchRadian));
        } else {
            len = Math.abs(halfWidth / Math.cos(touchRadian));
        }
        let x = screenCenCor[0] + len * Math.cos(deg);
        let y = screenCenCor[1] - len * Math.sin(deg);
        let pos = this.pixel2geo([x,y]);
        return pos;
    },
    /**
     * 获取单触点设备位置
     * @param widget
     * @param touchAngle 连接点角度
     * @returns {{curPoint: *, curSide: string, nextPoint: *, nextSide: string}}
     */
    getSymbolTouchPosition: function (widget, touchAngle)
    {
        let sbzlx = widget.getSbzlx();
        let pos = null;
        if (PointDataConfig.isCircleSymbol(sbzlx)) {
            pos = this._getCircleSymbolTouchPosition(widget, touchAngle);
        } else if (PointDataConfig.isRectSymbol(sbzlx)) {
            pos = this._getRectSymbolTouchPosition(widget, touchAngle);
        }
        return pos;
    },
    /**
     * 获取圆边缘连接点地理坐标
     * @param widget
     * @param sp 当前屏幕坐标
     */
    _getCircleGeoPointParams: function (widget, sp) {
        let so = this.geo2Pixel(widget.getO());
        // let widgetAngle = widget.getAngle();
        let angle = this.getSymbolAngle([so[0], -so[1]], [sp[0], -sp[1]]);
        let dimention = widget.getDimension();
        let width = dimention.width;

        //获取图元实际大小
        let radius = width / 2;
        let deg = this.angle2Radian(angle);
        let x = so[0] + radius * Math.cos(deg);
        let y = so[1] - radius * Math.sin(deg);
        let pos = this.pixel2geo([x,y]);

        return {
            pos: pos,
            angle: angle
        };
    },
    /**
     * 获取取矩形边缘连接点
     * @param widget 矩形设备
     * @param sp     鼠标当前屏幕位置
     * @returns {{pos: [*,*], angle: number}}
     * @private
     */
    _getRectGeoPointParams: function (widget, sp)
    {
        let sc = this.geo2Pixel(widget.getO());
        let bounds = widget.getBounds();
        let lt = bounds[0];
        let lb = bounds[1];
        let rb = bounds[2];
        let rt = bounds[3];

        let mouseAngle = this.getSymbolAngle([sc[0], -sc[1]], [sp[0], -sp[1]]);


        // 延长中心到鼠标的线以相交边框
        let vec1 = new Vector2(sc[0], -sc[1]);
        let vec2 = new Vector2(sp[0], -sp[1]);
        let dir = vec2.clone().sub(vec1).normalize().multiplyScalar(1000);
        let pvec = vec1.clone().add(dir);


        let tmpP = [pvec.x, -pvec.y];

        // 使用插件计算连接点，简化操作
        let lineWidget = turf.lineString([lt, lb, rb, rt, lt]);
        let line = turf.lineString([sc, tmpP]);
        let intersects = turf.lineIntersect(lineWidget, line);
        if (intersects.features.length > 0) {
            let interPoint = intersects.features[0].geometry.coordinates;
            let pos = this.pixel2geo(interPoint);
            return {
                pos: pos,
                angle: mouseAngle
            };
        }
        return null;
    },
    /**
     * 获取边缘连接点地理坐标
     * @param widget
     * @param sp 当前屏幕坐标
     */
    getEdgeGeoPointParams: function(widget, sp)
    {
        let sbzlx = widget.getSbzlx();
        let params = null;
        if (PointDataConfig.isCircleSymbol(sbzlx)) {
            params = this._getCircleGeoPointParams(widget, sp);
        } else if (PointDataConfig.isRectSymbol(sbzlx)) {
            params = this._getRectGeoPointParams(widget, sp);
        }
        return params;
    },
    /**
     * 获取同杆设备的最近连接点
     * @param widget    当前设备
     * @param sp        屏幕坐标
     */
    getTgGeoPointParams: function (widget, sp) {
        let {p1, p2, p3} = widget.getNodeScreenPosition();
        let len = widget.getConnectionLen();

        let len1 = this.getPixelLen(p1, sp);
        let len2 = this.getPixelLen(p2, sp);
        let len3 = this.getPixelLen(p3, sp);

        let touch = null;
        let pos = null;
        let tmplen = 0;

        if (len1 < len2) {
            touch = 'a';
            pos = p1;
            tmplen = len1;
        } else {
            touch = 'b';
            pos = p2;
            tmplen = len2;
        }
        if (len == 3) {
            if (tmplen > len3) {
                touch = 'c';
                pos = p3;
            }
        }
        return {
            pos: this.pixel2geo(pos),
            touch: touch
        }
    },
    /**
     * 获取鼠标点中了设备哪边的触点,以及相邻的触点
     * @param symbol  当前符号
     * @param clickedPos 鼠标点击点(屏幕坐标)
     * @returns {*[]}
     */
    getClickedSymbolSidePositions: function (widget, clickedPos)
    {
        let touchPoints = widget.getTouchPoints();
        let params = null;
        if (touchPoints == 2) //双触点设备
        {
            //地理坐标
            let p1 = widget.getA();
            let p2 = widget.getB();
            //屏幕坐标
            let sp1 = this.geo2Pixel(p1);
            let sp2 = this.geo2Pixel(p2);

            let left2originLen = this.getScreenLenOfScreenPoints(sp1, clickedPos);
            let right2originLen = this.getScreenLenOfScreenPoints(sp2, clickedPos);

            if (left2originLen < right2originLen)
            {
                params = {
                    curPoint: p1,
                    curSide: 'a',
                    nextPoint: p2,
                    nextSide: 'b'
                }
            }
            else
            {
                params = {
                    curPoint: p2,
                    curSide: 'b',
                    nextPoint: p1,
                    nextSide: 'a'
                }
            }
        }
        else //单触点设备
        {
            params = {
                curPoint: widget.o,
                curSide: 'o',
                nextPoint: widget.o,
                nextSide: 'o'
            }
        }
        return params;
    },

    getRelativePositions: function (lastPointScreen, widget)
    {
        let params;
        if (widget.getTouchPoints() == 2) //特殊设备处理
        {
            //通过虚拟symbol计算转换后的左右位置
            let touchA = this.geo2Pixel(widget.getA());
            let touchB = this.geo2Pixel(widget.getB());
            let touchA2lastPont = this.getScreenLenOfScreenPoints(touchA, lastPointScreen);
            let touchB2lastPont = this.getScreenLenOfScreenPoints(touchB, lastPointScreen);

            //计算当前图形哪边连线
            let curSide, nextSide;
            let curPoint, nextPoint;
            if (touchA2lastPont < touchB2lastPont)
            {
                curSide = 'a';
                curPoint = widget.getA();

                nextSide = 'b';
                nextPoint = widget.getB();
            }
            else
            {
                curSide = 'b';
                curPoint = widget.getB();
                nextSide = 'a';
                nextPoint = widget.getA();
            }
            params = {
                curSide: curSide,
                nextSide: nextSide,
                curPoint: curPoint,
                nextPoint: nextPoint
            }
        }
        else //普通设备处理
        {
            let cen = widget.getO();

            //中心点直接返回
            params = {
                curPoint: cen,
                curSide: 'o',
                nextPoint: cen,
                nextSide: 'o'
            }
        }
        return params;
    },
    /**
     * 获取设备两边触点坐标(用于首次手绘设备)
     * @param width 设备宽度
     * @param cor 中心坐标(地理坐标)
     * @param angle 角度
     * @returns {{a: (*|*[]), b: (*|*[])}}
     */
    getTouchGeoPointsOfSymbol: function (width, cor, angle)
    {
        let halfOfWidth = width / 2;
        let params;

        let cxy = this.geo2Pixel(cor);
        let cx = cxy[0];
        let cy = cxy[1];

        angle = (!angle) ? 0 : angle;

        let symbolRadian = angle * this.radianPerAngle;
        let leftSideAngle;
        let rightSideAngle;

        leftSideAngle = Math.PI + symbolRadian;
        rightSideAngle = symbolRadian;
        //计算事件点与两端距离
        //计算左侧中间点
        let degreeLeft = leftSideAngle;
        let x1offset = Math.cos(degreeLeft) * halfOfWidth;
        let y1offset = Math.sin(degreeLeft) * halfOfWidth;

        let degreeRight = rightSideAngle;
        let x2offset = Math.cos(degreeRight) * halfOfWidth;
        let y2offset = Math.sin(degreeRight) * halfOfWidth;
        //左侧中心点
        let x1 = cx + x1offset;
        let y1 = cy - y1offset;
        //右侧中心点
        let x2 = cx + x2offset;
        let y2 = cy - y2offset;
        params = {
            a: this.pixel2geo([x1, y1]),
            b: this.pixel2geo([x2, y2])
        }

        return params;
    },

    //获取符号当前transform对象结构
    getSymbolTransform: function (symbol)
    {
        let transform = symbol.attr('transform');

        let posReg = /translate\(([^,]+),([^)]+)\)/;
        let groupTranslate = transform.match(posReg);
        let x = parseFloat(groupTranslate[1]);
        let y = parseFloat(groupTranslate[2]);

        let scaleReg = /scale\(([^)]+)\)/;
        let groupScale = transform.match(scaleReg);
        let scale = parseFloat(groupScale[1]);

        let rotateReg = /rotate\(([^)]+)\)/;
        let rotateScale = transform.match(rotateReg);
        let rotate = parseFloat(rotateScale[1]);

        return {
            translate: [x, y],
            scale: scale,
            rotate: rotate
        };
    },
    /**
     * 计算鼠标点击到图元位置
     * @param curGraphic 点中的图元
     * @param mapPoint   单击时的点
     * @returns {{angle: number, percent: number}} 角度，距离杆塔中心的比例
     */
    getClickedOffsetOfWidget: function (widget, clickPoint)
    {
        let cxy = this.geo2Pixel(widget.getO());
        return [clickPoint[0] - cxy[0], clickPoint[1] - cxy[1]];
    },
    /**
     * 通过地理坐标获取svg中的坐标
     * @param points
     * @param offset
     * @returns {Array}
     */
    getSvgPoints: function (points, offset)
    {
        let ls = [];
        for (let i = 0; i < points.length; i++)
        {
            let originalScreenPoints = this.geo2Pixel(points[i]);
            ls.push([originalScreenPoints[0] - offset[0], originalScreenPoints[1] - offset[1]]);
        }
        return ls;
    },
    //获取符号顶部位置
    getSymbolTopPostion: function (widget, textHeight)
    {
        let map = this.map;
        let wkid = map.spatialReference.wkid;
        let symbolScaleAttr = PointDataConfig.getSymbolScaleAttr(wkid);
        let sbzlx = widget.getSbzlx();
        let level = this.map.getLevel();


        let symbolRadian = widget.getAngle() * this.radianPerAngle;
        let degree = Math.PI / 2 + symbolRadian;
        //获取符号的属性值
        let params = symbolScaleAttr[sbzlx];
        //图元当前缩放级别
        let scaleLevel = (!params['scale']) ? symbolScaleAttr.scale : params['scale'];
        //图元初始大小
        let initWidth = (!params['width']) ? symbolScaleAttr.width : params['width'];
        let initHeight = (!params['height']) ? symbolScaleAttr.width : params['height'];
        let scale = scaleLevel[level];
        //获取图元实际大小
        //let width = initWidth * scale;
        let height = initHeight * scale;
        let halfOfHeight = height / 2;
        //halfOfHeight = halfOfHeight + textHeight;
        let x1offset = Math.cos(degree) * halfOfHeight;
        let y1offset = Math.sin(degree) * halfOfHeight;

        //获取中心点屏幕坐标
        let scen = this.geo2Pixel(widget.o);

        let x1 = scen[0] + x1offset;
        let y1 = scen[1] - y1offset;
        let pos = [];
        pos[0] = x1;
        pos[1] = y1;
        return pos;
    },
    //获取符号顶部位置
    getSymbolLinePostionParam: function (widget)
    {
        let level = this.map.getLevel();
        let sa = this.geo2Pixel(widget.a);
        let sb = this.geo2Pixel(widget.b);
        let pos = [];
        pos[0] = (sa[0] + sb[0]) / 2;
        pos[1] = (sa[1] + sb[1]) / 2;

        let leftP,rightP;
        if (sa[0] < sb[0])
        {
            leftP = sa;
            rightP = sb;
        }
        else
        {
            leftP = sb;
            rightP = sa;
        }
        let angle = this.getSymbolAngle(leftP, rightP);

        return {
            pos: pos,
            angle: angle
        };
    },
    /**
     * 计算鼠标距离起始点X距离像素的点
     * @param p1 起始坐标
     * @param p2 当前鼠标坐标
     * @param step 要减去的距离
     * @returns [x, y] 最终坐标
     */
    getEndPointOfLine(p1, p2, step) {
        let vstart = new Vector2(p1[0], -p2[1]);
        let vend = new Vector2(p2[0], -p2[1]);
        let vsub = vend.clone().sub(vstart);
        let vnormalize = vsub.clone().normalize();
        let vtmp = vsub.clone().sub(vnormalize.multiplyScalar(step));

        let v = vstart.clone().add(vtmp);
        return [v.x, -v.y];
    },
    /**
     * 正交计算获取线结束点,在stepAngle范围内
     * @param p1 当前起始点
     * @param p2 当前结束点
     * @param stepLen 要减去的长度（为了在鼠标移动时候防止无法触发图元事件）
     * @param stepAngle 在限制的角度的范围取正交
     * @returns {[*,*]}
     */
    getOrthogonalEndPointOfLine: function (p1, p2, stepLen, stepAngle) {
        let curAngle = this.getSymbolAngle([p1[0], -p1[1]], [p2[0], -p2[1]]);
        let angle = this.getOrthogonalAngle(curAngle, stepAngle);
        let targetP = null;
        if (angle === 0 || angle === 90 || angle === 180 || angle === 270 || angle === 360) {
            let len = this.getPixelLen(p1, p2);
            if (angle === 0) {
                targetP = [p1[0] + len - stepLen, p1[1]];
            } else if (angle === 90) {
                targetP = [p1[0], p1[1] - len + stepLen];
            } else if (angle === 180) {
                targetP = [p1[0] - len + stepLen, p1[1]];
            } else if (angle === 270) {
                targetP = [p1[0], p1[1] + len - stepLen]
            }
        } else {
            targetP = this.getEndPointOfLine(p1, p2, stepLen);
        }
        return targetP;
    },
    getSymbolLinePostionParamByPoints: function (cors)
    {
        let sa = this.geo2Pixel(cors[0]);
        let sb = this.geo2Pixel(cors[1]);
        let pos = [];
        pos[0] = (sa[0] + sb[0]) / 2;
        pos[1] = (sa[1] + sb[1]) / 2;

        let leftP,rightP;
        if (sa[0] < sb[0])
        {
            leftP = sa;
            rightP = sb;
        }
        else
        {
            leftP = sb;
            rightP = sa;
        }
        let angle = this.getSymbolAngle(leftP, rightP);

        return {
            pos: pos,
            angle: angle
        };
    },

    /**
     * 获取90倍数角度
     * @param angle  当前角度(0~360)
     * @param step   偏移量
     */
    getOrthogonalAngle(angle, step) {
        if (angle > 360 - step || angle < step) {
            angle = 0;
        } else if (angle > 90 - step && angle < 90 + step) {
            angle = 90;
        } else if (angle > 180 - step && angle < 180 + step) {
            angle = 180;
        } else if (angle > 270 - step && angle < 270 + step) {
            angle = 270;
        }
        return angle;
    },
    /**
     * 获取点到直线的最短距离
     * @param point [x,y]
     * @param line  [[x,y], [x, y], [x,y],...]
     */
    getNearstPointFromPoint2Line(point, line){
        var line = turf.lineString(line);
        var pt = turf.point(point);
        var snapped = turf.nearestPointOnLine(line, pt, {units: 'miles'});
        let i = 1;
    }
};


