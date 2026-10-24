import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// Run AFTER android init and restoring upstream's tracked Android customizations.
const app = path.resolve(process.argv[2]);
const gradleFile = path.join(app, "src-tauri/gen/android/app/build.gradle.kts");
let gradle = readFileSync(gradleFile, "utf8");
const marker = 'applicationId = "com.bilingify.readest"';
if (
	gradle.split(marker).length !== 2 ||
	gradle.includes("applicationIdSuffix")
) {
	throw new Error(
		"Upstream Android application ID changed; review before building",
	);
}
const signing = 'create("signing") {';
if (gradle.split(signing).length !== 2)
	throw new Error("Upstream Android signing config changed");
gradle = gradle.replace(
	marker,
	marker + '\n        applicationIdSuffix = ".personal"',
);
gradle = gradle.replace(
	signing,
	signing + '\n                storeType = "PKCS12"',
);
writeFileSync(gradleFile, gradle);
const password = process.env.PERSONAL_ANDROID_PASSWORD;
const key = process.env.PERSONAL_ANDROID_KEYSTORE;
if (!password || !key || !process.env.RUNNER_TEMP)
	throw new Error("Missing Android signing secrets");
const keystore = path.join(process.env.RUNNER_TEMP, "readest-personal.p12");
writeFileSync(keystore, Buffer.from(key, "base64"), { mode: 0o600 });
writeFileSync(
	path.join(app, "src-tauri/gen/android/keystore.properties"),
	[
		"keyAlias=personal",
		"password=" + password,
		"storeFile=" + keystore,
		"",
	].join("\n"),
	{ mode: 0o600 },
);
