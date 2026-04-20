export default class GridSymbol {
    _id = null
    _dom = null
    _initWidth = 0
    _initHeight = 0
    _xratio = .5
    _yratio = .5
    _co = null
    _touchList = []
    _xmin = null
    _ymin = null

    constructor () {

    }

    get id () {
        return this._id
    }

    set id (value) {
        this._id = value
    }

    get dom () {
        return this._dom
    }

    set dom (value) {
        this._dom = value
    }

    get initWidth () {
        return this._initWidth
    }

    set initWidth (value) {
        this._initWidth = value
    }

    get initHeight () {
        return this._initHeight
    }

    set initHeight (value) {
        this._initHeight = value
    }

    get xratio () {
        return this._xratio
    }

    set xratio (value) {
        this._xratio = value
    }

    get yratio () {
        return this._yratio
    }

    set yratio (value) {
        this._yratio = value
    }

    get touchList () {
        return this._touchList
    }

    set touchList (value) {
        this._touchList = value
    }

    set co (cor) {
        this._co = cor
    }

    get co () {
        return this._co
    }

    set xmin (xmin) {
        this._xmin = xmin
    }

    get xmin () {
        return this._xmin
    }

    set ymin (ymin) {
        this._ymin = ymin
    }

    get ymin () {
        return this._ymin
    }

    touch (flag) {
        for (let item of this.touchList) {
            if (item.touch === flag) {
                return item
            }
        }
        return null
    }
}
