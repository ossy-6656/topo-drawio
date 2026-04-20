"use strict";

function _typeof(obj) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (obj) { return typeof obj; } : function (obj) { return obj && "function" == typeof Symbol && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }, _typeof(obj); }

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _iterableToArray(iter) { if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) return _arrayLikeToArray(arr); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

var _version = 'v1.0.0';
console.info(_version);
console.log('23-1-16');
window.top.__BASE_LOCATION__ = document.currentScript.src.slice(0, -10); // 构造函数

function VideoObj(id, winNum, ip, port, token, objType, returnFuc, isVideoFull, ak) {
  if (!winNum || typeof winNum !== 'number' || winNum > 16 || winNum < 1) {
    throw new Error('winNum参数不合法');
  }

  if (objType === 'video') {
    objType = 1;
  } else if (objType === 'replay') {
    objType = 2;
  }

  if (![1, 2].includes(objType)) {
    throw new Error('objType参数不合法');
  }

  try {
    var self = this;
    this.color = 'rgba(135,206,235,1)';
    this.selectWidth = "1"; //选中窗口默认边框样式

    this.transType265 = "websocket"; //默认为http，通过http传输。可设置为'ws',通过websocket传输

    this.rongqiId = id;
    this.isTuchuScreen = 1; //突出显示切换flag

    this.returnFuc = returnFuc; //传入得回调方法名

    this.showMenuArr = [];
    this.showCircleCloud = false; //是否展示圆形云台

    this.showDefaultCloud = false; //是否展示默认云台

    this.winNum = winNum; //初始化显示窗口数

    this.ip = ip || window.location.hostname;
    this.port = port || window.location.port || '80';
    this.ak = ak;
    this.token = token;
    this.refreshToken = null;
    this.errorList = null; // this.ChromeVersion = null

    this.objType = objType === 2 ? "replay" : "video";
    this.flvType = "websocket";
    this.proxyIp = null;
    this.isMp4 = 'flv';
    this.isWaterMark = false;
    this.hasAudio = false;
    this.loopInterval = null; // 定时器

    this.PTZSpeed = 5; // 云台控制速度

    this.playingSelectedWinNum = null; // 选中当前正在播放的视频的窗口

    this.playingSelecteddevCode = null; // 选中当前正在播放的视频的设备号

    this.screenNum = 1; // 当前视频窗口个数，（点击分屏该数字回改变）

    this.isAllScreen = 0; // 是否全屏

    this.isPlayCodeList = []; // 正在播放的设备列表

    this.isTalkingDevCode = ""; // 正在对讲的设备编号

    this.videoWidth = 0; // 视频分辨率宽

    this.videoHeight = 0; // 视频分辨率高

    this.argarr = []; //用来保存某个窗口播放设备参数

    this.menuArr = [{
      menuCode: 'rightMenu01',
      menuName: '软解播放'
    }, {
      menuCode: 'rightMenu02',
      menuName: '关闭当前视频'
    }, {
      menuCode: 'rightMenu03',
      menuName: '关闭所有视频'
    }, {
      menuCode: 'rightMenu04',
      menuName: '工况信息'
    }];
    this.myUserName = ak || 'piadmin';
    this.errorCodeType = 'inner'; // 错误提示模板

    if (window.origin.indexOf('https://') >= 0) {
      if (ip.indexOf('http://') >= 0) {
        this.gatewayURL = window._gateWayUrl = this.ip + ":" + this.port;
      } else {
        this.gatewayURL = window._gateWayUrl = "https://" + this.ip + ":" + this.port;
      }
    } else {
      if (ip.indexOf('http://') >= 0) {
        this.gatewayURL = window._gateWayUrl = this.ip + ":" + this.port;
      } else {
        this.gatewayURL = window._gateWayUrl = "http://" + this.ip + ":" + this.port;
      }
    }

    self.playerObj = {};

    for (var i = 1; i < 17; i++) {
      self['playerInfo' + i] = {};
      self.playerObj["player".concat(i)] = "";
      self.playerObj["videoPlayer".concat(i)] = "";
    }

    var isLuzhi = self.objType === 'video';
    videoInit(id, self.objType, isLuzhi, isVideoFull, self);
    changeObjScreen(winNum, self, 0, '');
    eventInit(self);
    getErrorList(self, 'VIDEO_ERROR_CODE');
    var obj = getBrowserNameVersion();

    if ((obj === null || obj === void 0 ? void 0 : obj.Browser) === 'Chrome') {
      var v = obj.version.split('.')[0]; // self.ChromeVersion =  v * 1

      self.isMp4Play = v * 1 >= 107;
    }

    window.top.Demo = self;
  } catch (e) {
    console.log(e.message);
    return 0;
  }

  return 1;
}
/*
*
* 配置相关

*
*/


VideoObj.prototype.openRefreshToken = function (ak, sk) {
  var self = this;

  if (self.refreshToken) {
    this.closeRefreshToken();
  }

  self.refreshToken = setInterval(function () {
    getTokenTime(self, ak, sk);
  }, 1000 * 60 * 5);
};

VideoObj.prototype.closeRefreshToken = function () {
  clearInterval(this.refreshToken);
  this.refreshToken = null;
};

VideoObj.prototype.setVolume = function (value) {
  sessionStorage.setItem('volume', value);
};

VideoObj.prototype.setWaterMark = function (name, x, y, rows, cols) {
  if (this.isWaterMark) {
    var arr = document.getElementsByClassName('__waterMarks');
    var l = arr.length;

    for (var i = l - 1; i >= 0; i--) {
      if (arr[i] !== null) {
        arr[i].parentNode.removeChild(arr[i]);
      }
    }

    this.isWaterMark = false;
    return;
  } //传入动态水印内容


  var config = {
    watermark_txt: name ? name : this.myUserName
  };

  if (x) {
    config.watermark_x_space = x;
  } //水印x轴间隔


  if (y) {
    config.watermark_y_space = y;
  } //水印x轴间隔


  if (rows) {
    config.watermark_rows = rows;
  } //水印x轴间隔


  if (cols) {
    config.watermark_cols = cols;
  } //水印x轴间隔


  waterMark(config, 'videoZoomIE');
  this.isWaterMark = true;
};

VideoObj.prototype.setToken = function (token) {
  if (!token) {
    throw new Error("token\u4E0D\u5F97\u4E3A\u7A7A ".concat(token));
  }

  this.token = token;
};

VideoObj.prototype.showUser = function (isShow, userName) {
  var _this = this;

  this.myUserName = isShow ? userName : '';
  $("#" + _this.rongqiId + " .usertip").text("".concat(_this.myUserName));
};

VideoObj.prototype.setVersion = function (version) {
  window._version = version;
}; // errorTips


VideoObj.prototype.changeErrorTips = function (key) {
  var self = this;
  getErrorList(self, key); // if(![1,2].includes(num)){
  // 	throw new Error('num参数不合法')
  // 	return 0
  // }
  // if (num === 1) {
  // 	this.errorList = null
  // 	this.errorCodeType = 'inner'
  // } else {
  // 	getErrorList(self,key)
  // 	this.errorCodeType = 'outer'
  // }
}; // proxy


VideoObj.prototype.isEnableProxy = function (ip, flag) {
  if (flag && !ip) {
    throw new Error("\u5F00\u542F\u4EE3\u7406\u65F6ip\u4E0D\u5F97\u4E3A\u7A7A ".concat(ip));
  }

  this.proxyIp = ip;
  return 1;
}; // 传输协议


VideoObj.prototype.setTranseType = function (codeType, transType) {
  if (codeType === 'h264') {
    codeType = 1;
  }

  if (codeType === 'h265') {
    codeType = 2;
  }

  if (transType === 'http') {
    transType = 1;
  }

  if (transType === 'websocket') {
    transType = 2;
  }

  if (![1, 2].includes(codeType)) {
    throw new Error('codeType参数不合法');
    return 0;
  }

  if (![1, 2].includes(transType)) {
    throw new Error('transType参数不合法');
    return 0;
  }

  if (codeType === 1) {
    this.flvType = transType === 1 ? 'http' : 'websocket';
  }

  if (codeType === 2) {
    this.transType265 = transType === 1 ? 'http' : 'websocket';
  }
}; // 创建右键菜单栏 （未用到）


VideoObj.prototype.addRightClickMenu = function (arr) {
  var flag = true;

  if (Array.isArray(arr)) {
    arr.map(function (item) {
      flag = !['rightMenu01', 'rightMenu02', 'rightMenu03', 'rightMenu04', 'rightMenu05', 'rightMenu06', 'rightMenu07', 'rightMenu08', 'rightMenu09', 'rightMenu10'].includes(item.menuCode);
    });
  }

  if (!flag) {
    throw new Error('menuCode标识符已被内部占用');
  }

  return this.showMenu(arr);
};

VideoObj.prototype.showMenu = function (arr) {
  var self = this;

  try {
    if (arr.length > 0) {
      self.menuArr = concat_(self.menuArr, arr);
    }
  } catch (e) {
    console.log(e.message);
    return 0;
  }

  return 1;
}; // 控制云台展示


VideoObj.prototype.showControlPanel = function (type, enable) {
  if (![1, 2].includes(type)) {
    throw new Error("type\u4E0D\u5408\u6CD5 ".concat(type));
  }

  if (![true, false].includes(enable)) {
    throw new Error("enable\u4E0D\u5408\u6CD5 ".concat(enable));
  }

  try {
    if (type === 1) {
      this.showDefaultCloud = enable;
    } else if (type === 2) {
      this.showCircleCloud = enable;
    }
  } catch (e) {
    console.log(e.message);
    return 0;
  }

  return 1;
}; // 设置码流


VideoObj.prototype.setStreamType = function (num, streamType) {
  if (!num || typeof num !== 'number' || num > 16 || num < 1) {
    throw new Error("\u7A97\u53E3\u6570\u5E94\u5F53\u57281-16\u4E4B\u95F4 ".concat(num));
  }

  if (![1, 2].includes(streamType)) {
    throw new Error("streamType\u53C2\u6570\u4E0D\u5408\u6CD5 ".concat(streamType));
  }

  var self = this;

  try {
    videoObjClose(num, self, true);
    self.argarr[6] = streamType;
    videoPlay.apply(void 0, _toConsumableArray(self.argarr));
  } catch (e) {
    console.log(e.message);
    return 0;
  }

  return 1;
}; // 设置选中边框


VideoObj.prototype.setBorderStyle = function (color, selectWidth) {
  return this.setWinColor(color, selectWidth);
};

VideoObj.prototype.setWinColor = function (color, selectWidth) {
  try {
    this.color = color;
    this.selectWidth = selectWidth;
  } catch (e) {
    console.log(e.message);
    return 0;
  }

  return 1;
}; // 某个窗口是否展示右键的某个菜单项


VideoObj.prototype.setRightClickMenuShow = function (num, menuCode, isShow) {
  this.isShowMenu(num, menuCode, isShow);
};

VideoObj.prototype.isShowMenu = function (num, menuCode, isShow) {
  if (!num || typeof num !== 'number' || num > 16 || num < 1) {
    throw new Error('num参数不合法');
  }

  var length = this.showMenuArr.length;
  var showMenuArr = this.showMenuArr;
  var isHas = false;
  var j;

  for (var i = 0; i < length; i++) {
    if (showMenuArr[i].num === num && showMenuArr[i].menuCode === menuCode) {
      isHas = true;
      j = i;
    }
  }

  if (isHas) {
    showMenuArr.splice(j, 1, {
      num: num,
      menuCode: menuCode,
      isShow: isShow
    });
    isHas = false;
  } else {
    showMenuArr.push({
      num: num,
      menuCode: menuCode,
      isShow: isShow
    });
  }
};
/*
*
* 功能区
*
*/


VideoObj.prototype.pointPlay = function (num, pointId) {
  if (!num || typeof num !== 'number' || num > 16 || num < 1) {
    throw new Error("\u7A97\u53E3\u6570\u5E94\u5F53\u57281-16\u4E4B\u95F4 ".concat(num));
  }

  if (!pointId) {
    throw new Error("\u672A\u4F20\u5165pointId ".concat(pointId));
  }

  var self = this;

  if (pointId) {
    $.ajax({
      async: false,
      data: JSON.stringify({
        pointId: pointId
      }),
      type: "POST",
      contentType: 'application/json',
      dataType: "json",
      url: self.gatewayURL + "/uvp-backend-datafusion/api/v1/getDevInfosByPointId",
      success: function success(result) {
        if (result.successful) {
          var _result$resultValue = result.resultValue,
              name = _result$resultValue.name,
              devCode = _result$resultValue.devCode,
              decoderTag = _result$resultValue.decoderTag;
          var packageMethod = decoderTag == '108' ? 'h265' : 'h264';
          self.videoPlay(num, packageMethod, devCode, '', name, null, null);
          return true;
        }

        return false;
      }
    });
  } else {
    return false;
  }
}; // 实时视频视频播放1


VideoObj.prototype.videoPlay = function (num, packageMethod, devCode, videoTalkUrl, showName, streamType, videoUrl, hasAudio) {
  if (!num || typeof num !== 'number' || num > 16 || num < 1) {
    throw new Error("\u7A97\u53E3\u6570\u5E94\u5F53\u57281-16\u4E4B\u95F4 ".concat(num));
  }

  if (![1, 2].includes(streamType)) {
    throw new Error("\u7801\u6D41\u53C2\u6570\u4E0D\u5408\u6CD5 ".concat(streamType));
  }

  try {
    var self = this;
    var step = false;
    hasAudio = hasAudio === undefined ? self.hasAudio : hasAudio;

    if (!packageMethod) {
      var obj = {};
      obj.devCodes = [devCode];
      $.ajax({
        async: false,
        data: JSON.stringify(obj),
        type: "POST",
        contentType: 'application/json',
        dataType: "json",
        url: self.gatewayURL + "/uvp-backend-common/api/v1/resource/queryDev?ak=".concat(self.ak, "&token=").concat(self.token, "&timestamp=").concat(new Date().getTime(), "&nonce=").concat(generateUUID()),
        success: function success(result) {
          if (result.resultValue.length > 0) {
            if (result.resultValue[0].decoderTag == 108) {
              packageMethod = 2;
            } else {
              packageMethod = 1;
            }
          } else {
            packageMethod = 1;
          }
        },
        error: function error(result) {
          packageMethod = 1;
        }
      });
    } else {
      if (typeof packageMethod === 'string') {
        if (packageMethod.toLowerCase() === 'h264') {
          packageMethod = 1;
        } else if (packageMethod.toLowerCase() === 'h265') {
          packageMethod = 2;
        } else if (packageMethod.toLowerCase() === 'h264decode') {
          packageMethod = 3;
        } else if (packageMethod.toLowerCase() === 'jpg') {
          packageMethod = 4;
        }
      }
    }

    if (![1, 2, 3, 4].includes(packageMethod)) {
      throw new Error("\u89E3\u7801\u6807\u7B7E\u4E0D\u5408\u6CD5 ".concat(packageMethod));
    }

    packageMethod = packageMethod === 1 ? 'h264' : packageMethod === 2 ? 'h265' : packageMethod === 3 ? 'h264decoder' : 'jpg';
    var uuid = generateUUID();
    self['playerInfo' + num].sessionId = uuid;

    if (!videoTalkUrl) {
      videoTalkUrl = self.gatewayURL + '/uvp-micro-service/mediatranscode/api/v1/talk?code=' + devCode + "&sessionId=" + uuid + "&ak=" + self.ak + "&token=" + self.token + "&format=pcm&redirect=false";
    }

    if (videoUrl) {
      step = true;
      self.isMp4 = 'flv';
      self.isLive = true; // if(videoUrl.indexOf("?") <0){
      // 	videoUrl = videoUrl + '?code='+ devCode +'&sessionId='+uuid+'&format=flv&codec='+packageMethod+'&rate=main&redirect=false&ak='+self.ak+'&token='+self.token+ "&num=" + num + "&rongqiId=" + self.rongqiId+ "&time=" + new Date().getTime()
      // }
    } else {
      // 去除判断h264
      if (packageMethod === "h264") {
        videoUrl = self.gatewayURL + '/uvp-micro-service/mediatranscode/api/v1/play?code=' + devCode + '&sessionId=' + uuid + '&format=flv&codec=' + packageMethod + '&rate=main&redirect=false&ak=' + self.ak + '&token=' + self.token + "&num=" + num + "&rongqiId=" + self.rongqiId + "&time=" + new Date().getTime();
      } else {
        videoUrl = self.gatewayURL + '/uvp-micro-service/mediatranscode/api/v1/play?code=' + devCode + '&sessionId=' + uuid + '&format=ps&codec=' + packageMethod + '&rate=main&redirect=false&ak=' + self.ak + '&token=' + self.token + "&num=" + num + "&rongqiId=" + self.rongqiId + "&time=" + new Date().getTime();
      }
    }

    if (streamType === 2) {
      videoUrl = replaceParamVal(videoUrl, "rate", "sub");
    }

    videoPlay(num, packageMethod, devCode, videoUrl, videoTalkUrl, showName, streamType, self, '', step, hasAudio);
    return 1;
  } catch (e) {
    return 0;
  }
}; // 历史视频播放1


VideoObj.prototype.recordPlay = function (num, packageMethod, devCode, showName, videoUrl, type, streamType, playurl, decodetag, hasAudio) {
  if (!num || typeof num !== 'number' || num > 16 || num < 1) {
    throw new Error("\u7A97\u53E3\u6570\u5E94\u5F53\u57281-16\u4E4B\u95F4 ".concat(num));
  }

  if (typeof packageMethod === 'string') {
    if (packageMethod.toLowerCase() === 'h264') {
      packageMethod = 1;
    } else if (packageMethod.toLowerCase() === 'h265') {
      packageMethod = 2;
    } else if (packageMethod.toLowerCase() === 'h264decode') {
      packageMethod = 3;
    }
  }

  if (![1, 2, 3].includes(packageMethod)) {
    throw new Error("packageMethod\u4E0D\u5408\u6CD5 ".concat(packageMethod));
  }

  packageMethod = packageMethod === 1 ? 'h264' : packageMethod === 2 ? 'h265' : 'h264decoder';
  var self = this;
  var uuid = generateUUID();
  self['playerInfo' + num].sessionId = uuid;
  var recordType = type == 0 ? 'device' : 'storage';
  streamType = streamType === 0 ? '0' : '1';
  hasAudio = hasAudio === undefined ? self.hasAudio : hasAudio;

  if (videoUrl.indexOf('rtsp') > -1) {
    videoUrl = encodeURIComponent(videoUrl);
  }

  try {
    if (playurl) {
      // if(playurl.indexOf("?") >0){
      // 	playurl = playurl + "&time=" + new Date().getTime() + "&num=" + num + "&rongqiId=" + self.rongqiId +'&sessionId='+uuid+"&directurl=directurl"+'&recordType='+recordType
      // }else{
      // 	playurl = playurl + "?time=" + new Date().getTime() + "&num=" + num + "&rongqiId=" + self.rongqiId + '&sessionId='+uuid+"&directurl=directurl"+'&recordType='+recordType
      // }
      if (decodetag == 200) {
        self.isMp4 = 'mp4';
      } else {
        self.isMp4 = 'flv';
      }

      self.isLive = false;
      videoPlay(num, packageMethod, devCode, playurl, '', showName, streamType, self, '', true, hasAudio);
    } else {
      if (decodetag == 200) {
        //拼接不经过网关，后面播放认为时直接传进来
        if (videoUrl.indexOf('://') < 0) {
          videoUrl = self.gatewayURL + videoUrl + "?token=" + self.token + '&sessionId=' + uuid + "&businessid=" + "" + "&time=" + new Date().getTime() + "&num=" + num + "&rongqiId=" + self.rongqiId + "&directurl=directurl&decodetag=200" + '&ak=' + self.ak + '&recordType=' + recordType;
        }
      } else {
        if (videoUrl.indexOf('rtsp') > -1) {
          videoUrl = '/mediatranscode/api/v1/play' + '?recordUrl=' + videoUrl + '&code=' + devCode;
        }

        if (videoUrl.indexOf('?') > -1) {
          videoUrl = self.gatewayURL + '/uvp-micro-service' + videoUrl + "&token=" + self.token + '&ak=' + self.ak + '&sessionId=' + uuid + "&businessid=" + "" + "&time=" + new Date().getTime() + "&num=" + num + "&rongqiId=" + self.rongqiId + '&recordType=' + recordType;
        } else {
          videoUrl = self.gatewayURL + '/uvp-micro-service' + videoUrl + "?token=" + self.token + '&ak=' + self.ak + '&sessionId=' + uuid + "&businessid=" + "" + "&time=" + new Date().getTime() + "&num=" + num + "&rongqiId=" + self.rongqiId + '&recordType=' + recordType;
        }
      }

      videoPlay(num, packageMethod, devCode, videoUrl, '', showName, streamType, self, '', false, hasAudio);
    }
  } catch (e) {
    console.log(e.message);
    return 0;
  }

  return 1;
}; // 关闭视频播放


