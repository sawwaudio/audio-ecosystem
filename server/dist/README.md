# server/dist

worker.bundle.js は server/worker.js と growth/*.mjs を esbuild で1ファイルにまとめたもの（Cloudflare のダッシュボードから入れる版）。
作り方：`npx esbuild@0.24.0 server/worker.js --bundle --format=esm --platform=neutral --outfile=server/dist/worker.bundle.js`
確かめ方：server/test_worker.mjs の import を ./dist/worker.bundle.js に変えて実行する。
