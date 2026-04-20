let MapTool = {
  createPromise(list) {
    return new Promise((resolve, reject) => {
      try {
        narimap.cgcs2sg(
          list,
          (resp) => {
            if (resp.success) {
              const mercator = resp.returnValue
              resolve(mercator)
            }
          },
          (err) => {
            console.log('MapTool->createPromise：思极坐标转换异常')
            reject(err)
          }
        )
      } catch (e) {
        console.log('调用坐标转换网络错误')
        reject(e)
      }
    })
  },
  /**
   * 84坐标转思极坐标，
   * @param corlist  坐标数组 | [[x,y],[x,y]...]
   * @param callback 回调
   * @param groupLen 默认按200个一组，目前测试最大为200，超过报错
   */
  wgs84ToSj(corlist, callback, groupLen = 200) {
    let promiseList = []

    if (corlist.length < groupLen) {
      promiseList.push(this.createPromise(corlist))
    } else {
      let len = Math.floor(corlist.length / groupLen)
      let step = 0
      for (let i = 0; i < len; i++) {
        let arr = corlist.slice(step, step + groupLen)
        promiseList.push(this.createPromise(arr))
        step += groupLen
      }

      // 如果有多余的
      if (corlist.length / groupLen > len) {
        let preLen = groupLen * len
        let arr = corlist.slice(preLen, corlist.length)
        promiseList.push(this.createPromise(arr))
      }
    }
    Promise.all(promiseList)
      .then((list) => {
        let tmpls = []
        for (let ls of list) {
          tmpls.push(...ls)
        }
        callback(tmpls)
      })
      .catch((err) => {
        console.log('wgs84ToSj:', err.message)
      })
  },
  /**
   * 获取多线坐标
   * @param lineLs | [
   *  [[x,y], [x,y]...],
   *  [[x,y], [x,y]...]...
   * ]
   * @param callback 回调
   */
  getMultiLineCor(lineLs, callback) {
    let corLenList = [] // 每个线路的长度
    let corList = [] // 线路坐标打散为一纬数组
    // 展开坐标
    for (let list of lineLs) {
      corList.push(...list)
      corLenList.push(list.length)
    }
    this.wgs84ToSj(corList, function (list) {
      let rslist = []
      let start = 0,
        end = 0
      for (let i = 0; i < lineLs.length; i++) {
        end = start + corLenList[i]
        rslist.push(list.slice(start, end))
        start = end
      }
      callback(rslist)
    })
  },
  /**
   * 获取单线坐标
   * @param lineLs | [ [x,y],[x,y]...]
   * @param callback
   */
  getSingleLineCor(lineLs, callback) {
    this.wgs84ToSj(lineLs, function (list) {
      callback(list)
    })
  }
}
export default MapTool
