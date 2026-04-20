"use strict";
var kPlayVideoReq = 0
  , kPauseVideoReq = 1
  , kStopVideoReq = 2
  , kPlayVideoRsp = 0
  , kAudioInfo = 1
  , kVideoInfo = 2
  , kAudioData = 3
  , kVideoData = 4
  , kGetFileInfoReq = 0
  , kDownloadFileReq = 1
  , kCloseDownloaderReq = 2
  , kGetFileInfoRsp = 0
  , kFileData = 1
  , kCloseDownloaderRsp = 2
  , kErrorTip = 3
  , kliuover = 4
  , kInitDecoderReq = 0
  , kUninitDecoderReq = 1
  , kOpenDecoderReq = 2
  , kCloseDecoderReq = 3
  , kFeedDataReq = 4
  , kStartDecodingReq = 5
  , kPauseDecodingReq = 6
  , kSeekToReq = 7
  , kInitDecoderRsp = 0
  , kUninitDecoderRsp = 1
  , kOpenDecoderRsp = 2
  , kCloseDecoderRsp = 3
  , kVideoFrame = 4
  , kAudioFrame = 5
  , kStartDecodingRsp = 6
  , kPauseDecodingRsp = 7
  , kDecodeFinishedEvt = 8
  , kRequestDataEvt = 9
  , kSeekToRsp = 10;
function Logger(e) {
    this.module = e
}
Logger.prototype.log = function(e) {
    console.log("[" + this.currentTimeStr() + "][" + this.module + "]" + e)
}
,
Logger.prototype.logError = function(e) {
    console.log("[" + this.currentTimeStr() + "][" + this.module + "][ER] " + e)
}
,
Logger.prototype.logInfo = function(e) {
    console.log("[" + this.currentTimeStr() + "][" + this.module + "][IF] " + e)
}
,
Logger.prototype.logDebug = function(e) {
    console.log("[" + this.currentTimeStr() + "][" + this.module + "][DT] " + e)
}
,
Logger.prototype.currentTimeStr = function() {
    var e = new Date(Date.now());
    return e.getFullYear() + "-" + (e.getMonth() + 1) + "-" + e.getDate() + " " + e.getHours() + ":" + e.getMinutes() + ":" + e.getSeconds() + ":" + e.getMilliseconds()
}
;