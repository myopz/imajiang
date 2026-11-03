export type RuleId = 'classic' | 'guangdong' | 'hongzhong' | 'laizi';

export interface RuleSet {
  id: RuleId;
  name: string;
  region: string;
  /** 'all' = 136 张；'hongzhong' = 万筒条 + 4 张红中，共 112 张 */
  tileSet: 'all' | 'hongzhong';
  allowChi: boolean;
  /** 是否允许点炮胡（否则只能自摸） */
  discardWin: boolean;
  wild: 'none' | 'hongzhong' | 'flip';
  thirteen: boolean;
  summary: string[];
}

export const RULESETS: RuleSet[] = [
  {
    id: 'classic', name: '大众麻将', region: '通用', tileSet: 'all', allowChi: true, discardWin: true,
    wild: 'none', thirteen: false,
    summary: ['136 张，可吃碰杠', '可点炮、可自摸，支持七对', '番型：碰碰胡、清一色、混一色、字一色、门前清等'],
  },
  {
    id: 'guangdong', name: '广东推倒胡', region: '广东', tileSet: 'all', allowChi: false, discardWin: true,
    wild: 'none', thirteen: true,
    summary: ['136 张，不能吃，只能碰杠', '鸡胡可胡，可点炮', '番型：对对胡、混一色、清一色、字一色、七对、十三幺'],
  },
  {
    id: 'hongzhong', name: '红中赖子', region: '湖南 / 湖北', tileSet: 'hongzhong', allowChi: false, discardWin: false,
    wild: 'hongzhong', thirteen: false,
    summary: ['112 张：万筒条 + 4 张红中', '红中为赖子，可当任意牌', '不能吃，只能自摸胡；不用红中胡牌算“硬胡”加番'],
  },
  {
    id: 'laizi', name: '武汉翻赖子', region: '湖北武汉', tileSet: 'all', allowChi: true, discardWin: true,
    wild: 'flip', thirteen: false,
    summary: ['136 张，按骰子点数翻一张“赖子皮”', '赖子皮的下一张为赖子，可当任意牌', '可吃碰杠；赖子不能被吃碰，硬胡加番'],
  },
];

export const getRule = (id: string): RuleSet => RULESETS.find((r) => r.id === id) ?? RULESETS[0];
