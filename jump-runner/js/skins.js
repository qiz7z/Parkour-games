// 角色定义：Q 版小人（颜色 + 发型/服装），无需图片素材
// kind 决定造型：boy_cap 棒球帽男孩 / girl_twintails 双马尾 / girl_ponytail 马尾辫 / boy_hood 连帽卫衣 / girl_buns 丸子头
const SKINS = [
  {
    id: 'classic', name: '阿杰', price: 0, kind: 'boy_cap',
    fill: [255, 111, 91], dark: [201, 79, 59],        // 帽子/鞋
    hair: [93, 64, 55], cloth: [255, 255, 255],       // 头发/上衣
    eye: [109, 76, 65],
  },
  {
    id: 'mint', name: '小薄荷', price: 100, kind: 'girl_twintails',
    fill: [78, 205, 196], dark: [48, 158, 150],       // 连衣裙
    hair: [52, 160, 150], cloth: [225, 252, 248],     // 头发/发绳裙边
    eye: [27, 110, 103],
  },
  {
    id: 'sunny', name: '柠檬少女', price: 100, kind: 'girl_ponytail',
    fill: [255, 209, 102], dark: [216, 167, 55],      // 连衣裙
    hair: [141, 110, 99], cloth: [255, 244, 214],     // 头发/发绳
    eye: [224, 150, 50],
  },
  {
    id: 'grape', name: '葡萄少年', price: 200, kind: 'boy_hood',
    fill: [155, 93, 229], dark: [112, 58, 180],       // 连帽卫衣
    hair: [74, 48, 128], cloth: [238, 232, 255],      // 头发/帽绳
    eye: [126, 63, 242],
  },
  {
    id: 'blossom', name: '樱子', price: 200, kind: 'girl_buns',
    fill: [255, 143, 171], dark: [212, 96, 127],      // 连衣裙
    hair: [121, 85, 72], cloth: [255, 255, 255],      // 头发/发饰领口
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
