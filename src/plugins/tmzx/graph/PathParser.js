// https://zhuanlan.zhihu.com/p/432284368


let regGroup = /[mlhvcsqtaz][^mlhvcsqtaz]+/ig;

// 数据解析
let dataRegex = /([-+]?[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?)/g;
let splitRegex = /[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g;

let PathParser = {

    parseGroup(str) {
        str = str.trim();

        if (str.toLowerCase() == 'z') {
            return {
                c: 'z'
            }
        }
        let param = {};

        let cChar = str.charAt(0);
        let pstr = str.substring(1).trim();

        param.c = cChar;

        let flag = cChar.toLowerCase();
        if (flag == 'a')
        {
            // A rx ry x-axis-rotation large-arc-flag sweep-flag x  y
            // a rx ry x-axis-rotation large-arc-flag sweep-flag dx dy


            // A 0.774274289608002 0.774274289608002 0 0 1 -0.0625001149695315 -2.41154651137165E-07
            let arr = pstr.split(' ');
            param.rx = +arr[0];
            param.ry = +arr[1];
            param.rot = +arr[2];
            param.arcFlag = +arr[3]; // 决定弧线是大于还是小于180度，0表示小角度弧，1表示大角度弧
            param.sweepFlag = +arr[4]; // 0表示从起点到终点沿逆时针画弧，1表示从起点到终点沿顺时针画弧。
            param.endX = +arr[5];
            param.endY = +arr[6];
        }
        else
        {
            let arr = pstr.split(' ');
            param.points = [+arr[0], +arr[1]];
        }
        return param;
    },

    parse(d) {
        let list = [];

        let groupArr = d.match(regGroup);
        for(let str of groupArr) {
            list.push(this.parseGroup(str));
        }
        return list;
    },

    /**
     * path解析，只要直线
     * @param pathData
     * @returns {*[]}
     */
    parsePathToCoordinates(pathData) {
        const coordinates = [];
        let currentX = 0, currentY = 0;
        let startX = 0, startY = 0;
        let prevX = 0, prevY = 0;
        let prevControlX = 0, prevControlY = 0;

        // 解析数字，支持科学记数法、负数、小数
        function parseNumbers(str) {
            const numbers = [];
            let match;
            while ((match = dataRegex.exec(str)) !== null) {
                numbers.push(parseFloat(match[0]));
            }
            return numbers;
        }

        // 分离命令和参数
        const commands = pathData.match(splitRegex) || [];

        commands.forEach(cmd => {
            const command = cmd[0];
            const isRelative = command === command.toLowerCase();
            const args = parseNumbers(cmd.substring(1));
            const upperCmd = command.toUpperCase();

            switch (upperCmd) {
                case 'M': // MoveTo
                    let len = args.length;
                    let n1 = args[len - 2];
                    let n2 = args[len - 1];

                    if (isRelative) {
                        currentX += n1 || 0;
                        currentY += n2 || 0;
                    } else {
                        currentX = n1 || currentX;
                        currentY = n2 || currentY;
                    }
                    startX = currentX;
                    startY = currentY;
                    // coordinates.push({ x: currentX, y: currentY, type: 'move', command: cmd });
                    coordinates.push([currentX, currentY]);
                    break;

                case 'L': // LineTo
                    for (let i = 0; i < args.length; i += 2) {
                        if (isRelative) {
                            currentX += args[i] || 0;
                            currentY += args[i + 1] || 0;
                        } else {
                            currentX = args[i] || currentX;
                            currentY = args[i + 1] || currentY;
                        }
                        // coordinates.push({ x: currentX, y: currentY, type: 'line', command: cmd });
                        coordinates.push([currentX, currentY]);
                    }
                    break;

                case 'H': // Horizontal LineTo
                    for (let i = 0; i < args.length; i++) {
                        if (isRelative) {
                            currentX += args[i];
                        } else {
                            currentX = args[i];
                        }
                        // coordinates.push({ x: currentX, y: currentY, type: 'line', command: cmd });
                        coordinates.push([currentX, currentY]);
                    }
                    break;

                case 'V': // Vertical LineTo
                    for (let i = 0; i < args.length; i++) {
                        if (isRelative) {
                            currentY += args[i];
                        } else {
                            currentY = args[i];
                        }
                        // coordinates.push({ x: currentX, y: currentY, type: 'line', command: cmd });
                        coordinates.push([currentX, currentY]);
                    }
                    break;

                case 'C': // Cubic Bezier
                    // for (let i = 0; i < args.length; i += 6) {
                    //     const x1 = isRelative ? currentX + args[i] : args[i];
                    //     const y1 = isRelative ? currentY + args[i + 1] : args[i + 1];
                    //     const x2 = isRelative ? currentX + args[i + 2] : args[i + 2];
                    //     const y2 = isRelative ? currentY + args[i + 3] : args[i + 3];
                    //     const x = isRelative ? currentX + args[i + 4] : args[i + 4];
                    //     const y = isRelative ? currentY + args[i + 5] : args[i + 5];
                    //
                    //     // 记录控制点（可选）
                    //     coordinates.push({
                    //         x: x,
                    //         y: y,
                    //         type: 'bezier',
                    //         command: cmd,
                    //         cp1: { x: x1, y: y1 },
                    //         cp2: { x: x2, y: y2 }
                    //     });
                    //
                    //     currentX = x;
                    //     currentY = y;
                    //     prevControlX = x2;
                    //     prevControlY = y2;
                    // }

                    if (isRelative) {
                        currentX += args[4];
                        currentY += args[5];
                    } else {
                        currentX = args[4];
                        currentY = args[5];
                    }

                    // coordinates.push({ x: currentX, y: currentY, type: 'C', command: cmd });
                    coordinates.push([currentX, currentY]);
                    break;

                case 'S': // Smooth Cubic Bezier
                    // for (let i = 0; i < args.length; i += 4) {
                    //     const x2 = isRelative ? currentX + args[i] : args[i];
                    //     const y2 = isRelative ? currentY + args[i + 1] : args[i + 1];
                    //     const x = isRelative ? currentX + args[i + 2] : args[i + 2];
                    //     const y = isRelative ? currentY + args[i + 3] : args[i + 3];
                    //
                    //     // // 计算第一个控制点（对称）
                    //     // const x1 = 2 * currentX - prevControlX;
                    //     // const y1 = 2 * currentY - prevControlY;
                    //     //
                    //     // coordinates.push({
                    //     //     x: x,
                    //     //     y: y,
                    //     //     type: 'bezier',
                    //     //     command: cmd,
                    //     //     cp1: { x: x1, y: y1 },
                    //     //     cp2: { x: x2, y: y2 }
                    //     // });
                    //
                    //
                    //
                    //     currentX = x;
                    //     currentY = y;
                    //     prevControlX = x2;
                    //     prevControlY = y2;
                    // }

                    if (isRelative) {
                        currentX += args[2];
                        currentY += args[3];
                    } else {
                        currentX = args[2];
                        currentY = args[3];
                    }

                    // coordinates.push({ x: currentX, y: currentY, type: 'S', command: cmd });
                    coordinates.push([currentX, currentY]);
                    break;

                case 'Q': // Quadratic Bezier
                    // for (let i = 0; i < args.length; i += 4) {
                    //     const x1 = isRelative ? currentX + args[i] : args[i];
                    //     const y1 = isRelative ? currentY + args[i + 1] : args[i + 1];
                    //     const x = isRelative ? currentX + args[i + 2] : args[i + 2];
                    //     const y = isRelative ? currentY + args[i + 3] : args[i + 3];
                    //
                    //     coordinates.push({
                    //         x: x,
                    //         y: y,
                    //         type: 'quadratic',
                    //         command: cmd,
                    //         cp: { x: x1, y: y1 }
                    //     });
                    //
                    //     currentX = x;
                    //     currentY = y;
                    //     prevControlX = x1;
                    //     prevControlY = y1;
                    // }
                    if (isRelative) {
                        currentX += args[2];
                        currentY += args[3];
                    } else {
                        currentX = args[2];
                        currentY = args[3];
                    }

                    // coordinates.push({ x: currentX, y: currentY, type: 'S', command: cmd });
                    coordinates.push([currentX, currentY]);
                    break;

                case 'T': // Smooth Quadratic Bezier
                    // for (let i = 0; i < args.length; i += 2) {
                    //     const x = isRelative ? currentX + args[i] : args[i];
                    //     const y = isRelative ? currentY + args[i + 1] : args[i + 1];
                    //
                    //     // 计算控制点（对称）
                    //     const x1 = 2 * currentX - prevControlX;
                    //     const y1 = 2 * currentY - prevControlY;
                    //
                    //     coordinates.push({
                    //         x: x,
                    //         y: y,
                    //         type: 'quadratic',
                    //         command: cmd,
                    //         cp: { x: x1, y: y1 }
                    //     });
                    //
                    //     currentX = x;
                    //     currentY = y;
                    //     prevControlX = x1;
                    //     prevControlY = y1;
                    // }
                    // if (isRelative) {
                    //     currentX += args[2];
                    //     currentY += args[3];
                    // } else {
                    //     currentX = args[2];
                    //     currentY = args[3];
                    // }
                    //
                    // coordinates.push({ x: currentX, y: currentY, type: 'S', command: cmd });
                    break;

                case 'A': // Arc
                    // for (let i = 0; i < args.length; i += 7) {
                    //     const rx = args[i];
                    //     const ry = args[i + 1];
                    //     const rotation = args[i + 2];
                    //     const largeArc = args[i + 3];
                    //     const sweep = args[i + 4];
                    //     const x = isRelative ? currentX + args[i + 5] : args[i + 5];
                    //     const y = isRelative ? currentY + args[i + 6] : args[i + 6];
                    //
                    //     coordinates.push({
                    //         x: x,
                    //         y: y,
                    //         type: 'arc',
                    //         command: cmd,
                    //         rx: rx,
                    //         ry: ry,
                    //         rotation: rotation,
                    //         largeArc: largeArc,
                    //         sweep: sweep
                    //     });
                    //
                    //     currentX = x;
                    //     currentY = y;
                    // }
                    if (isRelative) {
                        currentX += args[5];
                        currentY += args[6];
                    } else {
                        currentX = args[5];
                        currentY = args[6];
                    }

                    // coordinates.push({ x: currentX, y: currentY, type: 'S', command: cmd });
                    coordinates.push([currentX, currentY]);
                    break;

                case 'Z': // ClosePath
                    // if (currentX !== startX || currentY !== startY) {
                    //     coordinates.push({
                    //         x: startX,
                    //         y: startY,
                    //         type: 'close',
                    //         command: cmd
                    //     });
                    // }
                    // currentX = startX;
                    // currentY = startY;
                    break;
            }

            prevX = currentX;
            prevY = currentY;
        });

        return coordinates;
    }
}
export default PathParser;
