import Dimension from '@/plugins/tmzx/graph/Dimension.js'

// Vector2 在 public/tmzx/lib/math/Vector2.js 中以全局 script 形式定义。
// 在 Vite ESM 环境中模块作用域无法访问全局变量，此处内联定义并挂到 window，确保同步可用。
if (typeof window !== 'undefined' && typeof window.Vector2 === 'undefined') {
    function Vector2(x, y) { this.x = x || 0; this.y = y || 0; }
    Object.defineProperties(Vector2.prototype, {
        width:  { get() { return this.x; }, set(v) { this.x = v; } },
        height: { get() { return this.y; }, set(v) { this.y = v; } },
    });
    Object.assign(Vector2.prototype, {
        isVector2: true,
        set(x, y)          { this.x = x; this.y = y; return this; },
        setScalar(s)        { this.x = s; this.y = s; return this; },
        setX(x)             { this.x = x; return this; },
        setY(y)             { this.y = y; return this; },
        clone()             { return new this.constructor(this.x, this.y); },
        copy(v)             { this.x = v.x; this.y = v.y; return this; },
        add(v)              { this.x += v.x; this.y += v.y; return this; },
        addScalar(s)        { this.x += s; this.y += s; return this; },
        addVectors(a, b)    { this.x = a.x + b.x; this.y = a.y + b.y; return this; },
        addScaledVector(v, s){ this.x += v.x * s; this.y += v.y * s; return this; },
        sub(v)              { this.x -= v.x; this.y -= v.y; return this; },
        subScalar(s)        { this.x -= s; this.y -= s; return this; },
        subVectors(a, b)    { this.x = a.x - b.x; this.y = a.y - b.y; return this; },
        multiply(v)         { this.x *= v.x; this.y *= v.y; return this; },
        multiplyScalar(s)   { this.x *= s; this.y *= s; return this; },
        divide(v)           { this.x /= v.x; this.y /= v.y; return this; },
        divideScalar(s)     { return this.multiplyScalar(1 / s); },
        applyMatrix3(m) {
            const x = this.x, y = this.y, e = m.elements;
            this.x = e[0] * x + e[3] * y + e[6];
            this.y = e[1] * x + e[4] * y + e[7];
            return this;
        },
        min(v)      { this.x = Math.min(this.x, v.x); this.y = Math.min(this.y, v.y); return this; },
        max(v)      { this.x = Math.max(this.x, v.x); this.y = Math.max(this.y, v.y); return this; },
        clamp(min, max) {
            this.x = Math.max(min.x, Math.min(max.x, this.x));
            this.y = Math.max(min.y, Math.min(max.y, this.y));
            return this;
        },
        clampScalar(minV, maxV) {
            this.x = Math.max(minV, Math.min(maxV, this.x));
            this.y = Math.max(minV, Math.min(maxV, this.y));
            return this;
        },
        clampLength(min, max) {
            const len = this.length();
            return this.divideScalar(len || 1).multiplyScalar(Math.max(min, Math.min(max, len)));
        },
        floor()     { this.x = Math.floor(this.x); this.y = Math.floor(this.y); return this; },
        ceil()      { this.x = Math.ceil(this.x);  this.y = Math.ceil(this.y);  return this; },
        round()     { this.x = Math.round(this.x); this.y = Math.round(this.y); return this; },
        negate()    { this.x = -this.x; this.y = -this.y; return this; },
        dot(v)      { return this.x * v.x + this.y * v.y; },
        cross(v)    { return this.x * v.y - this.y * v.x; },
        lengthSq()  { return this.x * this.x + this.y * this.y; },
        length()    { return Math.sqrt(this.x * this.x + this.y * this.y); },
        manhattanLength() { return Math.abs(this.x) + Math.abs(this.y); },
        normalize() { return this.divideScalar(this.length() || 1); },
        angle()     { const a = Math.atan2(this.y, this.x); return a < 0 ? a + 2 * Math.PI : a; },
        distanceTo(v)        { return Math.sqrt(this.distanceToSquared(v)); },
        distanceToSquared(v) { const dx = this.x - v.x, dy = this.y - v.y; return dx * dx + dy * dy; },
        manhattanDistanceTo(v) { return Math.abs(this.x - v.x) + Math.abs(this.y - v.y); },
        setLength(l) { return this.normalize().multiplyScalar(l); },
        lerp(v, a)   { this.x += (v.x - this.x) * a; this.y += (v.y - this.y) * a; return this; },
        lerpVectors(v1, v2, a) { return this.subVectors(v2, v1).multiplyScalar(a).add(v1); },
        equals(v)    { return v.x === this.x && v.y === this.y; },
        fromArray(arr, off = 0) { this.x = arr[off]; this.y = arr[off + 1]; return this; },
        toArray(arr = [], off = 0) { arr[off] = this.x; arr[off + 1] = this.y; return arr; },
        rotateAround(center, angle) {
            const c = Math.cos(angle), s = Math.sin(angle);
            const x = this.x - center.x, y = this.y - center.y;
            this.x = x * c - y * s + center.x;
            this.y = x * s + y * c + center.y;
            return this;
        },
    });
    window.Vector2 = Vector2;
}

