# Integrating `master` into `main` — analysis and plan

Status: **analysis only. Nothing was merged, pushed, deployed or flashed.** Verified on a throw-away
clone that was deleted afterwards.

## What the graph really looks like

* `origin/main` (72 commits, tip `a0a4f6d`) and `origin/master` (20 commits + this work) share **no ancestor**:
  roots `dc82d91` and `d890b7f`. `git merge-base` returns nothing, so a plain merge needs `--allow-unrelated-histories`
  and then reports an add/add conflict on every file.
* `d890b7f` is titled "baseline: b591c02 + working tree": `master` was started from a **snapshot of `main` at
  `b591c02`** plus uncommitted work (468 files, line endings normalised CRLF→LF in `86c9630`).
* After `b591c02`, `main` gained exactly **one** commit: `a0a4f6d` "sửa mực nước để còi kêu" — one file,
  `firmware/esp32-node/src/gateway/gateway.ino`, 21 lines (buzzer relay threshold 5 cm → 3 cm, no buzzer in boot self-test).
* So `b591c02` is a valid **virtual merge base**.

## Verified dry run (scratch clone, then deleted)

```
git replace --graft d890b7f906f6696fa3de42cc4c6a4601c3ab3ea1 b591c02   # local only, gives master a parent
git checkout -b dry origin/main
git merge --no-commit --no-ff <this branch>
```
Result: **0 conflicts**; `gateway.ino` auto-merged; the merged tree keeps `a0a4f6d`'s `WATER_TOUCH_DISTANCE_CM = 3.0`
**and** the new gateway queue. Firmware tests on the merged tree: 18/18 node tests and the upload-queue host build pass.
The web tests were not re-run on the merged tree (no `node_modules` in the scratch clone) — rerun them on the real merge branch.

Tried and rejected: applying the baseline as a patch on top of `main` — conflicts in `gateway.ino` (CRLF vs LF) and
needs manual resolution; a force-push of `master` over `main` — would destroy 72 commits of history.

## Decisions the owner must make BEFORE merging

1. **Buzzer threshold.** `master` (and the gateway queue branch) still has 5 cm (`WATER_CRITICAL_DISTANCE_CM`);
   `main` has 3 cm plus no boot beep. The merge keeps `main`'s value silently. Which firmware is actually flashed at
   Cồn Hô is not recorded in the repository. Confirm the intended threshold with the field team; do not let a merge decide it.
2. **Bulk content that `master` carries and `main` lacks** (from the 468-file baseline): `docs/presentations` (109 files, PDFs up to 5 MB),
   `.impeccable/review` (26 files, one 6.8 MB PNG), `docs/qa/screenshots`, `scripts/staging/*.result.json`, `apps/web/public/assets/**`
   (3.3 MB PNGs, one named "Thiết kế chưa có tên.png"). Decide whether they belong in `main`. No secret-like content was found
   in a scan (only test fixtures such as `sb_secret_*_test_only`).
3. **Which branch does the team work on.** Production web deploys from `master` today. After the merge, decide the single source branch
   and what Vercel (or other host) tracks; two long-lived branches with no shared history will keep diverging.

## Recommended procedure (run by the owner, after the decisions above)

```
git fetch origin
git switch -c integrate/master-into-main origin/main
git replace --graft d890b7f906f6696fa3de42cc4c6a4601c3ab3ea1 b591c02
git merge --no-ff origin/master        # or the reviewed work branch; expect 0 conflicts
git replace -d d890b7f906f6696fa3de42cc4c6a4601c3ab3ea1
# review: git diff origin/main --stat ; then open a PR into main (do not push to main directly)
```
The merge commit keeps both parents permanently, so the graft is only needed while merging. Do not push `refs/replace/*`.
If a file list must be trimmed (item 2), do it as a follow-up commit on the integration branch, not by rewriting history.

## QA before the PR is merged

* `cd apps/web && npm test && npx tsc --noEmit && npx next lint && npx next build`
* `cd services/edge-ingestion && npx tsx --test tests/contract.test.ts tests/partial_water_readings.test.ts && npx tsc --noEmit`
* `cd firmware/esp32-node && node --test tests/*.test.mjs && g++ -std=c++17 -Wall -Wextra -Werror -I src -I tests/host tests/upload_queue_host.cpp -o /tmp/uq && /tmp/uq`
* `pio run -e gateway -e station1 -e station2` (not possible in the authoring environment — must be done on a machine with PlatformIO)
* Staging only: edge function + migrations against a staging project; the integration tests (`test:integration`) need a database and must
  never be pointed at production.
* Screenshots of `/dashboard`, `/dashboard?mode=demo`, `/data-scope`, desktop and 390 px.

## Deploy and rollback

* Web: deploy the PR preview first. Rollback = redeploy the previous production build (host's "promote previous"), no data migration involved
  by this work.
* Edge Function / migrations: **none are required by this work.** The only backend change proposed (honouring `received_at_epoch`) is separate and needs approval.
* Firmware: the gateway change takes effect only after a manual flash. Keep the previous gateway binary; rollback = flash it back.
  The `spiffs` partition region is claimed only if blank, so a rollback leaves the stored frames untouched (the old firmware ignores them).
* Merge rollback: `git revert -m 1 <merge commit>` on `main` (keeps history); never force-push.
* Order: PR review → staging check → web deploy → (separately approved) gateway flash during a supervised visit.
