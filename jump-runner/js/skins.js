// 角色定义：Kenney 平台跳跃角色素材（CC0 免费商用），sprite 字段对应素材目录
// 五位角色各有完整动作帧：跑步循环/跳/落/滑铲/受击/待机/骑行握把/蜷缩
const SKINS = [
  {
    id: 'classic', name: '阿杰', price: 0, sprite: 'player',
    fill: [255, 111, 91], dark: [201, 79, 59],
    hair: [255, 158, 64], cloth: [255, 255, 255],
    eye: [180, 90, 40], kind: 'boy_spiky',
  },
  {
    id: 'mint', name: '小薄荷', price: 100, sprite: 'female',
    fill: [78, 205, 196], dark: [48, 158, 150],
    hair: [52, 160, 150], cloth: [225, 252, 248],
    eye: [27, 110, 103],
  },
  {
    id: 'sunny', name: '探险家', price: 100, sprite: 'adventurer',
    fill: [255, 209, 102], dark: [216, 167, 55],
    hair: [141, 110, 99], cloth: [255, 244, 214],
    eye: [224, 150, 50],
  },
  {
    id: 'grape', name: '小队长', price: 200, sprite: 'soldier',
    fill: [155, 93, 229], dark: [112, 58, 180],
    hair: [74, 48, 128], cloth: [238, 232, 255],
    eye: [126, 63, 242],
  },
  {
    id: 'blossom', name: '小僵尸', price: 200, sprite: 'zombie',
    fill: [255, 143, 171], dark: [212, 96, 127],
    hair: [121, 85, 72], cloth: [255, 255, 255],
    eye: [236, 95, 138],
  },
];

function get(id) {
  for (const s of SKINS) if (s.id === id) return s;
  return SKINS[0];
}

function rgb(c, a) {
  return a === undefined
    ? 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'
    : 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
}

module.exports = { SKINS, get, rgb };
