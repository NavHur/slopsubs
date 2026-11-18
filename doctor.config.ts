import { defineConfig } from "react-doctor/api";

export default defineConfig({
	// Nothing leaves the machine: no score API, no share URL, no Socket.dev
	// dependency checks.
	noScore: true,
	share: false,
	supplyChain: { enabled: false },
	scope: "full",
	// A new error fails the gate; warnings stay visible and are fixed at the
	// cause or suppressed with a reason.
	blocking: "error",
});
