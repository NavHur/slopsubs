import { defineConfig } from "react-doctor/api";

export default defineConfig({
	// Turns off the score API, the share URL, and supply-chain checks. Telemetry
	// is off only through the `doctor` script's `--no-score`: run `vp run doctor`.
	noScore: true,
	share: false,
	supplyChain: { enabled: false },
	scope: "full",
	// A new error fails the gate, in test and story files too; warnings stay
	// visible and are fixed at the cause or suppressed with a reason.
	blocking: "error",
	surfaces: { ciFailure: { includeFileContexts: ["test", "story"] } },
});
