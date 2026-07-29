# 观迹 · Museum Log

一个移动端优先、默认私有的博物馆、展览、遗址与古建参观档案。

## 本地运行

需要 Node.js `>=22.13.0`。

```bash
npm ci
npm run dev
```

## 验证

```bash
npm test
npx tsc --noEmit
npm run lint
```

`npm test` 会完成生产构建，并验证应用入口、数据库模型、关键归档动作与 R2
原始照片写入路径。

## 持久化

- D1 `DB`：地点、展览、参观、对象、照片组、现场记录、旅程、标签及其关系。
- R2 `PHOTOS`：用户主动上传的原始照片。
- `drizzle/`：由 Sites 在部署时执行的版本化数据库迁移。

`.openai/hosting.json` 只声明资源绑定和 Sites 项目 ID，不存放密钥。