// Vector3 内联定义，确保 ESM 环境中同步可用
if (typeof window !== 'undefined' && typeof window.Vector3 === 'undefined') {
    function Vector3(x, y, z) { this.x = x || 0; this.y = y || 0; this.z = z || 0; }
    Object.assign(Vector3.prototype, {
        isVector3: true,
        set(x, y, z)        { this.x = x; this.y = y; this.z = z; return this; },
        setScalar(s)        { this.x = s; this.y = s; this.z = s; return this; },
        clone()             { return new this.constructor(this.x, this.y, this.z); },
        copy(v)             { this.x = v.x; this.y = v.y; this.z = v.z; return this; },
        add(v)              { this.x += v.x; this.y += v.y; this.z += v.z; return this; },
        addScalar(s)        { this.x += s; this.y += s; this.z += s; return this; },
        addVectors(a, b)    { this.x = a.x+b.x; this.y = a.y+b.y; this.z = a.z+b.z; return this; },
        sub(v)              { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; },
        subScalar(s)        { this.x -= s; this.y -= s; this.z -= s; return this; },
        subVectors(a, b)    { this.x = a.x-b.x; this.y = a.y-b.y; this.z = a.z-b.z; return this; },
        multiplyScalar(s)   { this.x *= s; this.y *= s; this.z *= s; return this; },
        divideScalar(s)     { return this.multiplyScalar(1 / s); },
        applyMatrix3(m) {
            const x = this.x, y = this.y, z = this.z, e = m.elements;
            this.x = e[0]*x + e[3]*y + e[6]*z;
            this.y = e[1]*x + e[4]*y + e[7]*z;
            this.z = e[2]*x + e[5]*y + e[8]*z;
            return this;
        },
        min(v)      { this.x = Math.min(this.x,v.x); this.y = Math.min(this.y,v.y); this.z = Math.min(this.z,v.z); return this; },
        max(v)      { this.x = Math.max(this.x,v.x); this.y = Math.max(this.y,v.y); this.z = Math.max(this.z,v.z); return this; },
        negate()    { this.x=-this.x; this.y=-this.y; this.z=-this.z; return this; },
        dot(v)      { return this.x*v.x + this.y*v.y + this.z*v.z; },
        lengthSq()  { return this.x*this.x + this.y*this.y + this.z*this.z; },
        length()    { return Math.sqrt(this.x*this.x + this.y*this.y + this.z*this.z); },
        normalize() { return this.divideScalar(this.length() || 1); },
        crossVectors(a, b) {
            const ax=a.x,ay=a.y,az=a.z, bx=b.x,by=b.y,bz=b.z;
            this.x=ay*bz-az*by; this.y=az*bx-ax*bz; this.z=ax*by-ay*bx;
            return this;
        },
        distanceTo(v)        { return Math.sqrt(this.distanceToSquared(v)); },
        distanceToSquared(v) { const dx=this.x-v.x,dy=this.y-v.y,dz=this.z-v.z; return dx*dx+dy*dy+dz*dz; },
        fromArray(arr, off=0) { this.x=arr[off]; this.y=arr[off+1]; this.z=arr[off+2]; return this; },
        toArray(arr=[], off=0) { arr[off]=this.x; arr[off+1]=this.y; arr[off+2]=this.z; return arr; },
    });
    window.Vector3 = Vector3;
}

