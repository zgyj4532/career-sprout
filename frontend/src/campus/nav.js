import { CapArt, GateArt, MicArt, NotebookArt } from './art/Decor'

export const CORE_NAV = [
  { to: '/resume', label: '做简历', copy: '编辑、保存、导出中文 PDF。', Icon: NotebookArt },
  { to: '/interview', label: '练面试', copy: '普通语音面试。没有语音服务时会说明原因。', Icon: MicArt },
  { to: '/jd', label: '分析岗位', copy: '粘贴岗位描述，不抓取招聘网站。', Icon: GateArt },
  { to: '/profile', label: '我的档案', copy: '保存姓名、技能和年级。', Icon: CapArt },
]
