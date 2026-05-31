# Lexibush

Lexibush 是 Lexilorries 的 Node.js / Astro 重制版：用于积累单词、短语与词根词缀的动态网页版工具。

## 功能

- 单词/短语增删改查，数据格式沿用 `data/words.json`
- 词根词缀管理，数据格式沿用 `data/affixes.json`
- 精确、前缀、后缀、包含查询分别放在独立子选项卡；短语会按空格拆词参与非精确查询
- 单条导入复刻 Lexilorries 的逐词性输入，并支持动态增加/删除词性-释义框
- 批量导入单词和词根词缀分别提供独立子选项卡，支持 JSON、逗号、空格格式
- 删除词条前自动用 `data/.git` 建立快照，并提供快照创建、刷新、列表与恢复
- 内置少量基础词根词缀，可一键播种
- 原生 JS 统计面板，热力图按周排布，最多显示最近 180 天，可下载统计 JSON
- 设置页支持主题模式、主题风格、字号缩放与字体设置
- 添加词条时可查询外部词典并自动填入词性释义

## 运行

```bash
npm install
npm run dev
```

打开 `http://localhost:4321`。

## 数据与存档

主仓库忽略 `data/`，实际数据保存在：

- `data/words.json`
- `data/affixes.json`

程序会在 `data/` 内初始化独立 Git 仓库。删除词条前会提交快照；也可以在页面“存档”面板中手动建立快照、查看历史、恢复到某个提交。

## 词典查询

默认使用 Free Dictionary API 作为无需密钥的回退。若要使用 Oxford Dictionaries API，可配置：

```bash
OXFORD_APP_ID=...
OXFORD_APP_KEY=...
```

Oxford API 返回字段会被程序尽量解析成 `n.`、`v.`、`adj.` 等词性映射。
