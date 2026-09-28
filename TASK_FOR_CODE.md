# 作業依頼: Honest Headers を Chrome ウェブストアに申請する

## 前提
- あなたはこのパソコンの画面(ブラウザ)を操作できるはず。まずそれを確認してから進めてください。
- 対象のストア管理画面: Chrome ウェブストア デベロッパー ダッシュボード (chrome.google.com/webstore/devconsole)
- 対象アイテム: **Honest Headers – Modify HTTP Headers**(ステータス: ドラフト、ID: nomciaobihmigkiocpafmhmhcabpneif)
- ログインはユーザー本人の Google アカウント(kei.inoue0612@gmail.com)。ログイン画面が出たら、そこだけユーザーに代わってもらってください。
- 公開設定、料金(無料)、販売地域(すべての地域)はすでに正しく入力済みなので触らない。

## ゴール
「審査のため送信」ボタンを押せる状態にして、実際に送信すること。

## 手順

### 1. 状況確認
ダッシュボードでこのアイテムを開き、「送信できない理由」をクリックして、今どんなエラーが残っているか確認する。

### 2. 「プライバシー」タブを開いて、以下の内容が正しく入っているか確認・修正する

**単一用途の説明:**
```
Lets users add, modify or remove HTTP request and response headers on the websites they choose.
```

**declarativeNetRequest が必要な理由:**
```
This is the core feature. The extension turns the header rules the user writes into declarativeNetRequest modifyHeaders rules, so Chrome can add, change or remove request and response headers. No other request handling is done.
```

**storage が必要な理由:**
```
Used only to save the user's header profiles and settings locally in chrome.storage.local. Nothing is synced or sent anywhere.
```

**ホスト権限 が必要な理由:**
```
declarativeNetRequest requires host access for modifyHeaders rules to take effect. Users decide which sites are affected with their own URL filters (no filter means all sites, which is what users of header tools expect). The extension has no content scripts and never reads page content.
```

**リモートコードを使用していますか?**
→ 「**いいえ、リモートコードを使用していません**」を選ぶ(「はい」になっていたら必ず直す)

**データ使用のチェックボックス(個人を特定できる情報 〜 ウェブサイトのコンテンツ、計9項目):**
→ **すべてチェックなし(空欄)**にする

**「私は以下の開示が正しいものであることを表明します」の3項目:**
→ **3つともチェックを入れる**

**プライバシー ポリシーの URL:**
```
https://github.com/keiinoue0612-droid/honest-headers/blob/main/PRIVACY.md
```

すべて入力・確認できたら、画面上部の「下書きとして保存する」を押す。

### 3. 「設定」ページを開いて、連絡先メールアドレスを確認する
- 「連絡先メールアドレスを追加」の欄に kei.inoue0612@gmail.com が入っているか確認。入っていなければ入力して保存。
- メールアドレスの確認(認証)がまだなら、確認メールを送ってもらうよう案内し、ユーザーに受信メールを開いて認証してもらう(これはユーザーにしかできない)。認証済みになるまで次に進めない。

### 4. ストアの掲載情報タブも念のため確認
- 説明、カテゴリ、アイコン、ホームページURL(https://github.com/keiinoue0612-droid/honest-headers)、サポートURL(同リポジトリの /issues)、スクリーンショット3枚が入っていることを確認。欠けていたら教えてください(画像ファイルは別途もらう必要があります)。

### 5. 送信
上記がすべて揃ったら、画面上部の「審査のため送信」を押す。押した後の画面(受付完了のメッセージが出ているか)を確認して、ユーザーに結果を報告する。

## 注意
- ログインやメール認証など、本人確認が必要な操作は必ずユーザーに振ってください。
- 何かフィールドが今回の指示にない内容を求めてきたら、勝手に埋めず、ユーザーに確認してください。
