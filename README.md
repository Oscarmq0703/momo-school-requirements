# 美国音乐学院 MM Piano 申请要求检索

这是一个本地可运行的招生要求检索 MVP，当前聚焦：

- Degree: Master of Music
- Major: Piano Performance
- Secondary target: Collaborative Piano

## 本地运行

在当前目录启动静态服务器：

```powershell
node scripts/static-server.mjs 5173
```

然后打开：

```text
http://127.0.0.1:5173/
```

## 数据原则

为了保证准确度，任何招生字段只有在满足以下条件时才应标记为 `verified`：

- 来源是学校官方申请页面、学院/音乐学院页面、申请系统说明页，或官方 PDF。
- 字段有明确来源 URL。
- 字段记录了抓取或复核日期。
- 如果页面信息和 PDF 信息冲突，状态必须保持 `needs_review`。

当前导入的是学校清单，申请字段默认是 `not_started`，避免把未核验内容误展示成真实要求。

## 数据文件

学校清单在：

```text
data/schools.json
```

字段状态：

- `not_started`: 尚未抓取。
- `needs_review`: 已抓取或人工输入，但存在冲突、过期、缺少来源或需要二次确认。
- `verified`: 已用官方来源核验。

## 维护脚本

校验学校清单：

```powershell
node scripts/validate-data.mjs
```

生成后续抓取/人工核验队列：

```powershell
node scripts/build-research-queue.mjs
```

输出文件：

```text
research-queue.csv
```

## 下一阶段建议

优先先做 10 所学校的全字段官方核验样本，把字段结构、冲突处理、PDF 保存、更新时间展示跑通。确认流程后，再批量扩展到完整清单。
