//----------------------------------------------------//
window.webVideoIp = '25.213.120.208' //统一视频地址
// var webVideoIp = '25.213.45.24'
window.webVideoPort = '80'
String.prototype.replaceAll = function (FindText, RepText) {
    var regExp = new RegExp(FindText, 'g')
    return this.replace(regExp, RepText)
}
//----------------------------------------------------//
const baseurl = '/pwtmzxPbulicPath'

var mxIsElectron = false
window.mxLanguage = 'zh'
window.RESOURCE_BASE = baseurl + '/tmzx/drawio/resources/dia'
window.STYLE_PATH = baseurl + '/tmzx/drawio/styles'
window.PLUGINS_BASE_PATH = baseurl + '/tmzx/drawio/'
window.IMAGE_PATH = baseurl + '/tmzx/drawio/images'
var urlParams = {
    dev: 1,
    demo: 1,
    contrast: 0,
    dark: '0',
    'shape-picker': '0'
}
var isLocalStorage = true
var mxScriptsLoaded = false,
    mxWinLoaded = false
var mxDevUrl = baseurl + '/tmzx/drawio/'
var geBasePath = (window.geBasePath = baseurl + '/tmzx/drawio/js/grapheditor')
var mxBasePath = (window.mxBasePath = baseurl + '/tmzx/drawio/')
var drawDevUrl = (window.drawDevUrl = baseurl + '/tmzx/drawio/')
//----------------------------------------------------//
const links = [
    {
        rel: "manifest",
        href: "/tmzx/drawio/images/manifest.json"
    },
    {
        rel: "stylesheet",
        type: "text/css",
        href: "/tmzx/drawio/styles/grapheditor.css"
    },
    {
        rel: "stylesheet",
        href: "http://25.213.0.139:31005/sgepriamapsdk/css/narimap.umd.css"
    },
    {
        rel: "stylesheet",
        href: "http://25.213.0.139:31005/sgepriamapsdk/css/nrgis-common.min.css"
    }

].map(item => {
    return {
        ...item,
        tagType: 'link',
        pos: 'body'
    }
})
const scripts0 = [
    {
        src: "/tmzx/lib/jquery.js"
    },
    // 0
    {
        src: "/lib/svg-path-commander.js"
    },
    {
        src: "/lib/gsap.min.js"
    },
    {
        src: "/lib/turf.min.js"
    },
    // {
    //     src: "/lib/svg.min.js"
    // },
    {
        src: "/lib/svg.panzoom.js"
    },
    {
        src: "/lib/d3@7.js"
    },
].map(item => {
    return {
        ...item,
        tagType: 'script',
        pos: 'body'
    }
})
const scripts = [
    
    // 1
    {
        type: "text/javascript",
        src: "http://25.213.0.139:31005/sgepriamapsdk/libs/narimap.map.min.js"
    },
    {
        type: "text/javascript",
        src: "http://25.213.0.139:31005/sgepriamapsdk/libs/narimap.umd.min.js"
    },
    {
        type: "text/javascript",
        src: "http://25.213.0.139:31005/sgepriamapsdk/libs/narimap.components.devicecard.min.js"
    },
    {
        type: "text/javascript",
        src: "http://25.213.0.139:31005/sgepriamapsdk/libs/narimap.popup.min.js"
    },
    {
        type: "text/javascript",
        src: "http://25.213.0.139:31005/sgepriamapsdk/libs/narimap.psrmap.min.js"
    },
    // {
    //     type: "text/javascript",
    //     src: "http://25.213.0.139:31005/narimap/libs/thematic/d3.v7.min.js"
    // },

    // 2
    // {
    //     type: "text/javascript",
    //     src: "http://25.213.120.208/videoComponent/latest/uvp.js"
    // },
    // 3
    {
        src: "/tmzx/lib/math/Math.js"
    },
    {
        src: "/tmzx/lib/math/Quaternion.js"
    },
    {
        src: "/tmzx/lib/math/Vector2.js"
    },
    {
        src: "/tmzx/lib/math/Vector3.js"
    },
    {
        src: "/tmzx/lib/math/Matrix3.js"
    },
].map(item => {
    return {
        ...item,
        tagType: 'script',
        pos: 'body'
    }
})
const scripts2 = [
    {
        type: "text/javascript",
        src: "/tmzx/drawio/js/PreConfig.js"
    },
    {
        type: "text/javascript",
        src: "/tmzx/drawio/js/diagramly/Init.js"
    },
    {
        type: "text/javascript",
        src: "/tmzx/drawio/js/grapheditor/Init.js"
    },
    {
        type: "text/javascript",
        src: "/tmzx/drawio/mxgraph/mxClient.js"
    },
    {
        type: "text/javascript",
        src: "/tmzx/drawio/js/diagramly/Devel.js"
    },
    {
        type: "text/javascript",
        src: "/tmzx/drawio/js/PostConfig.js"
    }

].map(item => {
    return {
        ...item,
        tagType: 'script',
        pos: 'body'
    }
})
//----------------------------------------------------//
const loadPwtmzxPublic = (r) => {
    return new Promise((resolve, reject) => {
        let tag = document.createElement(r.tagType);
        Object.keys(r).forEach(key => {
            if (key !== 'tagType') {
                if (key === 'href' || key === 'src') {
                    if (!r[key].includes('http://')) {
                        r[key] = (r[key].indexOf(baseurl) !== -1 ? '' : baseurl) + r[key]
                    }
                }
                tag[key] = r[key]
            }
        })

        // tag.defer = true
        tag.ignore = true
        document[r.pos||'head'].appendChild(tag)
        tag.onload = () => resolve()
        tag.onerror = () => reject(new Error(`资源加载错误：${r.href || r.src}`))
    })
}
window.addEventListener('DOMContentLoaded', async () => {
    try {
        if (!window.__POWERED_BY_QIANKUN__) {
            // const publicList = [...scripts0,...links, ...scripts,...scripts2]
            const publicList = [...scripts0,...links, ...scripts]
            // const publicList = [...links, ...scripts]
            publicList.forEach(async pub => {
                await loadPwtmzxPublic(pub)
            });
        }
    } catch (error) {
        console.error('资源加载失败');
    }
})

