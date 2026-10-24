import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { test } from "node:test";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";

// Execute the actual module with service dependencies isolated. No network or real account.
const source = stripTypeScriptTypes(
	readFileSync(
		new URL("../../apps/readest-app/src/utils/access.ts", import.meta.url),
		"utf8",
	),
);
const MiB = 1024 ** 2;

async function loadAccess(personal = false) {
	const context = createContext({
		process: { env: { NEXT_PUBLIC_PERSONAL_EDITION: String(personal) } },
	});
	const dependencies = {
		"jwt-decode": { jwtDecode: JSON.parse },
		"@/utils/supabase": { supabase: {} },
		"@/types/quota": { UserPlan: {} },
		"@/services/constants": {
			DEFAULT_STORAGE_QUOTA: {
				free: 500 * MiB,
				plus: 5 * 1024 * MiB,
				pro: 20 * 1024 * MiB,
			},
			DEFAULT_DAILY_TRANSLATION_QUOTA: { free: 1000, plus: 10000, pro: 100000 },
			DEFAULT_DAILY_TTS_QUOTA: { free: 0, plus: 10000, pro: 100000 },
		},
		"@/services/environment": { isWebAppPlatform: () => false },
		"@/services/translators/utils": { getDailyUsage: () => 42 },
		"@/services/runtimeConfig": { getRuntimeConfig: () => null },
	};
	const module = new SourceTextModule(source, { context });
	await module.link((specifier) => {
		const exports = dependencies[specifier];
		assert.ok(exports, "Unexpected dependency: " + specifier);
		return new SyntheticModule(
			Object.keys(exports),
			function () {
				for (const [name, value] of Object.entries(exports))
					this.setExport(name, value);
			},
			{ context },
		);
	});
	await module.evaluate();
	return module.namespace;
}

test("personal edition opens customization and personal services without a purchase", async () => {
	const access = await loadAccess(true);
	for (const name of [
		"isCustomizationAllowed",
		"isCloudSyncAllowed",
		"isTTSCacheAllowed",
		"isAbsOfflineAllowed",
		"isNearbyPairingAllowed",
	]) {
		assert.equal(
			access[name]("free", false),
			true,
			name + " must work on a free account",
		);
		assert.equal(
			access[name]("purchase", false),
			true,
			name + " must work for storage buyers",
		);
	}
	for (const name of ["isCustomTranslatorAllowed", "isCustomTTSAllowed"]) {
		assert.equal(
			access[name](null),
			true,
			name + " must work without signing in",
		);
		assert.equal(access[name](JSON.stringify({ plan: "free" })), true);
	}
});

test("official storage purchase and account identity remain genuine", async () => {
	const access = await loadAccess(true);
	const token = JSON.stringify({
		plan: "free",
		storage_purchased_bytes: 1024 * MiB,
		storage_usage_bytes: 123,
		customization_purchased: false,
	});
	assert.equal(access.getSubscriptionPlan(token), "free");
	assert.equal(access.getUserProfilePlan(token), "purchase");
	assert.equal(access.getCustomizationPurchased(token), false);
	const storage = access.getStoragePlanData(token);
	assert.equal(storage.quota, 1524 * MiB);
	assert.equal(storage.usage, 123);
	assert.equal(storage.plan, "free");
	assert.equal(access.isSelfHosted(), false);
});

test("official paid service eligibility and quotas remain enforced", async () => {
	const access = await loadAccess(true);
	assert.equal(access.isEmailInPlan("free", false), false);
	assert.equal(access.isEmailInPlan("purchase", false), false);
	assert.equal(access.isEmailInPlan("plus", false), true);
	assert.equal(access.isEmailInPlan("free", true), true);
	assert.equal(access.isTTSInPlan("free"), false);
	assert.equal(access.isTTSInPlan("purchase"), false);
	assert.equal(access.isVoiceTierInPlan("pro", "plus"), false);
	assert.equal(access.getTTSQuota("free"), 0);
	assert.equal(access.getTranslationQuota("free"), 1000);
});

test("ordinary builds retain upstream authorization behavior", async () => {
	const access = await loadAccess(false);
	assert.equal(access.isCustomizationAllowed("free", false), false);
	assert.equal(access.isCloudSyncAllowed("free", false), false);
	assert.equal(access.isTTSCacheAllowed("free", false), false);
	assert.equal(access.isCustomTranslatorAllowed(null), false);
	assert.equal(access.isCustomTTSAllowed(null), false);
	assert.equal(access.isCustomizationAllowed("plus", false), true);
});
