/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface HazardDefinition {
  id: number;
  label: string;
  details: string;
  category: string;
}

export const HAZARDS_DEFINITIONS: HazardDefinition[] = [
  // ===== 消防安全（消防部分） =====
  {
    id: 5,
    label: '安全指示牌（应急灯）隐患',
    details: '如安全指示牌、应急指示灯已损坏，或者被广告物、窗帘等故意遮挡。',
    category: '消防安全'
  },
  {
    id: 6,
    label: '安全出口安全隐患',
    details: '安全疏散通道或出口大门无法打开、锁死，或者通道、门口堆放杂物。',
    category: '消防安全'
  },
  {
    id: 7,
    label: '消防灭火器材隐患',
    details: '灭火器指针低于绿色安全区（压力不足），二氧化碳灭火器过期，或者消火栓箱被纸箱或绿植遮挡。',
    category: '消防安全'
  },
  {
    id: 8,
    label: '防火卷帘遮挡隐患',
    details: '防火卷帘下方、卷轴通道内堆放杂物或货架，导致卷帘无法正常启动和降落。',
    category: '消防安全'
  },
  {
    id: 9,
    label: '用电安全隐患',
    details: '影院范围内电线绝缘皮破损裸露、凌乱、配电箱未关门、私自拉设临时插线板，或在影院范围内给电动车电瓶充电。',
    category: '消防安全'
  },
  {
    id: 10,
    label: '违规使用局部取暖设备',
    details: '后台休息室、售票前台或影厅办公违规使用"小太阳"、明火电暖炉等高功率取暖器件插入机房等区域。',
    category: '消防安全'
  },
  {
    id: 16,
    label: '吸烟行为与禁烟警示缺失',
    details: '观众在影厅内、洗手间或通道等非指定吸烟处吸烟，或影院未按规定设置禁烟警示牌。',
    category: '消防安全'
  },
  // ===== 建筑安全（建筑部分） =====
  {
    id: 12,
    label: '改变房屋主体物理结构',
    details: '擅自拆改影院承重墙体、承重柱，或擅自切割影院房屋主体结构钢梁设施。',
    category: '建筑安全'
  },
  {
    id: 13,
    label: '未经审批审核的搭建加层',
    details: '在影院大厅内、夹层中违规擅自进行违章扩建、乱搭铁皮房或违章加高二层。',
    category: '建筑安全'
  },
  // ===== 食品安全（食品部分） =====
  {
    id: 11,
    label: '卖品区卫生环境差',
    details: '影院卖品区域卫生状况差，地面、柜台、设备有污渍、积尘，食品存放不符合卫生要求。',
    category: '食品安全'
  },
  {
    id: 14,
    label: '售卖过期、变质食品',
    details: '影院卖品区售卖超过保质期或已变质的食品、饮料，危害消费者健康。',
    category: '食品安全'
  },
  {
    id: 15,
    label: '未办理食品经营相关证照',
    details: '影院卖品区未办理食品经营许可证、卫生许可证，或工作人员未持有有效健康证。',
    category: '食品安全'
  }
];
