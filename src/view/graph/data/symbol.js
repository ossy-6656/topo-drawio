export default `
        <!-- 站内-断路器(0305)：水平方向，两侧双箭头+中间红色矩形，与 lgdata.js 保持一致 -->
        <symbol id="breaker0305" viewBox="0 0 120 56" width="120" height="56">
            <!-- 左侧水平连接线 -->
            <line x1="0" y1="28" x2="18" y2="28" stroke="rgb(185,72,66)" stroke-width="4" fill="none"/>
            <!-- 左侧外箭头 -->
            <polyline points="8,16 18,28 8,40" stroke="rgb(185,72,66)" stroke-width="4" fill="none" stroke-linecap="butt" stroke-linejoin="miter"/>
            <!-- 左侧内箭头 -->
            <polyline points="18,16 28,28 18,40" stroke="rgb(185,72,66)" stroke-width="4" fill="none" stroke-linecap="butt" stroke-linejoin="miter"/>
            <!-- 中间红色矩形主体 -->
            <rect x="28" y="14" width="64" height="28" fill="rgb(185,72,66)" stroke="rgb(185,72,66)" stroke-width="4"/>
            <!-- 右侧水平连接线 -->
            <line x1="92" y1="28" x2="120" y2="28" stroke="rgb(185,72,66)" stroke-width="4" fill="none"/>
            <!-- 右侧外箭头 -->
            <polyline points="112,16 102,28 112,40" stroke="rgb(185,72,66)" stroke-width="4" fill="none" stroke-linecap="butt" stroke-linejoin="miter"/>
            <!-- 右侧内箭头 -->
            <polyline points="102,16 92,28 102,40" stroke="rgb(185,72,66)" stroke-width="4" fill="none" stroke-linecap="butt" stroke-linejoin="miter"/>
        </symbol>

        <!-- 断路器 Breaker：水平，两侧双箭头+中间实心矩形，viewBox=200x105 -->
        <symbol id="breaker" viewBox="0 0 200 105" width="120" height="63">
            <!-- 左连接线 -->
            <line x1="0" y1="52" x2="15" y2="52" stroke="rgb(185,72,66)" stroke-width="5" fill="none"/>
            <!-- 左外箭头 -->
            <polyline points="13,33 21,52 13,71" stroke="rgb(185,72,66)" stroke-width="5" fill="none" stroke-linecap="butt" stroke-linejoin="miter"/>
            <!-- 左内箭头 -->
            <polyline points="21,33 29,52 21,71" stroke="rgb(185,72,66)" stroke-width="5" fill="none" stroke-linecap="butt" stroke-linejoin="miter"/>
            <!-- 中间实心矩形 -->
            <rect x="29" y="33" width="142" height="39" fill="rgb(185,72,66)" stroke="rgb(185,72,66)" stroke-width="4"/>
            <!-- 右内箭头 -->
            <polyline points="179,33 171,52 179,71" stroke="rgb(185,72,66)" stroke-width="5" fill="none" stroke-linecap="butt" stroke-linejoin="miter"/>
            <!-- 右外箭头 -->
            <polyline points="187,33 179,52 187,71" stroke="rgb(185,72,66)" stroke-width="5" fill="none" stroke-linecap="butt" stroke-linejoin="miter"/>
            <!-- 右连接线 -->
            <line x1="185" y1="52" x2="200" y2="52" stroke="rgb(185,72,66)" stroke-width="5" fill="none"/>
        </symbol>

        <!-- 隔离开关 Disconnector：水平，两侧V形+中间空心矩形，viewBox=300x186 -->
        <symbol id="disconnector" viewBox="0 0 300 186" width="120" height="74">
            <!-- 水平通线 -->
            <line x1="0" y1="93" x2="300" y2="93" stroke="rgb(185,72,66)" stroke-width="5" fill="none"/>
            <!-- 左侧V形1 -->
            <polyline points="15,60 25,93 15,126" stroke="rgb(185,72,66)" stroke-width="5" fill="none" stroke-linecap="butt" stroke-linejoin="miter"/>
            <!-- 左侧V形2 -->
            <polyline points="25,60 37,93 25,126" stroke="rgb(185,72,66)" stroke-width="5" fill="none" stroke-linecap="butt" stroke-linejoin="miter"/>
            <!-- 右侧V形1 -->
            <polyline points="275,60 265,93 275,126" stroke="rgb(185,72,66)" stroke-width="5" fill="none" stroke-linecap="butt" stroke-linejoin="miter"/>
            <!-- 右侧V形2 -->
            <polyline points="285,60 275,93 285,126" stroke="rgb(185,72,66)" stroke-width="5" fill="none" stroke-linecap="butt" stroke-linejoin="miter"/>
            <!-- 中间空心矩形 -->
            <rect x="55" y="60" width="190" height="66" fill="none" stroke="rgb(185,72,66)" stroke-width="5"/>
        </symbol>

        <!-- 熔断器 Fuse：水平，两侧小V形+中间空心矩形，viewBox=300x128 -->
        <symbol id="fuse" viewBox="0 0 300 128" width="120" height="51">
            <!-- 水平通线 -->
            <line x1="0" y1="64" x2="300" y2="64" stroke="rgb(185,72,66)" stroke-width="5" fill="none"/>
            <!-- 左侧斜线组（仿原图V形） -->
            <line x1="17" y1="81" x2="28" y2="55" stroke="rgb(185,72,66)" stroke-width="4" fill="none"/>
            <line x1="20" y1="84" x2="28" y2="110" stroke="rgb(185,72,66)" stroke-width="4" fill="none"/>
            <!-- 右侧斜线组 -->
            <line x1="283" y1="81" x2="272" y2="55" stroke="rgb(185,72,66)" stroke-width="4" fill="none"/>
            <line x1="280" y1="84" x2="272" y2="110" stroke="rgb(185,72,66)" stroke-width="4" fill="none"/>
            <!-- 中间空心矩形 -->
            <rect x="55" y="38" width="190" height="53" fill="none" stroke="rgb(185,72,66)" stroke-width="5"/>
        </symbol>

        <!-- 节点/T接 Junction：红色实心三角，viewBox=260x300 -->
        <symbol id="junction" viewBox="0 0 260 300" width="52" height="60">
            <polygon points="3,3 3,297 257,150" fill="rgb(185,72,66)" stroke="rgb(185,72,66)" stroke-width="5"/>
        </symbol>

        <!-- 变压器 PowerTransformer：双圆+上方接线框，viewBox=300x328 -->
        <symbol id="powertransformer" viewBox="0 0 300 328" width="90" height="98">
            <!-- 右圆 -->
            <circle cx="198" cy="150" r="72" fill="none" stroke="rgb(185,72,66)" stroke-width="6"/>
            <!-- 左圆 -->
            <circle cx="102" cy="149" r="72" fill="none" stroke="rgb(185,72,66)" stroke-width="6"/>
            <!-- 右引出线 -->
            <line x1="270" y1="150" x2="330" y2="150" stroke="rgb(185,72,66)" stroke-width="6" fill="none"/>
            <!-- 上方接线框 -->
            <polyline points="90,-30 122,-30 144,-54 222,-54 226,-54 227,-54 227,30 227,31 227,37 142,36 130,13 92,13 88,13 88,-30 90,-30" fill="none" stroke="rgb(185,72,66)" stroke-width="6"/>
            <rect x="150" y="-30" width="54" height="42" fill="none" stroke="rgb(185,72,66)" stroke-width="6"/>
            <polyline points="139,38 126,60 190,60 198,46" fill="none" stroke="rgb(185,72,66)" stroke-width="6"/>
        </symbol>

        <!-- 电流互感器 CurrentTransformer：横穿线+小圆，viewBox=80x94 -->
        <symbol id="currenttransformer" viewBox="0 0 80 94" width="60" height="71">
            <!-- 横穿水平线 -->
            <line x1="0" y1="47" x2="80" y2="47" stroke="rgb(185,72,66)" stroke-width="3" fill="none"/>
            <!-- 中心小圆 -->
            <circle cx="42" cy="49" r="13" fill="none" stroke="rgb(185,72,66)" stroke-width="3"/>
        </symbol>

        <!-- 电压互感器 PotentialTransformer：两个重叠圆，viewBox=83x81 -->
        <symbol id="potentialtransformer" viewBox="0 0 83 81" width="70" height="68">
            <!-- 右圆 -->
            <circle cx="55" cy="43" r="23" fill="none" stroke="rgb(185,72,66)" stroke-width="3"/>
            <!-- 左圆 -->
            <circle cx="25" cy="43" r="23" fill="none" stroke="rgb(185,72,66)" stroke-width="3"/>
        </symbol>

        <!-- 远动装置 RemoteUnit：圆+内部十字+三角，viewBox=299x300 -->
        <symbol id="remoteunit" viewBox="0 0 299 300" width="70" height="70">
            <!-- 外圆 -->
            <circle cx="151" cy="160" r="115" fill="none" stroke="rgb(185,72,66)" stroke-width="8"/>
            <!-- 内三角（左侧指针） -->
            <polygon points="3,160 87,190 87,130" fill="rgb(185,72,66)" stroke="rgb(185,72,66)" stroke-width="1"/>
            <!-- 竖线 -->
            <line x1="151" y1="10" x2="151" y2="310" stroke="rgb(185,72,66)" stroke-width="8" fill="none"/>
            <!-- 横线 -->
            <line x1="91" y1="160" x2="301" y2="160" stroke="rgb(185,72,66)" stroke-width="8" fill="none"/>
        </symbol>

        <!-- 杆塔 PoleCode：实心圆，viewBox=160x160 -->
        <symbol id="polecode" viewBox="0 0 160 160" width="50" height="50">
            <circle cx="82" cy="82" r="78" fill="rgb(168,56,0)" stroke="rgb(0,0,0)" stroke-width="6"/>
        </symbol>

        <!-- 配电站(zf06)：黑色矩形+红色"PD"文字，viewBox=300x300 -->
        <symbol id="substation" viewBox="0 0 300 300" width="70" height="70">
            <rect x="2" y="2" width="296" height="296" fill="rgb(0,0,0)" stroke="rgb(185,72,66)" stroke-width="8"/>
            <text x="150" y="170" fill="rgb(185,72,66)" font-family="SimSun" font-size="140" text-anchor="middle" dominant-baseline="middle">PD</text>
        </symbol>

        <!-- 箱式变电站(zf08) XB：黑色矩形+红色"XB"文字，viewBox=300x300 -->
        <symbol id="xb" viewBox="0 0 300 300" width="70" height="70">
            <rect x="2" y="2" width="296" height="296" fill="rgb(0,0,0)" stroke="rgb(185,72,66)" stroke-width="8"/>
            <text x="150" y="170" fill="rgb(185,72,66)" font-family="SimSun" font-size="140" text-anchor="middle" dominant-baseline="middle">XB</text>
        </symbol>

        <!-- 避雷器 LightningArrester：竖线+外圆（蓝）+内圆（红），viewBox=100x160 -->
        <symbol id="lightningarrester" viewBox="0 0 100 160" width="50" height="80">
            <!-- 上方竖线 -->
            <line x1="50" y1="0" x2="50" y2="30" stroke="rgb(0,120,215)" stroke-width="5" fill="none"/>
            <!-- 外圆（蓝色空心） -->
            <circle cx="50" cy="80" r="45" fill="none" stroke="rgb(0,120,215)" stroke-width="5"/>
            <!-- 内圆（红色实心） -->
            <circle cx="50" cy="80" r="20" fill="rgb(185,72,66)" stroke="none"/>
            <!-- 下方竖线 -->
            <line x1="50" y1="130" x2="50" y2="160" stroke="rgb(0,120,215)" stroke-width="5" fill="none"/>
        </symbol>

        <!-- 接地刀闸 GroundDisconnector：横线+竖线+多条水平短线，viewBox=400x204 -->
        <symbol id="grounddisconnector" viewBox="0 0 400 204" width="120" height="61">
            <!-- 横向通线 -->
            <line x1="0" y1="93" x2="200" y2="93" stroke="rgb(185,72,66)" stroke-width="8" fill="none"/>
            <!-- 竖线 -->
            <line x1="66" y1="204" x2="66" y2="14" stroke="rgb(185,72,66)" stroke-width="8" fill="none"/>
            <!-- 接地短横线（从宽到窄） -->
            <line x1="26" y1="174" x2="106" y2="174" stroke="rgb(185,72,66)" stroke-width="8" fill="none"/>
            <line x1="36" y1="145" x2="96" y2="145" stroke="rgb(185,72,66)" stroke-width="8" fill="none"/>
            <line x1="46" y1="116" x2="86" y2="116" stroke="rgb(185,72,66)" stroke-width="8" fill="none"/>
        </symbol>
`