// Matrix3 内联定义，确保 ESM 环境中同步可用
if (typeof window !== 'undefined' && typeof window.Matrix3 === 'undefined') {
    function Matrix3() {
        this.elements = [1,0,0, 0,1,0, 0,0,1];
    }
    Object.assign(Matrix3.prototype, {
        isMatrix3: true,
        set(n11,n12,n13,n21,n22,n23,n31,n32,n33) {
            const te = this.elements;
            te[0]=n11; te[1]=n21; te[2]=n31;
            te[3]=n12; te[4]=n22; te[5]=n32;
            te[6]=n13; te[7]=n23; te[8]=n33;
            return this;
        },
        identity() { return this.set(1,0,0, 0,1,0, 0,0,1); },
        clone()    { return new this.constructor().fromArray(this.elements); },
        copy(m)    { const te=this.elements,me=m.elements; for(let i=0;i<9;i++) te[i]=me[i]; return this; },
        multiply(m)   { return this.multiplyMatrices(this, m); },
        premultiply(m){ return this.multiplyMatrices(m, this); },
        multiplyMatrices(a, b) {
            const ae=a.elements, be=b.elements, te=this.elements;
            const a11=ae[0],a12=ae[3],a13=ae[6], a21=ae[1],a22=ae[4],a23=ae[7], a31=ae[2],a32=ae[5],a33=ae[8];
            const b11=be[0],b12=be[3],b13=be[6], b21=be[1],b22=be[4],b23=be[7], b31=be[2],b32=be[5],b33=be[8];
            te[0]=a11*b11+a12*b21+a13*b31; te[3]=a11*b12+a12*b22+a13*b32; te[6]=a11*b13+a12*b23+a13*b33;
            te[1]=a21*b11+a22*b21+a23*b31; te[4]=a21*b12+a22*b22+a23*b32; te[7]=a21*b13+a22*b23+a23*b33;
            te[2]=a31*b11+a32*b21+a33*b31; te[5]=a31*b12+a32*b22+a33*b32; te[8]=a31*b13+a32*b23+a33*b33;
            return this;
        },
        multiplyScalar(s) { const te=this.elements; for(let i=0;i<9;i++) te[i]*=s; return this; },
        getInverse(matrix) {
            const me=matrix.elements, te=this.elements;
            const n11=me[0],n21=me[1],n31=me[2], n12=me[3],n22=me[4],n32=me[5], n13=me[6],n23=me[7],n33=me[8];
            const t11=n33*n22-n32*n23, t12=n32*n13-n33*n12, t13=n23*n12-n22*n13;
            const det=n11*t11+n21*t12+n31*t13;
            if(det===0){ console.warn('Matrix3: .getInverse() det=0'); return this.identity(); }
            const di=1/det;
            te[0]=t11*di;             te[1]=(n31*n23-n33*n21)*di; te[2]=(n32*n21-n31*n22)*di;
            te[3]=t12*di;             te[4]=(n33*n11-n31*n13)*di; te[5]=(n31*n12-n32*n11)*di;
            te[6]=t13*di;             te[7]=(n21*n13-n23*n11)*di; te[8]=(n22*n11-n21*n12)*di;
            return this;
        },
        transpose() {
            const m=this.elements; let tmp;
            tmp=m[1]; m[1]=m[3]; m[3]=tmp;
            tmp=m[2]; m[2]=m[6]; m[6]=tmp;
            tmp=m[5]; m[5]=m[7]; m[7]=tmp;
            return this;
        },
        scale(sx, sy) {
            const te=this.elements;
            te[0]*=sx; te[3]*=sx; te[6]*=sx;
            te[1]*=sy; te[4]*=sy; te[7]*=sy;
            return this;
        },
        rotate(theta) {
            const c=Math.cos(theta), s=Math.sin(theta), te=this.elements;
            const a11=te[0],a12=te[3],a13=te[6], a21=te[1],a22=te[4],a23=te[7];
            te[0]=c*a11+s*a21; te[3]=c*a12+s*a22; te[6]=c*a13+s*a23;
            te[1]=-s*a11+c*a21; te[4]=-s*a12+c*a22; te[7]=-s*a13+c*a23;
            return this;
        },
        translate(tx, ty) {
            const te=this.elements;
            te[0]+=tx*te[2]; te[3]+=tx*te[5]; te[6]+=tx*te[8];
            te[1]+=ty*te[2]; te[4]+=ty*te[5]; te[7]+=ty*te[8];
            return this;
        },
        equals(m) { const te=this.elements,me=m.elements; for(let i=0;i<9;i++) if(te[i]!==me[i]) return false; return true; },
        fromArray(arr, off=0) { for(let i=0;i<9;i++) this.elements[i]=arr[i+off]; return this; },
        toArray(arr=[], off=0) { const te=this.elements; for(let i=0;i<9;i++) arr[off+i]=te[i]; return arr; },
    });
    window.Matrix3 = Matrix3;
}

