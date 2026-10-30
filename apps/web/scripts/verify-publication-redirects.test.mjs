import assert from "node:assert/strict";
import test from "node:test";
import { buildRedirectLines } from "./redirect-rules.mjs";
import { verifyPublicationRedirects } from "./verify-publication-redirects.mjs";

const registry = [
  { slug: "shard-dominion", playUrl: "/games/shard-dominion/", status: "live" },
  ...["shard-dominion-fable", "shard-dominion-chat", "shard-dominion-v2"].map((slug) => ({
    slug, playUrl: `/games/${slug}/`, status: "archived", hidden: true, redirectTo: "/games/shard-dominion/",
  })),
];
const approved = [{ slug: "other-game", proxyTo: "https://approved.example/" }];
const generated = (discovered = []) => buildRedirectLines([...approved, ...discovered], registry).join("\n");

test("accept actual generated rules, including unchanged approved proxies", () => {
  const result = verifyPublicationRedirects(generated(), approved, registry);
  assert.equal(result.rules, 8);
  assert.equal(result.matchesApprovedOfflineRules, true);
  assert.match(result.sha256, /^[a-f0-9]{64}$/);
});

test("reject a discovery-added canonical proxy in the actual artifact", () => {
  assert.throws(() => verifyPublicationRedirects(generated([
    { slug: "shard-dominion", proxyTo: "https://unreviewed.example/" },
  ]), approved, registry), /interferes with canonical/);
});

test("reject unrelated additions from network discovery rather than silently approve them", () => {
  assert.throws(() => verifyPublicationRedirects(generated([
    { slug: "unrelated-game", proxyTo: "https://unreviewed.example/" },
  ]), approved, registry), /differ from approved offline rules/);
});

test("reject broad wildcard and placeholder interference", () => {
  for (const source of ["/*", "/games/*", "/games/:slug", "/games/:slug/*"]) {
    assert.throws(() => verifyPublicationRedirects(`${source} https://unreviewed.example/:splat 200!\n${generated()}`, approved, registry), /interferes with canonical/);
  }
});

test("reject missing, reordered or changed publication rules", () => {
  const text = generated();
  for (const changed of [text.replace("302!", "301!"), text.replace(/\/games\/shard-dominion-fable  .*\n/, ""), text.split("\n").reverse().join("\n")]) {
    assert.throws(() => verifyPublicationRedirects(changed, approved, registry), /differ from approved offline rules/);
  }
});

test("accept harmless formatting but reject unsupported condition syntax", () => {
  assert.equal(verifyPublicationRedirects(`# build metadata\n${generated().replaceAll("\n", "\r\n")}`, approved, registry).rules, 8);
  assert.throws(() => verifyPublicationRedirects(`${generated()}\n/extra /target 302 Country=us`, approved, registry), /Unsupported generated redirect syntax/);
});
