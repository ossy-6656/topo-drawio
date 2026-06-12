export default `
        <!-- 电压互感器-双绕组(0314)：双圆竖向排列、无黑底；与 3w 同量级坐标 -->
        <symbol id="potentialtransformer2w" viewBox="0 0 3 3" width="3" height="3">
            <circle cx="50" cy="34" r="26" fill="none" stroke="rgb(185,72,66)" stroke-width="4"/>
            <circle cx="50" cy="72" r="26" fill="none" stroke="rgb(185,72,66)" stroke-width="4"/>
        </symbol>

        <!-- 电压互感器-三绕组(0314)：三圆品字、无黑底 -->
        <symbol id="potentialtransformer3w" viewBox="0 0 3 3" width="3" height="3">
            <circle cx="55" cy="34" r="26" fill="none" stroke="rgb(185,72,66)" stroke-width="4"/>
            <circle cx="32" cy="72" r="26" fill="none" stroke="rgb(185,72,66)" stroke-width="4"/>
            <circle cx="78" cy="72" r="26" fill="none" stroke="rgb(185,72,66)" stroke-width="4"/>
        </symbol>

        <!-- 发电机组：黑底圆 + 赭红边 + 红色「G」（与负荷块设备配色一致） -->
        <symbol id="generatingunit" viewBox="0 0 3 3" width="3" height="3">
            <circle cx="50" cy="50" r="40" fill="rgb(0,0,0)" stroke="rgb(185,72,66)" stroke-width="5"/>
            <text x="50" y="58" fill="rgb(185,72,66)" font-family="SimSun" font-size="46" text-anchor="middle" dominant-baseline="middle">G</text>
        </symbol>

        <!-- 配电站(zf06)：与 lgdata Substation_30000005_1030020 一致 3×3 单位 -->
        <symbol id="substation" viewBox="0 0 3 3" width="3" height="3">
            <polygon fill="rgb(0,0,0)" points="0.025,0.025 0.025,3.025 3.025,3.025 3.025,0.025" stroke="rgb(185,72,66)" stroke-linecap="butt" stroke-linejoin="miter" stroke-width="0.15"/>
            <text dy=".3em" fill="rgb(185,72,66)" font-family="SimSun" font-size="2" stroke="none" style="text-anchor:middle" x="1.538" y="1.503">PD</text>
        </symbol>

        <!-- 箱式变电站(zf08)：与 lgdata Substation_32300000_1030050 一致 3×3 单位 -->
        <symbol id="xb" viewBox="0 0 3 3" width="3" height="3">
            <polygon fill="rgb(0,0,0)" points="0.025,0.025 0.025,3.025 3.025,3.025 3.025,0.025" stroke="rgb(185,72,66)" stroke-linecap="butt" stroke-linejoin="miter" stroke-width="0.15"/>
            <text dy=".3em" fill="rgb(185,72,66)" font-family="SimSun" font-size="2" stroke="none" style="text-anchor:middle" x="1.538" y="1.503">XB</text>
        </symbol>

        <!-- 柱上-用户变压器(0110)：横向双圆+引线；Y 向居中使旋转中心与接线中点一致 -->
        <symbol id="ptuser" viewBox="0 0 3 2.550548" width="3" height="2.550548">
            <circle cx="1.175" cy="1.265274" r="0.6" fill="none" stroke="rgb(0,204,255)" stroke-width="0.1" stroke-linecap="butt" stroke-linejoin="miter"/>
            <circle cx="1.975" cy="1.275274" r="0.6" fill="none" stroke="rgb(185,72,66)" stroke-width="0.1" stroke-linecap="butt" stroke-linejoin="miter"/>
            <line x1="2.575" y1="1.275274" x2="3.075" y2="1.275274" fill="none" stroke="rgb(185,72,66)" stroke-width="0.1" stroke-linecap="butt" stroke-linejoin="miter"/>
            <line x1="0.575" y1="1.285274" x2="0.075" y2="1.285274" fill="none" stroke="rgb(0,204,255)" stroke-width="0.1" stroke-linecap="butt" stroke-linejoin="miter"/>
            <use x="3.075" y="1.275274" terminal-index="1" type="0" xlink:href="#terminal"/>
            <use x="0.075" y="1.275274" terminal-index="2" type="0" xlink:href="#terminal"/>
        </symbol>

        <!-- 站内断路器(0305) 闭合：实心 -->
        <symbol id="cbreaker" viewBox="0 0 3 3" width="3" height="3">
            <line x1="1.5" y1="0.15" x2="1.5" y2="0.5" stroke="rgb(255,0,0)" stroke-width="0.12" stroke-linecap="round"/>
            <rect x="1.12" y="0.5" width="0.76" height="2" fill="rgb(255,0,0)" stroke="none"/>
            <line x1="1.5" y1="2.5" x2="1.5" y2="2.85" stroke="rgb(255,0,0)" stroke-width="0.12" stroke-linecap="round"/>
            <use x="1.5" y="0.08" terminal-index="1" type="0" xlink:href="#terminal"/>
            <use x="1.5" y="2.92" terminal-index="2" type="0" xlink:href="#terminal"/>
        </symbol>

        <!-- 光伏配变角标：深蓝底 + 青色栅格，叠在配变图元上方 -->
        <symbol id="pvsolar" viewBox="0 0 3 2" width="3" height="2">
            <rect x="0.12" y="0.12" width="2.76" height="1.76" fill="rgb(0,24,48)" stroke="rgb(0,200,255)" stroke-width="0.1"/>
            <line x1="1" y1="0.12" x2="1" y2="1.88" stroke="rgb(0,200,255)" stroke-width="0.06"/>
            <line x1="2" y1="0.12" x2="2" y2="1.88" stroke="rgb(0,200,255)" stroke-width="0.06"/>
            <line x1="0.12" y1="1" x2="2.88" y2="1" stroke="rgb(0,200,255)" stroke-width="0.06"/>
        </symbol>

        <!-- 站内断路器(0305) 断开：空心 -->
        <symbol id="cbreaker_open" viewBox="0 0 3 3" width="3" height="3">
            <line x1="1.5" y1="0.15" x2="1.5" y2="0.5" stroke="rgb(255,0,0)" stroke-width="0.12" stroke-linecap="round"/>
            <rect x="1.12" y="0.5" width="0.76" height="2" fill="none" stroke="rgb(255,0,0)" stroke-width="0.12"/>
            <line x1="1.5" y1="2.5" x2="1.5" y2="2.85" stroke="rgb(255,0,0)" stroke-width="0.12" stroke-linecap="round"/>
            <use x="1.5" y="0.08" terminal-index="1" type="0" xlink:href="#terminal"/>
            <use x="1.5" y="2.92" terminal-index="2" type="0" xlink:href="#terminal"/>
        </symbol>
`