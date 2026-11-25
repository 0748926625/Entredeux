# Security Specification & Payload-First TDD (`EntreDeux`)

## 1. Data Invariants
1. **PII Isolation**: User email addresses are stored exclusively in `/userPrivate/{userId}` and readable/writable only by `{userId}`. `/profiles/{userId}` contains zero PII and is listable by signed-in users only for published profiles (`isPublished == true`) or the owner's own document.
2. **Profile Identity & Size Integrity**: A user can only create or update `/profiles/{userId}` where `userId == request.auth.uid`, `uid == request.auth.uid`, `age` is between 18 and 99, `interests` is bounded (`<= 8` items), `photoDataUrl` is `<= 350000` chars, and `createdAt`/`updatedAt` strictly equal `request.time`.
3. **Like Ownership & Determinism**: `/likes/{likeId}` requires `likeId == request.auth.uid + '_' + incoming().toUid`, preventing duplicate or spoofed likes. Only `fromUid == request.auth.uid` can create or delete a like.
4. **Conversation Master Gate**: `/conversations/{conversationId}` strictly limits `participantIds` to length 2, containing `participantA` and `participantB`. Only a participant (`request.auth.uid in resource.data.participantIds`) can read, update, or access subcollection `/messages/{messageId}`.
5. **Message Integrity**: Messages in `/conversations/{conversationId}/messages/{messageId}` must satisfy `get(parent).data` membership. `senderId` must equal `request.auth.uid` for user messages, or `parent.data.aiPartnerId` strictly when `parent.data.isAiPartner == true && request.auth.uid == parent.data.participantA`. Messages are immutable once created (`allow update, delete: if false`).
6. **Vocabulary Notebook Isolation**: `/userPrivate/{userId}/vocab/{entryId}` is strictly scoped to `userId == request.auth.uid` and `ownerId == request.auth.uid`.

## 2. The "Dirty Dozen" Malicious Payloads (All Must Return PERMISSION_DENIED)
1. **Unauthenticated profile write**: Anonymous request creating `/profiles/user1` -> Denied (`email_verified` & `isSignedIn` check).
2. **Identity spoofing on profile**: User A creating `/profiles/userB` with `uid: "userB"` -> Denied (`userId == request.auth.uid`).
3. **Shadow ghost field injection on profile**: User A updating `/profiles/userA` with extra `isVerifiedAdmin: true` -> Denied (`hasOnly` / `affectedKeys().hasOnly()`).
4. **Unverified email spoofing**: Auth token with `email_verified: false` creating `/profiles/userA` -> Denied (`request.auth.token.email_verified == true`).
5. **Underage or oversized bio poisoning**: Profile with `age: 15` or 2000-char `bio` -> Denied (`age >= 18` & `bio.size() <= 500`).
6. **Unbounded array DoW attack**: Profile with 50 interests -> Denied (`interests.size() <= 8`).
7. **Client-forged timestamps**: Creating profile with `createdAt` in the past -> Denied (`createdAt == request.time`).
8. **PII cross-user read**: User A reading `/userPrivate/userB` -> Denied (`userId == request.auth.uid`).
9. **Spoofed Like**: User A creating `/likes/userB_userC` with `fromUid: "userB"` -> Denied (`fromUid == request.auth.uid`).
10. **Unauthorized Conversation List / Read**: User C reading or listing `/conversations` where User C is not in `participantIds` -> Denied (`request.auth.uid in resource.data.participantIds`).
11. **Fake AI Message in Human Chat**: User A inserting a message with `senderType: "ai"` into a human-to-human conversation (`isAiPartner == false`) -> Denied (`parent.data.isAiPartner == true`).
12. **Message tampering / deletion**: User A updating or deleting an existing message -> Denied (`allow update, delete: if false`).
