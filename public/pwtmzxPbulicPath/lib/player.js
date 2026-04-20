"use strict";
var downloadJsUrl = document.currentScript.src.replace("player.js", "downloader.js")
  , decoderJsUrl = document.currentScript.src.replace("player.js", "decoder.js")
  , decoderStateIdle = 0
  , decoderStateInitializing = 1
  , decoderStateReady = 2
  , decoderStateFinished = 3
  , playerStateIdle = 0
  , playerStatePlaying = 1
  , playerStatePausing = 2
  , maxVideoFrameQueueSize = 132
  , downloadSpeedByteRateCoef = 1.5;
function FileInfo(e) {
    this.url = e,
    this.size = 0,
    this.offset = 0,
    this.chunkSize = 655360
}
function Player(e, t, i, o) {
    this.videoObj = i,
    this.h264decoderTag = e,
    this.returnFuc = t,
    this.cutPicJson = "",
    this.fileInfo = null,
    this.pcmPlayer = null,
    this.canvas = null,
    this.webglPlayer = null,
    this.callback = null,
    this.waitHeaderLength = 524288,
    this.duration = 0,
    this.pixFmt = 0,
    this.videoWidth = 0,
    this.videoHeight = 0,
    this.yLength = 0,
    this.uvLength = 0,
    this.beginTimeOffset = 0,
    this.decoderState = decoderStateIdle,
    this.playerState = playerStateIdle,
    this.decoding = !1,
    this.decodeInterval = 1,
    this.audioQueue = [],
    this.videoQueue = [],
    this.videoRendererTimer = null,
    this.downloadTimer = null,
    this.chunkInterval = 1,
    this.downloadSeqNo = 0,
    this.downloading = !1,
    this.timeLabel = null,
    this.timeTrack = null,
    this.trackTimer = null,
    this.trackTimerInterval = 500,
    this.displayDuration = "00:00:00",
    this.audioEncoding = "",
    this.audioChannels = 0,
    this.audioSampleRate = 0,
    this.seeking = !1,
    this.justSeeked = !1,
    this.urgent = !1,
    this.loadingDiv = null,
    this.logger = new Logger("Player"),
    this.videoTimeStamp = 0,
    this.devCode = o,
    this.downloadVideo = function(e, t) {
        var i, o, r;
        e && 0 < e.length && (e = new Blob([e],{
            type: "application/octet-stream"
        }),
        (i = document.createElement("a")).style.display = "none",
        o = URL.createObjectURL(e),
        i.href = o,
        e = "-" + (e = new Date).getFullYear() + "-" + (e.getMonth() + 1) + "-" + e.getDate() + "-" + e.getHours() + ":" + e.getMinutes() + ":" + e.getSeconds(),
        i.download = t + e + ".ps",
        document.body.appendChild(i),
        i.click(),
        r = setTimeout(function() {
            document.body.removeChild(i),
            window.URL.revokeObjectURL(o),
            clearTimeout(r)
        }, 1e4))
    }
    ,
    this.initDownloadWorker(this.videoObj.errorCodeType),
    this.initDecodeWorker()
}
Player.prototype.initDownloadWorker = function(i) {
    var o = this;
    this.downloadWorker = new Worker(downloadJsUrl),
    this.downloadWorker.onmessage = function(e) {
        var t = e.data;
        switch (t.t) {
        case kGetFileInfoRsp:
            o.onGetFileInfo(t.i, t.num);
            break;
        case kFileData:
            o.onFileData(t.d, t.s, t.e, t.q, t);
            break;
        case kErrorTip:
            o.onErrorTip(t.num, t.errorDes, t.errorCode, t.rongqiId, t.devCode, i);
            break;
        case kliuover:
            o.onLiuOver(t.num);
            break;
        case 6:
            o.onMalvShow(t)
        }
    }
}
,
Player.prototype.onMalvShow = function(e) {
    malvtips(e.num, Number(8 * e.malv / 1024).toFixed(2) + "kb/s", e.rongqiId)
}
,
Player.prototype.onLiuOver = function(e) {
    console.log("流结束调用暂停"),
    this.pause(e)
}
,
Player.prototype.initDecodeWorker = function() {
    var i = this;
    this.decodeWorker = new Worker(decoderJsUrl),
    this.decodeWorker.onmessage = function(e) {
        var t = e.data;
        switch (t.t) {
        case kInitDecoderRsp:
            i.onInitDecoder(t);
            break;
        case kOpenDecoderRsp:
            i.onOpenDecoder(t);
            break;
        case kVideoFrame:
            i.onVideoFrame(t);
            break;
        case kAudioFrame:
            i.onAudioFrame(t);
            break;
        case kDecodeFinishedEvt:
            i.onDecodeFinished(t);
            break;
        case kRequestDataEvt:
            i.onRequestData(t.o);
            break;
        case kSeekToRsp:
            i.onSeekToRsp(t.r)
        }
    }
}
,
Player.prototype.onErrorTip = function(e, t, i, o, r, a) {
    t = "outer" === a ? "统一视频平台反馈异常，请联系平台运维人员处理（".concat(i, "）") : window.top.__errorList[i] || "设备故障，请联系设备厂商做进一步处理 (".concat(i, ")");
    execute(this.returnFuc, "111", {
        windowIndex: e,
        errorDes: t,
        errorCode: i,
        rongqiId: o,
        devCode: r
    }),
    errortips(e, t, o),
    console.log(222),
    this.pause(e)
}
,
Player.prototype.play = function(e, t, i, o, r) {
    var a = {
        e: 0,
        m: "Success"
    };
    do {
        if (this.playerState == playerStatePausing) {
            a = this.resume();
            break
        }
        if (this.playerState == playerStatePlaying)
            break;
        if (!e) {
            a = {
                e: -1,
                m: "Invalid url"
            },
            this.logger.logError("[ER] playVideo error, url empty.");
            break
        }
        if (!t) {
            a = {
                e: -2,
                m: "Canvas not set"
            },
            this.logger.logError("[ER] playVideo error, canvas empty.");
            break
        }
        if (!this.downloadWorker) {
            a = {
                e: -3,
                m: "Downloader not initialized"
            },
            this.logger.logError("[ER] Downloader not initialized.");
            break
        }
        if (!this.decodeWorker) {
            a = {
                e: -4,
                m: "Decoder not initialized"
            },
            this.logger.logError("[ER] Decoder not initialized.");
            break
        }
        this.fileInfo = new FileInfo(e),
        this.canvas = t,
        this.callback = i,
        this.waitHeaderLength = 0,
        this.playerState = playerStatePlaying,
        this.startTrackTimer(),
        this.displayLoop(),
        this.webglPlayer = new WebGLPlayer(this.canvas,{
            preserveDrawingBuffer: !1
        });
        var s = {
            t: kGetFileInfoReq,
            u: e,
            num: r
        }
    } while (this.downloadWorker.postMessage(s),
    0);
    return a
}
,
Player.prototype.pause = function() {
    return this.logger.logInfo("Pause."),
    this.playerState != playerStatePlaying ? {
        e: -1,
        m: "Not playing"
    } : (this.playerState = playerStatePausing,
    this.pcmPlayer.pause(),
    this.pauseDecoding(),
    this.stopTrackTimer(),
    {
        e: 0,
        m: "Success"
    })
}
,
Player.prototype.resume = function() {
    if (this.logger.logInfo("Resume."),
    this.playerState != playerStatePausing)
        return {
            e: -1,
            m: "Not pausing"
        };
    for (this.pcmPlayer.resume(); 0 < this.audioQueue.length; ) {
        var e = this.audioQueue.shift();
        this.pcmPlayer.play(e)
    }
    return null != this.videoRendererTimer && (clearTimeout(this.videoRendererTimer),
    this.videoRendererTimer = null),
    this.playerState = playerStatePlaying,
    this.startDecoding(),
    this.seeking || this.startTrackTimer(),
    {
        e: 0,
        m: "Success"
    }
}
,
Player.prototype.stop = function(e) {
    var t;
    return this.logger.logInfo("Stop."),
    this.playerState == playerStateIdle ? {
        e: -1,
        m: "Not playing"
    } : (null != this.videoRendererTimer && (clearTimeout(this.videoRendererTimer),
    this.videoRendererTimer = null,
    this.logger.logInfo("Video renderer timer stopped.")),
    this.stopDownloadTimer(),
    this.stopTrackTimer(),
    this.fileInfo = null,
    this.canvas = null,
    this.webglPlayer = null,
    this.callback = null,
    this.duration = 0,
    this.pixFmt = 0,
    this.videoWidth = 0,
    this.videoHeight = 0,
    this.yLength = 0,
    this.uvLength = 0,
    this.decoderState = decoderStateIdle,
    this.playerState = playerStateIdle,
    this.decoding = !1,
    this.audioQueue = [],
    this.videoQueue = [],
    this.pcmPlayer && (this.pcmPlayer.destroy(),
    this.pcmPlayer = null,
    this.logger.logInfo("Pcm player released.")),
    this.logger.logInfo("Closing decoder."),
    this.decodeWorker.postMessage({
        t: kCloseDecoderReq,
        num: e,
        h264decoderTag: this.h264decoderTag
    }),
    this.downloadWorker.postMessage({
        t: kCloseDownloaderRsp,
        num: e
    }),
    this.logger.logInfo("Uniniting decoder."),
    this.decodeWorker.postMessage({
        t: kUninitDecoderReq,
        h264decoderTag: this.h264decoderTag
    }),
    t)
}
,
Player.prototype.seekTo = function(e) {
    this.pause(),
    this.stopDownloadTimer(),
    this.videoQueue.length = 0,
    this.audioQueue.length = 0,
    this.decodeWorker.postMessage({
        t: kSeekToReq,
        ms: e,
        h264decoderTag: this.h264decoderTag
    }),
    this.beginTimeOffset = e / 1e3,
    this.seeking = !0,
    this.justSeeked = !0,
    this.showLoading()
}
,
Player.prototype.fullscreen = function() {
    this.webglPlayer && this.webglPlayer.fullscreen()
}
,
Player.prototype.getState = function() {
    return this.playerState
}
,
Player.prototype.setTrack = function(e, t) {
    var i;
    this.timeTrack = e,
    this.timeLabel = t,
    this.timeTrack && ((i = this).timeTrack.oninput = function() {
        i.seeking || i.seekTo(i.timeTrack.value)
    }
    ,
    this.timeTrack.onchange = function() {
        i.seeking || i.seekTo(i.timeTrack.value)
    }
    )
}
,
Player.prototype.onGetFileInfo = function(e, t) {
    this.playerState != playerStateIdle && (this.logger.logInfo("Got file size rsp:" + e.st + " size:" + e.sz + " byte."),
    200 == e.st ? (this.fileInfo.size = e.sz,
    this.logger.logInfo("Initializing decoder."),
    t = {
        t: kInitDecoderReq,
        s: this.fileInfo.size,
        c: this.fileInfo.chunkSize,
        num: t,
        h264decoderTag: this.h264decoderTag
    },
    this.decodeWorker.postMessage(t)) : this.reportPlayError(-1, e.st))
}
,
Player.prototype.onFileData = function(e, t, i, o, r) {
    var a = this;
    if (r.chushihua && (r.num,
    r.showName,
    r.rongqiId,
    this.devCode,
    this.videoObj),
    this.downloading = !1,
    this.playerState != playerStateIdle && o == this.downloadSeqNo) {
        if (this.playerState == playerStatePausing) {
            if (!this.seeking)
                return;
            setTimeout(function() {
                a.resume()
            }, 0)
        }
        this.fileInfo.offset += i - t + 1;
        r = {
            t: kFeedDataReq,
            d: e,
            h264decoderTag: this.h264decoderTag
        };
        switch (this.decodeWorker.postMessage(r, [r.d]),
        this.decoderState) {
        case decoderStateIdle:
            this.onFileDataUnderDecoderIdle();
            break;
        case decoderStateInitializing:
            this.onFileDataUnderDecoderInitializing();
            break;
        case decoderStateReady:
            this.onFileDataUnderDecoderReady()
        }
        this.urgent && setTimeout(function() {
            a.downloadOneChunk()
        }, 0)
    }
}
,
Player.prototype.onFileDataUnderDecoderIdle = function() {
    var e;
    this.fileInfo.offset >= this.waitHeaderLength && (this.logger.logInfo("Opening decoder."),
    this.decoderState = decoderStateInitializing,
    e = {
        t: kOpenDecoderReq,
        h264decoderTag: this.h264decoderTag
    },
    this.decodeWorker.postMessage(e)),
    this.downloadOneChunk()
}
,
Player.prototype.onFileDataUnderDecoderInitializing = function() {
    this.downloadOneChunk()
}
,
Player.prototype.onFileDataUnderDecoderReady = function() {}
,
Player.prototype.onInitDecoder = function(e) {
    this.playerState != playerStateIdle && (this.logger.logInfo("Init decoder response " + e.e + "."),
    0 == e.e ? this.downloadOneChunk(e.num) : this.reportPlayError(e.e))
}
,
Player.prototype.onOpenDecoder = function(e) {
    this.playerState != playerStateIdle && (this.logger.logInfo("Open decoder response " + e.e + "."),
    0 == e.e ? (this.onVideoParam(e.v),
    this.onAudioParam(e.a),
    this.decoderState = decoderStateReady,
    this.logger.logInfo("Decoder ready now."),
    this.startDecoding()) : this.reportPlayError(e.e))
}
,
Player.prototype.onVideoParam = function(e) {
    var t;
    this.playerState != playerStateIdle && (this.logger.logInfo("Video param duation:" + e.d + " pixFmt:" + e.p + " width:" + e.w + " height:" + e.h + "."),
    this.duration = e.d,
    this.pixFmt = e.p,
    this.videoWidth = e.w,
    this.videoHeight = e.h,
    this.yLength = this.videoWidth * this.videoHeight,
    this.uvLength = this.videoWidth / 2 * (this.videoHeight / 2),
    this.timeTrack && (this.timeTrack.min = 0,
    this.timeTrack.max = this.duration,
    this.timeTrack.value = 0,
    this.displayDuration = this.formatTime(this.duration / 1e3)),
    e = 1e3 * this.waitHeaderLength / this.duration,
    t = downloadSpeedByteRateCoef * e,
    this.fileInfo.chunkSize,
    this.startDownloadTimer(),
    this.logger.logInfo("Byte rate:" + e + " target speed:" + t + " chunk interval:" + this.chunkInterval + "."))
}
,
Player.prototype.onAudioParam = function(e) {
    if (this.playerState != playerStateIdle) {
        this.logger.logInfo("Audio param sampleFmt:" + e.f + " channels:" + e.c + " sampleRate:" + e.r + ".");
        var t = e.f
          , i = e.c
          , e = e.r
          , o = "16bitInt";
        switch (t) {
        case 0:
            o = "8bitInt";
            break;
        case 1:
            o = "16bitInt";
            break;
        case 2:
            o = "32bitInt";
            break;
        case 3:
            o = "32bitFloat";
            break;
        default:
            this.logger.logError("Unsupported audio sampleFmt " + t + "!")
        }
        this.logger.logInfo("Audio encoding " + o + "."),
        this.pcmPlayer = new PCMPlayer({
            encoding: o,
            channels: i,
            sampleRate: e,
            flushingTime: 5e3
        }),
        this.audioEncoding = o,
        this.audioChannels = i,
        this.audioSampleRate = e
    }
}
,
Player.prototype.restartAudio = function() {
    this.pcmPlayer && (this.pcmPlayer.destroy(),
    this.pcmPlayer = null),
    this.pcmPlayer = new PCMPlayer({
        encoding: this.audioEncoding,
        channels: this.audioChannels,
        sampleRate: this.audioSampleRate,
        flushingTime: 5e3
    })
}
,
Player.prototype.onAudioFrame = function(e) {
    if (this.playerState == playerStatePlaying)
        switch (this.seeking && (this.restartAudio(),
        this.startTrackTimer(),
        this.hideLoading(),
        this.seeking = !1),
        this.playerState) {
        case playerStatePlaying:
            this.pcmPlayer.play(new Uint8Array(e.d));
            break;
        case playerStatePausing:
            this.audioQueue.push(new Uint8Array(e.d))
        }
}
,
Player.prototype.onDecodeFinished = function(e) {
    this.pauseDecoding(),
    this.decoderState = decoderStateFinished
}
,
Player.prototype.onVideoFrame = function(e) {
    this.videoTimeStamp = e.s,
    this.playerState == playerStatePlaying && (this.seeking && (this.restartAudio(),
    this.startTrackTimer(),
    this.hideLoading(),
    this.seeking = !1),
    this.videoQueue.push(e),
    this.videoQueue.length >= maxVideoFrameQueueSize && (this.videoQueue = [],
    this.decoding))
}
,
Player.prototype.onSeekToRsp = function(e) {
    0 != e && (this.justSeeked = !1,
    this.seeking = !1)
}
,
Player.prototype.onRequestData = function(e) {
    this.justSeeked && (this.logger.logInfo("Request data " + e),
    0 <= e && e < this.fileInfo.size && (this.fileInfo.offset = e),
    this.startDownloadTimer(),
    this.justSeeked = !1)
}
,
Player.prototype.displayLoop = function() {
    var e, t, i;
    requestAnimationFrame(this.displayLoop.bind(this)),
    this.playerState == playerStatePlaying && 0 != this.videoQueue.length && (e = this.videoQueue[0],
    this.pcmPlayer.getTimestamp(),
    this.beginTimeOffset,
    e.s,
    e = {
        d: new Uint8Array(e.d),
        w: e.w,
        h: e.h
    },
    t = this.getQueryString(this.playUrl, "rongqiId"),
    i = this.getQueryString(this.playUrl, "num"),
    $("#" + t + " #errortip" + i).hasClass("hide") || errortipshide(i, t),
    this.renderVideoFrame(e),
    this.videoQueue.shift(),
    this.videoQueue.length < maxVideoFrameQueueSize / 2 && (this.decoding || (this.logger.logInfo("Image queue size < " + maxVideoFrameQueueSize / 2 + ", restart decoding."),
    this.startDecoding())))
}
,
Player.prototype.renderVideoFrame = function(e) {
    this.cutPicJson = {
        data: e.d,
        videoWidth: e.w,
        videoHeight: e.h,
        yLength: e.w * e.h,
        uvLength: e.w / 2 * (e.h / 2)
    },
    this.webglPlayer.renderFrame(e.d, e.w, e.h, e.w * e.h, e.w / 2 * (e.h / 2))
}
,
Player.prototype.getQueryString = function(e, t) {
    t = new RegExp("(^|&?)" + t + "=([^&]*)(&|$)"),
    e = e.match(t);
    return null != e ? unescape(e[2]) : null
}
,
Player.prototype.downloadOneChunk = function(e) {
    var t, i, o, r, a, s;
    this.downloading || (s = this.fileInfo.offset,
    t = this.fileInfo.offset + this.fileInfo.chunkSize - 1,
    i = this.getQueryString(this.fileInfo.url, "rongqiId"),
    e = this.getQueryString(this.fileInfo.url, "num"),
    o = $("#" + i + " #fullBtnBox" + e + " .showDev").text(),
    r = $("#" + i + " img#recordVideo" + e).attr("data-status"),
    a = $("#" + i + " #fullBtnBox" + e + " .showDev").attr("data-devCode"),
    s = {
        t: kDownloadFileReq,
        u: this.fileInfo.url,
        s: s,
        e: t,
        q: this.downloadSeqNo,
        num: e,
        luzhistatus: r,
        showName: o,
        rongqiId: i,
        devCode: a
    },
    this.downloadWorker.postMessage(s),
    this.downloading = !0)
}
,
Player.prototype.startDownloadTimer = function() {
    var e = this;
    this.downloadSeqNo++,
    this.downloadTimer = setInterval(function() {
        e.downloadOneChunk()
    }, this.chunkInterval)
}
,
Player.prototype.stopDownloadTimer = function() {
    null != this.downloadTimer && (clearInterval(this.downloadTimer),
    this.downloadTimer = null,
    this.logger.logInfo("Download timer stopped.")),
    this.downloading = !1
}
,
Player.prototype.startTrackTimer = function() {
    var e = this;
    this.trackTimer = setInterval(function() {
        e.updateTrackTime()
    }, this.trackTimerInterval)
}
,
Player.prototype.stopTrackTimer = function() {
    null != this.trackTimer && (clearInterval(this.trackTimer),
    this.trackTimer = null)
}
,
Player.prototype.updateTrackTime = function() {
    var e;
    this.playerState == playerStatePlaying && this.pcmPlayer && (e = this.pcmPlayer.getTimestamp() + this.beginTimeOffset,
    this.timeTrack && (this.timeTrack.value = 1e3 * e),
    this.timeLabel && (this.timeLabel.innerHTML = this.formatTime(e) + "/" + this.displayDuration))
}
,
Player.prototype.startDecoding = function() {
    var e = {
        t: kStartDecodingReq,
        i: this.decodeInterval,
        h264decoderTag: this.h264decoderTag
    };
    this.decodeWorker.postMessage(e),
    this.decoding = !0
}
,
Player.prototype.pauseDecoding = function() {
    var e = {
        t: kPauseDecodingReq,
        h264decoderTag: this.h264decoderTag
    };
    this.decodeWorker.postMessage(e),
    this.decoding = !1
}
,
Player.prototype.formatTime = function(e) {
    var t = Math.floor(e / 3600) < 10 ? "0" + Math.floor(e / 3600) : Math.floor(e / 3600)
      , i = Math.floor(e / 60 % 60) < 10 ? "0" + Math.floor(e / 60 % 60) : Math.floor(e / 60 % 60)
      , e = Math.floor(e % 60) < 10 ? "0" + Math.floor(e % 60) : Math.floor(e % 60);
    return result = t + ":" + i + ":" + e
}
,
Player.prototype.reportPlayError = function(e, t, i) {
    this.callback && this.callback({
        error: e || 0,
        status: t || 0,
        message: i
    })
}
,
Player.prototype.setLoadingDiv = function(e) {
    this.loadingDiv = e
}
,
Player.prototype.hideLoading = function() {
    null != this.loadingDiv && (loading.style.display = "none")
}
,
Player.prototype.showLoading = function() {
    null != this.loadingDiv && (loading.style.display = "block")
}
,
Player.prototype.getT = function() {
    if (this.pcmPlayer.getTimestamp)
        return this.pcmPlayer.getTimestamp()
}
;
