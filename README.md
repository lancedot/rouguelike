# 夜诊（第一版原型）

一个基于 JSON 节点驱动的文字恐怖游戏原型，提供 CLI 与 Web UI 两种游玩方式。

## 已实现

- 开场姓名输入，支持 `{{player_name}}` 文本替换。
- 全局状态系统（布尔/计数）与条件分支。
- 规则页（未知 / 已发现 / 被污染）。
- 危险值 `danger` 驱动的环境异常文本插入。
- 关键死亡进入“替位后继续”分支，而非立即黑屏结束。
- 隐藏结局条件：
  - 不补空位
  - 不回应名字
  - 不接号码牌
  - 在队伍剩 3 人时离开
- Web UI：暗色夜诊风格、规则页+叙事区+选项区布局、轻量“系统污染”显示。

## 运行

### CLI

```bash
python3 game_engine.py
```

### Web

```bash
python3 -m http.server 8000
# 打开 http://localhost:8000/web/
```

## 数据结构

- 事件节点：`id`, `text`, `choices`, `on_enter`, `ending`
- 选项：`text`, `next`, `conditions`, `effects`
- 故事文件：`story/night_clinic.json`

