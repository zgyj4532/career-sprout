# 2026-10-23 Browser acceptance

Actual Chromium, current campus development entry, WSL Node24.14.1; isolated synthetic UID/database `closeout-browser-20261023` / `closeout_browser_20261023`. Not production-transfer/performance evidence, not formal Clerk authentication or physical-device acceptance.

Eight page/viewport captures: home, resume, interview preparation, feedback at360 and768. Each document scrollWidth equalled viewport width. Keyboard Tab reached a visible navigation control. At360, interview primary control measured328×44 CSS pixels and its center received pointer hit testing after scrolling. Screenshot full-page stitching captures sticky navigation/header at current scroll offset; actual viewport screenshot verified the button unobscured.

Real resume input and save initially encountered unavailable local infrastructure. Input remained intact and the ambiguous-save guard disabled duplicate creation. After infrastructure health200, explicit “检查保存结果并继续” checked operation404 then saved201; listing contained one synthetic resume. Reload and selecting that saved record restored content; “继续准备面试” navigated with resume ID/revision.

Feedback sample was inserted through actual Mongoose model into the isolated DB; feedback text explicitly says synthetic, not real model evaluation. Real API served history detail200. Expanded per-question feedback was inspected. No model/ASR calls or fabricated business success.

Artifacts: `browser-2026-10-23.json`, `home-{360,768}.png`, `resume-{360,768}.png`, `interview-{360,768}.png`, `feedback-{360,768}.png`, `feedback-expanded-360.png`.

Cleanup: closed owned browser tab; stopped own Vite/backend services; dropped only exact synthetic database and removed own `/tmp/closeout-browser-20261023`; deleted temporary seed/cleanup scripts. Original developer DB/files untouched. WSL was observed to stop infrastructure between commands without a persistent process; an owned WSL hold is used during integrated acceptance and will be stopped afterward.
