import { appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function selectRelease(latest, existing, revision) {
	if (!Number.isSafeInteger(revision) || revision < 1)
		throw new Error("Invalid personal revision");
	if (
		latest.draft ||
		latest.prerelease ||
		!/^v\d+\.\d+\.\d+$/.test(latest.tag_name)
	) {
		throw new Error("Expected an official stable version tag");
	}
	return {
		upstream_tag: latest.tag_name,
		release_tag: "personal-" + latest.tag_name + "-r" + revision,
		build: existing && !existing.draft ? "false" : "true",
	};
}

export async function githubAPI(endpoint, options = {}) {
	const response = await fetch("https://api.github.com" + endpoint, {
		...options,
		headers: {
			Accept: "application/vnd.github+json",
			Authorization: "Bearer " + process.env.GH_TOKEN,
			"X-GitHub-Api-Version": "2022-11-28",
			...options.headers,
		},
		signal: AbortSignal.timeout(30000),
	});
	if (response.status === 404 && options.allowMissing) return null;
	if (!response.ok)
		throw new Error("GitHub " + response.status + ": " + endpoint);
	if (response.status === 204) return null;
	return response.json();
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
	const { revision } = JSON.parse(
		readFileSync(new URL("./revision.json", import.meta.url), "utf8"),
	);
	const latest = await githubAPI("/repos/readest/readest/releases/latest");
	const candidate = selectRelease(latest, null, revision);
	const existing = await githubAPI(
		"/repos/" +
			process.env.GITHUB_REPOSITORY +
			"/releases/tags/" +
			candidate.release_tag,
		{ allowMissing: true },
	);
	const result = selectRelease(latest, existing, revision);
	for (const [name, value] of Object.entries(result)) {
		appendFileSync(process.env.GITHUB_OUTPUT, name + "=" + value + "\n");
	}
	console.log(
		result.build === "true"
			? "Build " + result.release_tag
			: "Already published: " + result.release_tag,
	);
}
