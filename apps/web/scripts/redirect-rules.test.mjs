import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildRedirectLines } from "./redirect-rules.mjs";

const target = { slug: "shard-dominion", playUrl: "/games/shard-dominion/", status: "live" };
const variants = ["shard-dominion-fable", "shard-dominion-chat", "shard-dominion-v2"];
const retired = variants.map((slug) => ({ slug, playUrl: `/games/${slug}/`, status: "archived", hidden: true, redirectTo: target.playUrl }));
const registry = [target, ...retired];

test("only archived, hidden entries with explicit successors redirect", () => {
  const lines = buildRedirectLines([], [...registry, { slug: "other-game", status: "archived" }]);
  const rules = lines.filter((line) => line.startsWith("/"));
  assert.equal(rules.length, 6);
  for (const slug of variants) {
    assert.ok(rules.includes(`/games/${slug}  /games/shard-dominion/  302!`));
    assert.ok(rules.includes(`/games/${slug}/index.html  /games/shard-dominion/  302!`));
  }
  assert.ok(rules.every((rule) => !rule.includes("*")));
  assert.ok(rules.every((rule) => !rule.startsWith("/games/shard-dominion ")));
  assert.ok(rules.every((rule) => !rule.includes("bakeoff")));
});

test("legacy discovery cannot resurrect retired entries or proxy their assets", () => {
  const lines = buildRedirectLines([
    ...variants.map((slug) => ({ slug, proxyTo: "https://legacy.example/" })),
    { slug: "other-game", proxyTo: "https://other.example///" },
  ], registry);
  assert.ok(!lines.some((line) => line.includes("legacy.example")));
  assert.ok(lines.includes("/games/other-game        /games/other-game/        301"));
  assert.ok(lines.includes("/games/other-game/*      https://other.example/:splat            200!"));
  assert.ok(lines.findIndex((line) => line.includes("302!")) < lines.findIndex((line) => line.includes("200!")));
});

test("ordinary proxies retain existing behavior when no archival redirect applies", () => {
  assert.deepEqual(buildRedirectLines([{ slug: "other-game", proxyTo: "https://other.example/" }], [target]).filter((line) => line.startsWith("/")), [
    "/games/other-game        /games/other-game/        301",
    "/games/other-game/*      https://other.example/:splat            200!",
  ]);
});

for (const [name, change] of [
  ["external successor", { redirectTo: "https://elsewhere.example/" }],
  ["missing successor", { redirectTo: "/games/missing-game/" }],
  ["self redirect", { redirectTo: retired[0].playUrl }],
  ["rule injection", { slug: "bad\n/rule" }],
]) {
  test(`reject ${name} before writing routing configuration`, () => {
    assert.throws(() => buildRedirectLines([], [target, { ...retired[0], ...change }]), /Invalid archival redirect/);
  });
}

test("successor must remain visible and live", () => {
  for (const change of [{ hidden: true }, { status: "archived" }]) {
    assert.throws(() => buildRedirectLines([], [{ ...target, ...change }, retired[0]]), /Invalid archival redirect/);
  }
});

test("published catalog retains old slugs for run history while hiding only the approved variants", () => {
  const actual = JSON.parse(readFileSync(new URL("../src/lib/games.registry.json", import.meta.url), "utf8"));
  const shard = actual.filter((game) => game.slug.startsWith("shard-dominion"));
  assert.deepEqual(shard.filter((game) => !game.hidden).map((game) => game.slug), ["shard-dominion"]);
  for (const slug of variants) {
    assert.deepEqual(actual.find((game) => game.slug === slug).status, "archived");
    assert.equal(actual.find((game) => game.slug === slug).redirectTo, target.playUrl);
  }
  assert.equal(buildRedirectLines([], actual).filter((line) => line.startsWith("/")).length, 6);
});
