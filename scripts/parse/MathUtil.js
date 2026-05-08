export default {
	radianPerAngle: Math.PI / 180,
	angle2radian(angle) {
		return angle * this.radianPerAngle;
	},
	/**
	 * 根据角度获取椭圆坐标
	 * rx、ry分别为x轴上的焦半径，y轴的焦半径
	 * 如果是圆，则rx == ry
	 * @param cx
	 * @param cy
	 * @param rx
	 * @param ry
	 * @param angle
	 * @returns {*[]}
	 */
	angle2cor_ellipsear(cx, cy, rx, ry, angle) {
		angle = this.angle2radian(angle);
		let x = cx + Math.cos(angle) * rx;
		let y = cy - Math.sin(angle) * ry;
		return [x, y];
	}
}