VideoObj.prototype.videoClose = function (num, url, sessionId) {
  var self = this;

  if (!num || typeof num !== 'number' || num > 16 || num < 1) {
    throw new Error("\u7A97\u53E3\u6570\u5E94\u5F53\u57281-16\u4E4B\u95F4 ".concat(num));
  }

  if (url) {
    videoObjClose(num, self, true, url, sessionId);
  } else {
    videoObjClose(num, self, true);
  }
}; // 云台控制


VideoObj.prototype.videoControl = function (devCode, cmd, lspeed, rspeed, url, sessionId) {
  try {
    if (!cmd) {
      throw new Error("\u7F3A\u5C11cmd\u53C2\u6570 ".concat(cmd));
    }

    if (!lspeed || typeof lspeed !== 'number' || lspeed > 9 || lspeed < 1) {
      throw new Error("lspeed\u53C2\u6570\u9519\u8BEF\uFF0C\u53D6\u503C\u8303\u56F41-9 ".concat(lspeed));
    }

    if (!rspeed || typeof rspeed !== 'number' || rspeed > 9 || rspeed < 1) {
      throw new Error("rspeed\u53C2\u6570\u9519\u8BEF\uFF0C\u53D6\u503C\u8303\u56F41-9 ".concat(rspeed));
    }

    var self = this;
    videoObjControl(devCode, cmd, lspeed, rspeed, self, url, sessionId);
  } catch (e) {
    console.log(e.message);
  }
}; // 关闭录像播放 (未用到)


VideoObj.prototype.recordClose = function (num) {
  var self = this; // recordClose(num, self);
}; // 实时视频录制


VideoObj.prototype.realRecord = function (num) {
  recordVideoFuc(num, this);
}; // 视频截图


VideoObj.prototype.capture = function (winNum) {
  var picurl = '';

  try {
    var self = this;
    picurl = picSave(winNum, self);

    if (picurl) {
      picurl = "data:image/png;base64," + picurl;
    } else {
      picurl = 0; // 失败返回0
    }

    return picurl;
  } catch (e) {
    return 0;
  }
}; // 获取窗口号


VideoObj.prototype.getWindowInfo = function (winNum) {
  this.getInfo(winNum);
};

VideoObj.prototype.getInfo = function (winNum) {
  if (!winNum || typeof winNum !== 'number' || winNum > 16 || winNum < 1) {
    throw new Error("\u7A97\u53E3\u6570\u5E94\u5F53\u57281-16\u4E4B\u95F4 ".concat(winNum));
  }

  var self = this;
  getObjInfo(winNum, self);
}; // 语音对讲


VideoObj.prototype.videoTalk = function (num, src) {
  try {
    if (!num || typeof num !== 'number' || num > 16 || num < 1) {
      throw new Error("\u7A97\u53E3\u6570\u5E94\u5F53\u57281-16\u4E4B\u95F4 ".concat(num));
    }

    var self = this;
    videoTalk(num, self, src);
  } catch (e) {
    return 0;
  }

  return 1;
};

VideoObj.prototype.closeVideoTalk = function () {
  endVideoTalk();
};

VideoObj.prototype.closeAllVideo = function () {
  var self = this;

  for (var i = 1; i < 17; i++) {
    try {
      videoObjClose(i, self, true);
    } catch (e) {
      console.log(e.message);
      return 0;
    }
  }

  return 1;
}; //返回历史视频状态


VideoObj.prototype.getVideoState = function (num) {
  this.state(num);
};

VideoObj.prototype.state = function (num) {
  if (!num || typeof num !== 'number' || num > 16 || num < 1) {
    throw new Error("\u7A97\u53E3\u6570\u5E94\u5F53\u57281-16\u4E4B\u95F4 ".concat(num));
  }

  var self = this;

  if (self.playerObj['videoPlayer' + num]) {
    var eventType = '109';
    var time = self.playerObj["videoPlayer" + num].currentTime; // console.log('原始currentTime==',time)

    if (time && +time > 36000 || !time) {
      time = self.playerObj["videoPlayer" + num].dts - 1;
      self['playerInfo' + num].pauseTime = null;
    } // if(self['playerInfo'+num].pauseStartTime) {
    // 	if(new Date().getTime() - self['playerInfo'+num].pauseStartTime < 8000 && Math.abs(self['playerInfo'+num].pauseTime - time) > 60) {
    // 		time = self['playerInfo'+num].pauseTime
    // 	} else {
    // 		self['playerInfo'+num].pauseStartTime = null
    // 	}
    // }
    // if(self['playerInfo'+num].isGoback === 'true') { 
    // 	if(time > self['playerInfo'+num].pauseTime) {
    // 		time = self['playerInfo'+num].pauseTime
    // 	}
    // 	if(time - self['playerInfo'+num].pauseTime < 5) {
    // 		console.log('完成后拖拽')
    // 		self['playerInfo'+num].isGoback = ''
    // 	}
    // } else if (self['playerInfo'+num].isGoback === 'false') {
    // 	if(time < self['playerInfo'+num].pauseTime) {
    // 		time = self['playerInfo'+num].pauseTime
    // 	}
    // 	if(time - self['playerInfo'+num].pauseTime < 5) {
    // 		console.log('完成前拖拽')
    // 		self['playerInfo'+num].isGoback = ''
    // 	}
    // }
    // 	let time1 = time *1000
    // 	if(time1 * 1000 > 4294967295){
    // 		let t = time1.toString(2)
    // 		let t3 = t.substring(t.length - 32)
    // 		time1 = parseInt(t3,2)
    // 		time = time1 / 1000
    // 		console.log('+_+_++',time)
    // }


    if (self['playerInfo' + num].pauseTime) {
      // liu没到之前
      time = self['playerInfo' + num].pauseTime; // console.log('定格currentTime==',time)
    }

    var eventContext = {
      num: num,
      playbackRate: document.querySelector("#" + self.rongqiId + " #videoPlayer" + num).playbackRate,
      paused: document.querySelector("#" + self.rongqiId + " #videoPlayer" + num).paused,
      //currentTime:document.querySelector("#" + self.rongqiId  + " #videoPlayer" + num).currentTime,
      currentTime: time,
      ended: document.querySelector("#" + self.rongqiId + " #videoPlayer" + num).ended,
      //buffered:document.querySelector("#" + self.rongqiId  + " #videoPlayer" + num).buffered.end(0),
      buffered: self.playerObj["videoPlayer" + num].dts
    }; // console.log(eventContext)

    execute(self.returnFuc, eventType, eventContext);
  } else if (self.playerObj["player".concat(num)]) {
    var _eventType = '109';
    var _eventContext = {
      num: num,
      paused: self.playerObj["player" + num].getState() == 1 ? false : true,
      currentTime: self.playerObj["player".concat(num)].videoTimeStamp
    };
    execute(self.returnFuc, _eventType, _eventContext);
  }
};

VideoObj.prototype.fastForward = function (num, playRate) {
  if (!num || typeof num !== 'number' || num > 16 || num < 1) {
    throw new Error("\u7A97\u53E3\u6570\u5E94\u5F53\u57281-16\u4E4B\u95F4 ".concat(num));
  }

  if (document.querySelector("#" + this.rongqiId + " #videoPlayer" + num)) {
    document.querySelector("#" + this.rongqiId + " #videoPlayer" + num).playbackRate = playRate;
  }
}; //录像控制


VideoObj.prototype.remoteFilePlayControl = function (num, controlType, controlValue) {
  if (!num || typeof num !== 'number' || num > 16 || num < 1) {
    throw new Error("\u7A97\u53E3\u6570\u5E94\u5F53\u57281-16\u4E4B\u95F4 ".concat(num));
  }

  var self = this;
  var controlUrl = '';
  var cmd = 'play';
  var scale = '';
  var range = '';
  var sessionId = self['playerInfo' + num].sessionId;

  if (controlType == 1 || controlType == 4) {
    self.playerObj["player".concat(num)] && self.playerObj["player".concat(num)].play();
    self.playerObj["videoPlayer".concat(num)] && document.querySelector("#" + self.rongqiId + " #videoPlayer" + num).play();
  } else if (controlType == 2) {
    videoObjClose(num, self, true);
    return;
  } else if (controlType == 3) {
    cmd = 'pause';
    self.playerObj["player".concat(num)] && self.playerObj["player".concat(num)].pause();
    self.playerObj["videoPlayer".concat(num)] && document.querySelector("#" + self.rongqiId + " #videoPlayer" + num).pause();
  } else if ([5, 6, 7, '5', '6', '7'].includes(controlType)) {
    scale = controlValue;
  } else if (controlType == 12) {
    range = controlValue + ''; // 保存暂停时间

    var time = self.playerObj["videoPlayer" + num].currentTime; // 60s
    // self['playerInfo'+num].isGoback = (+controlValue - time) < 0 ? 'true' : 'false'

    self['playerInfo' + num].pauseTime = +controlValue; // 1000s  940s + 10

    self['playerInfo' + num].keyTime = Math.abs(+controlValue - time); // self['playerInfo'+num].pauseTime = +controlValue // 1000s  940s + 10
    // self['playerInfo'+num].pauseStartTime = new Date().getTime()

    var play1 = self.playerObj["videoPlayer" + num]; // console.log('before',play1.dts)

    if (play1) {
      play1.dts = controlValue;
    } // console.log('after',play1.dts)

  }

  try {
    var typeNum = self['playerInfo' + num].streamType;

    if (typeNum == 0) {
      //是片段
      if ([5, 6, 7, '5', '6', '7'].includes(controlType)) {
        document.querySelector("#" + self.rongqiId + " #videoPlayer" + num).playbackRate = scale;
      }

      if (controlType == 3) {
        document.querySelector("#" + self.rongqiId + " #videoPlayer" + num).pause();
      }

      if (controlType == 1) {
        document.querySelector("#" + self.rongqiId + " #videoPlayer" + num).play();
      }

      if (controlType == 12) {
        document.querySelector("#" + self.rongqiId + " #videoPlayer" + num).currentTime = controlValue;
      }

      var eventType = '108';
      var eventContext = {
        num: num,
        controlType: controlType
      };
      execute(self.returnFuc, eventType, eventContext);
      return;
    }

    var obj = {
      cmd: cmd,
      range: range,
      sessionId: sessionId,
      scale: scale + ''
    };

    if (sessionId && sessionId.length > 0) {
      controlUrl = self.gatewayURL + '/uvp-micro-service/mediatranscode/api/v1/playControl' + "?token=" + self.token + "&nonce=" + "&ak=" + self.ak + "&sessionId=" + sessionId + "&businessid=" + '' + "&timestamp=" + new Date().getTime();
    } else {
      controlUrl = self.gatewayURL + '/media/control' + "?token=" + self.token + "&cmd=" + cmd + "&scale=" + scale + "&range=" + range + "&sessionId=" + sessionId + "&businessid=" + '' + "&time=" + new Date().getTime();
    }

    $.ajax({
      url: controlUrl,
      data: JSON.stringify(obj),
      type: "POST",
      dataType: "json",
      contentType: 'application/json',
      success: function success(result) {
        if (result && (result.resultCode || result.ResultCode) == 200) {
          if (self.objType == "replay") {
            if (controlType == 5 || controlType == 6 || controlType == 7) {
              if (self.playerObj["videoPlayer".concat(num)]) {
                var ttt = setTimeout(function () {
                  var sel = document.getElementById(self.rongqiId);
                  sel.querySelector("#videoPlayer".concat(num)).playbackRate = scale;
                  var eventType = '108';
                  var eventContext = {
                    res: result,
                    num: num,
                    controlType: controlType,
                    playbackRate: document.querySelector("#" + self.rongqiId + " #videoPlayer" + num).playbackRate
                  };
                  execute(self.returnFuc, eventType, eventContext);
                  clearTimeout(ttt);
                }, 2000);
              } else if (self.playerObj["player".concat(num)]) {
                var _eventType2 = '108';
                var _eventContext2 = {
                  res: result,
                  num: num,
                  controlType: controlType,
                  playbackRate: scale
                };
                execute(self.returnFuc, _eventType2, _eventContext2);
              }
            } else if (controlType == 3) {
              var _eventType3 = '108';
              var _eventContext3 = {
                res: result,
                num: num,
                controlType: controlType
              };
              execute(self.returnFuc, _eventType3, _eventContext3);
            } else if (controlType == 1) {
              if (self.playerObj["videoPlayer".concat(num)]) {
                document.querySelector("#" + self.rongqiId + " #videoPlayer" + num).play();
                var _eventType4 = '108';
                var _eventContext4 = {
                  res: result,
                  num: num,
                  controlType: controlType
                };
                execute(self.returnFuc, _eventType4, _eventContext4);
              } else if (self.playerObj["player".concat(num)]) {
                self.playerObj["player".concat(num)].play();
                var _eventType5 = '108';
                var _eventContext5 = {
                  res: result,
                  num: num,
                  controlType: controlType
                };
                execute(self.returnFuc, _eventType5, _eventContext5);
              }
            } else {
              // const tt = setTimeout(function(){
              // if(controlType == 12 && self.playerObj[`videoPlayer${num}`]  &&  self.playerObj[`videoPlayer${num}`].buffered.length){
              // 	// self.playerObj[`videoPlayer${num}`].currentTime = self['playerInfo'+num].pauseTime
              // 		const buffered = self.playerObj[`videoPlayer${num}`].buffered.end(0) - 0.1
              // 		if (buffered - self.playerObj[`videoPlayer${num}`].currentTime > 1) {
              // 			console.log('++++')
              // 			self.playerObj[`videoPlayer${num}`].currentTime = buffered
              // 		}else{
              // 			self.playerObj[`videoPlayer${num}`].currentTime = buffered - 1
              // 		}
              // 		self['playerInfo'+num].pauseTime = null
              // 	}
              // 	clearTimeout(tt)
              // },4000)
              var interval = setInterval(function () {
                var trueTime = self.playerObj["videoPlayer".concat(num)].currentTime;
                var pauseTime = self['playerInfo' + num].pauseTime; // console.log('kuadu',Math.abs(trueTime - pauseTime,self['playerInfo'+num].keyTime))

                if (Math.abs(trueTime - pauseTime) * 4 < self['playerInfo' + num].keyTime) {
                  self['playerInfo' + num].pauseTime = null;
                  clearInterval(interval);
                }
              }, 1000);
              var _eventType6 = '108';
              var _eventContext6 = {
                res: result,
                num: num,
                controlType: controlType
              };
              execute(self.returnFuc, _eventType6, _eventContext6);
            }
          }
        }
      },
      complete: function complete(xhr, textStatus) {
        if (xhr.getResponseHeader('sessionstate') == 'tokenTimeout' || xhr.getResponseHeader('sessionstate') == 'timeout' || xhr.getResponseHeader('sessionstate') == 'nouser') {
          window.top.postMessage({
            key: "loginOut",
            value: ""
          }, "*");
        }
      }
    });
  } catch (e) {
    return 0;
  }
}; //视频宽高接口


VideoObj.prototype.getVideoWH = function (num) {
  return this.videoWH(num);
};

VideoObj.prototype.videoWH = function (num) {
  if (!num || typeof num !== 'number' || num > 16 || num < 1) {
    throw new Error("\u7A97\u53E3\u6570\u5E94\u5F53\u57281-16\u4E4B\u95F4 ".concat(num));
  }

  var self = this;
  var videoWidth = 0;
  var videoHeight = 0;

  if (self.playerObj["videoPlayer".concat(num)]) {
    var sel = document.getElementById(self.rongqiId);
    videoWidth = sel.querySelector("#videoPlayer".concat(num)).videoWidth;
    videoHeight = sel.querySelector("#videoPlayer".concat(num)).videoHeight;
  }

  if (self.playerObj["player".concat(num)]) {
    videoWidth = self.playerObj["player".concat(num)].videoWidth;
    videoHeight = self.playerObj["player".concat(num)].videoHeight;
  }

  return {
    videoWidth: videoWidth,
    videoHeight: videoHeight
  };
};
/**
 * 
 * @param {*} num 几分屏循环
 * @param {*} arr {devCode:设备code,devName:设备名称,packageMethod:解码标签}
 * @param {*} time 多久循环一次
 * @param {*} times 第几次循环
 */


VideoObj.prototype.loopPlay = function (num, arr, time, times) {
  var self = this;
  this.arr = arr;
  changeObjScreen(num, self, 0, '');
  var len = arr.length; // 数组长度

  if (len === 0) {
    return;
  }

  this.isPause = false; // let loopNum =Math.floor(len/num)
  // let last = len % num // 取模
  // self.loopNum = last === 0 ? loopNum : loopNum + 1 // 一共多少组

  var loopNum = self.loopNum = Math.ceil(len / num);
  self.loopList = []; // 循环的数组

  self.time = time; // 循环时间间隔

  self.loopTimes = times = times ? times : 0; // 当前第几组

  for (var i = 0; i < loopNum; i++) {
    var start = i * num;

    if (i === self.loopNum) {
      if (arr.slice(start, len).length !== 0) {
        self.loopList[i] = arr.slice(start, len);
      }
    } else {
      self.loopList[i] = arr.slice(start, start + num);
    }
  }

  videoLoopPlay(self, times, num, time);
}; // looptimes  第几波循环 num没波循环几个窗口 time 循环时间间隔


function videoLoopPlay(self, loopTimes, num, time) {
  time = time ? time : self.time;
  var loopArr = self.loopList[self.loopTimes]; // 第几轮的

  for (var i = 0, j = 1; i < num; i++, j++) {
    self.videoPlay(j, loopArr[i].codeType, loopArr[i].devCode, null, loopArr[i].devName, 1, null);
  }

  self.loopInterval = setInterval(function () {
    if (self.isPause) {
      // 如果暂停了不执行
      return;
    }

    self.loopTimes++;

    if (self.loopTimes > self.loopNum - 1) {
      self.loopTimes = 0;
    }

    self.closeAllVideo();
    loopArr = self.loopList[self.loopTimes];

    for (var _i = 0, _j = 1; _i < num; _i++, _j++) {
      self.videoPlay(_j, loopArr[_i].codeType, loopArr[_i].devCode, null, loopArr[_i].devName, 1, null);
    }
  }, time);
}

