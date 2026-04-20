"use strict";
function Texture(e) {
    this.gl = e,
    this.texture = e.createTexture(),
    e.bindTexture(e.TEXTURE_2D, this.texture),
    e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MAG_FILTER, e.LINEAR),
    e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MIN_FILTER, e.LINEAR),
    e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_S, e.CLAMP_TO_EDGE),
    e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_T, e.CLAMP_TO_EDGE)
}
function WebGLPlayer(e, t) {
    this.canvas = e,
    this.gl = e.getContext("webgl") || e.getContext("experimental-webgl"),
    this.initGL(t)
}
Texture.prototype.bind = function(e, t, r) {
    var i = this.gl;
    i.activeTexture([i.TEXTURE0, i.TEXTURE1, i.TEXTURE2][e]),
    i.bindTexture(i.TEXTURE_2D, this.texture),
    i.uniform1i(i.getUniformLocation(t, r), e)
}
,
Texture.prototype.fill = function(e, t, r) {
    var i = this.gl;
    i.bindTexture(i.TEXTURE_2D, this.texture),
    i.texImage2D(i.TEXTURE_2D, 0, i.LUMINANCE, e, t, 0, i.LUMINANCE, i.UNSIGNED_BYTE, r)
}
,
WebGLPlayer.prototype.initGL = function(e) {
    var t, r, i, o, a;
    this.gl ? ((t = this.gl).pixelStorei(t.UNPACK_ALIGNMENT, 1),
    r = t.createProgram(),
    i = ["attribute highp vec4 aVertexPosition;", "attribute vec2 aTextureCoord;", "varying highp vec2 vTextureCoord;", "void main(void) {", " gl_Position = aVertexPosition;", " vTextureCoord = aTextureCoord;", "}"].join("\n"),
    o = t.createShader(t.VERTEX_SHADER),
    t.shaderSource(o, i),
    t.compileShader(o),
    i = ["precision highp float;", "varying lowp vec2 vTextureCoord;", "uniform sampler2D YTexture;", "uniform sampler2D UTexture;", "uniform sampler2D VTexture;", "const mat4 YUV2RGB = mat4", "(", " 1.1643828125, 0, 1.59602734375, -.87078515625,", " 1.1643828125, -.39176171875, -.81296875, .52959375,", " 1.1643828125, 2.017234375, 0, -1.081390625,", " 0, 0, 0, 1", ");", "void main(void) {", " gl_FragColor = vec4( texture2D(YTexture, vTextureCoord).x, texture2D(UTexture, vTextureCoord).x, texture2D(VTexture, vTextureCoord).x, 1) * YUV2RGB;", "}"].join("\n"),
    a = t.createShader(t.FRAGMENT_SHADER),
    t.shaderSource(a, i),
    t.compileShader(a),
    t.attachShader(r, o),
    t.attachShader(r, a),
    t.linkProgram(r),
    t.useProgram(r),
    t.getProgramParameter(r, t.LINK_STATUS) || console.log("[ER] Shader link failed."),
    i = t.getAttribLocation(r, "aVertexPosition"),
    t.enableVertexAttribArray(i),
    o = t.getAttribLocation(r, "aTextureCoord"),
    t.enableVertexAttribArray(o),
    a = t.createBuffer(),
    t.bindBuffer(t.ARRAY_BUFFER, a),
    t.bufferData(t.ARRAY_BUFFER, new Float32Array([1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0]), t.STATIC_DRAW),
    t.vertexAttribPointer(i, 3, t.FLOAT, !1, 0, 0),
    a = t.createBuffer(),
    t.bindBuffer(t.ARRAY_BUFFER, a),
    t.bufferData(t.ARRAY_BUFFER, new Float32Array([1, 0, 0, 0, 1, 1, 0, 1]), t.STATIC_DRAW),
    t.vertexAttribPointer(o, 2, t.FLOAT, !1, 0, 0),
    t.y = new Texture(t),
    t.u = new Texture(t),
    t.v = new Texture(t),
    t.y.bind(0, r, "YTexture"),
    t.u.bind(1, r, "UTexture"),
    t.v.bind(2, r, "VTexture")) : console.log("[ER] WebGL not supported.")
}
,
WebGLPlayer.prototype.renderFrame = function(e, t, r, i, o) {
    var a;
    this.gl && ((a = this.gl).viewport(0, 0, a.canvas.width, a.canvas.height),
    a.clearColor(0, 0, 0, 0),
    a.clear(a.COLOR_BUFFER_BIT),
    a.y.fill(t, r, e.subarray(0, i)),
    a.u.fill(t >> 1, r >> 1, e.subarray(i, i + o)),
    a.v.fill(t >> 1, r >> 1, e.subarray(i + o, e.length)),
    a.drawArrays(a.TRIANGLE_STRIP, 0, 4))
}
,
WebGLPlayer.prototype.fullscreen = function() {
    var e = this.canvas;
    e.RequestFullScreen ? e.RequestFullScreen() : e.webkitRequestFullScreen ? e.webkitRequestFullScreen() : e.mozRequestFullScreen ? e.mozRequestFullScreen() : e.msRequestFullscreen ? e.msRequestFullscreen() : alert("This browser doesn't supporter fullscreen")
}
,
WebGLPlayer.prototype.exitfullscreen = function() {
    document.exitFullscreen ? document.exitFullscreen() : document.webkitExitFullscreen ? document.webkitExitFullscreen() : document.mozCancelFullScreen ? document.mozCancelFullScreen() : document.msExitFullscreen ? document.msExitFullscreen() : alert("Exit fullscreen doesn't work")
}
;
