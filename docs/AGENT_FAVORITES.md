# Layer Studioのお気に入り演出とMCP

このフォークでは、cityedge版のSRT・字幕編集・モーションライブラリに、hirazisora版を参考にしたローカルMCPと独自演出を接続しています。

- 詳しい設定、ツール一覧、保存形式、検証方法：[mcp/README.md](../mcp/README.md)
- 全字幕の書体固定：画面の「全編の書体を固定」またはMCPの `font_set`。
- 1カットの演出：画面の「お気に入り演出…」または `favorite_*`。
- 字幕全体のカット構成：既存の「モーションライブラリ…」または `motion_*`。
- 独自演出：`custom_effect_spec` と `favorite_spec` を読み、JSONで定義・検証・登録・画像確認します。任意のJavaScriptは実行しません。

お気に入り専用ファイルは `.jizura-layer-favorites.json` です。ONE STOP EDITIONのバイナリ `.jizuraichifav` は読み込めません。プロジェクトJSONにはお気に入り・独自定義・適用済み演出が含まれます。音源・背景ファイルは含まれないので、再開時に選び直してください。

MCPの制作手順は `jizura-layer://workflow` でも取得できます。動画の品質記録はエージェントが実画像を確認して作るもので、利用者への追加の承認要求ではありません。