VideoObj.prototype.setLoopConfig = function (type, time) {
  this.time = time ? time : this.time;
  this.closeLoopPlay();

  if (type === 2) {
    this.loopTimes++;
    this.loopTimes = this.loopTimes > this.loopNum ? 0 : this.loopTimes;
  } else if (type === 1) {
    this.loopTimes--;
    this.loopTimes = this.loopTimes < 0 ? this.loopNum : this.loopTimes;
  } // num,arr,time,times


  this.loopPlay(this.screenNum, this.arr, this.time, this.loopTimes);
}; // 停止循环


VideoObj.prototype.closeLoopPlay = function () {
  this.closeAllVideo();
  clearInterval(this.loopInterval);
  this.loopInterval = null;
  var obj = {
    num: this.screenNum,
    loopList: this.arr,
    time: this.time,
    times: this.loopTimes
  };
  return obj;
};

VideoObj.prototype.pauseLoopPlay = function () {
  clearInterval(this.loopInterval);
  this.isPause = true;
  this.loopInterval = null;
  var obj = {
    num: this.screenNum,
    loopList: this.arr,
    time: this.time,
    times: this.loopTimes
  };
  return obj;
};
/*
*
* 窗口区
*
*/


VideoObj.prototype.freeWinNum = function (flag) {
  var num = flag ? this.screenNum : 16;

  for (var i = 1; i <= num; i++) {
    var key = "playerInfo".concat(i);

    if (!this[key].devCode) {
      return i;
    }
  }

  return flag ? null : num + 1 > 16 ? null : num + 1;
}; // 分屏


VideoObj.prototype.splitScreen = function (winNum, hang, lie) {
  return this.videoNum(winNum, hang, lie);
};

VideoObj.prototype.videoNum = function (winNum, hang, lie) {
  if (!winNum || typeof winNum !== 'number' || winNum > 16 || winNum < 1) {
    throw new Error("\u7A97\u53E3\u6570\u5E94\u5F53\u57281-16\u4E4B\u95F4 ".concat(winNum));
  }

  if (hang && lie && winNum) {
    if (hang < 0 || lie < 0) {
      throw new Error("\u884C\u5217\u503C\u4E0D\u53EF\u4E3A\u8D1F\u6570 ".concat(hang, "-").concat(lie));
    }

    if (hang * lie !== winNum) {
      throw new Error("\u884C\u5217\u503C\u4E58\u79EF\u5E94\u5F53\u7B49\u4E8E\u7A97\u53E3\u6570 ".concat(hang, "-").concat(lie, "-").concat(winNum));
    }
  }

  try {
    var self = this;
    changeObjScreen(winNum, self, 0, '', hang, lie);
  } catch (e) {
    console.log(e.message);
    return 0;
  }

  return 1;
};

VideoObj.prototype.innerFullScreen = function (winNum) {
  if (!winNum || typeof winNum !== 'number' || winNum > 16 || winNum < 1) {
    throw new Error("\u7A97\u53E3\u6570\u5E94\u5F53\u57281-16\u4E4B\u95F4 ".concat(winNum));
  }

  if (this.isTuchuScreen == 1) {
    changeObjScreen(this.screenNum, this, this.isTuchuScreen, "tuchu".concat(winNum));
    this.isTuchuScreen = 2;
  } else if (this.isTuchuScreen == 2) {
    changeObjScreen(this.screenNum, this, this.isTuchuScreen, "exittuchu".concat(winNum));
    this.isTuchuScreen = 1;
  }
}; // 销毁


VideoObj.prototype.destory = function (id) {
  try {
    clearInterval(this.catchNewTime);
    this.catchNewTime = null;
    this.closeAllVideo();
    destoryVideoObj(id);
  } catch (e) {
    console.log(e.message);
    return 0;
  }

  return 1;
};

VideoObj.prototype.fullScreen = function () {
  var self = this;
  partFullScreen(this.playingSelectedWinNum, self);
};

VideoObj.prototype.exitScreen = function () {
  var self = this;
  exitScreen('', this.playingSelectedWinNum, self);
}; //设置铺满视频框


VideoObj.prototype.setFullVideo = function (num) {
  var self = this;

  try {
    if ($("#" + self.rongqiId + " #videoPlayer" + num).hasClass("puman")) {
      sessionStorage.puman = 'notpuman';
      $("#" + self.rongqiId + " #videoPlayer" + num).removeClass("puman");
    } else {
      sessionStorage.puman = 'puman';
      $("#" + self.rongqiId + " #videoPlayer" + num).addClass("puman");
    }
  } catch (e) {
    return 0;
  }

  return 1;
};

VideoObj.prototype.setVideoSize = function (num, isFull) {
  var self = this;

  if (!num || typeof num !== 'number' || num > 16 || num < 1) {
    throw new Error("\u7A97\u53E3\u6570\u5E94\u5F53\u57281-16\u4E4B\u95F4 ".concat(num));
  }

  if (arguments.length === 1) {
    return this.setFullVideo(num);
  }

  try {
    if ($("#" + self.rongqiId + " #videoPlayer" + num).hasClass("puman")) {
      if (!isFull) {
        $("#" + self.rongqiId + " #videoPlayer" + num).removeClass("puman");
      }
    } else {
      if (isFull) {
        $("#" + self.rongqiId + " #videoPlayer" + num).addClass("puman");
      }
    }
  } catch (e) {
    return 0;
  }

  return 1;
};

var errortips = function errortips(num, msg, rongqiId) {
  $("#" + rongqiId + " #errortip" + num).removeClass("hide").text(msg);
};

var errortipshide = function errortipshide(num, rongqiId) {
  $("#" + rongqiId + " #errortip" + num).addClass("hide");
};

var malvtips = function malvtips(num, msg, rongqiId) {
  $("#" + rongqiId + " #malv" + num).text(msg);
};

Date.prototype.Format = function (fmt) {
  var o = {
    "M+": this.getMonth() + 1,
    //月份
    "d+": this.getDate(),
    //日
    "H+": this.getHours(),
    //小时
    "m+": this.getMinutes(),
    //分
    "s+": this.getSeconds(),
    //秒
    "q+": Math.floor((this.getMonth() + 3) / 3),
    //季度
    "S": this.getMilliseconds() //毫秒

  };
  if (/(y+)/.test(fmt)) fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));

  for (var k in o) {
    if (new RegExp("(" + k + ")").test(fmt)) fmt = fmt.replace(RegExp.$1, RegExp.$1.length == 1 ? o[k] : ("00" + o[k]).substr(("" + o[k]).length));
  }

  return fmt;
}; // 初始化


function videoInit(id, objType, isLuzhi, isVideoFull, self) {
  var str = '';

  for (var playnum = 1; playnum < 17; playnum++) {
    str += "<div class='videoBox videoBox".concat(playnum, "'>\n              <div class='errortip hide' id='errortip").concat(playnum, "'></div>\n              <div class='usertip hide' id='usertip").concat(playnum, "'></div>\n              <div class='noVideoMask ").concat(objType === 'replay' ? 'replay' : "", "' id='videoMask").concat(playnum, "' data-index='").concat(playnum, "' data-status='0'>\n                  <div class='fullBtnBox hide' id='fullBtnBox").concat(playnum, "'>\n                      <img class='closeBtn hide' id='closeBtn").concat(playnum, "' src='").concat(window.top.__BASE_LOCATION__, "images/realVideoImages/closeVideo.png' alt='' title='\u5173\u95ED' />\n                      <img class='volumeBtn hide' id='volumeBtn").concat(playnum, "' src='").concat(window.top.__BASE_LOCATION__, "images/realVideoImages/closeVolume.png' alt=''  title='\u97F3\u91CF' data-status='1'/>\n                      <img class='talkBtn hide' id='talkBtn").concat(playnum, "' src='").concat(window.top.__BASE_LOCATION__, "images/realVideoImages/videoTalk.png' alt=''  title='\u5F00\u542F\u8BED\u97F3\u5BF9\u8BB2' data-status='0' data-talkSrc=''/>\n                      <img class='picBtn' id='picBtn").concat(playnum, "' src='").concat(window.top.__BASE_LOCATION__, "images/realVideoImages/pic.png' alt='\u89C6\u9891\u622A\u56FE' title='\u89C6\u9891\u622A\u56FE' />\n                      <img class='recordVideo' style='").concat(isLuzhi == true ? '' : "display:none", "'  id='recordVideo").concat(playnum, "' src='").concat(window.top.__BASE_LOCATION__, "images/realVideoImages/recordVideo.png' alt='\u5F55\u5236\u89C6\u9891' title='\u5F55\u5236\u89C6\u9891' data-status='0'/>\n                      <img class='stickBtn hide' id='stickBtn").concat(playnum, "' src='").concat(window.top.__BASE_LOCATION__, "images/realVideoImages/stick.png' alt='' title='\u9876\u90E8\u680F\u56FA\u5B9A' data-status='0'/>\n                      <p class='malv' id='malv").concat(playnum, "'></p><p class='showDev' id='showDev").concat(playnum, "' title=''></p>\n                  </div>\n                  <div class='circle' id='circle").concat(playnum, "'>\n                      <div class='circleReal'>\n                          <div class='circleButton circleButton1' title='\u4E0A\u79FB'></div>\n                          <div class='circleButton circleButton3' title='\u53F3\u79FB'></div>\n                          <div class='circleButton circleButton5' title='\u4E0B\u79FB'></div>\n                          <div class='circleButton circleButton7' title='\u5DE6\u79FB'></div>\n                          <div class='innerCircle'></div>\n                      </div>\n                  </div>\n                  <div class='hoverCircleButton hoverCircleButton1' title='\u4E0A\u79FB'></div>\n                  <div class='hoverCircleButton hoverCircleButton2' title='\u53F3\u79FB'></div>\n                  <div class='hoverCircleButton hoverCircleButton3' title='\u4E0B\u79FB'></div>\n                  <div class='hoverCircleButton hoverCircleButton4' title='\u5DE6\u79FB'></div>\n                  <a class='bofang' id='bofang").concat(playnum, "'>\u64AD\u653E</a> <a class='tingbo' id='tingbo").concat(playnum, "'>\u505C\u6B62\u64AD\u653E</a>\n              </div>\n              <video class='videoPlayer ").concat(isVideoFull === true ? 'puman' : "", "' id='videoPlayer").concat(playnum, "' data-status='0' data-winNum='").concat(playnum, "'\n                     data-devCode='' c   preload='auto' autoplay='autoplay' data-setup='{}' crossOrigin='anonymous'\n                     width='852' height='480'>\"\n                     <p class='vjs-no-js'>To view this video please enable JavaScript,and consider upgrading to a web\n                     browser that<a href='https://videojs.com/html5-video-support/' target='_blank'>supports HTML5\n                     video</a></p>\n              </video>\n             <div id='canvasPlayerCont").concat(playnum, "' class='canvasPlayerCont'><canvas class='canvasPlayer hide' id='canvasPlayer").concat(playnum, "'\n                     width='1280' height='720' data-status='0' data-winNum='").concat(playnum, "' data-devCode=''></canvas>\n              </div>\n          <img class='ttpicPlayer hide' id='ttpicPlayer").concat(playnum, "' src='").concat(window.top.__BASE_LOCATION__, "images/realVideoImages/closeVideo.png' />\n\t\t\t\t\t<img class='picPlayer hide' style=\"position: absolute;top: 0;left: 0;\" id='picImgCL").concat(playnum, "' src='' />\n        </div>");
  }

  var textJson = "<div class='videoZoom' id='videoZoom'>\n                    <img src='' alt='' srcset='' style=' height: 10px; width: 10px;display: none;' id='savePicBox' />\n                    <div id='maskBox'></div><div class='videoZoom' id='videoZoom'><img src='' alt='' srcset='' style=' height: 10px; width: 10px;display: none;' id='savePicBox'>\n\t\t\t\t\t\t\t\t\t\t<div class='videoInfo' id='videoInfo' style=\"display:none\"></div>\n\t\t\t\t\t\t\t\t\t\t<div class='videoZoomIE' id=\"videoZoomIE\">\n\t\t\t\t\t\t\t\t\t";
  textJson += str;
  textJson += "<div class='videoBottom'> </div>\n                  </div>\n                </div>";
  $("#" + id).html(textJson);
  self.playerObj = {};

  for (var i = 1; i < 17; i++) {
    self['playerInfo' + i] = {};
    self.playerObj["player".concat(i)] = "";
    self.playerObj["videoPlayer".concat(i)] = "";
  }
}

function getBrowserNameVersion() {
  var Sys = {};
  var ua = navigator.userAgent.toLowerCase();
  var s;
  (s = ua.match(/rv:([\d.]+)\) like gecko/)) ? Sys.ie = s[1] : (s = ua.match(/msie ([\d\.]+)/)) ? Sys.ie = s[1] : (s = ua.match(/edge\/([\d\.]+)/)) ? Sys.edge = s[1] : (s = ua.match(/firefox\/([\d\.]+)/)) ? Sys.firefox = s[1] : (s = ua.match(/(?:opera|opr).([\d\.]+)/)) ? Sys.opera = s[1] : (s = ua.match(/chrome\/([\d\.]+)/)) ? Sys.chrome = s[1] : (s = ua.match(/version\/([\d\.]+).*safari/)) ? Sys.safari = s[1] : 0; // 根据关系进行判断

  if (Sys.ie) return {
    Browser: 'IE',
    version: Sys.ie
  };
  if (Sys.edge) return {
    Browser: 'EDGE',
    version: Sys.edge
  };
  if (Sys.firefox) return {
    Browser: 'Firefox',
    version: Sys.firefox
  };
  if (Sys.chrome) return {
    Browser: 'Chrome',
    version: Sys.chrome
  };
  if (Sys.opera) return {
    Browser: 'Opera',
    version: Sys.opera
  };
  if (Sys.safari) return {
    Browser: 'Safari',
    version: Sys.safari
  };
  return 'Unkonwn';
}

function getErrorList(self, key) {
  $.ajax({
    url: "".concat(self.gatewayURL, "/uvp-backend-common/api/dict/getDictByName?dictName=").concat(key),
    //请求的url地址
    type: "get",
    success: function success(result) {
      if (result.successful) {
        var errorList = result.resultValue || null;
        self.errorList = {};
        errorList.forEach(function (item) {
          self.errorList[item.value * 1] = item.text;
        });
        window.top.__errorList = self.errorList;
      }
    },
    error: function error(result) {
      console.log(result);
    },
    complete: function complete(xhr, textStatus) {
      if (xhr.getResponseHeader('sessionstate') == 'tokenTimeout' || xhr.getResponseHeader('sessionstate') == 'timeout' || xhr.getResponseHeader('sessionstate') == 'nouser') {
        window.top.postMessage({
          key: "loginOut",
          value: ""
        }, "*");
      }
    }
  });
}

function getTokenTime(self, ak, sk) {
  var obj = {
    token: self.token
  };
  $.ajax({
    data: JSON.stringify(obj),
    type: "POST",
    contentType: 'application/json',
    url: "".concat(self.gatewayURL, "/uvp-backend-common/api/v1/validateToken"),
    success: function success(result) {
      if (result.resultValue < 600) {
        $.ajax({
          async: false,
          data: JSON.stringify({
            ak: ak,
            sk: sk
          }),
          type: "POST",
          contentType: 'application/json',
          dataType: "json",
          url: "".concat(self.gatewayURL, "/uvp-backend-common/api/v1/authorization"),
          success: function success(res) {
            self.token = res.resultValue.token; // 拿到token
          }
        });
      }
    }
  });
}

function waterMark(config, id) {
  var videoDom = document.getElementById(id); //默认设置

  var defaultSettings = {
    watermark_txt: "text",
    watermark_x: 5,
    //水印起始位置x轴坐标
    watermark_y: 5,
    //水印起始位置Y轴坐标
    watermark_rows: 4,
    //水印行数
    watermark_cols: 5,
    //水印列数
    watermark_x_space: 20,
    //水印x轴间隔
    watermark_y_space: 27,
    //水印y轴间隔
    watermark_color: '#fff',
    //水印字体颜色
    watermark_alpha: 0.3,
    //水印透明度
    watermark_fontsize: '23px',
    //水印字体大小
    watermark_font: '微软雅黑',
    //水印字体
    watermark_width: 120,
    //水印宽度
    watermark_height: 80,
    //水印长度
    watermark_angle: 15 //水印倾斜度数

  }; //采用配置项替换默认值，作用类似jquery.extend

  if (_typeof(config) === "object") {
    var config = config || {}; // Object.assign(defaultSettings, config)

    for (var key in config) {
      if (config[key] && defaultSettings[key] && config[key] === defaultSettings[key]) continue;else if (config[key]) defaultSettings[key] = config[key];
    }
  }

  var oTemp = document.createDocumentFragment(); //获取页面最大宽度

  var page_width = Math.max(videoDom.scrollWidth, videoDom.clientWidth); //获取页面最大长度

  var page_height = Math.max(videoDom.scrollHeight, videoDom.clientHeight); //如果将水印列数设置为0，或水印列数设置过大，超过页面最大宽度，则重新计算水印列数和水印x轴间隔

  if (defaultSettings.watermark_cols < 0 || defaultSettings.watermark_rows < 0 || defaultSettings.watermark_cols * defaultSettings.watermark_rows === 0) {
    throw new Error('水印行列数只能是正整数');
  }

  var x;
  var y;

  for (var i = 0; i < defaultSettings.watermark_rows; i++) {
    y = defaultSettings.watermark_y + defaultSettings.watermark_y_space * i;

    for (var j = 0; j < defaultSettings.watermark_cols; j++) {
      x = defaultSettings.watermark_x + defaultSettings.watermark_x_space * j;
      var mask_div = document.createElement('div');
      mask_div.id = 'mask_div' + i + j;
      mask_div.className = '__waterMarks';
      mask_div.appendChild(document.createTextNode(defaultSettings.watermark_txt)); //设置水印div倾斜显示

      mask_div.style.webkitTransform = "rotate(-" + defaultSettings.watermark_angle + "deg)";
      mask_div.style.MozTransform = "rotate(-" + defaultSettings.watermark_angle + "deg)";
      mask_div.style.msTransform = "rotate(-" + defaultSettings.watermark_angle + "deg)";
      mask_div.style.OTransform = "rotate(-" + defaultSettings.watermark_angle + "deg)";
      mask_div.style.transform = "rotate(-" + defaultSettings.watermark_angle + "deg)";
      mask_div.style.visibility = "";
      mask_div.style.position = "absolute";
      mask_div.style.left = x + '%';
      mask_div.style.top = y + '%';
      mask_div.style.overflow = "hidden";
      mask_div.style.zIndex = "8";
      mask_div.style.whiteSpace = "nowrap"; //mask_div.style.border="solid #eee 1px";

      mask_div.style.opacity = defaultSettings.watermark_alpha;
      mask_div.style.fontSize = defaultSettings.watermark_fontsize;
      mask_div.style.fontFamily = defaultSettings.watermark_font;
      mask_div.style.color = defaultSettings.watermark_color;
      mask_div.style.textAlign = "center"; // mask_div.style.width = defaultSettings.watermark_width + 'px';
      // mask_div.style.height = defaultSettings.watermark_height + 'px';

      mask_div.style.display = "block";
      oTemp.appendChild(mask_div);
    }

    ;
  }

  ;
  videoDom.appendChild(oTemp);
}

