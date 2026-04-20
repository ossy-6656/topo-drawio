import { ElMessage } from 'element-plus'
export default {
  /**
   * 判断是否是手机号
   * @param tel
   * @returns {boolean}
   */
  isMobile: function (tel: string) {
    const reg = /^0?1[1|2|3|4|5|6|7|8|9][0-9]\d{8}$/
    return reg.test(tel)
  },
  /**
   * 主要用来解决Vue引用传递的BUG
   * @param obj
   * @returns {any}
   */
  clone: function (obj: any) {
    return JSON.parse(JSON.stringify(obj))
  },
  //格式化日期,
  format_date: function (date, format) {
    const paddNum = function (num) {
      num += ''
      return num.replace(/^(\d)$/, '0$1')
    }
    //指定格式字符
    const cfg = {
      yyyy: date.getFullYear(), //年 : 4位
      yy: date.getFullYear().toString().substring(2), //年 : 2位
      M: date.getMonth() + 1, //月 : 如果1位的时候不补0
      MM: paddNum(date.getMonth() + 1), //月 : 如果1位的时候补0
      d: date.getDate(), //日 : 如果1位的时候不补0
      dd: paddNum(date.getDate()), //日 : 如果1位的时候补0
      hh: paddNum(date.getHours()), //时
      mm: paddNum(date.getMinutes()), //分
      ss: paddNum(date.getSeconds()) //秒
    }
    format || (format = 'yyyy-MM-dd hh:mm:ss')
    return format.replace(/([a-z])(\1)*/gi, function (m) {
      return cfg[m]
    })
  },
  /**
   * 模仿PHP的strtotime()函数
   * strtotime('2012-07-27 12:43:43') OR strtotime('2012-07-27')
   * @return 时间戳
   */
  strtotime(str) {
    const _arr = str.split(' ')
    const _day = _arr[0].split('-')
    _arr[1] = _arr[1] == null ? '0:0:0' : _arr[1]
    const _time = _arr[1].split(':')
    for (let i = _day.length - 1; i >= 0; i--) {
      _day[i] = isNaN(parseInt(_day[i])) ? 0 : parseInt(_day[i])
    }
    for (let i = _time.length - 1; i >= 0; i--) {
      _time[i] = isNaN(parseInt(_time[i])) ? 0 : parseInt(_time[i])
    }
    const _temp = new Date(_day[0], _day[1] - 1, _day[2], _time[0], _time[1], _time[2])
    return _temp.getTime() / 1000
  },
  rand(minNum, maxNum) {
    switch (arguments.length) {
      case 1:
        return parseInt(Math.random() * 1 * minNum + 1 + '', 10)
        break
      case 2:
        return parseInt(Math.random() * 1 * (maxNum - minNum + 1) + minNum + '', 10)
        break
      default:
        return 0
        break
    }
  },
  listToTree(list, parent_id, field) {
    const data = [] as any
    list.forEach((e) => {
      if (e[field] === parent_id) {
        const id = e['alias']
        const arr = this.listToTree(list, id, field)
        if (arr.length > 0) {
          e['children'] = arr
        }
        data.push(e)
      }
    })
    return data
  },
  // 定义url字符串拼接的方法
  setUrlQuery: (options) => {
    const { url, query } = options

    if (!url) return ''
    let newurl = url
    if (query) {
      const queryArr = [] as any
      for (const key in query) {
        if (query.hasOwnProperty(key)) {
          queryArr.push(`${key}=${query[key]}`)
        }
      }
      if (url.indexOf('?') !== -1) {
        newurl = `${url}&${queryArr.join('&')}`
      } else {
        newurl = `${url}?${queryArr.join('&')}`
      }
    }
    return newurl
  },
  //获取前n天的时间数据
  getBeforeDayDate: function (currentDate: Date, interval: number) {
    const previousDatTimeStamp: number = currentDate.getTime() - interval * 24 * 60 * 60 * 1000
    const previousDate = new Date(previousDatTimeStamp)
    return previousDate
  },
  //复制文字
  copyText: function (value) {
    const aux = document.createElement('input')
    aux.setAttribute('value', value)
    document.body.appendChild(aux)
    aux.select()
    document.execCommand('copy')
    document.body.removeChild(aux)
    ElMessage.success('复制成功')
  },
  //动态计算表格宽度
  dynamicCalculationWidth: function (prop, tableData, title, num = 0) {
    if (tableData.length === 0) {
      // 表格没数据不做处理
      return '100px'
    }
    let flexWidth = 0 // 初始化表格列宽
    let columnContent = '' // 占位最宽的内容
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    context.font = '14px Microsoft YaHei'
    if (prop === '' && title) {
      // 标题长内容少的，取标题的值,
      columnContent = title
    } else {
      // 获取该列中占位最宽的内容
      let index = 0
      for (let i = 0; i < tableData.length; i++) {
        const now_temp = tableData[i][prop] + ''
        const max_temp = tableData[index][prop] + ''
        const now_temp_w = context.measureText(now_temp).width
        const max_temp_w = context.measureText(max_temp).width
        if (now_temp_w > max_temp_w) {
          index = i
        }
      }
      columnContent = tableData[index][prop]
      // 比较占位最宽的值跟标题、标题为空的留出四个位置
      const column_w = context.measureText(columnContent).width
      const title_w = context.measureText(title).width
      if (column_w < title_w) {
        columnContent = title || '占位符呀'
      }
    }
    // 计算最宽内容的列宽
    const width = context.measureText(columnContent)
    flexWidth = width.width + 25 + num
    return flexWidth + 'px'
  },
  //获取当前年月日
  getNowDate: function () {
    const now = new Date()
    return (
      now.getFullYear() +
      '-' +
      ('0' + (now.getMonth() + 1)).slice(-2) +
      '-' +
      ('0' + now.getDate()).slice(-2)
    )
  }
}
