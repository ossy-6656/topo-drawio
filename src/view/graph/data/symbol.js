export default `
        <!-- 电压互感器-双绕组(0314)：仅双圆、无黑底；小 init 尺寸避免 × getScale 后过大 -->
        <symbol id="potentialtransformer2w" viewBox="0 0 3 3" width="3" height="3">
            <circle cx="64" cy="44" r="30" fill="none" stroke="rgb(185,72,66)" stroke-width="4"/>
            <circle cx="36" cy="44" r="30" fill="none" stroke="rgb(185,72,66)" stroke-width="4"/>
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
`