function setVideoVolume(num, volume, self) {
  document.querySelector('#videoPlayer' + num).volume = volume;
  var status = $("#" + self.rongqiId + " img#volumeBtn" + num).attr("data-status");

  if (status == 0) {
    $("#volumeBtn" + num).attr({
      "data-status": "1",
      "src": "".concat(window.top.__BASE_LOCATION__, "images/realVideoImages/closeVolume.png")
    });
  } else {
    $("#volumeBtn" + num).attr({
      "data-status": "0",
      "src": "".concat(window.top.__BASE_LOCATION__, "images/realVideoImages/openVolume.png")
    });
  }
} // 修改分屏


function changeObjScreen(num, self, isTuchuScreen, tuchu, hang, lie) {
  if (num > 16) {
    return 0;
  }

  try {
    if (isTuchuScreen == 0) {
      self.screenNum = doScreenChange(num, tuchu, self, hang, lie);
    } else if (isTuchuScreen == 1) {
      doScreenChange(num, tuchu, self);
    } else if (isTuchuScreen == 2) {
      doScreenChange(num, tuchu, self);
    }

    var eventType = '103';
    var eventContext = {
      windowNum: self.screenNum
    };

    if (!tuchu) {
      //不加此判断会catcherror
      execute(self.returnFuc, eventType, eventContext);
      getObjInfo(1, self);
    } else if (tuchu == 'tuchu' + self.playingSelectedWinNum) {
      var devCode = self['playerInfo' + num].devCode;
      var showName = self['playerInfo' + num].showName;
      var streamType = self['playerInfo' + num].streamType;
      eventType = '104';
      eventContext = {
        windowIndex: num,
        devCode: devCode,
        showName: showName,
        streamType: streamType
      };
      execute(self.returnFuc, eventType, eventContext);
    } else if (tuchu.indexOf("exittuchu") >= 0) {
      if (tuchu.length < 11) {
        num = tuchu.slice(tuchu.length - 1);
      } else {
        num = tuchu.slice(tuchu.length - 2);
      }

      var _devCode = self['playerInfo' + num].devCode;
      var _showName = self['playerInfo' + num].showName;
      var _streamType = self['playerInfo' + num].streamType;
      eventType = '105';
      eventContext = {
        windowIndex: num,
        devCode: _devCode,
        showName: _showName,
        streamType: _streamType
      };
      execute(self.returnFuc, eventType, eventContext);
      getObjInfo(num, self);
    }
  } catch (e) {
    console.log(e.message);
    return 0;
  }
} // 事件绑定


function eventInit(self) {
  var _loop = function _loop(i) {
    $("#" + self.rongqiId + " #circle" + i).dblclick(function (event) {
      event.stopPropagation();
    });
    $("#" + self.rongqiId + " #videoMask" + i).mousedown(function () {
      getObjInfo(i, self);
    }).mouseleave(function () {
      showBtns(false, i, self);
    }).dblclick(function () {
      if (self.isTuchuScreen == 1) {
        changeObjScreen(self.screenNum, self, self.isTuchuScreen, "tuchu".concat(i));
        self.isTuchuScreen = 2;
      } else if (self.isTuchuScreen == 2) {
        changeObjScreen(self.screenNum, self, self.isTuchuScreen, "exittuchu".concat(i));
        self.isTuchuScreen = 1;
      }
    }).mouseenter(function () {
      var isBofang = self.playerObj["videoPlayer".concat(i)] || self.playerObj["player".concat(i)] || null;

      if (self.showDefaultCloud && isBofang) {
        $("#" + self.rongqiId + " #videoMask" + i + " .hoverCircleButton").removeClass("hoverCircleButtonNone");
      } else {
        $("#" + self.rongqiId + " #videoMask" + i + " .hoverCircleButton").addClass("hoverCircleButtonNone");
      }

      showBtns(true, i, self);
    }); // 视频关闭

    $("#" + self.rongqiId + " #closeBtn" + i).click(function () {
      videoObjClose(i, self, true);
      $("#" + self.rongqiId + " #bofang" + i).hide();
    }); // 音量开关

    $("#" + self.rongqiId + " #volumeBtn" + i).click(function () {
      if (!self['playerInfo' + i].hasAudio) {
        console.log('当前视频无音频源，无法播放声音');
        return;
      }

      var volume = document.querySelector('#videoPlayer' + i).volume === 0 ? 1 : 0;
      setVideoVolume(i, volume, self);
    }); //窗口固定

    $("#" + self.rongqiId + " img#stickBtn" + i).click(function () {
      stickTop(i, self);
    }); //播放

    $("#" + self.rongqiId + " #bofang" + i).click(function (e) {
      var packageMethod = self['playerInfo' + i].packageMethod;
      var devCode = self['playerInfo' + i].devCode;
      var videoUrl = self['playerInfo' + i].videoUrl;
      var videoTalkUrl = self['playerInfo' + i].videoTalkUrl;
      var showName = self['playerInfo' + i].showName;
      var streamType = self['playerInfo' + i].streamType;
      videoObjPlay(i, packageMethod, devCode, videoUrl, videoTalkUrl, showName, streamType, self);
    }); //视频截图

    $("#" + self.rongqiId + " #picBtn" + i).click(function () {
      var picurl = '';

      try {
        picurl = picSave(i, self);
      } catch (e) {
        console.log(e.message);
        return 0;
      }

      return picurl;
    });
    $("#" + self.rongqiId + " #talkBtn" + i).click(function () {
      videoTalk(i, self);
    });
    $("#" + self.rongqiId + " #recordVideo" + i).click(function () {
      recordVideoFuc(i, self); // realRecord(i,self)
    });

    function doMouseWheel(e) {
      var e = window.event || e[0]; // old IE support   

      if (e.wheelDelta > 0 || -e.detail > 0) {
        cloudDeskObjControl("", 0x0304, 5, 5, self); //772

        var timer1 = setTimeout(function () {
          cloudDeskObjControl("", 0x0303, 5, 5, self); //771

          clearTimeout(timer1);
        }, 500);
      } else {
        cloudDeskObjControl("", 0x0302, 5, 5, self); //770

        var timer2 = setTimeout(function () {
          cloudDeskObjControl("", 0x0301, 5, 5, self); //769

          clearTimeout(timer2);
        }, 500);
      }
    }

    function MouseWheelHandler(fn, delay) {
      var timer = '';
      return function () {
        if (timer) {
          clearTimeout(timer);
          timer = '';
        }

        timer = setTimeout(fn, delay, arguments); // 简化写法
      };
    } //缩放镜头 设置为鼠标移入即可进行缩放


    sel = document.getElementById(self.rongqiId);
    selecedVideoBox = sel.querySelectorAll(".videoBox" + i);

    if (selecedVideoBox[0].addEventListener) {
      // IE9, Chrome, Safari, Opera   
      selecedVideoBox[0].addEventListener("mousewheel", MouseWheelHandler.bind(null, doMouseWheel, 1000)(), {
        passive: true
      }); // Firefox   

      selecedVideoBox[0].addEventListener("DOMMouseScroll", MouseWheelHandler.bind(null, doMouseWheel, 1000)(), {
        passive: true
      });
    } else {
      // IE 6/7/8   
      selecedVideoBox[0].attachEvent("onmousewheel", MouseWheelHandler.bind(null, doMouseWheel, 1000)(), {
        passive: true
      });
    }
  };

  for (var i = 1; i <= 16; i++) {
    var sel;
    var selecedVideoBox;

    _loop(i);
  }

  document.addEventListener("visibilitychange", function () {
    var sendT = setTimeout(function () {
      if (self.flvType === 'websocket') {
        for (var num = 1; num <= 16; num++) {
          if (self.playerObj["videoPlayer".concat(num)].isVideoFile) {} else {
            var isPause = document.querySelector("#" + self.rongqiId + " #videoPlayer" + num).paused;

            if (isPause) {
              return;
            }

            var method = self['playerInfo' + num].packageMethod === 'h264' ? true : false;

            if (self.playerObj["videoPlayer".concat(num)] && method && self.playerObj["videoPlayer".concat(num)].buffered.length) {
              var buffered = self.playerObj["videoPlayer".concat(num)].buffered.end(0) - 0.1;

              if (buffered - self.playerObj["videoPlayer".concat(num)].currentTime > 1) {
                self.playerObj["videoPlayer".concat(num)].currentTime = buffered;
              }

              if (document.querySelector("#" + self.rongqiId + " #videoPlayer" + num) && document.querySelector("#" + self.rongqiId + " #videoPlayer" + num).playbackRate) {
                var eventType = '109';
                var eventContext = {
                  num: num,
                  playbackRate: document.querySelector("#" + self.rongqiId + " #videoPlayer" + num).playbackRate,
                  paused: document.querySelector("#" + self.rongqiId + " #videoPlayer" + num).paused,
                  currentTime: self.playerObj["videoPlayer".concat(num)].dts - 1,
                  ended: document.querySelector("#" + self.rongqiId + " #videoPlayer" + num).ended,
                  buffered: self.playerObj["videoPlayer".concat(num)].dts,
                  tuisong: true
                };
                execute(self.returnFuc, eventType, eventContext);
              }
            }
          }
        }
      }

      clearTimeout(sendT);
    }, 3000);
  });
  self.catchNewTime = setInterval(function () {
    if (self.flvType === 'websocket') {
      for (var num = 1; num <= 16; num++) {
        if (self.playerObj["videoPlayer".concat(num)].isVideoFile) {} else {
          var method = self['playerInfo' + num].packageMethod === 'h264' ? true : false;

          if (self.playerObj["videoPlayer".concat(num)] && method && self.playerObj["videoPlayer".concat(num)].buffered.length) {
            var buffered = self.playerObj["videoPlayer".concat(num)].buffered.end(0) - 0.1;

            if (buffered - self.playerObj["videoPlayer".concat(num)].currentTime > 3) {
              self.playerObj["videoPlayer".concat(num)].currentTime = buffered;
            }
          }
        }
      }
    }
  }, 10000);
  document.getElementById("videoZoom").addEventListener("contextmenu", function (ev) {
    addRightMenu(ev, self);
  });
  $("body").click(function (e) {
    if ($('.rightMenu').length > 0) {
      document.getElementsByClassName('rightMenu')[0].style.display = 'none';
    }
  }); // 云台控制e

  $("#" + self.rongqiId + " .circleButton1").mousedown(function (event) {
    var num = parseInt($(this).parent().parent().attr('id').slice(6));
    getObjInfo(num, self);
    cloudDeskObjControl("", 0x0402, 5, 5, self);
    changeBgImg(1, self);
    event.stopPropagation();
  }).mouseup(function (event) {
    cloudDeskObjControl("", 0x0401, 5, 5, self);
    event.stopPropagation();
  });
  $("#" + self.rongqiId + " .circleButton2").mousedown(function () {
    var num = parseInt($(this).parent().parent().attr('id').slice(6));
    getObjInfo(num, self);
    cloudDeskObjControl("", 0x0802, 5, 5, self);
    changeBgImg(2, self);
  }).mouseup(function () {
    cloudDeskObjControl("", 0x0801, 5, 5, self);
  });
  $("#" + self.rongqiId + " .circleButton3").mousedown(function () {
    var num = parseInt($(this).parent().parent().attr('id').slice(6));
    getObjInfo(num, self);
    cloudDeskObjControl("", 0x0502, 5, 5, self);
    changeBgImg(3, self);
  }).mouseup(function () {
    cloudDeskObjControl("", 0x0501, 5, 5, self);
  });
  $("#" + self.rongqiId + " .circleButton4").mousedown(function () {
    var num = parseInt($(this).parent().parent().attr('id').slice(6));
    getObjInfo(num, self);
    cloudDeskObjControl("", 0x0804, 5, 5, self);
    changeBgImg(4, self);
  }).mouseup(function () {
    cloudDeskObjControl("", 0x0803, 5, 5, self);
  });
  $("#" + self.rongqiId + " .circleButton5").mousedown(function () {
    var num = parseInt($(this).parent().parent().attr('id').slice(6));
    getObjInfo(num, self);
    cloudDeskObjControl("", 0x0404, 5, 5, self);
    changeBgImg(5, self);
  }).mouseup(function () {
    cloudDeskObjControl("", 0x0403, 5, 5, self);
  });
  $("#" + self.rongqiId + " .circleButton6").mousedown(function () {
    var num = parseInt($(this).parent().parent().attr('id').slice(6));
    getObjInfo(num, self);
    cloudDeskObjControl("", 0x0704, 5, 5, self);
    changeBgImg(6, self);
  }).mouseup(function () {
    cloudDeskObjControl("", 0x0703, 5, 5, self);
  });
  $("#" + self.rongqiId + " .circleButton7").mousedown(function () {
    var num = parseInt($(this).parent().parent().attr('id').slice(6));
    getObjInfo(num, self);
    cloudDeskObjControl("", 0x0504, 5, 5, self);
    changeBgImg(7, self);
  }).mouseup(function () {
    cloudDeskObjControl("", 0x0503, 5, 5, self);
  });
  $("#" + self.rongqiId + " .circleButton8").mousedown(function () {
    var num = parseInt($(this).parent().parent().attr('id').slice(6));
    getObjInfo(num, self);
    cloudDeskObjControl("", 0x0702, 5, 5, self);
    changeBgImg(8, self);
  }).mouseup(function () {
    cloudDeskObjControl("", 0x0701, 5, 5, self);
  });
  $("#" + self.rongqiId + " .hoverCircleButton1,.hoverCircleButton2,.hoverCircleButton3,.hoverCircleButton4").dblclick(function (event) {
    event.stopPropagation();
  }); //悬浮云台，长按/松开鼠标事件

  $("#" + self.rongqiId + " .hoverCircleButton1").mousedown(function () {
    var num = parseInt($(this).parent().attr('id').slice(9));
    var isBofang = self.playerObj["videoPlayer".concat(num)] || self.playerObj["player".concat(num)] || null;

    if (self.showDefaultCloud && isBofang) {
      getObjInfo(num, self);
      var devCode = self['playerInfo' + num].devCode;
      cloudDeskObjControl(devCode, 0x0402, 5, 5, self);
      changeBgImg(1, self);
    }
  }).mouseup(function () {
    var num = parseInt($(this).parent().attr('id').slice(9));
    var isBofang = self.playerObj["videoPlayer".concat(num)] || self.playerObj["player".concat(num)] || null;

    if (self.showDefaultCloud && isBofang) {
      cloudDeskObjControl("", 0x0401, 5, 5, self);
    }
  });
  $("#" + self.rongqiId + " .hoverCircleButton2").mousedown(function () {
    var num = parseInt($(this).parent().attr('id').slice(9));
    var isBofang = self.playerObj["videoPlayer".concat(num)] || self.playerObj["player".concat(num)] || null;

    if (self.showDefaultCloud && isBofang) {
      getObjInfo(num, self);
      var devCode = self['playerInfo' + num].devCode;
      cloudDeskObjControl(devCode, 0x0502, 5, 5, self);
      changeBgImg(3, self);
    }
  }).mouseup(function () {
    var num = parseInt($(this).parent().attr('id').slice(9));
    var isBofang = self.playerObj["videoPlayer".concat(num)] || self.playerObj["player".concat(num)] || null;

    if (self.showDefaultCloud && isBofang) {
      cloudDeskObjControl("", 0x0501, 5, 5, self);
    }
  });
  $("#" + self.rongqiId + " .hoverCircleButton3").mousedown(function () {
    var num = parseInt($(this).parent().attr('id').slice(9));
    var isBofang = self.playerObj["videoPlayer".concat(num)] || self.playerObj["player".concat(num)] || null;

    if (self.showDefaultCloud && isBofang) {
      getObjInfo(num, self);
      cloudDeskObjControl("", 0x0404, 5, 5, self);
      changeBgImg(5, self);
    }
  }).mouseup(function () {
    var num = parseInt($(this).parent().attr('id').slice(9));
    var isBofang = self.playerObj["videoPlayer".concat(num)] || self.playerObj["player".concat(num)] || null;

    if (self.showDefaultCloud && isBofang) {
      cloudDeskObjControl("", 0x0403, 5, 5, self);
    }
  });
  $("#" + self.rongqiId + " .hoverCircleButton4").mousedown(function () {
    var num = parseInt($(this).parent().attr('id').slice(9));
    var isBofang = self.playerObj["videoPlayer".concat(num)] || self.playerObj["player".concat(num)] || null;

    if (self.showDefaultCloud && isBofang) {
      getObjInfo(num, self);
      cloudDeskObjControl("", 0x0504, 5, 5, self);
      changeBgImg(7, self);
    }
  }).mouseup(function () {
    var num = parseInt($(this).parent().attr('id').slice(9));
    var isBofang = self.playerObj["videoPlayer".concat(num)] || self.playerObj["player".concat(num)] || null;

    if (self.showDefaultCloud && isBofang) {
      cloudDeskObjControl("", 0x0503, 5, 5, self);
    }
  }); //悬浮云台，鼠标移入/移出区域时显示/隐藏四方向箭头

  $("#" + self.rongqiId + " .hoverCircleButton1").mouseenter(function () {
    var num = parseInt($(this).parent().attr('id').slice(9));
    var isBofang = self.playerObj["videoPlayer".concat(num)] || self.playerObj["player".concat(num)] || null;

    if (self.showDefaultCloud && isBofang) {
      $(this).addClass("hoverCircle1").attr({
        "title": '上移'
      }).css({
        "cursor": "pointer"
      });
    } else {
      $(this).removeClass("hoverCircle1").attr({
        "title": ''
      }).css({
        "cursor": "auto"
      });
    }
  }).mouseleave(function () {
    $(this).removeClass("hoverCircle1").attr({
      "title": ''
    }).css({
      "cursor": "auto"
    });
  });
  $("#" + self.rongqiId + " .hoverCircleButton2").mouseenter(function () {
    var num = parseInt($(this).parent().attr('id').slice(9));
    var isBofang = self.playerObj["videoPlayer".concat(num)] || self.playerObj["player".concat(num)] || null;

    if (self.showDefaultCloud && isBofang) {
      $(this).addClass("hoverCircle2").attr({
        "title": '右移'
      }).css({
        "cursor": "pointer"
      });
    } else {
      $(this).removeClass("hoverCircle2").attr({
        "title": ''
      }).css({
        "cursor": "auto"
      });
    }
  }).mouseleave(function () {
    $(this).removeClass("hoverCircle2").attr({
      "title": ''
    }).css({
      "cursor": "auto"
    });
  });
  $("#" + self.rongqiId + " .hoverCircleButton3").mouseenter(function () {
    var num = parseInt($(this).parent().attr('id').slice(9));
    var isBofang = self.playerObj["videoPlayer".concat(num)] || self.playerObj["player".concat(num)] || null;

    if (self.showDefaultCloud && isBofang) {
      $(this).addClass("hoverCircle3").attr({
        "title": '下移'
      }).css({
        "cursor": "pointer"
      });
    } else {
      $(this).removeClass("hoverCircle3").attr({
        "title": ''
      }).css({
        "cursor": "auto"
      });
    }
  }).mouseleave(function () {
    $(this).removeClass("hoverCircle3").attr({
      "title": ''
    }).css({
      "cursor": "auto"
    });
  });
  $("#" + self.rongqiId + " .hoverCircleButton4").mouseenter(function () {
    var num = parseInt($(this).parent().attr('id').slice(9));
    var isBofang = self.playerObj["videoPlayer".concat(num)] || self.playerObj["player".concat(num)] || null;

    if (self.showDefaultCloud && isBofang) {
      $(this).addClass("hoverCircle4").attr({
        "title": '左移'
      }).css({
        "cursor": "pointer"
      });
    } else {
      $(this).removeClass("hoverCircle4").attr({
        "title": ''
      }).css({
        "cursor": "auto"
      });
    }
  }).mouseleave(function () {
    $(this).removeClass("hoverCircle4").attr({
      "title": ''
    }).css({
      "cursor": "auto"
    });
  }); //进入退出全屏事件监听

  $(document).on("fullscreenchange", function (e) {
    var tt = setTimeout(function () {
      self.isAllScreen = 0;
      clearTimeout(tt);
    }, 500);
  });
  $(document).on("mozfullscreenchange", function (e) {
    var tt = setTimeout(function () {
      self.isAllScreen = 0;
      clearTimeout(tt);
    }, 500);
  });
  $(document).on("webkitfullscreenchange", function (e) {
    var tt = setTimeout(function () {
      self.isAllScreen = 0;
      clearTimeout(tt);
    }, 500);
  });
  $(document).on("msfullscreenchange", function (e) {
    var tt = setTimeout(function () {
      self.isAllScreen = 0;
      clearTimeout(tt);
    }, 500);
  });
} // 回调执行函数


