# Journal - campus-dev (Part 1)

> AI development session journal
> Started: 2026-10-15

---



## Session 1: Campus phase1 local baseline
<!-- trellis-session: v=2 fp=0dfbc7e6c54c8d48 -->

**Date**: 2026-10-15
**Task**: Campus phase1 local baseline
**Branch**: `feat/campus-phase1-wsl`

### Summary

Implemented loopback campus profile, Chinese entry, and local scripts. Backend tests 405 passed. AI/Clerk/ASR remain blocked. Not committed.

### Git Commits

| Hash | Message |
|------|---------|
| `0f0be2c176b3dd08ba8a574b75a6c9003ce86c61` | chore(release): 1.276.0 [skip ci] |

### Status

[OK] **Completed**


## Session 2: Phase 1.1 stabilize
<!-- trellis-session: v=2 fp=00e08d80ff2a7329 -->

**Date**: 2026-10-15
**Task**: Phase 1.1 stabilize
**Branch**: `feat/campus-phase1-wsl`

### Summary

Fixed template scan timeout, added isolation tests and locatable API errors. AI, voice, and Clerk remain blocked. No commit.

### Git Commits

(No commits - planning session)

### Status

[OK] **Completed**


## Session 3: 职芽 CareerSprout 完整改造与低内存验证
<!-- trellis-session: v=2 fp=c4743e8caab33ddc -->

**Date**: 2026-10-18
**Task**: 职芽 CareerSprout 完整改造与低内存验证
**Branch**: `feat/campus-phase1-wsl`

### Summary

已实施成长档案、岗位、口述简历、明确录音与转写确认、Resend预留、关联日志、授权荐才与品牌彩蛋；GitHub改名完成，本地目录被当前会话锁定。

### Main Changes

- 保留用户修改、上游署名与数据卷；无自动提交或推送。

### Git Commits

(No commits - planning session)

### Testing

- [OK] 后端声明套件428通过，校园专项35通过；前端27个测试文件分批通过，单次全套600秒超时如实记录；前端lint和384MiB校园构建通过。
- [OK] 真实模型/ASR/API/浏览器录音状态/中文PDF/隔离授权ZIP已验证；正式Clerk和真人设备未冒充通过。

### Status

[OK] **Completed**

### Next Steps

- 关闭占用career-pilot目录的当前omp会话，运行E:/github/rename-careersprout.ps1后从新路径验证启动；真实账号、邮件及真机另验。


## Session 4: Existing task continuation and novice workflow safety
<!-- trellis-session: v=2 fp=5f4f903570863a6b -->

**Date**: 2026-10-20
**Task**: Existing task continuation and novice workflow safety
**Branch**: `feat/career-sprout-experience-polish`

### Summary

Completed reachable import, screenshot jobs, resume safety and novice recovery work; actual source/model/API/browser/PDF checks recorded. No new task or commit. Human acceptance remains open.

### Main Changes

- Preserved existing work; corrected directory blocker; populated frontend specs; durable imports and revision/deletion safety.

### Git Commits

(No commits - planning session)

### Testing

- [OK] Campus backend79 passed; latest backend+schema153 passed; frontend61 passed plus final20 focused; campus build and scoped lint passed.
- [OK] Thirty real source files parsed; final captured-response replay30 reviewable with explicit issues, not30perfect resumes; three fresh final format model calls succeeded.
- [OK] Actual isolated API/browser import save retry, private job screenshot return, profile roundtrip, guarded restore, other-resume delete, Chinese PDF and interview context passed; synthetic data cleaned.

### Status

[OK] **Completed**

### Next Steps

- 3-5 novice students, formal Clerk accounts and physical-device acceptance remain; no archive or push.
