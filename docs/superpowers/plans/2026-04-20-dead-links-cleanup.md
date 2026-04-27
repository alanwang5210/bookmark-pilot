# Dead Links Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 增加一个“扫描失效书签和标签页并在确认后批量清理”的维护功能，清理前先列出结果给用户确认。

**Architecture:** 在后台增加一个可轮询的失效链接扫描任务，逐个检测书签与当前标签页 URL，把命中的失效项缓存为结果列表。设置页新增扫描、结果展示与确认清理 UI；清理执行后刷新索引和状态。失效判定只覆盖 `404 / 410 / DNS 失败 / 连接失败`，避免误删。

**Tech Stack:** Chrome extension background service worker、vanilla JavaScript、Chrome bookmarks/tabs API、fetch、设置页 HTML/CSS/JS

---

### Task 1: 为失效链接扫描判定逻辑编写失败测试

**Files:**
- Create: `D:\workspace\alan\project1\scripts\background\dead-links.test.mjs`
- Create: `D:\workspace\alan\project1\scripts\background\dead-links.js`

- [ ] **Step 1: 写“404 和 410 判定为失效”的失败测试**
- [ ] **Step 2: 写“DNS 失败和连接失败判定为失效”的失败测试**
- [ ] **Step 3: 写“403 / 500 / timeout 不直接判定为失效”的失败测试**
- [ ] **Step 4: 运行 `node --test scripts\background\dead-links.test.mjs` 并确认先失败**
- [ ] **Step 5: 实现最小判定逻辑让测试通过**
- [ ] **Step 6: 重新运行 `node --test scripts\background\dead-links.test.mjs` 并确认通过**

### Task 2: 新增后台扫描任务和清理执行入口

**Files:**
- Modify: `D:\workspace\alan\project1\scripts\shared\constants.js`
- Modify: `D:\workspace\alan\project1\scripts\background\background.js`
- Modify: `D:\workspace\alan\project1\scripts\background\dead-links.js`

- [ ] **Step 1: 增加消息类型常量**
- [ ] **Step 2: 在后台维护失效链接扫描进度与结果缓存**
- [ ] **Step 3: 新增 `SCAN_DEAD_LINKS` 消息处理**
- [ ] **Step 4: 新增 `GET_DEAD_LINK_SCAN_PROGRESS` 消息处理**
- [ ] **Step 5: 新增 `CLEAN_DEAD_LINKS` 消息处理**
- [ ] **Step 6: 清理后刷新书签索引和标签页索引**

### Task 3: 为扫描结果汇总与清理流程编写失败测试

**Files:**
- Modify: `D:\workspace\alan\project1\scripts\background\dead-links.test.mjs`
- Modify: `D:\workspace\alan\project1\scripts\background\dead-links.js`

- [ ] **Step 1: 写“扫描结果只包含命中失效的项目”的失败测试**
- [ ] **Step 2: 写“清理执行对书签调用 remove、对标签页调用 remove”的失败测试**
- [ ] **Step 3: 运行 `node --test scripts\background\dead-links.test.mjs` 并确认失败**
- [ ] **Step 4: 实现最小汇总与清理逻辑**
- [ ] **Step 5: 再次运行测试并确认通过**

### Task 4: 在设置页增加扫描与确认清理 UI

**Files:**
- Modify: `D:\workspace\alan\project1\options.html`
- Modify: `D:\workspace\alan\project1\styles.css`
- Modify: `D:\workspace\alan\project1\scripts\options\options.js`
- Modify: `D:\workspace\alan\project1\scripts\shared\i18n.js`

- [ ] **Step 1: 在“索引与隐私”区域新增“扫描失效链接”按钮**
- [ ] **Step 2: 新增扫描进度展示区域**
- [ ] **Step 3: 新增结果列表、勾选、摘要和“批量清理”按钮**
- [ ] **Step 4: 补充对应中英文文案**
- [ ] **Step 5: 在 options.js 中接入扫描启动、轮询、结果渲染和确认清理**

### Task 5: 回归验证

**Files:**
- Modify: `D:\workspace\alan\project1\scripts\background\dead-links.js`
- Modify: `D:\workspace\alan\project1\scripts\background\background.js`
- Modify: `D:\workspace\alan\project1\scripts\options\options.js`
- Modify: `D:\workspace\alan\project1\options.html`
- Modify: `D:\workspace\alan\project1\scripts\shared\constants.js`

- [ ] **Step 1: 运行 `node --test scripts\background\dead-links.test.mjs`**
- [ ] **Step 2: 运行 `node --check scripts\background\dead-links.js scripts\background\background.js scripts\options\options.js scripts\shared\constants.js scripts\shared\i18n.js`**
- [ ] **Step 3: 做一个结构检查，确认设置页包含扫描按钮和结果容器**
- [ ] **Step 4: 诚实记录剩余的运行时风险，例如站点反爬或临时网络抖动造成的误判边界**
