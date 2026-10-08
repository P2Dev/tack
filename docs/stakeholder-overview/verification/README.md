# Presentation verification

Verified on 20 September 2026 with local Playwright Chromium. This checks the stakeholder artifact; it does not rerun Tack's application suite.

- All nine presentation sections rendered and were visually inspected at 1440 × 900.
- All nine original embedded images decoded successfully.
- Reading and presentation modes have no horizontal overflow at 390 and 320 px.
- Phone renders for sections 1, 3, and 8 were visually inspected.
- Previous/next, arrow keys, Home/End, Escape, image enlargement, actual-size toggle, and focus return passed.
- No page errors or remote HTTP(S) requests occurred. The HTML carries its own styles, scripts, and screenshots.
- Screenshot captions identify historical milestone captures, controlled failure fixtures, and current production-build evidence.

Raw checks: [checks.json](checks.json). Section and phone PNGs in this folder are rendered previews of the presentation, not additional application evidence. Application sources remain under `docs/ui-ux-review/`.

To rebuild and verify from the project root:

```sh
python3 docs/stakeholder-overview/build_presentation.py
node docs/stakeholder-overview/verify-presentation.cjs
```

The verification command needs the installed Playwright Chromium runtime. The finished HTML needs only a browser.
