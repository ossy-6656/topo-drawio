import AttrParse from "./AttrParse.js";
import MathUtil from "./MathUtil.js";
export default {
	symbolProps:{},
    // 解析容器
    getContainer(con, id) {
        // let id = con.getAttribute('id');

        let w = con.getAttribute('w');
        let h = con.getAttribute('h');
	    this.symbolProps[id] = {
		    width: parseFloat(w),
		    height: parseFloat(h)
	    }
        let state = con.getAttribute('state');
        let name = con.nodeName;
        let sb = [];
        sb.push('<symbol ');
        sb.push('id="' + id + '" ');
        sb.push('w="' + w + '" ');
        sb.push('h="' + h + '" ');
        sb.push('name="' + name + '" ');
        sb.push('state="' + state + '"');
        sb.push(">");
        return sb.join('');
    },
	// 解析直线
    parseLine(dom, iscommon) {
		let attrList = dom.getAttributeNames();
		let sb = [];
		sb.push('<line ');
		let x1 = dom.getAttribute('x1');
	    let y1 = dom.getAttribute('y1');
	    let x2 = dom.getAttribute('x2');
	    let y2 = dom.getAttribute('y2');
		sb.push('x1="' + x1 + '" ');
	    sb.push('y1="' + y1 + '" ');
	    sb.push('x2="' + x2 + '" ');
	    sb.push('y2="' + y2 + '" ');

		// for(let name of attrList) {
		// 	let v = dom.getAttribute(name);
		// 	let attrStr = AttrParse.parseAttr(name, v);
		// 	if (attrStr) {
		// 		sb.push(attrStr + ' ');
		// 	}
		// }

	    let id = dom.getAttribute('id');
	    if (id) {
		    sb.push('id="' + id + '" ');
	    }

	    let lc = dom.getAttribute('lc');
	    if (lc && iscommon) {
		    sb.push('stroke="rgb(' + lc + ')" ');
	    }

	    let lw = dom.getAttribute('lw');
	    if (lw) {
		    sb.push('stroke-width="' + lw + '" ');
	    }

	    let tfr = dom.getAttribute('tfr');
	    if (tfr) {
		    sb.push('transform="' + tfr + '" ');
	    }

		sb.push('/>');
		return sb.join('');
    },
	// 解析圆
	parseCircle(dom, iscommon) {
		let attrList = dom.getAttributeNames();
		let sb = [];
		sb.push('<circle ');
		let cx = dom.getAttribute('cx');
		let cy = dom.getAttribute('cy');
		let r = dom.getAttribute('r');
		sb.push('cx="' + cx + '" ');
		sb.push('cy="' + cy + '" ');
		sb.push('r="' + r + '" ');

		// 填充模式，0不填充
		let fm = dom.getAttribute('fm');
		if (fm) {
			sb.push('fm="' + fm + '" ');
		}
		// for(let name of attrList) {
		// 	// if (name == 'fc') {
		// 	// 	continue
		// 	// }
		// 	if (fm == '0' && name == 'fc') {
		// 		continue;
		// 	}
		// 	let v = dom.getAttribute(name);
		// 	let attrStr = AttrParse.parseAttr(name, v);
		// 	if (attrStr) {
		// 		sb.push(attrStr + ' ');
		// 	}
		// }
		let id = dom.getAttribute('id');
		if (id) {
			sb.push('id="' + id + '" ');
		}

		let lc = dom.getAttribute('lc');
		if (lc && iscommon) {
			sb.push('stroke="rgb(' + lc + ')" ');
		}

		let lw = dom.getAttribute('lw');
		if (lw) {
			sb.push('line-width="' + lw + '" ');
		}
		let tfr = dom.getAttribute('tfr');
		if (tfr) {
			sb.push('transform="' + tfr + '" ');
		}
		let fc = dom.getAttribute('fc');
		if (iscommon) {
			if (fm != '0' && fc) {
				sb.push('fill="rgb(' + fc + ')" ');
			} else {
				sb.push('fill="transparent" ')
			}
		}
		// else if (fm != '0' && fc) {
		// 	sb.push('fill="rgb(' + fc + ')" ');
		// }
		sb.push('/>');
		return sb.join('');
	},
	// 解析椭圆
	parseEllipse(dom, iscommon) {
		let attrList = dom.getAttributeNames();
		let sb = [];
		sb.push('<ellipse ');
		let cx = dom.getAttribute('cx');
		let cy = dom.getAttribute('cy');
		let rx = dom.getAttribute('rx');
		let ry = dom.getAttribute('ry');
		sb.push('cx="' + cx + '" ');
		sb.push('cy="' + cy + '" ');
		sb.push('rx="' + rx + '" ');
		sb.push('ry="' + ry + '" ');

		// 填充模式，0不填充
		let fm = dom.getAttribute('fm');

		// for(let name of attrList) {
		// 	if (fm == '0' && name == 'fc') {
		// 		continue;
		// 	}
		//
		// 	let v = dom.getAttribute(name);
		// 	let attrStr = AttrParse.parseAttr(name, v);
		// 	if (attrStr) {
		// 		sb.push(attrStr + ' ');
		// 	}
		// }
		let id = dom.getAttribute('id');
		if (id) {
			sb.push('id="' + id + '" ');
		}

		let lc = dom.getAttribute('lc');
		if (lc && iscommon) {
			sb.push('stroke="rgb(' + lc + ')" ');
		}

		let lw = dom.getAttribute('lw');
		if (lw) {
			sb.push('line-width="' + lw + '" ');
		}
		let tfr = dom.getAttribute('tfr');
		if (tfr) {
			sb.push('transform="' + tfr + '" ');
		}
		let fc = dom.getAttribute('fc');
		if (iscommon) {
			if (fm != '0' && fc) {
				sb.push('fill="rgb(' + fc + ')" ');
			} else {
				sb.push('fill="transparent" ')
			}
		} else if (fm != '0' && fc) {
			sb.push('fill="rgb(' + fc + ')" ');
		}
		sb.push('/>');
		return sb.join('');
	},
	// 解析特殊椭圆
	parseEllipsear(dom, iscommon) {
		let attrList = dom.getAttributeNames();
		let sb = [];
		sb.push('<path ');
		let cx = dom.getAttribute('cx');
		let cy = dom.getAttribute('cy');
		let rx = dom.getAttribute('rx');
		let ry = dom.getAttribute('ry');
		let a1 = dom.getAttribute('a1');
		let a2 = dom.getAttribute('a2');
		let tfr = dom.getAttribute('tfr');

		cx = parseFloat(cx);
		cy = parseFloat(cy);
		rx = parseFloat(rx);
		ry = parseFloat(ry);
		a1 = parseFloat(a1) % 360;
		a2 = parseFloat(a2) % 360;

		let p1 = MathUtil.angle2cor_ellipsear(0, 0, rx, ry, a1);
		let p2 = MathUtil.angle2cor_ellipsear(0, 0, rx, ry, a2);

		let pathSb = [];
		pathSb.push('d="');
		pathSb.push('M' + p1[0] + ' ' + p1[1] + ' ');
		pathSb.push('A' + rx + ' ' + ry + ' ');
		pathSb.push('0 ');
		pathSb.push('0 ');
		pathSb.push('0 '); // 逆时针画
		pathSb.push(p2[0] + ' ' + p2[1]);

		sb.push(pathSb.join('') + '" ');

		// for(let name of attrList) {
		// 	if (name == 'tfr') {
		// 		continue;
		// 	}
		// 	let v = dom.getAttribute(name);
		// 	let attrStr = AttrParse.parseAttr(name, v);
		// 	if (attrStr) {
		// 		sb.push(attrStr + ' ');
		// 	}
		// }
		let fm = dom.getAttribute('fm');
		let id = dom.getAttribute('id');
		if (id) {
			sb.push('id="' + id + '" ');
		}

		let lc = dom.getAttribute('lc');
		if (lc && iscommon) {
			sb.push('stroke="rgb(' + lc + ')" ');
		}

		let lw = dom.getAttribute('lw');
		if (lw) {
			sb.push('line-width="' + lw + '" ');
		}
		let fc = dom.getAttribute('fc');
		if (iscommon) {
			if (fm != '0' && fc) {
				sb.push('fill="rgb(' + fc + ')" ');
			} else {
				sb.push('fill="transparent" ')
			}
		}
		// else if (fm != '0' && fc) {
		// 	sb.push('fill="rgb(' + fc + ')" ');
		// }
		sb.push('transform="translate(' + cx + ',' + cy + ') ' + tfr + '"');
		sb.push('/>');
		return sb.join('');
	},
	// 解析特殊椭圆
	parseCirclearc(dom, iscommon) {
		let attrList = dom.getAttributeNames();
		let sb = [];
		sb.push('<path ');
		let cx = dom.getAttribute('cx');
		let cy = dom.getAttribute('cy');
		let r = dom.getAttribute('r');
		let a1 = dom.getAttribute('a1');
		let a2 = dom.getAttribute('a2');
		let ArcShape = dom.getAttribute('ArcShape');
		let tfr = dom.getAttribute('tfr');

		cx = parseFloat(cx);
		cy = parseFloat(cy);
		r = parseFloat(r);
		a1 = parseFloat(a1) % 360;
		a2 = parseFloat(a2) % 360;

		let p1 = MathUtil.angle2cor_ellipsear(0, 0, r, r, a1);
		let p2 = MathUtil.angle2cor_ellipsear(0, 0, r, r, a2);

		let pathSb = [];
		pathSb.push('d="');
		pathSb.push('M' + p1[0] + ' ' + p1[1] + ' ');
		pathSb.push('A' + r + ' ' + r + ' ');
		pathSb.push('0 ');
		pathSb.push('0 ');
		pathSb.push('0 '); // 逆时针画
		pathSb.push(p2[0] + ' ' + p2[1]);

		sb.push(pathSb.join('') + '" ');

		let fm = dom.getAttribute('fm');


		// for(let name of attrList) {
		// 	if (name == 'tfr') {
		// 		continue;
		// 	}
		// 	let v = dom.getAttribute(name);
		// 	let attrStr = AttrParse.parseAttr(name, v);
		// 	if (attrStr) {
		// 		sb.push(attrStr + ' ');
		// 	}
		// }
		let id = dom.getAttribute('id');
		if (id) {
			sb.push('id="' + id + '" ');
		}

		let lc = dom.getAttribute('lc');
		if (lc && iscommon) {
			sb.push('stroke="rgb(' + lc + ')" ');
		}

		let lw = dom.getAttribute('lw');
		if (lw) {
			sb.push('line-width="' + lw + '" ');
		}
		let fc = dom.getAttribute('fc');
		if (iscommon) {
			if (fm != '0' && fc) {
				sb.push('fill="rgb(' + fc + ')" ');
			} else {
				sb.push('fill="transparent" ')
			}
		}
		// else if (fm != '0' && fc) {
		// 	sb.push('fill="rgb(' + fc + ')" ');
		// }

		sb.push('transform="translate(' + cx + ',' + cy + ') ' + tfr + '"');
		sb.push('/>');
		return sb.join('');
	},
	// 解析拆线
	parsePolyline(dom, iscommon) {
		let attrList = dom.getAttributeNames();
		let sb = [];
		sb.push('<polyline ');
		let d = dom.getAttribute('d');
		sb.push('points="' + d + '" ');

		// 填充模式，0不填充
		let fm = dom.getAttribute('fm');

		// for(let name of attrList) {
		// 	if (fm == '0' && name == 'fc') {
		// 		continue;
		// 	}
		// 	let v = dom.getAttribute(name);
		// 	let attrStr = AttrParse.parseAttr(name, v);
		// 	if (attrStr) {
		// 		sb.push(attrStr + ' ');
		// 	}
		// }
		let id = dom.getAttribute('id');
		if (id) {
			sb.push('id="' + id + '" ');
		}

		let lc = dom.getAttribute('lc');
		if (lc && iscommon) {
			sb.push('stroke="rgb(' + lc + ')" ');
		}

		let lw = dom.getAttribute('lw');
		if (lw) {
			sb.push('line-width="' + lw + '" ');
		}

		let tfr = dom.getAttribute('tfr');
		if (tfr) {
			sb.push('transform="' + tfr + '" ');
		}
		let fc = dom.getAttribute('fc');
		if (iscommon) {
			if (fm != '0' && fc) {
				sb.push('fill="rgb(' + fc + ')" ');
			} else {
				sb.push('fill="transparent" ')
			}
		}
		// else if (fm != '0' && fc) {
		// 	sb.push('fill="rgb(' + fc + ')" ');
		// }

		sb.push('/>');
		return sb.join('');
	},
	// 解析多边形
	parsePolygon(dom, iscommon) {
		let attrList = dom.getAttributeNames();
		let sb = [];
		sb.push('<polygon ');
		let d = dom.getAttribute('d');
		sb.push('points="' + d + '" ');

		// 填充模式，0不填充
		let fm = dom.getAttribute('fm');

		// for(let name of attrList) {
		// 	if (fm == '0' && name == 'fc') {
		// 		continue;
		// 	}
		// 	let v = dom.getAttribute(name);
		// 	let attrStr = AttrParse.parseAttr(name, v);
		// 	if (attrStr) {
		// 		sb.push(attrStr + ' ');
		// 	}
		// }
		let id = dom.getAttribute('id');
		if (id) {
			sb.push('id="' + id + '" ');
		}

		let lc = dom.getAttribute('lc');
		if (lc && iscommon) {
			sb.push('stroke="rgb(' + lc + ')" ');
		}

		let lw = dom.getAttribute('lw');
		if (lw) {
			sb.push('line-width="' + lw + '" ');
		}

		let tfr = dom.getAttribute('tfr');
		if (tfr) {
			sb.push('transform="' + tfr + '" ');
		}
		let fc = dom.getAttribute('fc');
		if (iscommon) {
			if (fm != '0' && fc) {
				sb.push('fill="rgb(' + fc + ')" ');
			} else {
				sb.push('fill="transparent" ')
			}
		} else if (fm != '0' && fc) {
			sb.push('fill="rgb(' + fc + ')" ');
		}
		sb.push('/>');
		return sb.join('');
	},
	// 解析矩形
	parseRect(dom, iscommon) {
		let attrList = dom.getAttributeNames();
		let sb = [];
		sb.push('<rect ');
		let x = dom.getAttribute('x');
		let y = dom.getAttribute('y');
		let w = dom.getAttribute('w');
		let h = dom.getAttribute('h');
		sb.push('x="' + x + '" ');
		sb.push('y="' + y + '" ');
		sb.push('width="' + w + '" ');
		sb.push('height="' + h + '" ');

		// 填充模式，0不填充
		let fm = dom.getAttribute('fm');

		// for(let name of attrList) {
		// 	if (fm == '0' && name == 'fc') {
		// 		continue;
		// 	}
		// 	let v = dom.getAttribute(name);
		// 	let attrStr = AttrParse.parseAttr(name, v);
		// 	if (attrStr) {
		// 		sb.push(attrStr + ' ');
		// 	}
		// }

		let id = dom.getAttribute('id');
		if (id) {
			sb.push('id="' + id + '" ');
		}

		let lc = dom.getAttribute('lc');
		if (lc && iscommon) {
			sb.push('stroke="rgb(' + lc + ')" ');
		}
		let lw = dom.getAttribute('lw');
		if (lw) {
			sb.push('line-width="' + lw + '" ');
		}
		let tfr = dom.getAttribute('tfr');
		if (tfr) {
			sb.push('transform="' + tfr + '" ');
		}

		let fc = dom.getAttribute('fc');
		if (iscommon) {
			if (fm != '0' && fc) {
				sb.push('fill="rgb(' + fc + ')" ');
			} else {
				sb.push('fill="transparent" ')
			}
		} else if (fm != '0' && fc) {
			sb.push('fill="rgb(' + fc + ')" ');
		}

		sb.push('/>');
		return sb.join('');
	},
	parseText(dom) {
		let attrList = dom.getAttributeNames();
		let sb = [];
		sb.push('<text ');
		let x = parseInt(dom.getAttribute('x'));
		let y = parseInt(dom.getAttribute('y'));

		let w = parseInt(dom.getAttribute('w'));
		let h = parseInt(dom.getAttribute('h'))  * 3/4;
		let ts = dom.getAttribute('ts'); // 文本内容
		sb.push('flag="text" ');
		sb.push('x="' + x + '" ');
		sb.push('y="' + (y + h) + '" ');

		// for(let name of attrList) {
		// 	let v = dom.getAttribute(name);
		// 	if (name == 'lc') {
		// 		continue
		// 	}
		// 	let attrStr = AttrParse.parseAttr(name, v);
		// 	if (attrStr) {
		// 		sb.push(attrStr + ' ');
		// 	}
		// }
		let id = dom.getAttribute('id');
		if (id) {
			sb.push('id="' + id + '" ');
		}

		let lc = dom.getAttribute('lc');
		if (lc) {
			sb.push('fill="rgb(' + lc + ')" ');
		}

		let tfr = dom.getAttribute('tfr');
		if (tfr) {
			sb.push('transform="' + tfr + '" ');
		}

		let fm = dom.getAttribute('fm');
		if (fm) {
			sb.push('fm="' + fm + '" ');
		}

		// 特殊样式
		let ff = dom.getAttribute('ff'); // 字体名
		let fs = dom.getAttribute('fs'); // 字体大小
		let wm = dom.getAttribute('wm'); // 字体走向，默认1，1：水平，2：垂直

		if (wm) {
			sb.push('wm="' + wm + '" ');
		}

		sb.push('style="');
		if (ff) {
			sb.push('font-family:' + ff + ';');
		}
		if (fs) {
			sb.push('font-size:' + fs + 'px;');
		}
		sb.push('"')

		sb.push('>');
		sb.push(ts);
		sb.push('</text>');
		return sb.join('');
	},
	parseDText(dom) {
		let attrList = dom.getAttributeNames();
		let sb = [];
		sb.push('<text ');
		let x = parseInt(dom.getAttribute('x'));
		let y = parseInt(dom.getAttribute('y'));

		let w = parseInt(dom.getAttribute('w'));
		let h = parseInt(dom.getAttribute('h')) * 3/4;

		let ts = dom.getAttribute('ts'); // 文本内容
		sb.push('flag="dtext" ');
		sb.push('x="' + x + '" ');
		sb.push('y="' + (y + h) + '" ');

		// for(let name of attrList) {
		// 	if (name == 'lc') {
		// 		continue
		// 	}
		// 	let v = dom.getAttribute(name);
		// 	let attrStr = AttrParse.parseAttr(name, v);
		// 	if (attrStr) {
		// 		sb.push(attrStr + ' ');
		// 	}
		// }
		let id = dom.getAttribute('id');
		if (id) {
			sb.push('id="' + id + '" ');
		}

		let keyid = dom.getAttribute('keyid');
		if (keyid) {
			sb.push('keyid="' + keyid + '" ');
		}

		let keyname = dom.getAttribute('keyname');
		if (keyname) {
			sb.push('keyname="' + keyname + '" ');
		}

		let type = dom.getAttribute('type');
		if (type) {
			sb.push('type="' + type + '" ');
		}

		let IsAbs = dom.getAttribute('IsAbs');
		if (IsAbs) {
			sb.push('IsAbs="' + IsAbs + '" ');
		}

		let voltype = dom.getAttribute('voltype');
		if (voltype) {
			sb.push('voltype="' + voltype + '" ');
		}


		let lc = dom.getAttribute('lc');
		if (lc) {
			sb.push('fill="rgb(' + lc + ')" ');
		}

		let tfr = dom.getAttribute('tfr');
		if (tfr) {
			sb.push('transform="' + tfr + '" ');
		}
		// 特殊样式
		let ff = dom.getAttribute('ff'); // 字体名
		let fs = dom.getAttribute('fs'); // 字体大小
		let wm = dom.getAttribute('wm'); // 字体走向，默认1，1：水平，2：垂直

		if (wm) {
			sb.push('wm="' + wm + '" ');
		}

		sb.push('style="');
		if (ff) {
			sb.push('font-family:' + ff + ';');
		}
		if (fs) {
			sb.push('font-size:' + fs + 'px;');
		}
		sb.push('"')
		sb.push('>');
		sb.push(ts);
		sb.push('</text>');
		return sb.join('');
	},
	/**
	 * G 文件设备 state（遥信码）→ 图元 symbol 索引（_0 / _1）。
	 */
	deviceStateToSymbolIndex(nodeName, state) {
		const s = parseInt(state, 10);
		if (!Number.isFinite(s)) return 0;
		const closed = s % 10 === 1;
		switch (nodeName) {
			case 'Disconnector':
			case 'GroundDisconnector':
				return closed ? 1 : 0;
			case 'CBreaker':
			case 'DollyBreaker':
				return closed ? 0 : 1;
			default:
				return 0;
		}
	},
	resolveSymbolIdWithState(baseId, symbolProps, staIndex) {
		const candidate = baseId + '_' + staIndex;
		if (symbolProps[candidate]) return candidate;
		const fallback0 = baseId + '_0';
		if (symbolProps[fallback0]) return fallback0;
		const fallback1 = baseId + '_1';
		if (symbolProps[fallback1]) return fallback1;
		return candidate;
	},
	/**
	 * 特殊设备
	 * @param dom
	 * @param devMap 设备数据，用于取状态
	 * @returns {string}
	 */
	parseDev(dom, devMap) {
		let symbolProps = this.symbolProps;
		let attrList = dom.getAttributeNames();
		let sb = [];
		sb.push('<use ');
		let id = dom.getAttribute('id');
		let x = dom.getAttribute('x');
		let y = dom.getAttribute('y');
		let tfr = dom.getAttribute('tfr');
		let keyid = dom.getAttribute('keyid');
		let keyname = dom.getAttribute('keyname');
		let devref = dom.getAttribute('devref'); // 文本内容

		let symbolId = devref.substring(1);
		const staIndex = this.deviceStateToSymbolIndex(dom.nodeName, dom.getAttribute('state'));
		symbolId = this.resolveSymbolIdWithState(symbolId, symbolProps, staIndex);
		let width, height;
		try {
			let props = symbolProps[symbolId];
			width = props.width;
			height = props.height;
		} catch (e) {
			console.log(e.message);
			return;
		}

		sb.push('x="' + -width/2 + '" ');
		sb.push('y="' + -height/2 + '" ');

		// sb.push('x="0" ');
		// sb.push('y="0" ');

		// sb.push('x="' + x + '" ');
		// sb.push('y="' + y + '" ');




		let xstep = parseFloat(x) + width/2;
		let ystep = parseFloat(y) + height/2;

		// let xstep = parseFloat(x);
		// let ystep = parseFloat(y);

		// let xstep = parseFloat(x);
		// let ystep = parseFloat(y);

		sb.push('id="' + id + '"');
		sb.push('href="#' + symbolId + '"');
		sb.push('transform="translate(' + xstep + ',' + ystep + ') ' + tfr + '"');
		// sb.push('transform="translate(' + x + ',' + y + ') ' + tfr + ' translate(-' + xstep + ',-' + ystep + ')"');
		sb.push('keyid="' + keyid + '"');
		sb.push('keyname="' + keyname + '"');

		// sb.push('transform="' + tfr + ' translate(' + -xstep + ',' + -ystep + ')"');
		// 特殊样式
		let ff = dom.getAttribute('ff'); // 字体名
		let fs = dom.getAttribute('fs'); // 字体大小
		let wm = dom.getAttribute('wm'); // 字体走向，默认1，1：水平，2：垂直

		let lc = dom.getAttribute('lc');
		if (lc) {
			sb.push('lc="' + lc + '" ');
		}

		let ls = dom.getAttribute('ls');
		if (ls) {
			sb.push('ls="' + ls + '" ');
		}

		let lw = dom.getAttribute('lw');
		if (lw) {
			sb.push('lw="' + lw + '" ');
		}
		let fc = dom.getAttribute('fc');
		if (fc) {
			sb.push('fc="' + fc + '" ');
		}
		let fm = dom.getAttribute('fm');
		if (fm) {
			sb.push('fm="' + fm + '" ');
		}

		sb.push('style="');
		if (fm != '0' && fc) {
			sb.push('fill:rgb(' + fc + ');');
		} else {
			sb.push('fill:transparent;')
		}
		if (lc) {
			sb.push('stroke:rgb(' + lc + ');');
		}
		sb.push('"')

		sb.push('/>');

		return sb.join('');
	},
    parseEle(dom) {
        let nodeName = dom.nodeName;
		let html;
		switch (nodeName) {
			case 'line':
				html = this.parseLine(dom, false);
				break;
			case 'ellipse':
				html = this.parseEllipse(dom);
				break;
			case 'polyline':
				html = this.parsePolyline(dom);
				break;
			case 'rect':
				html = this.parseRect(dom, false);
				break;
			case 'circle':
				html = this.parseCircle(dom);
				break;
			case 'polygon':
				html = this.parsePolygon(dom);
				break;
			case 'ellipsear':
				html = this.parseEllipsear(dom);
				break;
		}
		return html;
    },
	/**
	 * 解析一个symbol，一个符号有多个状态，并生成一个符号对应的所有状态
	 * @param symbol
	 * @param id
	 * @returns {string}
	 */
    parse(symbol, id) {
        let sb = [];
	    let state = symbol.getAttribute('state');

		for(let i = 0; i < state; i++) {
			let symbolId = id + '_' + i;
			let conStr = this.getContainer(symbol, symbolId);
			sb.push(conStr);
			let list = $(symbol).find('Layer').children('[sta=' + i + ']');
			list.each((index, dom) => {
				sb.push(this.parseEle(dom));
			});
			sb.push('</symbol>');
		}
        return sb.join('');
    }
}
