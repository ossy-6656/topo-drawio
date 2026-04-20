function PTZControl(i, e, o, t, d, s, n, h, r) {
  return h ? r ? void $.ajax({
      url: h,
      type: "post",
      contentType: "application/json",
      data: JSON.stringify({
          sessionId: r,
          code: o,
          cmd: t,
          param1: d,
          param2: s
      }),
      crossDomain: !0,
      success: function(i) {
          console.log("yuntaifahui", i),
          i && (i = {
              success: i,
              cmd: t,
              num: n.playingSelectedWinNum
          },
          execute(n.returnFuc, "107", i))
      },
      error: function(i) {
          i = {
              error: "云台控制错误，错误代码：" + i.ResultCode + ";错误描述：" + i.Description,
              cmd: t,
              num: n.playingSelectedWinNum
          };
          execute(n.returnFuc, "107", i)
      },
      complete: function(i, e) {
          console.log("网关请求结束：", i.getResponseHeader("sessionstate")),
          "tokenTimeout" != i.getResponseHeader("sessionstate") && "timeout" != i.getResponseHeader("sessionstate") && "nouser" != i.getResponseHeader("sessionstate") || (console.log("重置token"),
          window.top.postMessage({
              key: "loginOut",
              value: ""
          }, "*"))
      }
  }) : e ? o ? t ? isNaN(d) || d < 1 || 9 < d ? (console.log("行速度参数不合法,速度控制失败"),
  -1) : isNaN(s) || s < 1 || 9 < s ? (console.log("列速度参数不合法,速度控制失败"),
  -1) : (h = i + "/cameracontrol?token=" + e + "&code=" + o + "&cmd=" + t + "&param1=" + d + "&param2=" + s,
  void $.ajax({
      url: h,
      type: "GET",
      xhrFields: {
          withCredentials: !0
      },
      crossDomain: !0,
      success: function(i) {
          console.log("yuntaifahui", i),
          i && (i = {
              success: i,
              cmd: t,
              num: n.playingSelectedWinNum
          },
          execute(n.returnFuc, "107", i))
      },
      error: function(i) {
          i = {
              error: "云台控制错误，错误代码：" + i.ResultCode + ";错误描述：" + i.Description,
              cmd: t,
              num: n.playingSelectedWinNum
          };
          execute(n.returnFuc, "107", i)
      },
      complete: function(i, e) {
          console.log("网关请求结束：", i.getResponseHeader("sessionstate")),
          "tokenTimeout" != i.getResponseHeader("sessionstate") && "timeout" != i.getResponseHeader("sessionstate") && "nouser" != i.getResponseHeader("sessionstate") || (console.log("重置token"),
          window.top.postMessage({
              key: "loginOut",
              value: ""
          }, "*"))
      }
  })) : (console.log("控制指令不存在,云台控制失败"),
  -1) : (console.log("设备编码不存在,云台控制失败"),
  -1) : (console.log("token不存在,云台控制失败"),
  -1) : e ? o ? t ? isNaN(d) || d < 1 || 9 < d ? (console.log("行速度参数不合法,速度控制失败"),
  -1) : isNaN(s) || s < 1 || 9 < s ? (console.log("列速度参数不合法,速度控制失败"),
  -1) : (h = i + "/uvpMircoServer/cameracontrol?token=" + e + "&code=" + o + "&cmd=" + t + "&param1=" + d + "&param2=" + s,
  void $.ajax({
      url: h,
      type: "GET",
      xhrFields: {
          withCredentials: !0
      },
      crossDomain: !0,
      success: function(i) {
          console.log("yuntaifahui", i),
          i && (i = {
              success: i,
              cmd: t,
              num: n.playingSelectedWinNum
          },
          execute(n.returnFuc, "107", i))
      },
      error: function(i) {
          i = {
              error: "云台控制错误，错误代码：" + i.ResultCode + ";错误描述：" + i.Description,
              cmd: t,
              num: n.playingSelectedWinNum
          };
          execute(n.returnFuc, "107", i)
      },
      complete: function(i, e) {
          console.log("网关请求结束：", i.getResponseHeader("sessionstate")),
          "tokenTimeout" != i.getResponseHeader("sessionstate") && "timeout" != i.getResponseHeader("sessionstate") && "nouser" != i.getResponseHeader("sessionstate") || (console.log("重置token"),
          window.top.postMessage({
              key: "loginOut",
              value: ""
          }, "*"))
      }
  })) : (console.log("控制指令不存在,云台控制失败"),
  -1) : (console.log("设备编码不存在,云台控制失败"),
  -1) : (console.log("token不存在,云台控制失败"),
  -1)
}
function doScreenChange(i, e, o, t, d) {
  if (console.log("设置" + i + "分屏，tuchu:" + e + "，hang:" + t + "，lie:" + d),
  "tuchu" <= e)
      return s = e.slice(5),
      $("#" + o.rongqiId + " div.videoBox").hide(),
      $("#" + o.rongqiId + " div.videoBox" + s).show(),
      $("#" + o.rongqiId + " div.videoBox").addClass("tuchu"),
      5 != i && 6 != i || t || d || 3 == s && $("#" + o.rongqiId + " .videoBox3").css({
          left: "0",
          top: "0"
      }),
      void (7 != i && 8 != i || t || d || (3 == s ? $("#" + o.rongqiId + " .videoBox3").css({
          left: "0",
          top: "0"
      }) : 4 == s && $("#" + o.rongqiId + " .videoBox4").css({
          left: "0",
          top: "0"
      })));
  if (0 <= e.indexOf("exittuchu"))
      return $("#" + o.rongqiId + " div.videoBox").show(),
      $("#" + o.rongqiId + " div.videoBox").removeClass("tuchu"),
      s = e.slice(9),
      5 != i && 6 != i || t || d || 3 == s && $("#" + o.rongqiId + " .videoBox3").css({
          left: "66.66%",
          top: "33.33%"
      }),
      void (7 != i && 8 != i || t || d || (3 == s ? $("#" + o.rongqiId + " .videoBox3").css({
          left: "75%",
          top: "25%"
      }) : 4 == s && $("#" + o.rongqiId + " .videoBox4").css({
          left: "75%",
          top: "50%"
      })));
  if ($("#" + o.rongqiId + " div.videoBox").hasClass("tuchu") && ($("#" + o.rongqiId + " div.videoBox").show(),
  $("#" + o.rongqiId + " div.videoBox").removeClass("tuchu")),
  $("#" + o.rongqiId + " .videoBox3,.videoBox4,.videoBox6,.videoBox7,.videoBox8,.videoBox9").css({
      position: "relative",
      left: "0",
      top: "0"
  }),
  i && t && d) {
      for (var s = 1; s <= 16; s++)
          $("#" + o.rongqiId + " div.videoBox" + s).show(),
          i < s && $("#" + o.rongqiId + " div.videoBox" + s).hide();
      return 1 == i ? (1 == t && $("#" + o.rongqiId + " div.videoBox").css({
          width: "100%",
          height: "100%"
      }),
      1) : 2 == i ? (1 == t && 2 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "50%",
          height: "100%"
      }),
      2 == t && 1 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "100%",
          height: "50%"
      }),
      2) : 3 == i ? (1 == t && 3 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "33.3%",
          height: "100%"
      }),
      2 == t && 2 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "50%",
          height: "50%"
      }),
      3 == t && 1 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "100%",
          height: "33.3%"
      }),
      3) : 4 == i ? (1 == t && 4 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "25%",
          height: "100%"
      }),
      2 == t && 3 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "33.3%",
          height: "50%"
      }),
      2 == t && 2 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "50%",
          height: "50%"
      }),
      4 == t && 1 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "100%",
          height: "25%"
      }),
      4) : 5 == i ? (1 == t && 5 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "20%",
          height: "100%"
      }),
      2 == t && 4 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "25%",
          height: "50%"
      }),
      2 == t && 3 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "33.3%",
          height: "50%"
      }),
      3 == t && 2 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "50%",
          height: "33.3%"
      }),
      5 == t && 1 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "100%",
          height: "20%"
      }),
      5) : 6 == i ? (1 == t && 6 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "16.6%",
          height: "100%"
      }),
      2 == t && 5 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "20%",
          height: "50%"
      }),
      2 == t && 4 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "25%",
          height: "50%"
      }),
      2 == t && 3 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "33.3%",
          height: "50%"
      }),
      3 == t && 2 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "50%",
          height: "33.3%"
      }),
      6 == t && 1 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "100%",
          height: "16.6%"
      }),
      6) : 7 == i ? (1 == t && 7 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "14.28%",
          height: "100%"
      }),
      2 == t && 6 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "16.66%",
          height: "50%"
      }),
      2 == t && 5 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "20%",
          height: "50%"
      }),
      2 == t && 4 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "25%",
          height: "50%"
      }),
      3 == t && 3 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "33.3%",
          height: "33.3%"
      }),
      4 == t && 2 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "50%",
          height: "25%"
      }),
      7 == t && 1 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "100%",
          height: "14.28%"
      }),
      7) : 8 == i ? (1 == t && 8 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "12.5%",
          height: "100%"
      }),
      2 == t && 7 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "14.28%",
          height: "50%"
      }),
      2 == t && 6 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "16.66%",
          height: "50%"
      }),
      2 == t && 5 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "20%",
          height: "50%"
      }),
      2 == t && 4 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "25%",
          height: "50%"
      }),
      3 == t && 3 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "33.3%",
          height: "33.3%"
      }),
      4 == t && 2 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "50%",
          height: "25%"
      }),
      8 == t && 1 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "100%",
          height: "12.5%"
      }),
      8) : 9 == i ? (1 == t && 9 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "11.1%",
          height: "100%"
      }),
      2 == t && 8 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "12.5%",
          height: "50%"
      }),
      2 == t && 7 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "14.28%",
          height: "50%"
      }),
      2 == t && 6 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "16.66%",
          height: "50%"
      }),
      2 == t && 5 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "20%",
          height: "50%"
      }),
      3 == t && 4 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "25%",
          height: "33.3%"
      }),
      3 == t && 3 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "33.3%",
          height: "33.3%"
      }),
      5 == t && 2 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "50%",
          height: "20%"
      }),
      9 == t && 1 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "100%",
          height: "11.1%"
      }),
      9) : 10 == i ? (1 == t && 10 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "10%",
          height: "100%"
      }),
      2 == t && 9 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "11.1%",
          height: "50%"
      }),
      2 == t && 8 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "12.5%",
          height: "50%"
      }),
      2 == t && 7 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "14.28%",
          height: "50%"
      }),
      2 == t && 6 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "16.66%",
          height: "50%"
      }),
      2 == t && 5 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "20%",
          height: "50%"
      }),
      3 == t && 4 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "25%",
          height: "33.3%"
      }),
      4 == t && 3 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "33.3%",
          height: "25%"
      }),
      5 == t && 2 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "50%",
          height: "20%"
      }),
      10 == t && 1 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "100%",
          height: "10%"
      }),
      10) : 11 == i ? (1 == t && 11 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "9.09%",
          height: "100%"
      }),
      2 == t && 10 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "10%",
          height: "50%"
      }),
      2 == t && 9 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "11.1%",
          height: "50%"
      }),
      2 == t && 8 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "12.5%",
          height: "50%"
      }),
      2 == t && 7 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "14.28%",
          height: "50%"
      }),
      2 == t && 6 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "16.66%",
          height: "50%"
      }),
      2 == t && 5 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "20%",
          height: "50%"
      }),
      3 == t && 4 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "25%",
          height: "33.3%"
      }),
      4 == t && 3 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "33.3%",
          height: "25%"
      }),
      6 == t && 2 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "50%",
          height: "16.66%"
      }),
      11 == t && 1 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "100%",
          height: "9.09%"
      }),
      11) : 12 == i ? (1 == t && 12 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "8.33%",
          height: "100%"
      }),
      2 == t && 11 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "9.09%",
          height: "50%"
      }),
      2 == t && 10 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "10%",
          height: "50%"
      }),
      2 == t && 9 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "11.1%",
          height: "50%"
      }),
      2 == t && 8 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "12.5%",
          height: "50%"
      }),
      2 == t && 7 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "14.28%",
          height: "50%"
      }),
      2 == t && 6 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "16.66%",
          height: "50%"
      }),
      3 == t && 5 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "20%",
          height: "33.3%"
      }),
      3 == t && 4 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "25%",
          height: "33.3%"
      }),
      4 == t && 3 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "33.3%",
          height: "25%"
      }),
      6 == t && 2 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "50%",
          height: "16.66%"
      }),
      12 == t && 1 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "100%",
          height: "8.33%"
      }),
      12) : 13 == i ? (1 == t && 13 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "7.69%",
          height: "100%"
      }),
      2 == t && 12 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "8.33%",
          height: "50%"
      }),
      2 == t && 11 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "9.09%",
          height: "50%"
      }),
      2 == t && 10 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "10%",
          height: "50%"
      }),
      2 == t && 9 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "11.1%",
          height: "50%"
      }),
      2 == t && 8 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "12.5%",
          height: "50%"
      }),
      2 == t && 7 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "14.28%",
          height: "50%"
      }),
      3 == t && 6 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "16.66%",
          height: "33.3%"
      }),
      3 == t && 5 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "20%",
          height: "33.3%"
      }),
      4 == t && 4 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "25%",
          height: "25%"
      }),
      5 == t && 3 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "33.3%",
          height: "20%"
      }),
      7 == t && 2 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "50%",
          height: "14.28%"
      }),
      13 == t && 1 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "100%",
          height: "7.69%"
      }),
      13) : 14 == i ? (1 == t && 14 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "7.14%",
          height: "100%"
      }),
      2 == t && 13 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "7.69%",
          height: "50%"
      }),
      2 == t && 12 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "8.33%",
          height: "50%"
      }),
      2 == t && 11 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "9.09%",
          height: "50%"
      }),
      2 == t && 10 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "10%",
          height: "50%"
      }),
      2 == t && 9 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "11.1%",
          height: "50%"
      }),
      2 == t && 8 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "12.5%",
          height: "50%"
      }),
      2 == t && 7 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "14.28%",
          height: "50%"
      }),
      3 == t && 6 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "16.66%",
          height: "33.3%"
      }),
      3 == t && 5 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "20%",
          height: "33.3%"
      }),
      4 == t && 4 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "25%",
          height: "25%"
      }),
      5 == t && 3 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "33.3%",
          height: "20%"
      }),
      7 == t && 2 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "50%",
          height: "14.28%"
      }),
      14 == t && 1 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "100%",
          height: "7.14%"
      }),
      14) : 15 == i ? (1 == t && 15 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "6.66%",
          height: "100%"
      }),
      2 == t && 14 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "7.14%",
          height: "50%"
      }),
      2 == t && 13 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "7.69%",
          height: "50%"
      }),
      2 == t && 12 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "8.33%",
          height: "50%"
      }),
      2 == t && 11 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "9.09%",
          height: "50%"
      }),
      2 == t && 10 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "10%",
          height: "50%"
      }),
      2 == t && 9 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "11.1%",
          height: "50%"
      }),
      2 == t && 8 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "12.5%",
          height: "50%"
      }),
      3 == t && 7 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "14.28%",
          height: "33.3%"
      }),
      3 == t && 6 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "16.66%",
          height: "33.3%"
      }),
      3 == t && 5 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "20%",
          height: "33.3%"
      }),
      4 == t && 4 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "25%",
          height: "25%"
      }),
      5 == t && 3 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "33.3%",
          height: "20%"
      }),
      8 == t && 2 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "50%",
          height: "12.5%"
      }),
      15 == t && 1 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "100%",
          height: "6.66%"
      }),
      15) : 16 == i ? (1 == t && 16 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "6.25%",
          height: "100%"
      }),
      2 == t && 15 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "6.66%",
          height: "50%"
      }),
      2 == t && 14 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "7.14%",
          height: "50%"
      }),
      2 == t && 13 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "7.69%",
          height: "50%"
      }),
      2 == t && 12 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "8.33%",
          height: "50%"
      }),
      2 == t && 11 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "9.09%",
          height: "50%"
      }),
      2 == t && 10 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "10%",
          height: "50%"
      }),
      2 == t && 9 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "11.1%",
          height: "50%"
      }),
      2 == t && 8 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "12.5%",
          height: "50%"
      }),
      3 == t && 7 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "14.28%",
          height: "33.3%"
      }),
      3 == t && 6 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "16.66%",
          height: "33.3%"
      }),
      3 == t && 5 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "20%",
          height: "33.3%"
      }),
      4 == t && 4 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "25%",
          height: "25%"
      }),
      6 == t && 3 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "33.3%",
          height: "16.66%"
      }),
      8 == t && 2 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "50%",
          height: "12.5%"
      }),
      16 == t && 1 == d && $("#" + o.rongqiId + " div.videoBox").css({
          width: "100%",
          height: "6.25%"
      }),
      16) : void 0
  }
  for (s = 1; s <= 16; s++)
      $("#" + o.rongqiId + " div.videoBox" + s).show(),
      i < s && $("#" + o.rongqiId + " div.videoBox" + s).hide();
  return 1 == i ? ($("#" + o.rongqiId + " div.videoBox").css({
      width: "100%",
      height: "100%"
  }),
  1) : 2 == i ? ($("#" + o.rongqiId + " div.videoBox").css({
      width: "50%",
      height: "100%"
  }),
  2) : 3 == i || 4 == i ? ($("#" + o.rongqiId + " div.videoBox").css({
      width: "50%",
      height: "50%"
  }),
  4) : 5 == i || 6 == i ? ($("#" + o.rongqiId + " .videoBox1").css({
      width: "66.66%",
      height: "66.66%"
  }),
  $("#" + o.rongqiId + " .videoBox2").css({
      width: "33.33%",
      height: "33.33%"
  }),
  $("#" + o.rongqiId + " .videoBox4").css({
      width: "33.33%",
      height: "33.33%"
  }),
  $("#" + o.rongqiId + " .videoBox5").css({
      width: "33.33%",
      height: "33.33%"
  }),
  $("#" + o.rongqiId + " .videoBox6").css({
      width: "33.33%",
      height: "33.33%"
  }),
  $("#" + o.rongqiId + " .videoBox3").css({
      position: "absolute",
      left: "66.66%",
      top: "33.33%",
      width: "33.33%",
      height: "33.33%"
  }),
  6) : 7 == i || 8 == i ? ($("#" + o.rongqiId + " div.videoBox").css({
      width: "25%",
      height: "25%"
  }),
  $("#" + o.rongqiId + " .videoBox1").css({
      width: "75%",
      height: "75%"
  }),
  $("#" + o.rongqiId + " .videoBox3").css({
      position: "absolute",
      left: "75%",
      top: "25%"
  }),
  $("#" + o.rongqiId + " .videoBox4").css({
      position: "absolute",
      left: "75%",
      top: "50%"
  }),
  8) : 9 == i ? ($("#" + o.rongqiId + " div.videoBox").css({
      width: "33.33%",
      height: "33.33%"
  }),
  9) : 10 == i || 11 == i || 12 == i ? ($("#" + o.rongqiId + " div.videoBox").css({
      width: "25%",
      height: "33.33%"
  }),
  12) : 13 == i || 14 == i || 15 == i || 16 == i ? ($("#" + o.rongqiId + " div.videoBox").css({
      width: "25%",
      height: "25%"
  }),
  16) : void 0
}
function savePic(i, e, o, t) {
  var d = "";
  switch (i) {
  case -1 < i.indexOf("png"):
      0;
      break;
  case -1 < i.indexOf("jpg"):
      0;
      break;
  case -1 < i.indexOf("jpeg"):
      0;
      break;
  case -1 < i.indexOf("bmp"):
      0;
      break;
  case -1 < i.indexOf("gif"):
      0;
      break;
  default:
      0
  }
  var e = document.querySelector(e)
    , s = window.canvas = document.createElement("canvas");
  if ("h265" === o || "h264decode" === o) {
      if (s.width = e.width,
      s.height = e.height,
      "" !== t.cutPicJson) {
          var o = t.cutPicJson.data
            , n = t.cutPicJson.videoWidth
            , h = t.cutPicJson.videoHeight
            , r = t.cutPicJson.yLength
            , c = t.cutPicJson.uvLength;
          new WebGLPlayer(s,{
              preserveDrawingBuffer: !0
          }).renderFrame(o, n, h, r, c),
          t.cutPicJson = "";
          for (var d = (n = s.toDataURL().split(","))[1], h = n[0].match(/:(.*?);/)[1], g = (l = atob(n[1])).length, v = new Uint8Array(g); g--; )
              v[g] = l.charCodeAt(g);
          var r = new Blob([v],{
              type: h
          })
            , a = window.URL.createObjectURL(r)
            , u = ((w = document.createElement("a")).style.display = "none",
          w.href = a,
          w.download = i,
          document.body.appendChild(w),
          w.click(),
          setTimeout(function() {
              document.body.removeChild(w),
              window.URL.revokeObjectURL(a),
              clearTimeout(u)
          }, 1e3))
      }
  } else {
      s.width = e.videoWidth,
      s.height = e.videoHeight,
      s.getContext("2d").drawImage(e, 0, 0, s.width, s.height);
      for (var l, d = (n = s.toDataURL("image/png").split(","))[1], h = n[0].match(/:(.*?);/)[1], g = (l = atob(n[1])).length, v = new Uint8Array(g); g--; )
          v[g] = l.charCodeAt(g);
      var w, r = new Blob([v],{
          type: h
      }), a = window.URL.createObjectURL(r), u = ((w = document.createElement("a")).style.display = "none",
      w.href = a,
      w.download = i,
      document.body.appendChild(w),
      w.click(),
      setTimeout(function() {
          document.body.removeChild(w),
          window.URL.revokeObjectURL(a),
          clearTimeout(u)
      }, 1e3))
  }
  return d
}
function isEmpty(i) {
  return null == i || "" == (i = String(i)).trim()
}
var concat_ = function(i, e, o) {
  if (arguments.length <= 1)
      return !1;
  function t(i, e) {
      for (var o = i.concat(), t = 0; t < e.length; t++)
          -1 === o.indexOf(e[t]) && o.push(e[t]);
      return o
  }
  for (var d = t(i, e), s = 2; s < arguments.length; s++)
      d = t(d, arguments[s]);
  return d.sort(function(i, e) {
      return i - e
  })
}
, deepClone = function(i) {
  let e;
  if ("object" == typeof i)
      if (Array.isArray(i))
          for (var o in e = [],
          i)
              e.push(this.deepClone(i[o]));
      else if (null === i)
          e = null;
      else if (i.constructor === RegExp)
          e = i;
      else
          for (var t in e = {},
          i)
              e[t] = this.deepClone(i[t]);
  else
      e = i;
  return e
}
, ws = (Float32Array.prototype.concat = function() {
  var i = Array.prototype.slice.call(arguments)
    , e = (i.unshift(this),
  (i = i.map(function(i) {
      if (i instanceof Float32Array)
          return i.buffer;
      if (i instanceof ArrayBuffer) {
          if (i.byteLength / 4 % 1 != 0)
              throw new Error("One of the ArrayBuffers is not from a Float32Array");
          return i
      }
      throw new Error("You can only concat Float32Array, or ArrayBuffers")
  })).map(function(i) {
      return i.byteLength
  }).reduce(function(i, e) {
      return i + e
  }, 0))
    , o = new Float32Array(e / 4)
    , t = 0;
  return i.forEach(function(i, e) {
      o.set(new Float32Array(i), t),
      t += i.byteLength / 4
  }),
  o
}
,
Uint8Array.prototype.concat = function(i, e) {
  i = [...i, ...e];
  return Uint8Array.from(i)
}
,
null)
, record = null
, timeInte = null
, canTalk = 0
, comeRecorder = null;
function microPhoneInit() {
  navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia,
  navigator.getUserMedia ? canTalk = 1 : console.log("语音对讲仅支持https协议")
}
function useWebSocket(i) {
  i = i.replace("http", "ws"),
  (ws = new WebSocket(i)).binaryType = "arraybuffer",
  ws.onopen = function() {
      console.log("握手成功"),
      record && 1 == ws.readyState && record.start()
  }
  ,
  ws.onmessage = function(i) {
      receive(i.data)
  }
  ,
  ws.onerror = function(i) {
      console.info(i)
  }
}
function startVideoTalk(e) {
  navigator.getUserMedia({
      audio: !0,
      video: !1
  }, function(i) {
      init(new Recorders(i), e)
  }, function(i) {
      switch (console.log(i),
      i.message || i.name) {
      case "PERMISSION_DENIED":
      case "PermissionDeniedError":
          console.info("用户拒绝提供信息。");
          break;
      case "NOT_SUPPORTED_ERROR":
      case "NotSupportedError":
          console.info("浏览器不支持硬件设备。");
          break;
      case "MANDATORY_UNSATISFIED_ERROR":
      case "MandatoryUnsatisfiedError":
          console.info("无法发现指定的硬件设备。");
          break;
      default:
          console.info("无法打开麦克风。异常信息:" + (i.code || i.name))
      }
  })
}
function init(i, e) {
  (record = i) && useWebSocket(e)
}
function getVolume() {
  return +sessionStorage.getItem("volume")
}
setTimeout(function() {
  microPhoneInit()
}, 3e3);
var Recorders = function(i) {
  var e = new AudioContext
    , o = (e.createGain().gain.value = getVolume(),
  e.createMediaStreamSource(i))
    , t = e.createScriptProcessor(16384, 4, 4)
    , d = {
      size: 0,
      buffer: [],
      inputSampleRate: 48e3,
      inputSampleBits: 16,
      outputSampleRate: 8e3,
      oututSampleBits: 16,
      clear: function() {
          this.buffer = [],
          this.size = 0
      },
      input: function(i) {
          this.buffer.push(new Float32Array(i)),
          this.size += i.length
      },
      compress: function() {
          for (var i = new Float32Array(this.size), e = 0, o = 0; o < this.buffer.length; o++)
              i.set(this.buffer[o], e),
              e += this.buffer[o].length;
          for (var t = parseInt(this.inputSampleRate / this.outputSampleRate), d = i.length / t, s = new Float32Array(d), n = 0, h = 0; n < d; )
              s[n] = i[h],
              h += t,
              n++;
          return s
      },
      encodePCM: function() {
          Math.min(this.inputSampleRate, this.outputSampleRate);
          for (var i = Math.min(this.inputSampleBits, this.oututSampleBits), e = this.compress(), i = e.length * (i / 8), i = new ArrayBuffer(i), o = new DataView(i), t = 0, d = 0; d < e.length; d++,
          t += 2) {
              var s = Math.max(-1, Math.min(1, e[d]));
              o.setInt16(t, s < 0 ? 32768 * s : 32767 * s, !0)
          }
          return new Blob([o])
      }
  };
  this.sendData = function() {
      var i = new FileReader;
      i.onload = i=>{
          i = i.target.result,
          i = new Float32Array(i);
          record && ws.readyState == WebSocket.OPEN && ws.send(i)
      }
      ,
      i.readAsArrayBuffer(d.encodePCM())
  }
  ,
  this.start = function() {
      o.connect(t),
      t.connect(e.destination)
  }
  ,
  this.stop = function() {
      t.disconnect(),
      t = null
  }
  ,
  this.getBlob = function() {
      return d.encodePCM()
  }
  ,
  this.clear = function() {
      d.clear()
  }
  ,
  t.onaudioprocess = function(i) {
      d.clear();
      i = i.inputBuffer.getChannelData(0);
      d.input(i),
      ws.readyState == WebSocket.OPEN && record.sendData()
  }
};
function endVideoTalk() {
  console.log("关闭对讲"),
  ws && (ws.close(),
  ws = null),
  timeInte && (clearInterval(timeInte),
  timeInte = null),
  record && (record.stop(),
  record = null)
}
function receive(i) {
  "string" == typeof e && "OK" == JSON.parse(e).message ? console.log("OK") : new Response(i).arrayBuffer().then(function(i) {
      var e = new (window.AudioContext || window.webkitAudioContext)
        , i = addWavHeader(i, "8000", "16", "1");
      e.decodeAudioData(i, function(i) {
          _visualize(e, i)
      })
  })
}
var addWavHeader = function(i, e, o, t) {
  var d = i.byteLength
    , s = new ArrayBuffer(44 + d)
    , s = new DataView(s);
  function n(i, e, o) {
      for (var t = 0; t < o.length; t++)
          i.setUint8(e + t, o.charCodeAt(t))
  }
  if (n(s, 0, "RIFF"),
  s.setUint32(4, 36 + d, !0),
  n(s, 8, "WAVE"),
  n(s, 12, "fmt "),
  s.setUint32(16, 16, !0),
  s.setUint16(20, 1, !0),
  s.setUint16(22, t, !0),
  s.setUint32(24, e, !0),
  s.setUint32(28, e * t * (o / 8), !0),
  s.setUint16(32, t * (o / 8), !0),
  s.setUint16(34, o, !0),
  n(s, 36, "data"),
  s.setUint32(40, d, !0),
  16 == o) {
      var h = s
        , r = 44
        , c = i;
      c = new Int16Array(c);
      for (var g = 0; g < c.length; g++,
      r += 2)
          h.setInt16(r, c[g], !0)
  } else if (8 == o) {
      var v = s
        , a = 44
        , u = i;
      u = new Int8Array(u);
      for (var l = 0; l < u.length; l++,
      a++)
          v.setInt8(a, u[l], !0)
  } else {
      var w = s
        , x = 44
        , I = i;
      I = new Int32Array(I);
      for (var B = 0; B < I.length; B++,
      x += 4)
          w.setInt32(x, I[B], !0)
  }
  return s.buffer
}
, _visualize = function(i, e) {
  var o = i.createBufferSource()
    , t = i.createAnalyser();
  o.connect(t),
  t.connect(i.destination),
  o.buffer = e,
  o.start || (o.start = o.noteOn,
  o.stop = o.noteOff),
  o.start()
};