let mathutil = {
    anglePerRad: 180 / Math.PI,
    radianPerAngle: Math.PI / 180,
    // 角度转弧度
    angle2Radian: function (angle) {
        return angle * this.radianPerAngle
    },
    // 弧度转角度
    radian2Angle: function (radian) {
        return radian * this.anglePerRad
    },
    // 像素长度
    pixelLen: function (p1, p2) {
        // v1.clone().sub(v2).length()
        return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2))
    },
    // 节点中心点
    cellCenter: function (cellGeometry) {
        return {
            x: cellGeometry.x + cellGeometry.width / 2,
            y: cellGeometry.y + cellGeometry.height / 2
        }
    },

    // 计算两个向量的正中间向量、Bisector平分线
    getBisectorVector(v1, v2) {
        let vmid = v1.clone().add(v2)
        return vmid.normalize()
    },

    // 中心点
    midPoint: function (v1, v2) {
        return new Vector2((v1.x + v2.x) / 2, (v1.y + v2.y) / 2)
    },

    // 负角度转正角度
    negativeAngle2Positive(angle) {
        return ((angle % 360) + 360) % 360
    },

    vecAngle(vec1, vec2) {
        let v_normal1 = vec1.normalize()
        let v_normal2 = vec2.normalize()
        let cosAngle = +v_normal1.clone().dot(v_normal2)
        return Math.acos(cosAngle) * this.anglePerRad
    },

    dirAngle(vec) {
        let radian = vec.angle()
        let angle = this.anglePerRad * radian
        return angle;
    },
    /**
     * 判断角度是水平还是垂直
     * @param angle       角度
     * @param tolerance   容差
     * @returns {string}
     */
    isHorizontalOrVertical(angle, tolerance = 5) {
        // 转化到0~360
        let normalizedAngle = ((angle % 360) + 360) % 360

        // 1、判断水平
        let nearZero = normalizedAngle <= tolerance || normalizedAngle >= 360 - tolerance
        let near180 = Math.abs(normalizedAngle - 180) <= tolerance

        let isHorizontal = nearZero || near180

        // 判断是否接近水平
        if (isHorizontal) {
            return 'H'
        }

        // 2、判断垂直
        let near90 = Math.abs(normalizedAngle - 90) <= tolerance
        let near270 = Math.abs(normalizedAngle - 270) <= tolerance

        let isVertical = near90 || near270
        // 判断是否接近垂直（90度或270度）
        if (isVertical) {
            return 'V'
        }

        return 'A'
    },
    snapAngle: function (angle, tolerance = 5) {
        angle = angle % 360
        if (angle < 0) {
            angle += 360
        }

        if (Math.abs(angle - 0) <= tolerance) {
            angle = 0
        } else if (Math.abs(angle - 90) <= tolerance) {
            angle = 90
        } else if (Math.abs(angle - 180) <= tolerance) {
            angle = 180
        } else if (Math.abs(angle - 270) <= tolerance) {
            angle = 270
        }
        return angle
    },

    /**
     * 直线角度
     * @param x1
     * @param y1
     * @param x2
     * @param y2
     * @returns {*|number} 0~180
     */
    lineAngle(x1, y1, x2, y2) {
        // 计算斜率
        let deltaX = x2 - x1
        let deltaY = y2 - y1

        // 处理垂直x轴情况
        if (deltaX == 0) {
            return 90
        }

        // 计算斜率
        let slope = deltaY / deltaX

        // 计算角度
        let angleRadians = Math.atan(slope)
        let angleDegrees = this.radian2Angle(angleRadians)

        // 确保角度在 0 到 180 之间
        if (angleDegrees < 0) {
            return angleDegrees + 180
        }
        return angleDegrees
    },
    // 直线斜率
    linerSlope(vec1, vec2) {
        // return Math.atan2(vec1.y - vec2.y, vec1.x - vec2.x);
        return (vec1.y - vec2.y) / (vec1.x - vec2.x)
    },
    /**
     * 通过叉乘计算两个向量的关系
     * @param v1
     * @param v2
     * @returns {number} 正：v1至v2 正坐标系旋转，负：逆坐标系旋转，0：则v1,v2共线
     */
    vecRelation(v1, v2) {
        // return v1.x * v2.y - v2.x * v1.y;
        return v1.clone().cross(v2)
    },
    // 求向量的垂直向量
    crossVector(vec) {
        return new Vector2(vec.y, -vec.x)
    },
    /**
     * 计算向量 va到vb 是顺时针还是逆时针
     * @param va
     * @param vb
     * @returns {number} 1：正旋转，2：负旋转，3：共线
     */
    crossProduct(va, vb) {
        let dot = va.clone().cross(vb)
        if (dot > 0) {
            return 1
        } else if (dot < 0) {
            return -1
        } else {
            return 0
        }
    },
    rgb2hex: function (r, g, b) {
        var hex = '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)
        return hex
    },

    /**
     * 点积
     * @param v1
     * @param v2
     * @returns {number}
     */
    dotProduct(v1, v2) {
        return v1.x * v2.x + v1.y * v2.y
    },
    /**
     * 向量相减
     * @param v1
     * @param v2
     * @returns {{x: number, y: number}}
     */
    subtractVectors(v1, v2) {
        return new Vector2(v1.x - v2.x, v1.y - v2.y)
    },
    commonMatrix(tran, rad, scale) {
        let scaleM = null
        if (scale) {
            scaleM = new Matrix3()
            scaleM.scale(scale, scale)
        }

        let rotM = null
        if (rad || rad == 0) {
            rotM = new Matrix3()
            rotM.rotate(rad)
        }

        let tranM = null
        if (tran) {
            tranM = new Matrix3()
            tranM.translate(tran.x, tran.y)
        }

        if (tran && (rad || rad == 0) && scale) {
            return tranM.clone().multiply(scaleM).multiply(rotM)
        } else if (tran && (rad || rad == 0)) {
            return tranM.clone().multiply(rotM)
        } else if (tran && scale) {
            return tranM.clone().multiply(scaleM)
        } else if ((rad || rad == 0) && scale) {
            return rotM.clone().multiply(scaleM)
        } else if (tran) {
            return tranM
        } else if (rad || rad == 0) {
            return rotM
        } else if (scale) {
            return scaleM
        }
    },
    /**
     * 计算长度
     * @param vector {x: number, y: number}
     * @returns {number}
     */
    magnitude(vector) {
        return Math.sqrt(vector.x * vector.x + vector.y * vector.y)
    },

    // 根据两点求直线
    lineFromPoints(p1, p2) {
        let a = p2.y - p1.y;
        let b = p1.x - p2.x;
        let c = p2.x * p1.y - p1.x * p2.y;
        return {a, b, c};
    },
    /**
     * 检查点是否在线段上
     * @param p
     * @param a
     * @param b
     */
    isPointOnSegment(p, a, b) {
        let minX = Math.min(a.x, b.x);
        let maxX = Math.max(a.x, b.x);
        let minY = Math.min(a.y, b.y);
        let maxY = Math.max(a.y, b.y);

        let minNum = 1e-8;
        if (p.x < minX - minNum || p.x > maxX + minNum || p.y < minY - minNum || p.y > maxY + minNum ) {
            return false;
        }

        let cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
        return Math.abs(cross) < minNum;
    },
    /**
     * 计算两条直线的交战
     * @param line1 {a, b, c}
     * @param line2 {a, b, c}
     * @returns {{x: number, y: number}|null}
     */
    getLineIntersection(line1, line2) {
        let denominator = line1.a * line2.b - line2.a * line1.b;
        if (Math.abs(denominator) < 1e-8) {
            return null;
        }

        // 计算交点坐标
        let x = (line1.b * line2.c - line2.b * line1.c) / denominator;
        let y = (line2.a * line1.c - line1.a * line2.c) / denominator;

        return {x, y}
    },
    /**
     * 计算两条线段的交战
     * @param a1
     * @param a2
     * @param b1
     * @param b2
     * @returns {{x: number, y: number}|null}
     */
    findSegmentIntersection(a1, a2, b1, b2) {
        let line1 = this.lineFromPoints(a1, a2);
        let line2 = this.lineFromPoints(b1, b2);

        let intersection = this.getLineIntersection(line1, line2);

        if (!intersection) {
            return null;
        }

        if (this.isPointOnSegment(intersection, a1, a2) && this.isPointOnSegment(intersection, b1, b2)) {
            return {
                x: parseFloat(intersection.x.toFixed(6)),
                y: parseFloat(intersection.y.toFixed(6)),
            }
        }

        return null;
    },
    /**
     * 点到线的最近点
     * @param point {x: number y: number}
     * @param lineStart {x: number y: number}
     * @param lineEnd {x: number, y: number}
     * @returns {{x: *, y: *}|*}
     */
    closestPointOnLineSegment(point, lineStart, lineEnd) {
        // 线段的向量表示
        const lineVector = this.subtractVectors(lineEnd, lineStart)
        // 点到线段起点的向量
        const pointVector = this.subtractVectors(point, lineStart)
        // 计算点向量在线段向量上的投影系数
        const projection =
            this.dotProduct(pointVector, lineVector) / this.dotProduct(lineVector, lineVector)

        // 投影点在线段上
        if (projection < 0) {
            // 如果投影点在线段起点的外侧，则起点即为最近点
            return lineStart
        } else if (projection > 1) {
            // 如果投影点在线段终点的外侧，则终点即为最近点
            return lineEnd
        } else {
            // 如果投影点在线段上，则计算确切的投影点坐标

            let x = lineStart.x + projection * lineVector.x
            let y = lineStart.y + projection * lineVector.y

            return new Vector2(x, y)
        }
    },

    closestPointOnLineSegmentStrict(point, lineStart, lineEnd) {
        // 线段的向量表示
        const lineVector = this.subtractVectors(lineEnd, lineStart)
        // 点到线段起点的向量
        const pointVector = this.subtractVectors(point, lineStart)
        // 计算点向量在线段向量上的投影系数
        const projection =
            this.dotProduct(pointVector, lineVector) / this.dotProduct(lineVector, lineVector)

        // 投影点在线段上
        if (projection < 0) {
            // 如果投影点在线段起点的外侧，则起点即为最近点
            return null
        } else if (projection > 1) {
            // 如果投影点在线段终点的外侧，则终点即为最近点
            return null
        } else {
            // 如果投影点在线段上，则计算确切的投影点坐标

            let x = lineStart.x + projection * lineVector.x
            let y = lineStart.y + projection * lineVector.y

            return new Vector2(x, y)
        }
    },

    // 线到圆的交点
    lineCircleIntersection(A, B, C, cx, cy, r) {
        // 将直线方程 Ax + By + C = 0 转换为斜截式 y = mx + c
        let m, c
        if (B !== 0) {
            m = -A / B // 斜率
            c = -C / B // 截距
        } else {
            // 如果直线是垂直于 x 轴的直线（x = constant）
            const x = -C / A
            // 代入圆的方程求 y
            const term = r * r - (x - cx) * (x - cx)
            if (term < 0) return [] // 无交点
            const y1 = cy + Math.sqrt(term)
            const y2 = cy - Math.sqrt(term)
            return [
                { x: x, y: y1 },
                { x: x, y: y2 }
            ]
        }

        // 将 y = mx + c 代入圆的方程 (x - cx)^2 + (y - cy)^2 = r^2
        const a = 1 + m * m
        const b = -2 * cx + 2 * m * (c - cy)
        const c_quad = cx * cx + (c - cy) * (c - cy) - r * r

        // 计算判别式
        const D = b * b - 4 * a * c_quad

        if (D < 0) {
            return [] // 无交点
        } else if (D === 0) {
            // 一个交点（相切）
            const x = -b / (2 * a)
            const y = m * x + c
            return [{ x: x, y: y }]
        } else {
            // 两个交点
            const x1 = (-b + Math.sqrt(D)) / (2 * a)
            const x2 = (-b - Math.sqrt(D)) / (2 * a)
            const y1 = m * x1 + c
            const y2 = m * x2 + c
            return [
                { x: x1, y: y1 },
                { x: x2, y: y2 }
            ]
        }
    },

    // 根据两点求直线方程 A、B、C
    lineEquationFromTwoPoints(x1, y1, x2, y2) {
        let A, B, C
        // if (x1 == x2) {
        if (Math.abs(x1 - x2) < 1) {
            // 垂直于x轴直线
            A = 1
            B = 0
            C = -x1
        } else {
            // 计算斜率
            let m = (y2 - y1) / (x2 - x1)
            // 转换为一般式 Ax + By + C = 0
            A = m
            B = -1
            C = y1 - m * x1
        }
        return { A, B, C }
    },

    /**
     * 计算点到线的垂直距离
     * @param point        {x: number y: number}
     * @param lineStart    {x: number y: number}
     * @param lineEnd      {x: number y: number}
     * @returns {number}
     */
    distancePointToLine(point, lineStart, lineEnd) {
        const lineVector = this.subtractVectors(lineEnd, lineStart)
        const pointVector = this.subtractVectors(point, lineStart)

        const projection =
            this.dotProduct(pointVector, lineVector) / this.dotProduct(lineVector, lineVector)

        const closestPoint = {
            x: lineStart.x + projection * lineVector.x,
            y: lineStart.y + projection * lineVector.y
        }

        const distanceVector = this.subtractVectors(point, closestPoint)
        const distance = this.magnitude(distanceVector)

        return distance
    },

    // 计算向量列表范围
    vecListBounds(list) {
        let xmin = Number.MAX_VALUE
        let ymin = Number.MAX_VALUE

        let xmax = Number.MIN_VALUE
        let ymax = Number.MIN_VALUE

        for (let vec of list) {
            if (vec.x < xmin) {
                xmin = vec.x
            }
            if (vec.x > xmax) {
                xmax = vec.x
            }
            if (vec.y < ymin) {
                ymin = vec.y
            }
            if (vec.y > ymax) {
                ymax = vec.y
            }
        }
        return { xmin, ymin, xmax, ymax, width: xmax - xmin, height: ymax - ymin }
    },

    vecListBounds2(list) {
        let xmin = Number.MAX_VALUE
        let ymin = Number.MAX_VALUE

        let xmax = Number.MIN_VALUE
        let ymax = Number.MIN_VALUE

        for (let vec of list) {
            if (vec.x < xmin) {
                xmin = vec.x
            }
            if (vec.x > xmax) {
                xmax = vec.x
            }
            if (vec.y < ymin) {
                ymin = vec.y
            }
            if (vec.y > ymax) {
                ymax = vec.y
            }
        }
        return { xmin, ymin, xmax, ymax }
    },
    dimensionListBounds(list) {
        let _xmin = -999,
            _ymin = -999,
            _xmax = -999,
            _ymax = -999
        for (let dimension of list) {
            let { xmin, ymin, xmax, ymax } = dimension

            if (_xmin == -999) {
                _xmin = xmin
            } else if (_xmin > xmin) {
                _xmin = xmin
            }

            if (_xmax == -999) {
                _xmax = xmax
            } else if (_xmax < xmax) {
                _xmax = xmax
            }

            if (_ymin == -999) {
                _ymin = ymin
            } else if (_ymin > ymin) {
                _ymin = ymin
            }

            if (_ymax == -999) {
                _ymax = ymax
            } else if (_ymax < ymax) {
                _ymax = ymax
            }
        }

        let dimention = new Dimension()
        dimention.init(_xmin, _ymin, _xmax, _ymax)

        return dimention
    },
    /**
     * 根据圆的半径和圆上两点计算圆心
     * @param {Object} p1 第一个点 {x, y}
     * @param {Object} p2 第二个点 {x, y}
     * @param {number} r 圆的半径
     * @returns {Array} 可能有两个解，返回两个圆心数组 [center1, center2]
     */
    findCircleCenter(p1, p2, r) {
        const {x: x1, y: y1} = p1;
        const {x: x2, y: y2} = p2;

        // 计算两点中点
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;

        // 计算两点间距离
        const dx = x2 - x1;
        const dy = y2 - y1;
        const d = Math.sqrt(dx*dx + dy*dy);

        // 检查两点是否重合
        if (d === 0) {
            throw new Error("两点重合，无法确定圆");
        }

        // 检查半径是否足够大
        if (2 * r < d) {
            throw new Error(`半径太小（需要至少 ${d/2}）`);
        }

        // 计算垂直距离
        const h = Math.sqrt(r*r - (d/2)*(d/2));

        // 计算垂直向量（垂直于P1P2的向量）
        const nx = -dy / d;
        const ny = dx / d;

        // 计算两个可能的圆心
        const center1 = {
            x: midX + h * nx,
            y: midY + h * ny
        };

        const center2 = {
            x: midX - h * nx,
            y: midY - h * ny
        };

        return [center1, center2];
    },
}

export default mathutil
