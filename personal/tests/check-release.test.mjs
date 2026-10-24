import assert from "node:assert/strict";
import { test } from "node:test";
import { selectRelease } from "../check-release.mjs";

const stable = { tag_name: "v0.12.16", draft: false, prerelease: false };
test("a new official stable release is built once", () => {
	assert.deepEqual(selectRelease(stable, null, 1), {
		upstream_tag: "v0.12.16",
		release_tag: "personal-v0.12.16-r1",
		build: "true",
	});
	assert.equal(selectRelease(stable, { draft: false }, 1).build, "false");
});
test("failed draft uploads can be retried and patch revisions have separate releases", () => {
	assert.equal(selectRelease(stable, { draft: true }, 1).build, "true");
	assert.equal(
		selectRelease(stable, null, 2).release_tag,
		"personal-v0.12.16-r2",
	);
});
test("pre-releases, unsafe tags, and invalid revisions are rejected", () => {
	for (const release of [
		{ ...stable, prerelease: true },
		{ ...stable, draft: true },
		{ ...stable, tag_name: "v0.12.17-beta.1" },
		{ ...stable, tag_name: "bad/tag" },
	])
		assert.throws(() => selectRelease(release, null, 1));
	assert.throws(() => selectRelease(stable, null, 0));
});