function execute(someFunction, value, value2) {
  var isImage = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;

  if (!isImage && (value == 110 || value == 112)) {
    var self = value2.videoObj;
    var num = value2.windowIndex;
    errortipshide(num, self.rongqiId);
    var tt = setInterval(function () {
      if (self.playerObj["videoPlayer".concat(num)] && self.playerObj["videoPlayer".concat(num)].currentTime > 0) {
        $("#usertip" + num).removeClass('hide');
        clearInterval(tt);
      } else if (self.playerObj["player".concat(num)] && self.playerObj["player".concat(num)].videoTimeStamp > 0) {
        $("#usertip" + num).removeClass('hide');
        clearInterval(tt);
      }
    }, 50);
    var ttt = setTimeout(function () {
      clearInterval(tt);
      clearTimeout(ttt);
    }, 6000);
  } else if (value == 111 || value == 101) {
    var _num = value2.windowIndex;
    $("#usertip" + _num).addClass('hide');
  }

  if (typeof someFunction === 'function') {
    someFunction(value, value2);
  } else if (typeof someFunction === 'string') {
    eval(someFunction + "(value,value2)");
  }
} // 实时&历史视频播放2


function videoPlay(num, packageMethod, devCode, videoUrl, videoTalkUrl, showName, streamType, self, isChangeSoftOpen, step, hasAudio) {
  try {
    // dom、cashe
    if (packageMethod === 'jpg') {
      // 图片机
      self['playerInfo' + num].packageMethod = packageMethod;
      $("#" + self.rongqiId + " #videoPlayer" + num).hide();
      $("#" + self.rongqiId + " canvas#canvasPlayer" + num).hide();
      $('#videoMask' + num).addClass('videoMask');
      $("#".concat(self.rongqiId, " #ttpicPlayer").concat(num)).attr({
        'src': videoUrl,
        'devCode': devCode
      }).removeClass('hide');
      $("#" + self.rongqiId + " #fullBtnBox" + num + " .showDev").text(showName).attr('title', showName);
      self['playerInfo' + num].devCode = devCode;
      self['playerInfo' + num].packageMethod = packageMethod;
      self['playerInfo' + num].showName = showName;
      self['playerInfo' + num].streamType = streamType;
      var eventContext = {
        windowIndex: num,
        devCode: devCode,
        showName: showName,
        streamType: streamType,
        videoWidth: self.playerObj["player" + num].videoWidth,
        videoHeight: self.playerObj["player" + num].videoHeight,
        playType: 'jpg'
      };
      execute(self.returnFuc, '110', eventContext, true);
      return;
    }

    if (self.objType == "video" || self.objType == "replay") {
      if (streamType === 2) {
        videoUrl = replaceParamVal(videoUrl, "rate", "sub");
      } // 保存属性


      self['playerInfo' + num].devCode = devCode;
      self['playerInfo' + num].hasAudio = hasAudio;
      self['playerInfo' + num].status = '1';
      self['playerInfo' + num].videoUrl = videoUrl;
      self['playerInfo' + num].videoTalkUrl = videoTalkUrl;
      self['playerInfo' + num].packageMethod = packageMethod;
      self['playerInfo' + num].showName = showName;
      self['playerInfo' + num].streamType = streamType;

      if (self['playerInfo' + num].hasAudio) {
        self['playerInfo' + num].videoUrl = videoUrl + '&acodec=g711a';
      } // 删除了部分dom属性


      if (packageMethod == "h265") {
        // if(self.ChromeVersion && (self.ChromeVersion < 107)){
        // 	alert('当前浏览器版本过低，请升级至107及以上版本')
        // 	self.ChromeVersion = 107
        // 	return
        // }
        $("#" + self.rongqiId + " canvas#canvasPlayer" + num).show();
        $("#" + self.rongqiId + " #videoPlayer" + num).hide();
        $("#" + self.rongqiId + " #fullBtnBox" + num + " .showDev").text(showName).attr('title', showName);
        videoObjPlay(num, packageMethod, devCode, videoUrl, videoTalkUrl, showName, streamType, self, '', isChangeSoftOpen);
      } else if (packageMethod == "h264") {
        $("#" + self.rongqiId + " #videoPlayer" + num).show();
        $("#" + self.rongqiId + " canvas#canvasPlayer" + num).hide();
        $("#" + self.rongqiId + " #fullBtnBox" + num + " .showDev").text(showName).attr('title', showName);
        videoObjPlay(num, packageMethod, devCode, videoUrl, videoTalkUrl, showName, streamType, self, '', '', step);
      } else if (packageMethod == "h264decoder") {
        $("#" + self.rongqiId + " canvas#canvasPlayer" + num).show();
        $("#" + self.rongqiId + " #videoPlayer" + num).hide();
        $("#" + self.rongqiId + " #fullBtnBox" + num + " .showDev").text(showName).attr('title', showName);
        videoObjPlay(num, packageMethod, devCode, videoUrl, videoTalkUrl, showName, streamType, self, '', isChangeSoftOpen);
      }
    } else {
      alert("该模块不能播放视频！");
    }

    return 1;
  } catch (e) {
    return 0;
  }
} // 实时&历史视频播放3


function videoObjPlay(num, packageMethod, devCode, videoUrl, videoTalkUrl, showName, streamType, self, relink, isChangeSoftOpen, step) {
  if (packageMethod == "h265") {
    var eventType = '100';
    var eventContext = {
      windowIndex: num,
      devCode: devCode,
      showName: showName,
      streamType: streamType,
      videoWidth: self.playerObj["player" + num].videoWidth,
      videoHeight: self.playerObj["player" + num].videoHeight,
      playType: 'h265'
    };
    execute(self.returnFuc, eventType, eventContext);
    var videoUrlNew = videoUrl;

    if (videoUrl.indexOf('&code=') < 0) {
      videoUrlNew = videoUrlNew + "&code=" + devCode;
    }

    if (videoUrl.indexOf('&format=') < 0) {
      videoUrlNew = videoUrlNew + '&format=ps';
    }

    if (videoUrl.indexOf('&codec=') < 0) {
      videoUrlNew = videoUrlNew + '&codec=h265';
    }

    $.ajax({
      url: videoUrlNew,
      //请求的url地址
      type: "get",
      success: function success(result) {
        if (['401', '403'].includes(result.resultCode)) {
          var _eventContext7 = {
            windowIndex: num,
            errorCode: '403'
          };
          execute(self.returnFuc, '403', _eventContext7);
        }

        if (result && result.resultCode == 301) {
          videoUrlNew = result.location || result.Location;

          if (self.proxyIp) {
            // 启用视频代理
            var index = videoUrlNew.indexOf('/', 8);
            videoUrlNew = self.proxyIp + videoUrlNew.slice(index);
          }

          if (self.transType265 === 'websocket') {
            if (self.gatewayURL.indexOf('https://') >= 0) {
              videoUrlNew = videoUrlNew.replace("http://", 'https://').replace('21102', '21103');
            }

            if (videoUrlNew.indexOf('https://') >= 0) {
              videoUrlNew = videoUrlNew.replace("https://", 'wss://').replace('format=mp4', 'format=ps').replace('format=MP4', 'format=ps').replace('format=flv', 'format=ps');
            } else if (videoUrlNew.indexOf('http://') >= 0) {
              // 0000
              videoUrlNew = videoUrlNew.replace("http://", 'ws://').replace('format=mp4', 'format=ps').replace('format=MP4', 'format=ps').replace('format=flv', 'format=ps');
            } else {
              videoUrlNew = videoUrlNew.replace('format=mp4', 'format=ps').replace('format=MP4', 'format=ps').replace('format=flv', 'format=ps');
            }
          } else {
            if (videoUrlNew.indexOf('wss://') >= 0) {
              videoUrlNew = videoUrlNew.replace("wss://", 'https://').replace('format=mp4', 'format=ps').replace('format=MP4', 'format=ps').replace('format=flv', 'format=ps');
            } else if (videoUrlNew.indexOf('ws://') >= 0) {
              videoUrlNew = videoUrlNew.replace("ws://", 'http://').replace('format=mp4', 'format=ps').replace('format=MP4', 'format=ps').replace('format=flv', 'format=ps');
            } else {
              videoUrlNew = videoUrlNew.replace('format=mp4', 'format=ps').replace('format=MP4', 'format=ps').replace('format=flv', 'format=ps');
            }
          }

          var decodetype = 1;
          var startIndex = videoUrlNew.lastIndexOf(":");
          var endIndex = videoUrlNew.indexOf("/", startIndex);
          var port = videoUrlNew.slice(startIndex + 1, endIndex);
          var videoTalkUrl = videoUrlNew.slice(0, endIndex).replace("http://", 'ws://') + '/talk/' + devCode + "?token=" + self.token + "&time=" + new Date().getTime(); // var videoTalkUrl = videoUrlNew.slice(0,endIndex).replace("http://",'ws://') + '/uvp-micro-service/mediatranscode/api/v1/talk?code=' + devCode + "&sessionId="+ self['playerInfo'+num].sessionId + '&ak='+ self.ak + "&token=" + self.token + "&time=" + new Date().getTime()
          // self['playerInfo'+num].videoUrl = videoUrlNew

          self['playerInfo' + num].videoTalkUrl = videoTalkUrl;

          if (self.isMp4Play && !isChangeSoftOpen) {
            $("#" + self.rongqiId + " #videoPlayer" + num).show();
            $("#" + self.rongqiId + " canvas#canvasPlayer" + num).hide();

            if (isChangeSoftOpen) {
              videoUrlNew = videoUrlNew.replace('format=mp4', 'format=ps');
            } else {
              videoUrlNew = videoUrlNew.replace('format=ps', 'format=mp4');
            }

            if (!self.playerObj["videoPlayer".concat(num)] && num) {
              if (flvjs.isSupported()) {
                self.playerObj["videoPlayer".concat(num)] = flvjs.createPlayer({
                  type: 'mp4',
                  hasVideo: true,
                  hasAudio: self['playerInfo' + num].hasAudio,
                  isLive: false,
                  url: videoUrlNew.replace('ws://', 'http://'),
                  lazyLoad: false,
                  videoObj: self
                });
                self.playerObj["videoPlayer".concat(num)].isVideoFile = true; // self['playerInfo'+num].videoUrl = videoUrl

                playVideoFunc(num, packageMethod, devCode, videoUrl, videoTalkUrl, showName, streamType, self);
              }
            }
          } else {
            if (!self.playerObj["player".concat(num)]) {
              self.playerObj["player".concat(num)] = new Player(decodetype, self.returnFuc, self, devCode);
            }

            self.playerObj["player".concat(num)].chonglian = 0;
            canvasPlay(num, packageMethod, devCode, videoUrlNew, videoTalkUrl, showName, streamType, self, decodetype);
          }
        }
      },
      error: function error(result) {
        console.log(result);
      },
      complete: function complete(xhr, textStatus) {
        if (xhr.getResponseHeader('sessionstate') == 'tokenTimeout' || xhr.getResponseHeader('sessionstate') == 'timeout' || xhr.getResponseHeader('sessionstate') == 'nouser') {
          window.top.postMessage({
            key: "loginOut",
            value: ""
          }, "*");
        }
      }
    });
  } else if (packageMethod == "h264") {
    var sel = document.getElementById(self.rongqiId);
    var _eventType7 = '100';
    var _eventContext8 = {
      windowIndex: num,
      devCode: devCode,
      showName: showName,
      streamType: streamType,
      videoWidth: sel.querySelector('#videoPlayer' + num).videoWidth,
      videoHeight: sel.querySelector('#videoPlayer' + num).videoHeight,
      playType: 'h264'
    };
    execute(self.returnFuc, _eventType7, _eventContext8);

    if (step) {
      self['playerInfo' + num].videoTalkUrl = videoTalkUrl;

      if (self.playerObj["videoPlayer".concat(num)]) {
        self.playerObj["videoPlayer".concat(num)].unload();
        self.playerObj["videoPlayer".concat(num)].destroy();
        self.playerObj["videoPlayer".concat(num)].detachMediaElement();
        self.playerObj["videoPlayer".concat(num)] = "";
      }

      self.playerObj["videoPlayer".concat(num)] = "";

      if (self['playerInfo' + num].hasAudio) {
        videoUrl = videoUrl + '&acodec=g711a';
      }

      if (!self.playerObj["videoPlayer".concat(num)] && num) {
        if (flvjs.isSupported()) {
          self.playerObj["videoPlayer".concat(num)] = flvjs.createPlayer({
            type: self.isMp4,
            hasVideo: true,
            hasAudio: self['playerInfo' + num].hasAudio,
            isLive: self.isLive,
            url: videoUrl,
            lazyLoad: false,
            videoObj: self // lazyLoadMaxDuration:5 *60,//懒加载最多的秒数
            // lazyLoadRecoverDuration:60,//缓存剩余秒数时继续下载
            // autoCleanupSourceBuffer:true//自动清理缓存
            //accurateSeek:true,//精确寻帧到任何帧，不局限于视频IDR帧，但可能会慢一点。可在Chrome >火狐和Safari浏览器。
            //reuseRedirectedURL:true//重用301/302重定向url，用于随后的请求，如查找、重新连接等。

          });
          self.playerObj["videoPlayer".concat(num)].chonglian = 0;
          playVideoFunc(num, packageMethod, devCode, videoUrlNew, videoTalkUrl, showName, streamType, self);
        }
      }
    } else {
      if (streamType == 0) {
        $("#videoMask" + num).remove('nowidth');
        $("#canvasPlayerCont" + num).addClass('nowidth'); // $("#videoPlayer" + num).attr('controls',true)

        if (self['playerInfo' + num].hasAudio) {
          videoUrl = videoUrl + '&acodec=g711a';
        }

        if (!self.playerObj["videoPlayer".concat(num)] && num) {
          if (flvjs.isSupported()) {
            self.playerObj["videoPlayer".concat(num)] = flvjs.createPlayer({
              type: 'mp4',
              hasVideo: true,
              hasAudio: self['playerInfo' + num].hasAudio,
              isLive: false,
              url: videoUrl,
              lazyLoad: false,
              videoObj: self
            });
            self.playerObj["videoPlayer".concat(num)].isVideoFile = true; // self['playerInfo'+num].videoUrl = videoUrl

            playVideoFunc(num, packageMethod, devCode, videoUrl, videoTalkUrl, showName, streamType, self);
          }
        }
      } else {
        if (videoUrl.indexOf('&format=') < 0) {
          videoUrl += '&format=flv';
        }

        if (videoUrl.indexOf('&codec=') < 0) {
          videoUrl += '&codec=h264';
        }

        var videoUrlNew = videoUrl + "&redirect=false";
        $.ajax({
          url: videoUrlNew,
          type: "get",
          success: function success(result) {
            if (['401', '403'].includes(result.resultCode)) {
              var _eventContext9 = {
                windowIndex: num,
                errorCode: '403'
              };
              execute(self.returnFuc, '403', _eventContext9);
            }

            if (result && result.resultCode == 301) {
              videoUrlNew = result.location || result.Location;

              if (self.proxyIp) {
                // 启用视频代理
                var index = videoUrlNew.indexOf('/', 8);
                videoUrlNew = self.proxyIp + videoUrlNew.slice(index);
              }

              if (self.flvType === 'websocket') {
                if (self.gatewayURL.indexOf('https://') >= 0) {
                  videoUrlNew = videoUrlNew.replace("http://", 'https://').replace('21102', '21103');
                }

                if (videoUrlNew.indexOf('http://') >= 0) {
                  // 0000
                  videoUrlNew = videoUrlNew.replace("format=mp4", 'format=flv').replace("format=ps", 'format=flv').replace("http://", 'ws://');
                } else if (videoUrlNew.indexOf('https://') >= 0) {
                  videoUrlNew = videoUrlNew.replace("https://", 'wss://').replace("format=mp4", 'format=flv').replace("format=ps", 'format=flv');
                } else {
                  videoUrlNew = videoUrlNew.replace("format=mp4", 'format=flv').replace("format=ps", 'format=flv');
                }
              } else if (self.flvType === 'http') {
                if (videoUrlNew.indexOf('ws://') >= 0) {
                  videoUrlNew = videoUrlNew.replace("ws://", 'http://').replace("format=flv", 'format=mp4').replace("format=ps", 'format=flv');
                } else if (videoUrlNew.indexOf('wss://') >= 0) {
                  videoUrlNew = videoUrlNew.replace("wss://", 'https://').replace("format=flv", 'format=mp4').replace("format=ps", 'format=flv');
                } else {
                  videoUrlNew = videoUrlNew.replace("format=flv", 'format=mp4').replace("format=ps", 'format=flv');
                }
              }

              var startIndex = videoUrlNew.lastIndexOf(":");
              var endIndex = videoUrlNew.indexOf("/", startIndex);
              var port = videoUrlNew.slice(startIndex + 1, endIndex);
              var videoTalkUrl = videoUrlNew.slice(0, endIndex).replace("http://", 'ws://').replace("https://", 'ws://') + '/talk/' + devCode + "?token=" + self.token + "&time=" + new Date().getTime(); // var videoTalkUrl = videoUrlNew.slice(0,endIndex).replace("http://",'ws://') + '/uvp-micro-service/mediatranscode/api/v1/talk?code=' + devCode + "&sessionId="+ self['playerInfo'+num].sessionId + '&ak='+ self.ak + "&token=" + self.token + "&time=" + new Date().getTime()

              self['playerInfo' + num].videoTalkUrl = videoTalkUrl; // self['playerInfo'+num].videoUrl = videoUrlNew

              if (self.playerObj["videoPlayer".concat(num)]) {
                self.playerObj["videoPlayer".concat(num)].unload();
                self.playerObj["videoPlayer".concat(num)].destroy();
                self.playerObj["videoPlayer".concat(num)].detachMediaElement();
                self.playerObj["videoPlayer".concat(num)] = "";
              }

              self.playerObj["videoPlayer".concat(num)] = "";

              if (self['playerInfo' + num].hasAudio) {
                videoUrlNew = videoUrlNew + '&acodec=g711a';
              }

              if (!self.playerObj["videoPlayer".concat(num)] && num) {
                if (flvjs.isSupported()) {
                  self.playerObj["videoPlayer".concat(num)] = flvjs.createPlayer({
                    type: self.flvType === 'http' ? 'mp4' : 'flv',
                    hasVideo: true,
                    hasAudio: !self.hasAudio && self['playerInfo' + num].hasAudio,
                    isLive: self.objType == "replay" ? false : true,
                    url: videoUrlNew,
                    lazyLoad: false,
                    videoObj: self // lazyLoadMaxDuration:5 *60,//懒加载最多的秒数
                    // lazyLoadRecoverDuration:60,//缓存剩余秒数时继续下载
                    // autoCleanupSourceBuffer:true//自动清理缓存
                    //accurateSeek:true,//精确寻帧到任何帧，不局限于视频IDR帧，但可能会慢一点。可在Chrome >火狐和Safari浏览器。
                    //reuseRedirectedURL:true//重用301/302重定向url，用于随后的请求，如查找、重新连接等。

                  });
                  self.playerObj["videoPlayer".concat(num)].chonglian = 0;
                  playVideoFunc(num, packageMethod, devCode, videoUrlNew, videoTalkUrl, showName, streamType, self);
                }
              }
            }
          },
          error: function error(result) {
            console.log(result);
          },
          complete: function complete(xhr, textStatus) {
            if (xhr.getResponseHeader('sessionstate') == 'tokenTimeout' || xhr.getResponseHeader('sessionstate') == 'timeout' || xhr.getResponseHeader('sessionstate') == 'nouser') {
              window.top.postMessage({
                key: "loginOut",
                value: ""
              }, "*");
            }
          }
        });
      }
    }
  } else if (packageMethod == "h264decoder") {
    var _eventType8 = '100';
    var _eventContext10 = {
      windowIndex: num,
      devCode: devCode,
      showName: showName,
      streamType: streamType,
      videoWidth: self.playerObj["player" + num].videoWidth,
      videoHeight: self.playerObj["player" + num].videoHeight,
      playType: 'h264decoder',
      isChangeSoftOpen: isChangeSoftOpen ? isChangeSoftOpen : 'false'
    };
    execute(self.returnFuc, _eventType8, _eventContext10);
    var videoUrlNew = videoUrl + "&format=ps&codec=h264&redirect=false";
    $.ajax({
      url: videoUrlNew,
      type: "get",
      success: function success(result) {
        if (['401', '403'].includes(result.resultCode)) {
          var _eventContext11 = {
            windowIndex: num,
            errorCode: '403'
          };
          execute(self.returnFuc, '403', _eventContext11);
        }

        if (result && result.resultCode == 301) {
          videoUrlNew = result.location || result.Location;

          if (self.proxyIp) {
            // 启用视频代理
            var index = videoUrlNew.indexOf('/', 8);
            videoUrlNew = self.proxyIp + videoUrlNew.slice(index);
          }

          if (self.transType265 === 'websocket') {
            if (self.gatewayURL.indexOf('https://') >= 0) {
              videoUrlNew = videoUrlNew.replace("http://", 'https://').replace('21102', '21103');
            }

            if (videoUrlNew.indexOf('https://') >= 0) {
              videoUrlNew = videoUrlNew.replace("https://", 'wss://').replace('format=MP4', 'format=ps').replace('format=flv', 'format=ps');
            } else if (videoUrlNew.indexOf('http://') >= 0) {
              videoUrlNew = videoUrlNew.replace("http://", 'ws://').replace('format=mp4', 'format=ps').replace('format=MP4', 'format=ps').replace('format=flv', 'format=ps');
            } else {
              videoUrlNew = videoUrlNew.replace('format=mp4', 'format=ps').replace('format=MP4', 'format=ps').replace('format=flv', 'format=ps');
            }
          } else {
            if (videoUrlNew.indexOf('wss://') >= 0) {
              videoUrlNew = videoUrlNew.replace("wss://", 'https://').replace('format=mp4', 'format=ps').replace('format=MP4', 'format=ps').replace('format=flv', 'format=ps');
            } else if (videoUrlNew.indexOf('ws://') >= 0) {
              videoUrlNew = videoUrlNew.replace("ws://", 'http://').replace('format=mp4', 'format=ps').replace('format=MP4', 'format=ps').replace('format=flv', 'format=ps');
            } else {
              videoUrlNew = videoUrlNew.replace('format=mp4', 'format=ps').replace('format=MP4', 'format=ps').replace('format=flv', 'format=ps');
            }
          }

          var decodetype = 0;
          var startIndex = videoUrlNew.lastIndexOf(":");
          var endIndex = videoUrlNew.indexOf("/", startIndex);
          var port = videoUrlNew.slice(startIndex + 1, endIndex);
          var videoTalkUrl = videoUrlNew.slice(0, endIndex).replace("http://", 'ws://') + '/talk/' + devCode + "?token=" + self.token + "&time=" + new Date().getTime(); // var videoTalkUrl = videoUrlNew.slice(0,endIndex).replace("http://",'ws://') + '/uvp-micro-service/mediatranscode/api/v1/talk?code=' + devCode + "&sessionId="+ self['playerInfo'+num].sessionId + '&ak='+ self.ak + "&token=" + self.token + "&time=" + new Date().getTime()
          // self['playerInfo'+num].videoUrl = videoUrlNew

          self['playerInfo' + num].videoTalkUrl = videoTalkUrl;

          if (!self.playerObj["player".concat(num)]) {
            self.playerObj["player".concat(num)] = new Player(decodetype, self.returnFuc, self, devCode);
          }

          self.playerObj["player".concat(num)].chonglian = 0; // 新增样式

          $("#videoMask" + num).addClass('nowidth');
          $("#canvasPlayerCont" + num).removeClass('nowidth');
          $("#videoMask" + num).removeClass('nowidth'); // 新增样式

          canvasPlay(num, packageMethod, devCode, videoUrlNew, videoTalkUrl, showName, streamType, self, decodetype);
        }
      },
      error: function error(result) {
        console.log(result);
      },
      complete: function complete(xhr, textStatus) {
        if (xhr.getResponseHeader('sessionstate') == 'tokenTimeout' || xhr.getResponseHeader('sessionstate') == 'timeout' || xhr.getResponseHeader('sessionstate') == 'nouser') {
          window.top.postMessage({
            key: "loginOut",
            value: ""
          }, "*");
        }
      }
    });
  }
} // h264播放视频


