import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { githubAPI } from "./check-release.mjs";

const directory = path.resolve(process.argv[2]);
const metadata = JSON.parse(
	readFileSync(path.join(directory, "build.json"), "utf8"),
);
if (metadata.repository !== process.env.GITHUB_REPOSITORY)
	throw new Error("Repository mismatch");
const { repository, release_tag: tag, version } = metadata;
const prefix = "Readest-Personal_" + version + "_";
const baseURL =
	"https://github.com/" + repository + "/releases/download/" + tag + "/";
const platforms = {};
for (const [platform, file] of [
	["windows-x86_64", prefix + "windows-x64.exe"],
	["linux-x86_64", prefix + "linux-x64.AppImage"],
	["android-arm64", prefix + "android-arm64.apk"],
]) {
	if (!readFileSync(path.join(directory, file)).length)
		throw new Error("Empty installer: " + file);
	const signature = readFileSync(
		path.join(directory, file + ".sig"),
		"utf8",
	).trim();
	if (!signature) throw new Error("Empty updater signature");
	platforms[platform] = { signature, url: baseURL + encodeURIComponent(file) };
}
writeFileSync(
	path.join(directory, "latest.json"),
	JSON.stringify(
		{
			version,
			notes: "Readest Personal based on " + metadata.upstream_tag,
			pub_date: new Date().toISOString(),
			platforms,
		},
		null,
		2,
	) + "\n",
);
const sourceArchive = "Readest-Personal_" + version + "_source.tar.gz";
readFileSync(path.join(directory, sourceArchive));
const assets = readdirSync(directory)
	.filter((file) => file !== "SHA256SUMS")
	.sort();
writeFileSync(
	path.join(directory, "SHA256SUMS"),
	assets
		.map(
			(file) =>
				createHash("sha256")
					.update(readFileSync(path.join(directory, file)))
					.digest("hex") +
				"  " +
				file,
		)
		.join("\n") + "\n",
);

const route = "/repos/" + repository + "/releases";
let release = await githubAPI(route + "/tags/" + tag, { allowMissing: true });
if (release && !release.draft)
	throw new Error("Refusing to replace a published release");
if (!release) {
	release = await githubAPI(route, {
		method: "POST",
		body: JSON.stringify({
			tag_name: tag,
			target_commitish: metadata.controller_sha,
			name: "Readest Personal " + version,
			draft: true,
			prerelease: false,
			body: [
				"Personal build based on [Readest " +
					metadata.upstream_tag +
					"](https://github.com/readest/readest/releases/tag/" +
					metadata.upstream_tag +
					").",
				"",
				"Device customization, third-party sync, and user-provided translation/TTS endpoints are enabled.",
				"Official account purchases, storage quotas, and paid server-service eligibility remain unchanged.",
				"",
				"Windows x64 · Linux x64 (AppImage / deb) · Android ARM64.",
				"Android package: com.bilingify.readest.personal; it installs separately from the official app.",
				"",
				"Build source, including submodules and the personal patch: " +
					sourceArchive +
					".",
				"Upstream commit: " + metadata.upstream_sha,
				"Build controller: " + metadata.controller_sha,
				"",
				"License: GNU AGPL-3.0. See the source archive for license and reproducible build scripts.",
			].join("\n"),
		}),
	});
}
const oldAssets = await githubAPI(
	route + "/" + release.id + "/assets?per_page=100",
);
for (const asset of oldAssets)
	await githubAPI("/repos/" + repository + "/releases/assets/" + asset.id, {
		method: "DELETE",
	});
for (const name of readdirSync(directory).sort()) {
	const response = await fetch(
		release.upload_url.split("{")[0] + "?name=" + encodeURIComponent(name),
		{
			method: "POST",
			headers: {
				Authorization: "Bearer " + process.env.GH_TOKEN,
				"Content-Type": "application/octet-stream",
			},
			body: readFileSync(path.join(directory, name)),
			signal: AbortSignal.timeout(120000),
		},
	);
	if (!response.ok)
		throw new Error(
			"Asset upload failed: " + name + " (" + response.status + ")",
		);
}
await githubAPI(route + "/" + release.id, {
	method: "PATCH",
	body: JSON.stringify({ draft: false, make_latest: "true" }),
});
console.log(
	"Published https://github.com/" + repository + "/releases/tag/" + tag,
);
