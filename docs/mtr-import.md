# Minecraft Transit Railway import

Open **Edit Routes → Import from MTR**. Select the MTR version and either load a
map/API URL or paste its complete API JSON. Preview the routes, select those to
add, and optionally choose a destination company. All processing and storage
happen in the browser; there is no server or proxy.

## Supported releases

| Version | API | Verified official artifact |
| --- | --- | --- |
| 4.0.5 | `mtr/api/map/stations-and-routes?dimension=N` | [FABRIC-4.0.5+1.20.1](https://modrinth.com/mod/minecraft-transit-railway/version/5cxaj3g8) |
| 4.1.0-beta.2 | Same as 4.0.5 | [FABRIC-4.1.0-beta.2+1.21.1](https://modrinth.com/mod/minecraft-transit-railway/version/JSuVAgAb) |
| 3.2.2-hotfix-2 | `data` (all dimensions; select array index locally) | [FORGE 1.20.1-3.2.2-hotfix-2](https://modrinth.com/mod/minecraft-transit-railway/version/YLvg95i9) |

These are explicit format adapters, not automatic support for every historical
or future MTR release. API responses do not identify the mod version reliably.
The version selector determines the parser. The dimension index starts at zero.
An API URL's `dimension` query populates the selection; it can be overridden.
Map paths behind a reverse proxy and `index.html` entry points are preserved.

If browser fetching is blocked by CORS, HTTPS/HTTP restrictions, or local-network
permissions, open the generated API link in another tab, copy its JSON, and use
**Paste JSON**. For MTR3, paste the whole array and choose the desired dimension.
For MTR4, a complete envelope or its `data` object is accepted.

## Conversion

- Every selected MTR route becomes an independent line. Opposite directions
  remain separate; the preview shows endpoints to distinguish them.
- Names are split into positional `|` language slots. MTR3 route names/numbers
  omit their `||` qualifier as the original map does. Station empty language
  slots and MTR4 name slots are preserved. Lines have four slots, stations five;
  slots are assigned by position, not language detection. Each name slot is
  limited to the app's 100-character field limit.
- RGB integers become six-digit hex colors; `number` becomes the line prefix.
  Station numbers and readings are not fabricated.
- Modern route stop IDs refer to the global station list. The per-stop `name`
  is a platform name and is not used as a station name.
- Legacy station IDs remain strings, including negative 64-bit decimal IDs.
  Legacy routes have no ID; local indices distinguish equal-color routes.
- Selected routes share the same source station identities within one import.
  Existing stations are not merged by name. Importing again adds a new batch.
- Consecutive stops at the same station are compressed. An explicit circular
  route may repeat its first station at the end. Other repeated intermediate
  stations cannot be represented by the app and those routes are excluded with
  a visible count. Empty routes are also excluded. Malformed station references
  cause validation failure rather than a silently shortened route.
- Additional metadata (coordinates, dwell times, depots, zones, explicit walking
  connections, visibility and transport type) is not imported. Modern hidden
  routes are available in the route selection as well.

Validation happens before database writes. Inserts use generated IDs and bound
SQL parameters, with a savepoint to roll back the complete batch on failure.
The batch is saved only after releasing the savepoint because sql.js exports
reopen the connection. If browser storage fails, the imported rows are removed
from memory, the previous saved database is kept, and the preview stays open
for retry. Connection foreign-key enforcement is restored after exporting.
JSON responses are bounded to 10 MiB (including streamed responses without a
Content-Length), 50,000 stations, 5,000 routes and 200,000 stop references. URL
requests use GET with credentials omitted, no referrer, a 15-second timeout,
and cancellation when the input changes or the dialog closes.

## Contract evidence

The compiled map DTOs/legacy handler in the official JARs above were inspected
without running Minecraft. SHA-1 values from the distribution:

- 4.0.5: `0b5c3b981418e092bfb0aa3f7414110be1c61040`
- 4.1.0-beta.2: `d7ba5e7371c45514fb58156fe16d971a4e32d788`
- 3.2.2-hotfix-2: `1f4ef7d51a20a6e4a3b9772daed8c11a04ceb223`

Source references for the synthetic test fixtures:

- [MTR4 map schemas](https://github.com/Minecraft-Transit-Railway/Transport-Simulation-Core/tree/ce3a5090829aef10f37a71d55454e8d0e5c66c6b/buildSrc/src/main/resources/schema/map)
- [MTR4 route station ID mapping](https://github.com/Minecraft-Transit-Railway/Transport-Simulation-Core/blob/ce3a5090829aef10f37a71d55454e8d0e5c66c6b/src/main/java/org/mtr/core/map/RouteStation.java)
- [MTR3 map handler](https://github.com/Minecraft-Transit-Railway/Minecraft-Transit-Railway/blob/2525e231c97a973af6272ff8a125606b64a5ace6/common/src/main/java/mtr/servlet/DataServletHandler.java)

The MTR4 source reference is the core commit just before publication. Because
the dependency used an unchanged Maven version, its exact build commit cannot
be asserted from metadata. The published artifacts independently confirm the
field contract; test fixtures do not claim to be captured server responses.
