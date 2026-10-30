# Class contact redaction

`redactClassText` filters projected student free text in the class overview, matching skill names/evidence, candidate target titles, teacher-side guidance feedback, and saved resume text before teacher-targeted generation. Teacher-authored guidance text is returned as written. Student guidance reads and feedback writes retain the original feedback, including after leaving a class. The filter does not modify stored source data. Authorization and field projection remain separate controls.

## Recognized patterns

Matching uses a one-to-one full-width ASCII shadow (including full-width space), but copies all unmatched characters from the original. Rules run in the following order; matching is case-insensitive where Latin letters are involved:

- `http://`, `https://`, and `www.` URLs using ASCII URL characters are replaced by `[链接已隐藏]`. This intentionally includes non-contact URLs. `mailto:`, `tel:`, `weixin://`, `wechat://`, `whatsapp://`, `tg://`, `mqq://`, and `skype:` links are replaced by `[联系方式已隐藏]`.
- Emails with ASCII local/domain components and at least one domain separator use `@`, `[at]`, `(at)`, spaced `at`, or `艾特`; domain separators may be `.`, `[dot]`, `(dot)`, spaced `dot`, or `点`. These become `[邮箱已隐藏]`.
- Mainland mobile numbers beginning with 1 and 3–9, optionally prefixed by `+86`, `86`, or `(86)`, and landlines with a 3- or 4-digit area code starting with 0 and a 7- or 8-digit subscriber number become `[电话已隐藏]`. Spaces, hyphens and dots are accepted as in the existing formats; landline `转`, `分机`, and `ext` extensions are included.
- Eleven-digit mainland mobiles can also use Chinese digit characters `零〇一二两三四五六七八九幺` mixed with digits, with spaces, dots or hyphens between them. English digit words are recognized when all eleven digits are written as space- or hyphen-separated words, starting with `one` and `three` through `nine`.
- Explicit `微信`, `微信号`, `微信ID`, `WeChat`, `WeChat ID`, `微讯`, `QQ`, and `QQ号` labels with a colon, equals sign or whitespace and an ASCII account identifier are replaced together with that identifier by `[联系方式已隐藏]`. `WhatsApp`, `Telegram`, `Signal`, `Skype`, and `Discord` labels, optionally followed by `ID` or `号`, require a colon or equals sign. Identifiers use ASCII letters, digits, underscore, dot, hyphen, plus or `@`.

A prior rule can replace a contact following a label without replacing the label itself. Coincidental matches can be hidden: in particular all recognized web URLs, labelled technical references, and number sequences resembling phone numbers may be redacted. Unlabelled short numbers are deliberately not treated as messaging accounts. Full-width normalization is only for matching; unaffected text retains its original characters.

## Known blind spots

This is deterministic pattern matching, not general personal-information detection or complete anonymization. It does not cover every spelling or obfuscation, international phone formats beyond the listed prefix, written-out landlines or country prefixes, landlines without area codes, arbitrary separators or extensions, unlabelled messaging IDs, non-ASCII account identifiers, arbitrary social handles, bare domains without `www.`, QR codes, images, or other personal information. URLs and contact details can still appear in unsupported forms. Review material before sharing or processing it; do not rely on this filter as the sole privacy boundary.
