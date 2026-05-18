# Firebase Security Specification

## Data Invariants
1. Users can only read/write their own profile (`/users/{uid}`).
2. Habit logs can only be read/written by the owner (`/habitLogs/{uid-habitId-date}`).
3. IDs must be valid (max 128 chars, alphanumeric).
4. Timestamps must be server-validated.

## Dirty Dozen Payloads (Rejections)
1. Write user profile with `role: 'admin'`. (Integrity)
2. Update someone else's habit log. (Identity)
3. Inject 1MB string into `name` field. (Resource Poisoning)
4. Skip `timestamp` and send client time. (Temporal Integrity)
5. Create habit log with negative `count`. (Validation)
6. Change `userId` of an existing log. (Immutability)
7. Query all users without filtering by UID. (PII Isolation)
8. Update terminal state without permission. (State Locking)
9. Bulk delete habit logs via wildcard exploit. (Master Gate)
10. Spoof `email_verified` if we had email auth. (Identity)
11. Write with junk document ID. (Path Hardening)
12. Create log for non-existent habit type (Schema).
