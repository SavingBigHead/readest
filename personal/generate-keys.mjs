import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
	chmodSync,
	existsSync,
	mkdirSync,
	readFileSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const output = path.resolve(process.argv[2] ?? "../.readest-personal-keys");
const checkout = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
if (output === checkout || output.startsWith(checkout + path.sep)) {
	throw new Error("Keep signing keys outside the Git checkout");
}
mkdirSync(output, { recursive: true, mode: 0o700 });
chmodSync(output, 0o700);
const bundleFile = path.join(output, "github-secrets.json");
if (existsSync(bundleFile))
	throw new Error(
		"Signing bundle already exists; reuse and back up those keys",
	);
const password = () => randomBytes(32).toString("hex");
const bundle = {
	secrets: {
		PERSONAL_TAURI_PASSWORD: password(),
		PERSONAL_ANDROID_PASSWORD: password(),
	},
	variables: {},
};
const save = () =>
	writeFileSync(bundleFile, JSON.stringify(bundle, null, 2) + "\n", {
		mode: 0o600,
	});
save();
const run = (command, args, options = {}) => {
	try {
		execFileSync(command, args, {
			stdio: ["ignore", "pipe", "pipe"],
			timeout: 180000,
			...options,
		});
	} catch {
		// Child-process errors include command arguments. Never log a signing password.
		throw new Error(
			"Signing tool failed; private output was withheld. Keep the existing password bundle.",
		);
	}
};
const updater = path.join(output, "updater.key");
run("npm", [
	"exec",
	"--yes",
	"--package=@tauri-apps/cli@2.11.4",
	"--",
	"tauri",
	"signer",
	"generate",
	"--ci",
	"--password",
	bundle.secrets.PERSONAL_TAURI_PASSWORD,
	"--write-keys",
	updater,
]);
bundle.secrets.PERSONAL_TAURI_KEY = readFileSync(updater, "utf8").trim();
bundle.variables.PERSONAL_TAURI_PUBLIC_KEY = readFileSync(
	updater + ".pub",
	"utf8",
).trim();
save();
const pem = path.join(output, "android-private.pem");
const cert = path.join(output, "android-cert.pem");
const p12 = path.join(output, "android-release.p12");
run("openssl", [
	"req",
	"-x509",
	"-newkey",
	"rsa:3072",
	"-sha256",
	"-nodes",
	"-days",
	"36500",
	"-subj",
	"/CN=Readest Personal/",
	"-keyout",
	pem,
	"-out",
	cert,
]);
run(
	"openssl",
	[
		"pkcs12",
		"-export",
		"-name",
		"personal",
		"-in",
		cert,
		"-inkey",
		pem,
		"-out",
		p12,
		"-passout",
		"env:PERSONAL_P12_PASSWORD",
	],
	{
		env: {
			...process.env,
			PERSONAL_P12_PASSWORD: bundle.secrets.PERSONAL_ANDROID_PASSWORD,
		},
	},
);
chmodSync(p12, 0o600);
bundle.secrets.PERSONAL_ANDROID_KEYSTORE = readFileSync(p12).toString("base64");
save();
unlinkSync(pem);
unlinkSync(cert);
console.log(
	"Created fixed Android and updater signing keys outside the checkout: " +
		output,
);
console.log(
	"Back up this directory privately. Only upload its named values to GitHub Actions secrets/variables.",
);
