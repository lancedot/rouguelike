# 夜诊（第一版原型）

一个基于 JSON 节点驱动的文字恐怖游戏原型，提供 CLI 与可直接部署到分支根目录的 Web UI。

## 已实现

- 开场不输入姓名，系统随机发放号码（如 `{{player_ticket}}`）作为玩家指代。
- 全局状态系统（布尔/计数）与条件分支。
- 规则不明示，改为通过叙事异常与后果让玩家自行推断。
- 关键错误分支拥有独立死亡结局（补位 / 错队 / 应答 / 换位），并会解锁对应禁忌。
- 每次死亡会累计“重复排队次数”，重复次数越高，开场体感文案越深。
- Web 端提供“重新开始”按钮。
- Web 端提供“结局收集 + 禁忌记忆”界面，显示已达成结局数量与已解锁规则（本地存储）。
- 网页启动包含加载失败提示，避免空白页。

## 运行

### CLI

```bash
python3 game_engine.py
```

### Web

```bash
python3 -m http.server 8000
# 打开 http://localhost:8000/
```

### Git 分支直接发布（推荐）

- 将本仓库根目录作为静态站点入口（`index.html` 在分支根目录）。
- 若使用 GitHub Pages，选择从对应分支根目录（`/`）发布即可直接访问。

## 数据结构

- 事件节点：`id`, `text`, `choices`, `on_enter`, `ending`, `ending_title`, `ending_type`, `unlock_rule`
- 选项：`text`, `next`, `conditions`, `effects`
- 故事文件：`story/night_clinic.json`

