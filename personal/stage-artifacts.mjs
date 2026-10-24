import { cpSync, existsSync, globSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

const platform = process.argv[2];
const root = path.resolve(process.argv[3]);
const dest = path.resolve(process.argv[4]);
const { version } = JSON.parse(
	readFileSync(path.join(root, "personal/build.json"), "utf8"),
);
const files = [...globSync("target/**/release/bundle/**/*", { cwd: root })];
const name = "Readest-Personal_" + version + "_";
mkdirSync(dest, { recursive: true });
const copyOne = (suffix, output, signed = true) => {
	const matches = files.filter((file) => file.endsWith(suffix));
	if (matches.length !== 1)
		throw new Error(
			"Expected exactly one " + suffix + ", found " + matches.length,
		);
	const file = path.join(root, matches[0]);
	cpSync(file, path.join(dest, name + output));
	if (signed) {
		if (!existsSync(file + ".sig"))
			throw new Error("Missing updater signature: " + file);
		cpSync(file + ".sig", path.join(dest, name + output + ".sig"));
	}
};
if (platform === "windows") {
	copyOne("-setup.exe", "windows-x64.exe");
} else if (platform === "linux") {
	copyOne(".AppImage", "linux-x64.AppImage");
	copyOne(".deb", "linux-x64.deb", false);
} else {
	throw new Error("Unexpected desktop platform");
}
