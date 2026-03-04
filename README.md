# 夜诊（第一版原型）

一个基于 JSON 节点驱动的文字恐怖游戏原型。

## 已实现

- 开场姓名输入，支持 `{{player_name}}` 文本替换。
- 全局状态系统（布尔/计数）与条件分支。
- 规则页（可发现、可污染）。
- 危险值 `danger` 驱动的环境异常文本插入。
- 关键死亡进入“替位后继续”分支，而非立即黑屏结束。
- 隐藏结局条件：
  - 不补空位
  - 不回应名字
  - 不接号码牌
  - 在队伍剩 3 人时离开

## 运行

```bash
python3 game_engine.py
```

## 数据结构

- 事件节点：`id`, `text`, `choices`, `on_enter`, `ending`
- 选项：`text`, `next`, `conditions`, `effects`
- 故事文件：`story/night_clinic.json`

