# PROJECT CONSTITUTION

This repository implements a production cross-border sourcing and
fulfillment operations platform for China-to-Bangladesh business.

The documentation under /docs is the product specification.

PRIORITY OF SOURCES

When implementing business behavior, inspect these documents first:

1. docs/BUSINESS_RULES.md
2. docs/STATUS_MACHINE.md
3. docs/DATABASE_DESIGN.md
4. docs/API_CONTRACT.md
5. docs/PROJECT_ARCHITECTURE.md
6. docs/DEVELOPMENT_ROADMAP.md

Vision.txt explains product intent but must not override explicit
business/database/API rules.

If two specification documents conflict:
DO NOT silently choose one.
Report the conflict before implementing the conflicting behavior.

GENERAL ENGINEERING RULES

1. Never rewrite the entire repository for a local task.
2. Never make unrelated refactors.
3. Never delete working features unless explicitly requested.
4. Never rename public APIs, tables, enums, routes, or domain concepts
   without explicit approval.
5. Preserve backward compatibility whenever practical.
6. Prefer small incremental changes.
7. Modify only files necessary for the current task.
8. Reuse existing architecture before introducing new abstractions.
9. Do not install dependencies unless clearly necessary.
10. Before installing a dependency, explain why existing dependencies
    cannot solve the problem.
11. Never expose secrets in frontend code.
12. Never commit .env or credentials.
13. Never expose SUPABASE_SERVICE_ROLE_KEY or OTAPI credentials.
14. Never store Taobao/1688 passwords in the Chrome extension.
15. Do not put production secrets into NEXT_PUBLIC_* variables.
16. No destructive database migrations without explicit approval.
17. Never DROP production tables/columns/data to simplify a migration.
18. Prefer additive migrations.
19. All schema changes must have rollback/recovery considerations.
20. Do not introduce fake/mock business behavior into production paths.

DATABASE RULES

21. Supabase/Postgres is the source of truth.
22. UUIDs are used for core business entities.
23. Monetary values use numeric/decimal — never floating point.
24. Financial history is append-only where specified.
25. Wallet balance must be derived from ledger transactions.
26. Approved wallet transactions must never be edited.
27. Corrections use adjustment/reversal transactions.
28. Exchange-rate history must be preserved.
29. Historical order/estimate/product snapshots must not change when
    supplier listings or default rates change.
30. Product snapshots must remain attached to historical orders.
31. Critical status changes must create status/audit history.
32. Manual overrides must record actor, timestamp, reason,
    old value, and new value.
33. Important integration calls must be logged.
34. Sensitive files use private storage and signed access.

SECURITY RULES

35. Authorization must be enforced server-side.
36. UI hiding is never considered authorization.
37. Supabase RLS must protect client data.
38. Client users must never access another client's data.
39. Staff receiver must not access wallet/payment/profit data.
40. Staff packer must not access wallet/payment/profit data.
41. Admin and super_admin permissions must follow specifications.
42. Never bypass RLS merely to make a feature work.
43. Service-role access must only be used in trusted server-side code.

BUSINESS WORKFLOW RULES

44. Status transitions must follow STATUS_MACHINE.md.
45. Invalid transitions must fail explicitly.
46. Completed/cancelled records cannot silently re-enter active workflow.
47. Orders cannot enter purchasing before required approval.
48. Failed QC items cannot enter normal packing without admin approval.
49. Automated features must have manual fallback where specified.
50. Never make external integrations the only way to complete an operation.

API RULES

51. Follow API_CONTRACT.md.
52. Successful API responses use the documented response envelope.
53. Errors use the centralized error envelope and documented error codes.
54. Validate incoming data with Zod or existing validation infrastructure.
55. Authentication and authorization are required before private operations.
56. External-provider-specific logic belongs behind service/adaptor boundaries.

UI RULES

57. Client, admin, staff_receiver and staff_packer interfaces may share
    components but must respect permission boundaries.
58. Warehouse screens must be mobile friendly.
59. Important financial/status information must not be silently hidden.
60. UI must display useful error states rather than failing silently.

TASK EXECUTION RULES

Before coding:
A. Read AGENTS.md.
B. Inspect only the documentation relevant to the task.
C. Inspect existing implementation.
D. State the files you expect to modify.
E. Identify any specification conflict.

During coding:
F. Keep the patch minimal.
G. Avoid unrelated cleanup.
H. Preserve existing functionality.

After coding:
I. Run the smallest relevant validation first.
J. Run typecheck/lint/tests/build when appropriate.
K. Report changed files.
L. Report tests executed.
M. Report anything not verified.
N. Do not continue into another phase automatically.

STOP after completing the requested task.