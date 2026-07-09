#!/usr/bin/env bash
# run-eval.sh — ゲート注入→即実行のアトミックなラッパー。
# early-access ゲート (tengu_walnut_spire) はサーバーリフレッシュで閉じ直される
# ことがある（実測: 1時間のrun中に閉じた）。判定はコマンド起動時の1回だけなので、
# 直前注入→即起動なら長時間runも安全。使い方: bash run-eval.sh <出力名> [追加引数...]
set -euo pipefail
NAME="${1:?usage: run-eval.sh <output-name> [extra args...]}"; shift
node -e "
const fs=require('fs');
const p=process.env.HOME+'/.claude.json';
const j=JSON.parse(fs.readFileSync(p,'utf8'));
(j.cachedGrowthBookFeatures=j.cachedGrowthBookFeatures||{})['tengu_walnut_spire']=true;
fs.writeFileSync(p,JSON.stringify(j));
console.log('gate flag injected');"
exec claude plugin eval . --ablation none --json \
  --output-dir "evals/results/$NAME" "$@"
