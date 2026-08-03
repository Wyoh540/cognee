# 工作空间选择页头用户入口 + 侧边栏 Members 入口

**日期:** 2026-08-03
**作者:** brainstorming (Claude)
**状态:** 待用户审阅

## 1. 目标

两个独立但相邻的前端调整:

1. **工作空间选择页(WorkspacePicker)头部右侧添加用户头像** — 让用户在选择/切换工作空间时也能登出或重新登录,而不是被迫先去选一个工作空间。
2. **将 Members 入口从 TopBar 头像下拉中移到左侧导航栏** — 提升可见性与可发现性,符合"工作空间管理"的导航语义。

## 2. 范围

| 变更 | 涉及文件 | 类型 |
|---|---|---|
| WorkspacePicker 头部右侧添加 ProfileMenu | `cognee-frontend/src/ui/layout/WorkspacePicker.tsx` | 修改 |
| 侧边栏新增 MANAGE 分区 + Members 项 | `cognee-frontend/src/ui/layout/Navbar/CustomAppShellNavbar.tsx` | 修改 |
| ProfileMenu 移除 Members 链接 + `showMembers` | `cognee-frontend/src/ui/layout/ProfileMenu.tsx` | 修改 |
| TopBar 移除 `isOwner` / `showMembers` 相关 | `cognee-frontend/src/ui/layout/TopBar.tsx` | 修改 |

**不在范围:**

- `/members` 页面本身的修改
- 登出流程 `/api/signout` 的修改
- 现有 `useCurrentUser` / `useTenant` 的修改
- 成员数徽章、搜索/筛选等增量功能

## 3. 当前状态

- `WorkspacePicker.tsx`:头部仅左侧有 logo + "Workspaces" 文字,右侧空白。
- `TopBar.tsx`:右侧 `ProfileMenu` 中包含 Profile、Members(仅 `isOwner`)、Log out 三项。
- `CustomAppShellNavbar.tsx`:`NAV_SECTIONS` 有 DATA / EXPLORE / CONNECT 三个分区,不含 Members。
- `/members` 是完整的成员管理页(添加/删除成员、角色等)。
- 路由标签 `TopBar.ROUTE_LABELS["/members"] = "Members"` 已存在但 `TopBar` 中未被使用(可有可无保留)。

## 4. 设计

### 4.1 WorkspacePicker 头部右侧

**目标:** 在已有的 `header` 中,把右半部分从空白改为 `ProfileMenu`,仅对已登录用户渲染。

**实现要点:**

- `WorkspacePicker` 内已有 `useCurrentUser()` 调用,直接复用。
- 在 `header` 内,`<span>Workspaces</span>` 之后插入一个 `marginLeft: auto` 的占位 div,内含 `<ProfileMenu />`。
- 当 `currentUser` 为 null 时不渲染头像。
- `ProfileMenu` 的 `profileHref` / `logoutHref` 用默认值(`/settings`、`/api/signout`),不传参。

**Header 结构变化:**

```
<header> [240px logo box] [Workspaces text] [.... marginLeft:auto ....] [ProfileMenu]</header>
```

### 4.2 侧边栏新增 MANAGE 分区

**目标:** 在 `NAV_SECTIONS` 中追加一项 `MANAGE`,仅对 `isOwner` 渲染,避免污染非所有者视图。

**实现要点:**

- 新增 `UsersIcon` 组件,与 `ProfileMenu` 之前内联版本相同的 SVG 形状,但在 `active` 状态下描边色为 `#BC9BFF`。
- 在 `CustomAppShellNavbar` 中通过 `useTenant()` 拿到 `isOwner`(已有 import)。
- `NAV_SECTIONS` 改为基于 `isOwner` 动态计算:`const sections = isOwner ? [...BASE_SECTIONS, MANAGE] : BASE_SECTIONS`。
- `MANAGE` 分区结构与 DATA / EXPLORE / CONNECT 一致,只含一项:`{ text: "Members", link: "/members", icon: UsersIcon }`。
- Members 暂不加入 `POD_DEPENDENT_LINKS`:当 `tenantReady=false` 时,`<main>` 已被 `WorkspaceProvisioning` 替代,用户无法在加载完成前进入 Members。

