# Semantic citation and truncation remediation

## Defect 1: title-only SOP citation

Previous membership validation accepted any contiguous source substring, including a document title. The remediation now requires a citation to be:

- from an allowed/current source ID;
- an exact contiguous whole-word span;
- at least 20 Unicode code points;
- substantive (at least two non-generic evidence tokens); and
- different from the title, section, source label and known demo boilerplate.

Context construction also excludes sources from which no substantive span can be obtained. Recommendation V2 evidence is validated with the same citation rules, and the backend-owned relevance decision still runs after retrieval.

## Defect 2: excerpt ending at `NETWO`

Raw code-point slicing could turn `NETWORK` into the convincing fragment `NETWO`. `boundedExactSpan` now searches backward for punctuation or whitespace and returns an exact source substring. If an extremely long token has no safe boundary within the bound, it returns an empty string and the evidence path fails closed rather than cutting the token.

Regression assertions verify:

- title-only evidence is rejected;
- a billing SOP cannot ground a network/IoT request;
- the historical 120-character fixture would have ended in `NETWO`;
- the repaired span never ends in `NETWO` and remains present verbatim in the source;
- an unbroken repeated `NETWORK` token returns no bounded citation; and
- the selected quote is the full substantive instruction line after the SOP title.

The production chunker also prefers word/sentence boundaries while retaining a hard size bound. An initial experimental version allowed an unbounded token to collapse into one oversized chunk and caused a rollback-profile integration failure; that overreach was reverted. The final implementation keeps chunk bounds and makes citation/display extraction fail closed, after which the full rollback integration passed.
