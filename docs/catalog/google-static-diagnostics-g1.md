# Google static diagnostics — G1

`contracts/google/diagnostics.g1.json` carries the eleven frozen diagnostic identifiers from G0.
The first eight are blocking `ERROR` diagnostics. The RDA vertical discrepancy, Demand Gen safe
zone source requirement, and transitional lifecycle marker are non-blocking `INFO` diagnostics.

Issues are sorted deterministically by severity, input JSON pointer, code, then message key. AJV
or platform English messages are not exposed as the stability contract. The diagnostics remain in
the Google contract namespace and are not added to the legacy active Error Registry.
