export default {
  // 获取属性信息
  getPropMap(metaNode) {
    let map = {}
    for (let itemNode of metaNode.children) {
      let nodeName = itemNode.nodeName

      if (!map[nodeName]) {
        if (nodeName == 'cge:GLink_Ref') {
          map[nodeName] = []
        } else {
          map[nodeName] = {}
        }
      }

      if (nodeName === 'cge:GLink_Ref') {
        map[nodeName].push({
          id: itemNode.getAttribute('ObjectID'),
          rel: itemNode.getAttribute('ObjectLinkPos')
        })
      } else {
        let nameList = itemNode.getAttributeNames()
        for (let name of nameList) {
          map[nodeName][name] = itemNode.getAttribute(name)
        }
      }
    }
    return map
  },

  // 获取dom属性信息，不包括链接信息
  getDomProps(metaNode) {
    let propMap = this.getPropMap(metaNode)
    let props = propMap['cge:PSR_Ref']
    return props
  },

  // 获取链接信息
  getLinkProps(node) {},
  // id="PD_30000000_381281"
  // 获取变电站
  getSubstation(rootNode) {
    let list = rootNode.getElementById('Substation_Layer').children
    for (let item of list) {
      let id = item.getAttribute('id')
      if (id.indexOf('PD_30000000_') != -1) {
        return item
      }
    }
    return null
  },

  // 根据gNode节点获取对应属性信息
  getPropsByDom(gNode) {
    let metaNode = gNode.getElementsByTagName('metadata')[0]
    return this.getDomProps(metaNode)
  },

  getPropsById(id, rootDoc) {
    let gNode = rootDoc.getElementById(id)
    this.getPropsByDom(gNode)
  },

  getDomById(id, rootDoc) {
    return rootDoc.getElementById(id)
  },

  // 获取设备的所有属性信息
  getDeviceInfo(id, rootDoc) {
    let gNode = this.getDomById(id, rootDoc)
    if (!gNode) {
      return
    }
    let metaNode = gNode.getElementsByTagName('metadata')[0]
    let propMap = this.getPropMap(metaNode)

    let pid = gNode.getAttribute('pid')

    let clist = gNode.children
    let ls = []
    for (let i = 0; i < clist.length - 1; i++) {
      ls.push(clist[i])
    }
    let firstNode = ls[0]
    // use，polyline，polygon，text
    let name = firstNode.nodeName.toLowerCase()

    let layerMap = propMap['cge:Layer_Ref']

    let layer = ''
    if (layerMap) {
      layer = layerMap['ObjectName'].toLowerCase()
    }

    return {
      id,
      pid,
      layer,
      flag: name,
      node: gNode,
      clist: ls,
      ...propMap['cge:PSR_Ref'],
      links: propMap['cge:GLink_Ref']
    }
  },

  getDeviceInfoById(id, rootDoc) {
    let gNode = this.getDomById(id, rootDoc)
    return this.getDeviceInfoByNode(gNode)
  },

  getDeviceInfoByNode(gNode) {
    let metaNode = gNode.getElementsByTagName('metadata')[0]
    let propMap = this.getPropMap(metaNode)

    let id = gNode.getAttribute('id')
    let pid = gNode.getAttribute('pid')

    let clist = gNode.children
    let ls = []
    for (let i = 0; i < clist.length - 1; i++) {
      ls.push(clist[i])
    }
    let firstNode = ls[0]
    // use，polyline，polygon，text
    let name = firstNode.nodeName.toLowerCase()

    let layerMap = propMap['cge:Layer_Ref']

    let layer = ''
    if (layerMap) {
      layer = layerMap['ObjectName'].toLowerCase()
    }

    return {
      id,
      pid,
      layer,
      flag: name,
      node: gNode,
      clist: ls,
      ...propMap['cge:PSR_Ref'],
      links: propMap['cge:GLink_Ref']
    }
  },

  getDevice($xmlDoc, id) {
    let $dom = $xmlDoc.find(`g[id='${id}']`)
    return $dom[0]
  },

  isTextNode(node) {
    return $(node).find('text').length > 0
  },

  isLineNode(node) {
    return $(node).find('polyline').length > 0
  },

  isUseNode(node) {
    return $(node).find('use').length > 0
  },

  isBusNode(node) {
    let layer = node.parentNode.parentNode
    return layer.getAttribute('id') == 'BusbarSection_Layer'
  },

  isStationNode(node) {
    return $(node).find('polygon').length > 0
  },

  // 获取dom节点下面的直接子结点
  getChildOfDom(parent, flag) {
    let list = []

    let clist = parent.children
    for (let item of clist) {
      let nodeName = item.nodeName.toLowerCase()
      if (nodeName == flag) {
        list.push(item)
      }
    }

    return list
  }
}