window.mxscript = async (src, onLoad, id, dataAppKey, noWrite, onError) => {
    var defer = onLoad == null && !noWrite
    if (
        (urlParams['dev'] != '1' &&
            typeof document.createElement('canvas').getContext === 'function') ||
        onLoad != null ||
        noWrite
    ) {
        var s = document.createElement('script')
        s.setAttribute('type', 'text/javascript')
        s.setAttribute('defer', 'true')
        s.setAttribute('src', src)

        if (id != null) {
            s.setAttribute('id', id)
        }

        if (dataAppKey != null) {
            s.setAttribute('data-app-key', dataAppKey)
        }

        if (onLoad != null) {
            var r = false

            s.onload = s.onreadystatechange = function () {
                if (!r && (!this.readyState || this.readyState == 'complete')) {
                    r = true
                    onLoad()
                }
            }
        }

        if (onError != null) {
            s.onerror = function (e) {
                onError('Failed to load ' + src, e)
            }
        }

        var t = document.getElementsByTagName('script')[0]

        if (t != null) {
            t.parentNode.insertBefore(s, t)
        }
    } else {
        const pubCof = {
            src,
            id: !id ? '' : id,
            type: "text/javascript",
            // async: true,
            'data-app-key': !dataAppKey ? '' : dataAppKey,
            tagType: 'script',
            pos: 'body'
        }

        // await loadPwtmzxPublic(pubCof)
        document.write(
            '<script src="' +
            src +
            '"' +
            (id != null ? ' id="' + id + '" ' : '') +
            (dataAppKey != null ? ' data-app-key="' + dataAppKey + '" ' : '') +
            '></scr' +
            'ipt>'
        )
    }
}


// <script type="text/javascript" src="/htmlJs/loadResources.js" ignore></script>



