import { CapArt, GateArt, MicArt, NotebookArt } from './art/Decor'

export const CORE_NAV = [
  { to: '/profile', label: '了解自己', copy: '从课程、社团与真实技能开始。', Icon: CapArt },
  { to: '/jd', label: '找个方向', copy: '录入岗位，看清要求与下一步。', Icon: GateArt },
  { to: '/resume', label: '做简历', copy: '讲述经历，核对建议，保存与导出。', Icon: NotebookArt },
  { to: '/interview', label: '练面试', copy: '用真实材料练习，确认后再提交。', Icon: MicArt },
]