### 4.3 ProfileMenu 清理

**目标:** 移除 Members 相关代码,简化组件。

**实现要点:**

- 删除 `ProfileMenuProps.showMembers` 字段。
- 删除 `ProfileMenu` 函数签名中的 `showMembers` 参数。
- 删除 `showMembers && <Link href="/members">` 整段 JSX。
- 删除 `UsersIcon` 函数(此文件内不再使用)。

### 4.4 TopBar 清理

**目标:** 不再向 ProfileMenu 传 `showMembers`,移除 TopBar 内对 `isOwner` 的获取(若仅为此用)。

**实现要点:**

- 移除 `const { isOwner } = useTenant()`(若 TopBar 还有其它地方使用 `isOwner`,则保留)。
- 移除 `<ProfileMenu ... showMembers={isOwner} />` 中的 `showMembers` 传参。
- `ROUTE_LABELS["/members"]` 项保留(无副作用)。

## 5. 数据流与状态

无新增数据源:

- 用户信息:走 `useCurrentUser`(已有)。
- 是否所有者:走 `useTenant().isOwner`(已有)。
- Members 列表:仍由 `/members` 页面内的 `getTenantUsers` 获取,侧边栏导航项不取这个数据(只展示文本,不做计数徽章)。

## 6. 错误处理

- `ProfileMenu` 自身已有 `useOutsideClick` 关闭下拉,无需新增。
- `useCurrentUser` 加载中或未登录:WorkspacePicker 头部右侧不渲染头像(避免假用户)。
- `isOwner` 在租户切换中间状态不可用:侧边栏不渲染 MANAGE 分区(而不是渲染一个永远跳到 403 的入口)。

## 7. 测试与验证

不引入新单元测试文件,沿用手动验证流程。

**手动验证清单:**

1. 在 WorkspacePicker 头部右上角看到用户头像,点击可下拉 Log out。
2. 登出后重新登录(新账号)再次进入 WorkspacePicker,头像显示新账号信息。
3. 所有者账号登录后,侧边栏可见 MANAGE > Members;进入页面正常。
4. 非所有者账号登录后,侧边栏**不**显示 MANAGE 分区。
5. TopBar 头像下拉中不再有 Members 链接。
6. 切换租户时 MANAGE 分区随 `isOwner` 变化正确显示/隐藏。
7. 移动端抽屉式侧边栏同样显示 MANAGE(Members 不应只在桌面端可见)。

**类型检查:**

- 运行项目类型检查命令,确保删除 `showMembers` 后无遗漏调用。

## 8. 风险与权衡

- **风险 1:** 在 WorkspacePicker 渲染 ProfileMenu 之前,`useCurrentUser` 异步加载,头像可能闪烁。
  - **缓解:** 未加载完时不渲染头像,加载完再渲染——与现有 TopBar 行为一致。
- **风险 2:** 重复显示 Members(若 ProfileMenu 清理不彻底)。
  - **缓解:** "测试与验证"清单第 5 条专门覆盖。
- **权衡:** 侧边栏不显示成员数徽章。若产品后续要求"管理员能在导航一眼看到成员总数",属于增量功能,留作后续 PR。

## 9. 实施步骤概要

1. 修改 `ProfileMenu.tsx` — 移除 `showMembers`、Members 链接、内联 `UsersIcon`。
2. 修改 `TopBar.tsx` — 移除 `isOwner` / `showMembers` 传参。
3. 修改 `WorkspacePicker.tsx` — 在头部右侧添加 `ProfileMenu`(仅在 `currentUser` 存在时)。
4. 修改 `CustomAppShellNavbar.tsx` — 新增 `UsersIcon`、新增 `MANAGE` 分区、根据 `isOwner` 动态渲染。
5. 类型检查 + 手动验证清单逐条过。