function playVideoFunc(num, packageMethod, devCode, videoUrl, videoTalkUrl, showName, streamType, self) {
  if (videoUrl === "") {} else {
    if (num) {
      var stringId = "videoPlayer" + num;
      var sel = document.getElementById(self.rongqiId);
      sel.querySelector("#" + stringId).volume = 0;

      if (self.flvType === 'http') {
        self.playerObj["videoPlayer".concat(num)].attachMediaElement(sel.querySelector("#" + stringId));
        self.playerObj["videoPlayer".concat(num)].load();
        self.playerObj["videoPlayer".concat(num)].play();
      } else {
        self.playerObj["videoPlayer".concat(num)].attachMediaElement(sel.querySelector("#" + stringId));
        self.playerObj["videoPlayer".concat(num)].load();
        self.playerObj["videoPlayer".concat(num)].play();
        self.playerObj["videoPlayer".concat(num)].on(flvjs.Events.ERROR, function (errType, errDetail) {// errortips(num,'视频或网络错误',self.rongqiId)
          // let eventType = '111'
          // let eventContext ={
          // 		windowIndex: num,
          // 		errorDes:'视频或网络错误',
          // 		errorCode:'999',
          // 		rongqiId:self.rongqiId,
          // 		devCode:self.devCode
          // }
          // execute(self.returnFuc,eventType,eventContext)
        });

        if (self.objType === 'video') {
          self.playerObj["videoPlayer".concat(num)].on(flvjs.Events.METADATA_ARRIVED, function () {
            errortipshide(num, self.rongqiId);
            setTimeout(function () {
              $("#".concat(self.rongqiId, " #picImgCL").concat(num)).attr({
                'src': ''
              }).addClass('hide');
              clearInterval(self["timer".concat(num)]);
              self["timer".concat(num)] = null;
              delete self["chonglian".concat(num)];
              errortipshide(num, self.rongqiId);
            }, 2500);
          });
          self.playerObj["videoPlayer".concat(num)].on(flvjs.Events.MEDIA_SOURCE_CLOSE, function (errType, errDetail) {
            console.log("flvjs.Events.MEDIA_SOURCE_CLOSE:视频关闭？", errType, errDetail);
          }); //重连

          self.playerObj["videoPlayer".concat(num)].on(flvjs.Events.MEDIA_SOURCE_ENDED, function (errType, errDetail) {
            // if($("#" + self.rongqiId + " #errortip"+ num).hasClass("hide")){
            //   if(errType == "NetworkError"){
            //     errortips(num,"当前设备网络故障无法播放",self.rongqiId)
            //   }else if(errType == "MediaError"){
            //     errortips(num,"当前设备媒体故障无法播放",self.rongqiId)
            //   }else{
            //     errortips(num,"当前设备网络故障无法播放",self.rongqiId)
            //   }
            // }
            console.log('触发重连');
            var captureImg = captureFuc(num, self);
            $("#".concat(self.rongqiId, " #picImgCL").concat(num)).width('100%');
            $("#".concat(self.rongqiId, " #picImgCL").concat(num)).height('100%');
            $("#".concat(self.rongqiId, " #picImgCL").concat(num)).attr({
              'src': captureImg
            }).removeClass('hide');

            if (!self["chonglian".concat(num)]) {
              self.playerObj["videoPlayer".concat(num)].unload();
              self.playerObj["videoPlayer".concat(num)].detachMediaElement();
              self.playerObj["videoPlayer".concat(num)].attachMediaElement(sel.querySelector("#" + stringId));
              self.playerObj["videoPlayer".concat(num)].load();
              self.playerObj["videoPlayer".concat(num)].play();
              self["chonglian".concat(num)] = 1;
            } else {
              self["timer".concat(num)] = setInterval(function () {
                if (self["chonglian".concat(num)] < 3) {
                  self["chonglian".concat(num)] += 1;
                } else {
                  delete self["chonglian".concat(num)];
                }

                if (!self["chonglian".concat(num)]) {
                  clearInterval(self["timer".concat(num)]);
                  self["timer".concat(num)] = null;
                } // self.playerObj[`videoPlayer${num}`].pause()


                self.playerObj["videoPlayer".concat(num)].unload();
                self.playerObj["videoPlayer".concat(num)].detachMediaElement();
                self.playerObj["videoPlayer".concat(num)].attachMediaElement(sel.querySelector("#" + stringId));
                self.playerObj["videoPlayer".concat(num)].load();
                self.playerObj["videoPlayer".concat(num)].play();
              }, 30000);
            }
          });
        } else {
          console.log('历史视频不应该触发重连！');
        }
      }

      $("#" + self.rongqiId + " div#videoMask" + num).addClass("videoMask");
      var eventType = '110';
      var eventContext = {
        windowIndex: num,
        devCode: devCode,
        showName: showName,
        streamType: streamType,
        videoWidth: sel.querySelector('#videoPlayer' + num).videoWidth,
        videoHeight: sel.querySelector('#videoPlayer' + num).videoHeight,
        playType: 'h264',
        videoObj: self
      };
      execute(self.returnFuc, eventType, eventContext);
    }
  }
} // h265视频播放/暂停操作


function canvasPlay(num, packageMethod, devCode, videoUrl, videoTalkUrl, showName, streamType, self, decodetype) {
  // errortips(num,'视频加载中...',self.rongqiId)
  self.playerObj["player" + num].playUrl = videoUrl;
  var currentState = self.playerObj["player" + num].getState();
  var canvasId = "canvasPlayer" + num;
  var sel = document.getElementById(self.rongqiId);
  var canvas = sel.querySelector("#" + canvasId);

  if (!canvas) {
    console.log("第" + num + "画布canvas获取失败！");
    return false;
  }

  if (currentState != playerStatePlaying) {
    self.playerObj["player" + num].play(videoUrl, canvas, function (e) {
      console.log("play error " + e.error + " status " + e.status + ".--" + videoUrl);

      if (e.error == 1) {
        console.log("Finished.");
      }
    }, 524288 * 2, num);
    $("#" + self.rongqiId + " div#videoMask" + num).addClass("videoMask");
    var eventType = '110';
    var eventContext = {
      windowIndex: num,
      devCode: devCode,
      showName: showName,
      streamType: streamType,
      videoWidth: self.playerObj["player" + num].videoWidth,
      videoHeight: self.playerObj["player" + num].videoHeight,
      playType: decodetype == 0 ? 'h264decoder' : 'h265',
      videoObj: self
    };
    execute(self.returnFuc, eventType, eventContext);
  } else {
    self.playerObj["player" + num].stop(num);
    self.playerObj["player" + num] = "";
    var canvasId = "canvasPlayer" + num;
    var sel = document.getElementById(self.rongqiId);
    var canvas = sel.querySelector("#" + canvasId);
    var gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    var _eventType9 = '101';
    var _eventContext12 = {
      windowIndex: num,
      devCode: devCode,
      showName: showName,
      streamType: streamType
    };
    execute(self.returnFuc, _eventType9, _eventContext12);
  }

  return true;
} // 软解码播放


function videoObjPlay264(num, self, str) {
  var devCode = self['playerInfo' + num].devCode;
  var videoUrl = self['playerInfo' + num].videoUrl;
  var packageMethod = self['playerInfo' + num].packageMethod;
  var videoTalkUrl = self['playerInfo' + num].videoTalkUrl;
  var showName = self['playerInfo' + num].showName;
  var streamType = self['playerInfo' + num].streamType;
  var isChangeSoftClose = true;
  var isChangeSoftOpen = true;
  videoObjClose(num, self, true, '', '', isChangeSoftClose);
  packageMethod = str === '软解播放' ? "h264decoder" : 'h264';
  setTimeout(function () {
    videoPlay(num, packageMethod, devCode, videoUrl, videoTalkUrl, showName, streamType, self, isChangeSoftOpen);
  }, 500);
}

function videoObjPlay265(num, self, str) {
  var devCode = self['playerInfo' + num].devCode;
  var videoUrl = str === '软解播放' ? self['playerInfo' + num].videoUrl.replace('format=mp4', 'format=ps') : self['playerInfo' + num].videoUrl.replace('format=ps', 'format=mp4');
  var packageMethod = self['playerInfo' + num].packageMethod;
  var videoTalkUrl = self['playerInfo' + num].videoTalkUrl;
  var showName = self['playerInfo' + num].showName;
  var streamType = self['playerInfo' + num].streamType;
  var isChangeSoftClose = true;
  var isChangeSoftOpen = true;
  videoObjClose(num, self, true, '', '', isChangeSoftClose);
  setTimeout(function () {
    videoPlay(num, packageMethod, devCode, videoUrl, videoTalkUrl, showName, streamType, self, isChangeSoftOpen);
  }, 500);
} // 3、关闭视频播放


function videoObjClose(num, self, isGuanBiLiu, url, sessionId, isChangeSoftClose) {
  var status = $("#" + self.rongqiId + " img#recordVideo" + num).attr("data-status");

  if (status == '1') {
    // 如果在录像，关闭视频前就关闭录像
    recordVideoFuc(num, self);
  }

  $("#volumeBtn" + num).attr({
    "data-status": "1",
    "src": "".concat(window.top.__BASE_LOCATION__, "images/realVideoImages/closeVolume.png")
  });
  $('#fullBtnBox' + num).hide(); // $(`#${self.rongqiId} #picImgCL${num}`).attr({'src':''}).addClass('hide')

  if (self["timer".concat(num)]) {
    clearInterval(self["timer".concat(num)]);
    self["timer".concat(num)] = null;
    delete self["chonglian".concat(num)];
  } // errortipshide(num, self.rongqiId)


  if (self['playerInfo' + num].packageMethod === 'jpg') {
    var _devCode2 = self['playerInfo' + num].devCode;
    var _eventType10 = '101';
    var _eventContext13 = {
      windowIndex: num,
      devCode: _devCode2
    };
    execute(self.returnFuc, _eventType10, _eventContext13);
    self['playerInfo' + num].packageMethod = '';
    $("#".concat(self.rongqiId, " #ttpicPlayer").concat(num)).attr({
      'src': "",
      'devCode': ''
    }).addClass('hide');
    $("#" + self.rongqiId + " div#videoMask" + num).removeClass("videoMask");
    $("#" + self.rongqiId + " div#videoMask" + num).removeClass("selecedVideoMask");
    return;
  }

  if ($("#" + self.rongqiId + " div#videoMask" + num).hasClass("videoMask")) {
    $("#" + self.rongqiId + " div#videoMask" + num).removeClass("videoMask");
  }

  errortipshide(num, self.rongqiId);
  var isBoFang = self.playerObj["videoPlayer".concat(num)] || self.playerObj["player".concat(num)] || null;

  if (!isBoFang) {
    $("#" + self.rongqiId + " div#fullBtnBox" + num).hide();
    return;
  }

  var devCode = self['playerInfo' + num].devCode;
  var videoUrl = self['playerInfo' + num].videoUrl;
  var packageMethod = self['playerInfo' + num].packageMethod;
  var videoTalkUrl = self['playerInfo' + num].videoTalkUrl;
  var showName = self['playerInfo' + num].showName;
  var streamType = self['playerInfo' + num].streamType;
  var sessionId = self['playerInfo' + num].sessionId;

  if (self.playerObj["videoPlayer".concat(num)]) {
    self.argarr = [num, packageMethod, devCode, videoUrl, videoTalkUrl, showName, streamType, self]; // self.playerObj[`videoPlayer${num}`].pause()

    self.playerObj["videoPlayer".concat(num)].unload();
    self.playerObj["videoPlayer".concat(num)].destroy();
    self.playerObj["videoPlayer".concat(num)].detachMediaElement();
    self.playerObj["videoPlayer".concat(num)] = "";
    self['playerInfo' + num].videoUrl = '';
    var isVideoFull = true;

    if (sessionStorage.puman == 'puman') {
      isVideoFull = true;
    } else if (sessionStorage.puman == 'notpuman') {
      isVideoFull = false;
    }

    var html = "";
    html += ["<video class='videoPlayer ".concat(isVideoFull === true ? 'puman' : "", "' id='videoPlayer").concat(num, "' data-status='0' data-winNum='").concat(num, "'"), "                data-devCode=''  preload='auto' autoplay='autoplay' data-setup='{}' crossOrigin='anonymous'", "                width='852' height='480'>", "                <p class='vjs-no-js'>To view this video please enable JavaScript,and consider upgrading to a web", "                    browser that<a href='https://videojs.com/html5-video-support/' target='_blank'>supports HTML5", "                        video</a></p>", "            </video>"].join("");
    $("#" + self.rongqiId + " #videoPlayer" + num).remove();
    $("#" + self.rongqiId + " #videoMask" + num).after(html);
  } //停止播放切断H265媒体流


  if (self.playerObj["player".concat(num)]) {
    self.argarr = [num, packageMethod, devCode, videoUrl, videoTalkUrl, showName, streamType, self];
    self.playerObj["player".concat(num)].stop(num);
    self.playerObj["player".concat(num)] = '';
    var canvasId = "canvasPlayer" + num;
    var sel = document.getElementById(self.rongqiId);
    var canvas = sel.querySelector("#" + self.rongqiId + " #" + canvasId);
    var gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl"); //指定清除颜色缓冲区的颜色。

    gl.clearColor(0.0, 0.0, 0.0, 0.0); //用指定的颜色清除颜色缓冲区。

    gl.clear(gl.COLOR_BUFFER_BIT);
    var html = "";
    html += ["<div id='canvasPlayerCont".concat(num, "' class='canvasPlayerCont'><canvas class='canvasPlayer hide' id='canvasPlayer").concat(num, "'"), "width='852' height='480' data-status='0' data-winNum='".concat(num, "' data-devCode=''></canvas></div>")].join("");
    $("#" + self.rongqiId + " #canvasPlayer" + num).remove();
    $("#" + self.rongqiId + " #videoPlayer" + num).after(html);
  } // 判断该窗口是否进行语音对讲


  if (Number($("#" + self.rongqiId + " img#talkBtn" + num).attr("data-status"))) {
    self.isTalkingDevCode = "";
    endVideoTalk();
  }

  var eventType = '101';
  var eventContext = {
    windowIndex: num,
    devCode: devCode,
    showName: showName,
    streamType: streamType,
    isChangeSoftClose: isChangeSoftClose ? isChangeSoftClose : false
  };
  self['playerInfo' + num] = {};
  execute(self.returnFuc, eventType, eventContext);

  if (isGuanBiLiu == false) {
    return;
  }

  url = self.gatewayURL + "/uvp-micro-service/mediatranscode/api/v1/playControl?ak=" + self.ak + "&token=" + self.token + "&timestamp=" + new Date().getTime() + "&nonce=" + sessionId + "&sessionId=" + sessionId;
  $.ajax({
    url: url,
    type: "post",
    contentType: 'application/json',
    data: JSON.stringify({
      'sessionId': sessionId,
      'cmd': 'stop',
      'scale': '',
      'range': ''
    }),
    success: function success(result) {
      if (result && JSON.parse(result).resultCode == 200) {
        console.log("后台关闭流成功");
      }
    },
    error: function error(err) {
      console.log("后台关闭流失败");
    },
    complete: function complete(xhr, textStatus) {
      console.log('网关请求结束：', xhr.getResponseHeader('sessionstate'));
    }
  });
  $("#" + self.rongqiId + " #fullBtnBox" + num).hide();
} // 4、云台控制


