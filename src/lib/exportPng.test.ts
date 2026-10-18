import { describe, expect, it } from "vitest";
import { basicLatinFontFaces } from "./exportPng";

const face = (range: string) =>
	`@font-face {\n  font-family: 'DM Sans';\n  src: url(https://fonts.gstatic.com/x.woff2) format('woff2');\n  unicode-range: ${range};\n}`;

describe("basicLatinFontFaces", () => {
	it("keeps only the faces that cover Basic Latin", () => {
		const latin = face("U+0000-00FF, U+0131, U+2000-206F");
		const css = [face("U+0100-02BA"), latin, face("U+0102-0103")].join("\n");
		expect(basicLatinFontFaces(css)).toEqual([latin]);
	});

	it("returns nothing for a stylesheet without font faces", () => {
		expect(basicLatinFontFaces("body { color: red; }")).toEqual([]);
	});
});
