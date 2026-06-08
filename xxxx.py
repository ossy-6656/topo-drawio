import xml.etree.ElementTree as ET

def parse_link_ids(link_str):
    ids = []
    if not link_str:
        return ids
    segments = link_str.strip().rstrip(';').split(';')
    for seg in segments:
        parts = seg.split(',')
        if len(parts) >= 3:
            ids.append(parts[2])
    return ids

def parse_node_area(node_area_str):
    """返回列表：[(port_idx, node_id), ...]"""
    res = []
    if not node_area_str:
        return res
    segments = node_area_str.strip().rstrip(';').split(';')
    for seg in segments:
        parts = seg.split(',')
        if len(parts) >= 3:
            port_idx = parts[0]
            node_id = parts[2]
            res.append((port_idx, node_id))
    return res

# 电压配置：voltype -> (color, level)
VOLTAGE_CONFIG = {
    '1005': ('192,0,192', 5),   # 220kV 紫
    '1006': ('185,72,66',   4),   # 110kV 红
    '1008': ('255,255,0', 3),   # 35kV 黄
    # '1009': ('185,72,66', 2),   # 10kV 红
}
DEFAULT_COLOR = '128,128,128'

def get_best_voltype(voltype_list):
    """从 [voltype1, voltype2, voltype3] 选等级最高的"""
    best = None
    best_level = -1
    for vt in voltype_list:
        if vt in VOLTAGE_CONFIG:
            _, lv = VOLTAGE_CONFIG[vt]
            if lv > best_level:
                best_level = lv
                best = vt
    return best

def main():
    input_file = '123.g'
    output_file = '123_output.g'

    with open(input_file, 'r', encoding='GBK') as f:
        xml_content = f.read()
    root = ET.fromstring(xml_content)

    id_to_voltage = {}

    # 第1遍：普通设备（带 voltype）和 Bus
    for elem in root.iter():
        eid = elem.attrib.get('id')
        if not eid:
            continue
        # 普通设备 voltype
        vt = elem.attrib.get('voltype')
        if vt in VOLTAGE_CONFIG:
            id_to_voltage[eid] = vt
        # Bus 也可能带 voltype，一并映射
        if elem.tag == 'Bus' and vt in VOLTAGE_CONFIG:
            id_to_voltage[eid] = vt

    # 第2遍：专门处理 Transformer3
    for elem in root.iter('Transformer3'):
        tid = elem.attrib.get('id')
        if not tid:
            continue

        # 取三个绕组电压
        vt1 = elem.attrib.get('voltype1')
        vt2 = elem.attrib.get('voltype2')
        vt3 = elem.attrib.get('voltype3')
        vt_list = [vt1, vt2, vt3]

        # 整个变压器取最高电压（用于自身图元）
        best_vt = get_best_voltype(vt_list)
        if best_vt:
            id_to_voltage[tid] = best_vt

        # 关键：node_area 每个端口ID 一一对应 voltype1/2/3
        node_area = elem.attrib.get('node_area', '')
        port_nodes = parse_node_area(node_area)
        for i, (port_idx, node_id) in enumerate(port_nodes):
            if i < len(vt_list):
                vt = vt_list[i]
                if vt in VOLTAGE_CONFIG:
                    id_to_voltage[node_id] = vt  # 端口ID映射到对应电压

    # 第3遍：给 ConnectLine 上色
    line_count = 0
    debug_lines = []
    for line in root.iter('ConnectLine'):
        link_str = line.attrib.get('link', '')
        linked_ids = parse_link_ids(link_str)

        best_vt = None
        best_level = -1
        for lid in linked_ids:
            if lid in id_to_voltage:
                vt = id_to_voltage[lid]
                _, lv = VOLTAGE_CONFIG[vt]
                if lv > best_level:
                    best_level = lv
                    best_vt = vt

        color, _ = VOLTAGE_CONFIG.get(best_vt, (DEFAULT_COLOR, 0))
        line.set('lc', color)
        line_count += 1

        # 调试记录
        debug_lines.append({
            'link': link_str,
            'ids': linked_ids,
            'best_vt': best_vt,
            'color': color
        })

    # 可选：设备图元上色
    for elem in root.iter():
        eid = elem.attrib.get('id')
        if eid in id_to_voltage:
            vt = id_to_voltage[eid]
            color, _ = VOLTAGE_CONFIG.get(vt, (DEFAULT_COLOR, 0))
            elem.set('lc', color)
            elem.set('fc', color)

    # 保存
    tree = ET.ElementTree(root)
    tree.write(output_file, encoding='GBK', xml_declaration=True)
    print(f"完成！共处理 {line_count} 条线 → {output_file}")

    # 打印前10条线调试信息（方便你定位哪类线错）
    print("\n=== 前10条线调试 ===")
    for i, d in enumerate(debug_lines[:10]):
        print(f"{i+1} color={d['color']} vt={d['best_vt']} ids={d['ids']}")

if __name__ == '__main__':
    main()