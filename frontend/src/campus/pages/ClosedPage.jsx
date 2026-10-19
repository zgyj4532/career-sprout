import { Link } from 'react-router-dom'
export default function ClosedPage() {
  return <section className="campus-form"><h1>这个入口暂未开放</h1><p>职芽专注档案、岗位、简历和面试。作品集、社区、支付和爬虫不在当前开放范围。</p><Link className="button" to="/">返回首页，继续下一步</Link></section>
}
