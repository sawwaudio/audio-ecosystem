# sawwaudio.github.io の直下に置くファイル（AI のクローラー対策）

robots.txt・ai.txt・.well-known/tdmrep.json は、サイトの**一番上**（https://sawwaudio.github.io/robots.txt）にないと読まれない。
アプリは https://sawwaudio.github.io/audio-ecosystem/ の下にあるので、このリポジトリに置いても効かない。

置き方：GitHub に `sawwaudio/sawwaudio.github.io` という名前の公開リポジトリを作り、このフォルダの中身（robots.txt・ai.txt・.well-known/tdmrep.json）をそのまま入れる。
GitHub Pages が自動で https://sawwaudio.github.io/ に公開する（アプリの URL は変わらない）。

効き目と限界：
- robots.txt・ai.txt・tdm-reservation は「お願い」の表明。主要な AI 企業のクローラー（GPTBot・ClaudeBot・Google-Extended・CCBot など）は従うと公表しているが、従わないクローラーは止められない。
- リポジトリ（コード）が公開のままだと、GitHub 上のコードは誰でも読める。確実に止めるには、リポジトリを非公開にして配信を別の場所（例：Cloudflare Pages の「AI ボットをブロック」）に移す必要がある。
