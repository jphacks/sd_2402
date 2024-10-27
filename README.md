# KINOKEN

[![IMAGE ALT TEXT HERE](https://jphacks.com/wp-content/uploads/2024/07/JPHACKS2024_ogp.jpg)](https://www.youtube.com/watch?v=DZXUkEj-CSI)

## 製品概要
- ポモドーロタイマー+作業姿勢とストレッチ笑顔の検知
ポモドーロテクニックを使い、作業効率を上げながら健康をサポートする革新的なタイマー。研究者や学生などのデスクワーカーのウェルビーイングを目的とする。

### 背景(製品開発のきっかけ、課題等）
現代では、学生や研究者を始めとして、デスクワーカーとして作業をする人が非常に増加している。
しかし、デスクワーカーは体を動かす機会に乏しく、作業に熱中しすぎると、肩首腰を始めとする心身の不調が生じ、結果的に作業効率、作業量が減少してしまうという課題がある。実際に、メンバーの一人はHack Day一週間ほど前にぎっくり腰を発症し、大変苦しんだ。
そこで、デスクワーカーにとって有益なツールであるポモドーロタイマーと健康を増進させるための要素を融合させよう！と考えた。ポモドーロタイマーはメンバーの殆どが利用していたが、運動をはじめとする、健康と関連しているツールはほぼ見当たらなかったため、今回有益かつ自分たちも継続的に使用したい、と思えるツールを創作しようと考えた。
### 製品説明（具体的な製品の説明）
はじめに、ポモドーロテクニックとは、作業時間が25分、休憩時間が5分のサイクルを繰り返すというのが基本的なテクニックです。ポモドーロタイマーとはそのテクニックを利用し、作業時間と休憩時間を交互に知らせ、作業に役立つタイマーです。
- タスク設定:ユーザーはタスクを自分で設定でき、その後なんの作業をどの程度実行したか確認できる
- 笑顔検知:タイマー開始のシグナルとして笑顔を検知し、その後タイマーが始動する
- 作業期間: タイマーが終了するまでの25分間、効率的なタスク集中が可能。タイマー起動中、姿勢の良し悪しをトラッキングでき、統計情報として作業終了後に確認可能
ストレッチ誘導: タイマー終了後、カメラがストレッチ動作を認識する。画面上に表示されるガイドに従って体を動かし、ストレッチの状態が検知されると、休憩時間が開始

### 特長

#### 1. 特長 1
始めに、基本的なポモドーロタイマーとして活用可能。加えて、ポモドーロの日別タスク別統計も確認可能で、より効率的に業務を行うことが可能。作業中の姿勢の状態も確認できる。

#### 2. 特長 2
ポモドーロタイマーの作業時間の終了後、強制的にストレッチを誘導することで、身体の健康状態を改善することができる。また、ストレッチの認識の際、ストレッチのガイドを型はめ形式で表示することで、同時にゲーム性も持たせた。

#### 3. 特長 3
笑顔をシグナルに、25分の作業時間のポモドーロタイマーを開始するようにした。意識的に笑顔の回数を増やすことで、心身のウェルビーイングを確保することができる。

### 解決出来ること
作業における集中力、デスクワーカーのウェルビーイングの確保、作業情報の整理、笑顔の回数の増加、心身の不調の改善
### 今後の展望
ストレッチの種類の増加、姿勢状況に応じたストレッチの提案、型はめストレッチガイド調整、拡充及びゲーム性の増加、Webカメラ以外(モバイル等)の実装、ポモドーロタイマー機能の拡大、UIの調整、複数人でのシンクロストレッチ機能の実装、グループや団体での使用を想定したコホート目標の設定やフレンド機能の実装、生成aiを用いた、表情やストレッチの検知後のアドバイスなどの実装
### 注力したこと（こだわり等）
ツールとしての有益さと、健康状況改善機能の融合。実際に自分たちが開発後、継続的に使える機能を考えることに重点を置いた。また、ユーザーの持続性を生み出すため、ユーザーがエンジョイし、好奇心をもつような仕組みが必要と考え、ストレッチ時のゲーム性を取り入れた。


## 開発技術
タイマーの終了、開始のシグナルとしてのストレッチの利用　ストレッチ状態の定義と検知、作業姿勢の良し悪しの定義と検知
### 活用した技術
笑顔の検出、体のパーツの座標を取得する技術、
#### API・データ
-

#### フレームワーク・ライブラリ・モジュール
- react 

- mediapipe

- firebase

#### デバイス
-　pc　webカメラ

### 独自技術

#### ハッカソンで開発した独自機能・技術

- ストレッチ、姿勢状況の判定
- src/components/StretchNeck.js　特に力を入れた部分をファイルリンク、または commit_id を記載してください。