function videoObjControl(devCode, cmd, lspeed, rspeed, self, url, sessionId) {
  cloudDeskObjControl(devCode, cmd, lspeed, rspeed, self, url, sessionId);
}

function cloudDeskObjControl(devCode, cmd, lspeed, rspeed, self, url, sessionId) {
  if (!lspeed || lspeed < 1 || lspeed > 9 || isNaN(lspeed)) {
    lspeed = self.PTZSpeed;
  }

  if (!rspeed || rspeed < 1 || rspeed > 9 || isNaN(rspeed)) {
    rspeed = self.PTZSpeed;
  }

  lspeed = lspeed + '';
  rspeed = rspeed + '';
  cmd = typeof cmd === 'string' ? Number(cmd) : cmd;
  var keys = Object.keys(self);

  if (devCode) {
    var code = devCode;
  } else {
    var num = self.playingSelectedWinNum;
    var code = self['playerInfo' + num].devCode;
  }

  if (cmd == 0x0402) {
    changeBgImg(1, self);
  } else if (cmd == 0x0802) {
    changeBgImg(2, self);
  } else if (cmd == 0x0502) {
    changeBgImg(3, self);
  } else if (cmd == 0x0804) {
    changeBgImg(4, self);
  } else if (cmd == 0x0404) {
    changeBgImg(5, self);
  } else if (cmd == 0x0704) {
    changeBgImg(6, self);
  } else if (cmd == 0x0504) {
    changeBgImg(7, self);
  } else if (cmd == 0x0702) {
    changeBgImg(8, self);
  }

  if (!code) {
    var errMsg = "未选择播放的设备，无法进行操作";
    console.log(errMsg);
  } else {
    keys.forEach(function (key) {
      var _self$key;

      if (((_self$key = self[key]) === null || _self$key === void 0 ? void 0 : _self$key.devCode) === code) {
        sessionId = self[key].sessionId;
      }
    });
    url = self.gatewayURL + "/uvp-micro-service/mediatranscode/api/v1/cameraControl?ak=" + self.ak + "&token=" + self.token + "&timestamp=" + new Date().getTime() + "&nonce=" + sessionId;

    if (!sessionId) {
      console.log("没有获取到所选窗口的sessionId");
    }

    cmd = String(cmd);
    PTZControl(self.gatewayURL, self.atToken, code, cmd, lspeed, rspeed, self, url, sessionId);
  }
} // 修改云台背景图片


function changeBgImg(pic, self) {
  for (var i = 1; i < 8; i++) {
    $("#" + self.rongqiId + " div.circle").removeClass("circle" + i);
  }

  $("#" + self.rongqiId + " div.circle").addClass("circle" + pic);
} // 9、获取窗口号和设备号


function getObjInfo(num, self) {
  for (var i = 1; i <= 16; i++) {
    if (num == i) {
      $("#" + self.rongqiId + " div#videoMask" + num).addClass("selecedVideoMask").css("border", "".concat(self.selectWidth, "px solid ").concat(self.color));
    } else {
      $("#" + self.rongqiId + " div#videoMask" + i).removeClass("selecedVideoMask").css("border", "1px solid #1c1c1c");
    }
  }

  self.selector = "#" + self.rongqiId + " #videoPlayer" + num;
  self.playingSelectedWinNum = num; // 存当前devcode

  self.playingSelecteddevCode = self['playerInfo' + num].devCode;
  var devCode = self['playerInfo' + num].devCode || null;
  var showName = self['playerInfo' + num].showName || null;
  var streamType = self['playerInfo' + num].streamType || null;
  var videoWidth = 0;
  var videoHeight = 0;

  if (self.playerObj["videoPlayer".concat(num)]) {
    var sel = document.getElementById(self.rongqiId);
    videoWidth = sel.querySelector("#videoPlayer".concat(num)).videoWidth;
    videoHeight = sel.querySelector("#videoPlayer".concat(num)).videoHeight;
  }

  if (self.playerObj["player".concat(num)]) {
    videoWidth = self.playerObj["player".concat(num)].videoWidth;
    videoHeight = self.playerObj["player".concat(num)].videoHeight;
  }

  var eventType = '102';
  var eventContext = {
    windowIndex: num,
    devCode: devCode,
    showName: showName,
    streamType: streamType,
    videoWidth: videoWidth,
    videoHeight: videoHeight,
    winWidth: $('#videoMask' + num).width(),
    winHeight: $('#videoMask' + num).height()
  };
  execute(self.returnFuc, eventType, eventContext);
  return [self.playingSelectedWinNum, self.playingSelecteddevCode];
} // 10、销毁窗口


function destoryVideoObj(id) {
  $("#" + id).html("");
} // 鼠标移入移出视频区域console.log()


function showBtns(flag, num, self) {
  if (flag && self['playerInfo' + num].packageMethod === 'jpg') {
    $("#".concat(self.rongqiId, " #fullBtnBox").concat(num)).show();
    $("#" + self.rongqiId + " #closeBtn" + num).show();
    $("#" + self.rongqiId + " img#volumeBtn" + num).hide();
    $("#" + self.rongqiId + " img#picBtn" + num).hide();
    $("#" + self.rongqiId + " img#talkBtn" + num).hide();
    $("#" + self.rongqiId + " div#circle" + num).hide();
    document.querySelector("#" + self.rongqiId + " #recordVideo" + num).style.display = 'none';
    return;
  } else if (!flag && self['playerInfo' + num].packageMethod === 'jpg') {
    $("#".concat(self.rongqiId, " #fullBtnBox").concat(num)).hide();
    return;
  }

  var isBoFang = self.playerObj["videoPlayer".concat(num)] || self.playerObj["player".concat(num)] || null;
  var status = $("#" + self.rongqiId + " img#stickBtn" + num).attr("data-status");

  if (flag && isBoFang) {
    // 移入操作，显示按钮
    $("#" + self.rongqiId + " img#closeBtn" + num).show();

    if (self.objType === 'replay') {
      $("#" + self.rongqiId + " img#picBtn" + num).hide();
    } else {
      $("#" + self.rongqiId + " img#picBtn" + num).show();
    }

    $("#" + self.rongqiId + " img#volumeBtn" + num).show(); // if (canTalk) {

    if (self.objType === 'replay') {
      $("#" + self.rongqiId + " img#talkBtn" + num).hide();
    } else {
      $("#" + self.rongqiId + " img#talkBtn" + num).show();
    } // }


    $("#" + self.rongqiId + " img#stickBtn" + num).show();
    $("#" + self.rongqiId + " div#fullBtnBox" + num).show();

    if (self.showCircleCloud) {
      $("#" + self.rongqiId + " div#circle" + num).show();
    } else {
      $("#" + self.rongqiId + " div#circle" + num).hide();
    }
  } else {
    // $("#" + self.rongqiId + " #volumeBtn" + num).hide();
    $("#" + self.rongqiId + " div#fullBtnBox" + num).hide();
    $("#" + self.rongqiId + " div#circle" + num).hide();

    if (status == 1) {
      $("#" + self.rongqiId + " div#fullBtnBox" + num).show();
    }
  }

  if (!isBoFang) {
    $("#" + self.rongqiId + " img#stickBtn" + num).attr("data-status", "0");
    $("#" + self.rongqiId + " div#fullBtnBox" + num).removeClass("block");
    $("#" + self.rongqiId + " img#closeBtn" + num).removeClass("inlineBlock");
    $("#" + self.rongqiId + " img#volumeBtn" + num).removeClass("inlineBlock");
    $("#" + self.rongqiId + " img#picBtn" + num).removeClass("inlineBlock");
    $("#" + self.rongqiId + " img#fullScreenBtn" + num).removeClass("inlineBlock"); // if (canTalk) {
    // 	$("#" + self.rongqiId + " img#talkBtn" + num).removeClass("inlineBlock");
    // }

    $("#" + self.rongqiId + " img#stickBtn" + num).removeClass("inlineBlock");
  }
} // 全屏操作


function fullScreen(element, num, self) {
  if (element.requestFullscreen) {
    element.requestFullscreen();
  } else if (element.webkitRequestFullscreen) {
    element.webkitRequestFullScreen();
  } else if (element.mozRequestFullScreen) {
    element.mozRequestFullScreen();
  } else if (element.msRequestFullscreen) {
    element.msRequestFullscreen();
  } else if (element.oRequestFullscreen) {
    element.oRequestFullscreen();
  } else {
    alert("浏览器版本太低，无法实现全屏！"); //兼容safari 用canvas dispay：fixed
    // if(self.playerObj[`videoPlayer${num}`]){
    //     const video= document.querySelector("#" + self.rongqiId + " .videoZoom #videoPlayer" + num)
    // 	video.webkitEnterFullScreen();
    // }else if(self.playerObj[`player${num}`]){
    //     const video= document.querySelector("#" + self.rongqiId + " .videoZoom #canvasPlayer" + num)
    // 	video.webkitEnterFullScreen();
    // }
  }

  self.isAllScreen = 1;
} // 取消全屏操作


function exitScreen(element, num, self) {
  if (document.fullscreenElement && document.fullscreenElement.classList.contains('videoZoomIE')) {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }

    self.isAllScreen = 0;
  }
}

function partFullScreen(num, self) {
  //console.log(self.isAllScreen,'0:去全屏，1：去退出全屏')
  if (self.isAllScreen) {} else {
    fullScreen(document.body.querySelector("#" + self.rongqiId + " .videoZoomIE"), num, self);
  }
} // 语音对讲


function videoTalk(num, self, src) {
  var status = $("#" + self.rongqiId + " img#talkBtn" + num).attr("data-status");
  var beforeTalkDevCode = ""; // 如果图标状态为“0”，并且没有正在对讲的设备

  if (status == "0" && !self.isTalkingDevCode) {
    // 1、切换图标和状态属性；2、标明正在对讲的设备
    $("#" + self.rongqiId + " img#talkBtn" + num).attr({
      "data-status": "1",
      "src": "".concat(window.top.__BASE_LOCATION__, "images/realVideoImages/videoTalking.png")
    });
    self.isTalkingDevCode = self['playerInfo' + num].devCode; // 开启语音对讲S

    var talkUrl = self['playerInfo' + num].videoTalkUrl;

    if (src) {
      startVideoTalk(src);
    } else {
      if (talkUrl) {
        startVideoTalk(talkUrl); // $.ajax({
        // 	url: talkUrl,    //请求的url地址
        // 	type: "GET",
        // 	success: function (result) {
        // 		if (result&&result.ResultCode == 301) {
        // 			talkUrl = result.Location
        // 			startVideoTalk(talkUrl);
        // 		}
        // 	}
        // })
      }
    }
  } else if (status == "0" && self.isTalkingDevCode) {
    alert("有设备进行对讲");
    return -1;
  } else if (status == "1") {
    $("#" + self.rongqiId + " img#talkBtn" + num).attr({
      "data-status": "0",
      "src": "".concat(window.top.__BASE_LOCATION__, "images/realVideoImages/videoTalk.png")
    });
    beforeTalkDevCode = self.isTalkingDevCode;
    self.isTalkingDevCode = "";
    endVideoTalk();
  }
} // 未使用


function realRecord(num, self) {
  var status = $("#" + self.rongqiId + " img#recordVideo" + num).attr("data-status");
  var classList = $('#errortip' + num).attr('class');
  var flag = classList.indexOf('hide') < 0; //没有发现hide，视频播放失败了

  if (flag) {
    alert('当前无设备，无法录制视频！');
    return;
  }

  if (status === "0") {
    $("#" + self.rongqiId + " img#recordVideo" + num).attr({
      "data-status": "1",
      "src": "".concat(window.top.__BASE_LOCATION__, "images/realVideoImages/recordVideoing.png")
    });
  } else if (status === "1") {
    $("#" + self.rongqiId + " img#recordVideo" + num).attr({
      "data-status": "2",
      "src": "".concat(window.top.__BASE_LOCATION__, "images/realVideoImages/recordVideo.png")
    });
  } else if (status === "2") {
    $("#" + self.rongqiId + " img#recordVideo" + num).attr({
      "data-status": "1",
      "src": "".concat(window.top.__BASE_LOCATION__, "images/realVideoImages/recordVideoing.png")
    });
  }

  var statusNow = $("#" + self.rongqiId + " img#recordVideo" + num).attr("data-status");

  if (statusNow == '1' && videoUrl) {
    var uuid = self['playerInfo' + num].sessionId;
    var time = new Date().getTime();
    var devCode = self['playerInfo' + num].devCode;

    var _videoUrl = self.gatewayURL + "/uvp-micro-service/storage/api/v1/realRecord?ak=".concat(self.ak, "&token=").concat(self.token, "&timestamp=").concat(time, "&nonce=").concat(uuid);

    $.ajax({
      url: _videoUrl,
      //请求的url地址
      type: "post",
      data: JSON.stringify({
        sessionId: uuid,
        code: devCode,
        cmd: "continue",
        duration: ""
      }),
      contentType: 'application/json',
      success: function success(result) {
        if (result && result.resultCode == 200) {
          console.log('开始录制');
        }
      }
    });
  }

  if (statusNow === "2" && videoUrl) {
    var _uuid = self['playerInfo' + num].sessionId;
    var _devCode3 = self['playerInfo' + num].devCode;
    $.ajax({
      url: videoUrl,
      //请求的url地址
      type: "post",
      data: JSON.stringify({
        sessionId: _uuid,
        code: _devCode3,
        cmd: "stop",
        duration: ""
      }),
      contentType: 'application/json',
      success: function success(result) {
        if (result && result.resultCode == 200) {
          console.log('录制完成');
        }
      }
    });
  }
}

