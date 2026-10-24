import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function patchAccess(source) {
  source = source.replaceAll('\r\n', '\n');
	const replace = (before, after) => {
		if (source.split(before).length !== 2) {
			throw new Error(
				"Upstream authorization changed; review the personal patch before building: " +
					before,
			);
		}
		source = source.replace(before, after);
	};

	replace(
		"export const isEmailInPlan = (plan: UserPlan, customizationPurchased: boolean): boolean =>\n  isCustomizationAllowed(plan, customizationPurchased);",
		"export const isEmailInPlan = (plan: UserPlan, customizationPurchased: boolean): boolean =>\n  hasCustomizationEntitlement(plan, customizationPurchased);",
	);
	replace(
		"export const isCustomizationAllowed = (plan: UserPlan, customizationPurchased: boolean): boolean =>\n  isSelfHosted() || customizationPurchased || PREMIUM_PLANS.includes(plan);",
		[
			"// Personal builds unlock device features, while official account claims remain untouched.",
			"const isPersonalEdition = (): boolean =>",
			"  process.env['NEXT_PUBLIC_PERSONAL_EDITION'] === 'true';",
			"",
			"const hasCustomizationEntitlement = (plan: UserPlan, customizationPurchased: boolean): boolean =>",
			"  isSelfHosted() || customizationPurchased || PREMIUM_PLANS.includes(plan);",
			"",
			"export const isCustomizationAllowed = (plan: UserPlan, customizationPurchased: boolean): boolean =>",
			"  isPersonalEdition() || hasCustomizationEntitlement(plan, customizationPurchased);",
		].join("\n"),
	);
	replace(
		"export const isCustomTranslatorAllowed = (token: string | null | undefined): boolean =>\n  token\n    ? isCustomizationAllowed(getUserProfilePlan(token), getCustomizationPurchased(token))\n    : isSelfHosted();",
		"export const isCustomTranslatorAllowed = (token: string | null | undefined): boolean =>\n  isPersonalEdition() ||\n  (token\n    ? isCustomizationAllowed(getUserProfilePlan(token), getCustomizationPurchased(token))\n    : isSelfHosted());",
	);
	return source;
}

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
	const file = path.join(
		process.argv[2] ?? ".",
		"apps/readest-app/src/utils/access.ts",
	);
	const original = readFileSync(file, "utf8");
	writeFileSync(file, patchAccess(original));
	console.log(
		"Applied personal device-feature access patch; official account and service quotas preserved.",
	);
}
