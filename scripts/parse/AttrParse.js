export default {

	parseAttr(name, v) {
		let sb = [];
		// sb.push('style="');
		switch (name) {
			case 'id':
				sb.push('id="' + v + '"');
				break;
			case 'fc': // fill-color: fc="255,0,0"
				sb.push('fill="rgb(' + v + ')"');
				break;
			case 'ls': // line-style  ls="1"

				break;
			case 'fm': // fill-mode  fm="1"
				break;
			case 'lc': // line-color  lc="160,160,164"
				sb.push('stroke="rgb(' + v + ')"');
				break;
			case 'lw': // line-width  lw="2"
				sb.push('stroke-width="' + v + '"');
				break;
			case 'tfr': // tfr="rotate(0) scale(1,1)"
				sb.push('transform="' + v + '"');
				break;
			case 'sta':
				sb.push('sta="' + v + '"');
				break;
			case 'keyid':
				sb.push('keyid="' + v + '"');
				break;
			case 'keyname':
				sb.push('keyname="' + v + '"');
				break;
		}
		return sb.join('');
	}
}