function recordVideoFuc(num, self) {
  var status = $("#" + self.rongqiId + " img#recordVideo" + num).attr("data-status");
  var classList = $('#errortip' + num).attr('class');
  var flag = classList.indexOf('hide') < 0; //没有发现hide，视频播放失败了

  if (flag) {
    alert('当前无设备，无法录制视频！');
    return;
  }

  if (status === "0") {
    $("#" + self.rongqiId + " img#recordVideo" + num).attr({
      "data-status": "1",
      "src": "".concat(window.top.__BASE_LOCATION__, "images/realVideoImages/recordVideoing.png")
    });
  } else if (status === "1") {
    $("#" + self.rongqiId + " img#recordVideo" + num).attr({
      "data-status": "2",
      "src": "".concat(window.top.__BASE_LOCATION__, "images/realVideoImages/recordVideo.png")
    });
  } else if (status === "2") {
    $("#" + self.rongqiId + " img#recordVideo" + num).attr({
      "data-status": "1",
      "src": "".concat(window.top.__BASE_LOCATION__, "images/realVideoImages/recordVideoing.png")
    });
  }

  var statusNow = $("#" + self.rongqiId + " img#recordVideo" + num).attr("data-status");
  var videoUrl = self['playerInfo' + num].videoUrl;
  var devCode = self['playerInfo' + num].devCode;

  if (statusNow == 1 && videoUrl) {
    // 新的session
    var sessionId = generateUUID();
    self['playerInfo' + num].downloadSession = sessionId;

    if (videoUrl.indexOf('directurl') > 0) {
      var videoUrlNew = videoUrl.replace('format=mp4', 'format=ps').replace('format=MP4', 'format=ps');
      var now = new Date();
      var time = '-' + now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate() + '-' + now.getHours() + ':' + now.getMinutes() + ':' + now.getSeconds();
      videoUrlNew = videoUrlNew.replace('format=mp4', 'format=ps').replace('format=MP4', 'format=ps');

      if (videoUrlNew.indexOf("sessionId") >= 0) {
        videoUrlNew = replaceParamVal(videoUrlNew, "sessionId", sessionId);
        $("#" + self.rongqiId + " #videoPlayer" + num).attr("data-videourl-down", videoUrlNew);
      } else {
        videoUrlNew += '&sessionId' + sessionId;
      }

      $.ajax({
        url: videoUrlNew,
        //请求的url地址
        type: "GET",
        success: function success(result) {
          if (['401', '403'].includes(result.resultCode)) {
            var eventContext = {
              windowIndex: num,
              errorCode: '403'
            };
            execute(self.returnFuc, '403', eventContext);
          }

          if (result && result.resultCode == 301) {
            videoUrlNew = result.location || result.Location;
            // var index = videoUrlNew.indexOf('?');
            // var str1 = videoUrlNew.slice(0, index);
            // var str2 = videoUrlNew.slice(index);
            // videoUrlNew = "".concat(str1, "/").concat(devCode, "_").concat(time, ".ps").concat(str2);
            var a = document.createElement('a');
            a.style.display = 'none';
            a.href = videoUrlNew;
            a.download = "下载" + devCode + "_"+time + '.ps';

            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }
        }
      }); // let index = videoUrlNew.indexOf('?')
      // let str1 = videoUrlNew.slice(0,index)
      // let str2 = videoUrlNew.slice(index)
      // videoUrlNew = `${str1}/${devCode}_${time}.ps${str2}`
    } else {
      if (videoUrl.indexOf("sessionId") >= 0) {
        videoUrl = replaceParamVal(videoUrl, "sessionId", sessionId);
        $("#" + self.rongqiId + " #videoPlayer" + num).attr("data-videourl-down", videoUrl);
      } else {
        videoUrlNew += '&sessionId' + sessionId;
      }

      var videoUrlNew = videoUrl + '&redirect=false';
      $.ajax({
        url: videoUrlNew,
        //请求的url地址
        type: "GET",
        success: function success(result) {
          if (['401', '403'].includes(result.resultCode)) {
            var eventContext = {
              windowIndex: num,
              errorCode: '403'
            };
            execute(self.returnFuc, '403', eventContext);
          }

          if (result && result.resultCode == 301) {
            videoUrlNew = result.location || result.Location; // xiazaidaili? ???

            if (self.proxyIp) {
              // 启用视频代理
              var _index = videoUrlNew.indexOf('/', 8);

              videoUrlNew = self.proxyIp + videoUrlNew.slice(_index);
            }

            var now = new Date();
            var time = '-' + now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate() + '-' + now.getHours() + ':' + now.getMinutes() + ':' + now.getSeconds();
            videoUrlNew = videoUrlNew.replace('format=mp4', 'format=ps').replace('format=MP4', 'format=ps'); // function downloadFile(url, fileName) {
            // 	const x = new XMLHttpRequest()
            // 	x.open("GET", url, true)
            // 	x.responseType = 'blob'
            // 	x.onload=function(e) {
            // 			const url = window.URL.createObjectURL(x.response)
            // 			const a = document.createElement('a')
            // 			a.href = url
            // 			a.target = '_blank'
            // 			a.download = fileName
            // 			a.click()
            // 			a.remove()
            // 	}
            // 	x.send()
            // }
            // downloadFile(videoUrlNew,"下载" + devCode + "_"+time + '.ps')

            // var index = videoUrlNew.indexOf('?');
            // var str1 = videoUrlNew.slice(0, index);
            // var str2 = videoUrlNew.slice(index);
            // videoUrlNew = "".concat(str1, "/").concat(devCode, "_").concat(time, ".ps").concat(str2);
            var a = document.createElement('a');
            a.style.display = 'none';
            a.href = videoUrlNew; 
            a.download = "下载" + devCode + "_"+time + '.ps';

            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }
        },
        error: function error(result) {
          console.log(result);
        }
      });
    }
  }

  if (statusNow === "2" && videoUrl) {
    if (videoUrl.indexOf('directurl') > 0) {
      //如果关闭地址外部直接传进来
      var videoUrlDown = $("#" + self.rongqiId + " #videoPlayer" + num).attr("data-videourl-down");
      var _sessionId = self['playerInfo' + num].downloadSession;

      var url = self.gatewayURL + "/uvp-micro-service/mediatranscode/api/v1/playControl?ak=" + self.ak + "&token=" + self.token + "&timestamp=" + new Date().getTime() + "&nonce=" + _sessionId + "&sessionId=" + _sessionId;

      var obj = {
        sessionId: _sessionId,
        cmd: "stop",
        scale: "",
        range: ""
      };
      $.ajax({
        url: url,
        type: "post",
        data: JSON.stringify(obj),
        contentType: 'application/json',
        success: function success(result) {
          if (result && JSON.parse(result).ResultCode == 200) {
            console.log("后台关闭流成功");
          }
        },
        error: function error(err) {
          console.log("后台关闭流失败");
        },
        complete: function complete(xhr, textStatus) {
          if (xhr.getResponseHeader('sessionstate') == 'tokenTimeout' || xhr.getResponseHeader('sessionstate') == 'timeout' || xhr.getResponseHeader('sessionstate') == 'nouser') {
            window.top.postMessage({
              key: "loginOut",
              value: ""
            }, "*");
          }
        }
      });
    } else {
      var videoUrlDown = $("#" + self.rongqiId + " #videoPlayer" + num).attr("data-videourl-down");
      var _sessionId2 = self['playerInfo' + num].downloadSession;

      var _url = self.gatewayURL + "/uvp-micro-service/mediatranscode/api/v1/playControl?ak=" + self.ak + "&token=" + self.token + "&timestamp=" + new Date().getTime() + "&nonce=" + _sessionId2 + "&sessionId=" + _sessionId2;

      var _obj = {
        sessionId: _sessionId2,
        cmd: "stop",
        scale: "",
        range: ""
      };
      $.ajax({
        url: _url,
        type: "post",
        data: JSON.stringify(_obj),
        contentType: 'application/json',
        success: function success(result) {
          if (result.resultCode == 200) {
            console.log("后台关闭流成功");
          }
        },
        error: function error(err) {
          console.log("后台关闭流失败");
        },
        complete: function complete(xhr, textStatus) {
          if (xhr.getResponseHeader('sessionstate') == 'tokenTimeout' || xhr.getResponseHeader('sessionstate') == 'timeout' || xhr.getResponseHeader('sessionstate') == 'nouser') {
            window.top.postMessage({
              key: "loginOut",
              value: ""
            }, "*");
          }
        }
      });
    }
  }
}

function stickTop(num, self) {
  var status = Number($("#" + self.rongqiId + " img#stickBtn" + num).attr("data-status"));

  if (status == 0) {
    $("#" + self.rongqiId + " img#stickBtn" + num).attr({
      "data-status": "1",
      "src": "".concat(window.top.__BASE_LOCATION__, "images/realVideoImages/sticking.png")
    });
  } else if (status == 1) {
    $("#" + self.rongqiId + " img#stickBtn" + num).attr({
      "data-status": "0",
      "src": "".concat(window.top.__BASE_LOCATION__, "images/realVideoImages/stick.png")
    });
  }
}

function picSave(num, self) {
  if (self.playerObj["player".concat(num)]) {
    var devCode = self['playerInfo' + num].devCode;
    var time = new Date().Format("yyyy-MM-dd HH:mm:ss");
    var fileName = devCode + "_" + time;
    return savePic(fileName, "#" + self.rongqiId + " div#canvasPlayerCont" + num + " canvas", "h265", self.playerObj["player".concat(num)]);
  } else if (self.playerObj["videoPlayer".concat(num)]) {
    var devCode = self['playerInfo' + num].devCode;
    var time = new Date().Format("yyyy-MM-dd HH:mm:ss");
    var fileName = devCode + "_" + time;
    return savePic(fileName, "#" + self.rongqiId + " #videoPlayer" + num, "", self.playerObj["videoPlayer".concat(num)]);
  }
} // 重连黑屏 （未用到）


function reconnect(num, self) {
  var packageMethod = self['playerInfo' + num].packageMethod;
  var devCode = self['playerInfo' + num].devCode;
  var videoUrl = self['playerInfo' + num].videoUrl;
  var videoTalkUrl = self['playerInfo' + num].videoTalkUrl;
  var showName = self['playerInfo' + num].showName;
  var streamType = self['playerInfo' + num].streamType; //关闭后台

  var sessionid = self['playerInfo' + num].sessionId;
  videoUrl = videoUrl.replace(sessionid, generateUUID());
  var captureImg = captureFuc(num, self);
  var w = $(".videoBox".concat(num)).width();
  var h = $(".videoBox".concat(num)).height();
  var url = self.gatewayURL + "/uvpMircoServer/media/control?token=" + self.token + "&cmd=stop&sessionid=" + sessionid + "&time=" + new Date().getTime();
  $.ajax({
    url: url,
    type: "GET",
    xhrFields: {
      withCredentials: true
    },
    crossDomain: true,
    success: function success(result) {
      if (result && JSON.parse(result).ResultCode == 200) {
        console.log("后台关闭流成功");
        $("#".concat(self.rongqiId, " #picImgCL").concat(num)).width(w + 'px');
        $("#".concat(self.rongqiId, " #picImgCL").concat(num)).height(h + 'px');
        $("#".concat(self.rongqiId, " #picImgCL").concat(num)).attr({
          'src': captureImg
        }).removeClass('hide');
        videoObjPlay(num, packageMethod, devCode, videoUrl, videoTalkUrl, showName, streamType, self);
      }
    },
    error: function error(err) {
      console.log("后台关闭流失败");
      var i = 0;
      var timer = setInterval(function () {
        console.log("后台关闭流失败````````````````");
        var elevideo = document.getElementById("videoPlayer".concat(num));
        elevideo.addEventListener('playing', function () {
          $("#".concat(self.rongqiId, " #picImgCL").concat(num)).attr({
            'src': ''
          }).addClass('hide');
          clearInterval(timer);
        });
        $("#".concat(self.rongqiId, " #picImgCL").concat(num)).width(w + 'px');
        $("#".concat(self.rongqiId, " #picImgCL").concat(num)).height(h + 'px');
        $("#".concat(self.rongqiId, " #picImgCL").concat(num)).attr({
          'src': captureImg
        }).removeClass('hide');
        videoObjPlay(num, packageMethod, devCode, videoUrl, videoTalkUrl, showName, streamType, self);
        i += 1;

        if (i >= 3) {
          clearInterval(timer);
        }
      }, 2000);
    },
    complete: function complete(xhr, textStatus) {
      if (xhr.getResponseHeader('sessionstate') == 'tokenTimeout' || xhr.getResponseHeader('sessionstate') == 'timeout' || xhr.getResponseHeader('sessionstate') == 'nouser') {
        window.top.postMessage({
          key: "loginOut",
          value: ""
        }, "*");
      }
    }
  });
} //重连保持保存最后一帧


function captureFuc(num, self) {
  var picurl = '';

  if ($("#" + self.rongqiId + " #canvasPlayer" + num).attr("data-status") == 1 && self.playerObj["player" + num]) {
    var devCode = self['playerInfo' + num].devCode;
    var time = new Date().Format("yyyy-MM-dd HH:mm:ss");
    var fileName = devCode + "_" + time;
    picurl = savePicCL(fileName, "#" + self.rongqiId + " div#canvasPlayerCont" + num + " canvas", "h265", self.playerObj["player" + num]);
  } else if (self.playerObj["videoPlayer" + num]) {
    var devCode = self['playerInfo' + num].devCode;
    var time = new Date().Format("yyyy-MM-dd HH:mm:ss");
    var fileName = devCode + "_" + time;
    picurl = savePicCL(fileName, "#" + self.rongqiId + " #videoPlayer" + num, "", self.playerObj["videoPlayer" + num]);
  }

  picurl = "data:image/png;base64," + picurl;
  return picurl;
} // 重连保存最后一帧方法


function savePicCL(fileName, videoDomId, type, player) {
  var cutPicUrl = "";
  var fileType = "png"; // 如果文件名中没有带后缀，默认使用png

  switch (fileName) {
    // 判断保存的图片格式
    case fileName.indexOf("png") > -1:
      fileType = "png";
      break;

    case fileName.indexOf("jpg") > -1:
      fileType = "jpg";
      break;

    case fileName.indexOf("jpeg") > -1:
      fileType = "jpeg";
      break;

    case fileName.indexOf("bmp") > -1:
      fileType = "bmp";
      break;

    case fileName.indexOf("gif") > -1:
      fileType = "gif";
      break;

    default:
      fileType = "png";
      break;
  }

  var video = document.querySelector(videoDomId);
  var canvas = window.canvas = document.createElement("canvas");
  var webglPlayer = "";

  if (type === "h265") {
    canvas.width = video.clientWidth;
    canvas.height = video.clientHeight; // canvas.width = video.width;
    // canvas.height = video.height;

    if (player.cutPicJson === "") {} else {
      var arrayBuffer = player.cutPicJson.data;
      var videoWidth = player.cutPicJson.videoWidth;
      var videoHeight = player.cutPicJson.videoHeight;
      var yLength = player.cutPicJson.yLength;
      var uvLength = player.cutPicJson.uvLength;
      webglPlayer = new WebGLPlayer(canvas, {
        preserveDrawingBuffer: true
      });
      webglPlayer.renderFrame(arrayBuffer, videoWidth, videoHeight, yLength, uvLength);
      player.cutPicJson = '';
      var strDataURL = canvas.toDataURL();
      var arr = strDataURL.split(','),
          cutPicUrl = arr[1],
          mime = arr[0].match(/:(.*?);/)[1],
          bstr = atob(arr[1]),
          n = bstr.length,
          u8arr = new Uint8Array(n);

      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }

      var blob = new Blob([u8arr], {
        type: mime
      });
      var url = window.URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      var t = setTimeout(function () {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        clearTimeout(t);
      }, 1000);
    }
  } else {
    canvas.width = video.clientWidth;
    canvas.height = video.clientHeight; // canvas.width = video.videoWidth;
    // canvas.height = video.videoHeight;

    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height); // 图片大小和视频分辨率一致

    var strDataURL = canvas.toDataURL('image/png');
    var arr = strDataURL.split(',');
    var cutPicUrl = arr[1];
  }

  return cutPicUrl;
} // uvp-bai


function generateUUID() {
  var d = new Date().getTime();
  var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = (d + Math.random() * 16) % 16 | 0;
    d = Math.floor(d / 16);
    return (c == 'x' ? r : r & 0x3 | 0x8).toString(16);
  });
  return uuid;
}

function replaceParamVal(oUrl, paramName, replaceWith) {
  var re = eval('/(' + paramName + '=)([^&]*)/gi');
  var nUrl = oUrl.replace(re, paramName + '=' + replaceWith);
  return nUrl;
}

function GetQueryString(url, name) {
  var reg = new RegExp("(^|&?)" + name + "=([^&]*)(&|$)");
  var r = url.match(reg);

  if (r != null) {
    return unescape(r[2]);
  }

  return null;
} //添加右键菜单


function addRightMenu(ev, self) {
  ev.preventDefault(); //正常版本
  // if(self.objType == 'replay'){
  // 	return
  // }

  var num = self.playingSelectedWinNum;
  var isBoFang = self.playerObj["videoPlayer".concat(num)] || self.playerObj["player".concat(num)] || null;

  if (!isBoFang) {
    return;
  }

  var menuArr = self.menuArr;

  if ($(".rightMenu").length) {
    $(".rightMenu").remove();
  }

  var addstr = '';
  var isAdd = true;

  for (var i = 0; i < menuArr.length; i++) {
    for (var j = 0; j < self.showMenuArr.length; j++) {
      if (self.showMenuArr[j].num == num && menuArr[i].menuCode == self.showMenuArr[j].menuCode && self.showMenuArr[j].isShow == false) {
        isAdd = false;
      }
    }

    if (isAdd) {
      addstr += "<div id=".concat(menuArr[i].menuCode, " class='menuItem'>").concat(menuArr[i].menuName, "</div>");
    } else {
      isAdd = true;
    }
  }

  var html = "<div class='rightMenu' style=\"left:0px;top:0px;display:none\">";
  html += addstr;
  html += "</div>";
  $("#" + self.rongqiId + " .videoZoomIE").append(html);
  var boxWidth = $('.videoZoomIE').width();
  var boxHeight = $('.videoZoomIE').height();
  var offsetLeft = ev.x - document.querySelector(".videoZoomIE").getBoundingClientRect().left;
  var offsetTop = ev.y - document.querySelector(".videoZoomIE").getBoundingClientRect().top;
  var menuWidth = $('.rightMenu').width();
  var menuHeight = $('.rightMenu').height();

  if (offsetLeft * 2 > boxWidth) {
    offsetLeft = offsetLeft - menuWidth;
  }

  if (offsetTop * 2 > boxHeight) {
    offsetTop = offsetTop - menuHeight;
  }

  document.querySelector('.rightMenu').style.left = offsetLeft + 'px';
  document.querySelector('.rightMenu').style.top = offsetTop + 'px';
  document.querySelector('.rightMenu').style.display = 'block';
  var devCode = self['playerInfo' + num].devCode;
  var showName = self['playerInfo' + num].showName;
  var streamType = self['playerInfo' + num].streamType;
  var packageMethod = self['playerInfo' + num].packageMethod;
  $(".rightMenu .menuItem").click(function (e) {
    document.getElementsByClassName('rightMenu')[0].style.display = 'none';

    if (e.target.innerHTML === "关闭当前视频") {
      videoObjClose(num, self, true);
    } else if (e.target.innerHTML === "关闭所有视频") {
      self.closeAllVideo();
    } else if (e.target.innerHTML === "工况信息") {
      $.ajax({
        data: JSON.stringify({
          devCode: devCode
        }),
        dataType: "json",
        contentType: 'application/json',
        crossDomain: true,
        url: self.gatewayURL + "/uvp-backend-common/api/v1/resource/call?ak=".concat(self.ak, "&token=").concat(self.token),
        type: "post",
        success: function success(result) {
          if (result.successful) {
            var _result$resultValue2;

            var length = ((_result$resultValue2 = result.resultValue) === null || _result$resultValue2 === void 0 ? void 0 : _result$resultValue2.length) || 0;
            var msg = "<div class=\"title\">\n\t\t\t\t\t\t\t\t\t\t\t\t\t<span>\u5DE5\u51B5\u4FE1\u606F</span>\n\t\t\t\t\t\t\t\t\t\t\t\t\t<div  id=\"infoClose\">\n\t\t\t\t\t\t\t\t\t\t\t\t\t\t<img style=\"object-fit: contain;\" src='".concat(window.top.__BASE_LOCATION__, "images/realVideoImages/closeVideo.png' alt='' title='\u5173\u95ED' />\n\t\t\t\t\t\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t\t\t\t\t\t</div>\n\t\t\t\t\t\t\t\t\t\t\t\t<div class=\"info\">\n\t\t\t\t\t\t\t\t\t\t\t\t\t<div><span class=\"subTitle\">\u89C6\u9891\u540D\u79F0\uFF1A</span><span>").concat(showName, "</span></div>\n\t\t\t\t\t\t\t\t\t\t\t\t\t<div><span class=\"subTitle\">\u89C6\u9891\u7F16\u7801\uFF1A</span><span>").concat(devCode, "</span></div>\n\t\t\t\t\t\t\t\t\t\t\t\t\t<div><span class=\"subTitle\">\u89E3\u7801\u6807\u7B7E\uFF1A</span><span>").concat(packageMethod, "</span></div>\n\t\t\t\t\t\t\t\t\t\t\t\t\t<div><span class=\"subTitle\">\u89C6\u9891\u8FDE\u63A5\u6570\uFF1A</span><span>").concat(length, "</span></div>\n\t\t\t\t\t\t\t\t\t\t\t\t\t<div><span class=\"subTitle\">\u89C6\u9891\u901F\u5EA6\uFF1A</span><span id='malv").concat(num, "'></span></div>\n\t\t\t\t\t\t\t\t\t\t\t\t</div>");
            $("#maskBox").show();
            $("#videoInfo").html(msg).show();
            $("#" + self.rongqiId + " #infoClose").click(function () {
              $("#videoInfo").hide();
              $("#maskBox").hide();
            });
          }
        },
        error: function error(err) {
          console.log("数据获取失败", err);
        },
        complete: function complete(xhr, textStatus) {
          if (xhr.getResponseHeader('sessionstate') == 'tokenTimeout' || xhr.getResponseHeader('sessionstate') == 'timeout' || xhr.getResponseHeader('sessionstate') == 'nouser') {
            window.top.postMessage({
              key: "loginOut",
              value: ""
            }, "*");
          }
        }
      });
    } else if (e.target.innerHTML === "软解播放") {
      if (packageMethod === 'h265') {
        videoObjPlay265(self.playingSelectedWinNum, self, '软解播放');
      } else {
        videoObjPlay264(self.playingSelectedWinNum, self, '软解播放');
      }
    } else if (e.target.innerHTML === "硬解播放") {
      if (packageMethod === 'h265') {
        videoObjPlay265(self.playingSelectedWinNum, self, '硬解播放');
      } else {
        videoObjPlay264(self.playingSelectedWinNum, self, '硬解播放');
      }
    }

    var eventType = '106';
    var eventContext = {
      windowIndex: num,
      devCode: devCode,
      showName: showName,
      streamType: streamType,
      menuCode: e.target.id,
      menuArr: menuArr
    };
    execute(self.returnFuc, eventType, eventContext);
  });
}