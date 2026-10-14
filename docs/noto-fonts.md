# Optional Noto Sans fonts

Settings recommends the Noto Sans family matching the current UI locale. The
additional families are bundled locally and are fetched by the browser only
when the user clicks **Load font**, or selects one in a custom style. Loading a
font does not change the UI typeface or an existing station-sign style.

| Locales | Recommended family |
| --- | --- |
| `ja` | Noto Sans JP (existing) |
| `zh-CN` | Noto Sans SC (existing) |
| `zh-TW` | Noto Sans TC (existing) |
| `zh-HK` | Noto Sans HK |
| `ko` | Noto Sans KR (existing) |
| `hi` | Noto Sans Devanagari |
| `ar` | Noto Sans Arabic |
| Other supported Latin/Cyrillic locales, including `ru` and `vi` | Noto Sans |

The four additional variable TrueType fonts are unmodified downloads from the
[official Google Fonts repository](https://github.com/google/fonts/tree/67bc647ce1910e92f461bcc82aae30f21d21a9cc/ofl),
pinned to revision `67bc647ce1910e92f461bcc82aae30f21d21a9cc`. Exact source URLs,
file sizes and SHA-256 hashes are recorded in
`src/fonts/noto-sans-sources.json`. Each family has its accompanying upstream
SIL Open Font License 1.1 text in `src/fonts/` and a license link in Settings.

The existing default station signs still require their existing CJK fonts at
startup; recommending those families does not make their existing loading
optional. A recommendation shows **Loaded** when its face is already available.
