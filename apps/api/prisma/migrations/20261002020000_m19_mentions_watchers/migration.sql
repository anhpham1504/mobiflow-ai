CREATE TABLE "RequestInternalNoteMention" (
  "noteId" UUID NOT NULL,
  "mentionedUserId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RequestInternalNoteMention_pkey" PRIMARY KEY ("noteId", "mentionedUserId"),
  CONSTRAINT "RequestInternalNoteMention_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "RequestInternalNote"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RequestInternalNoteMention_mentionedUserId_fkey" FOREIGN KEY ("mentionedUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "RequestInternalNoteMention_mentionedUserId_idx" ON "RequestInternalNoteMention"("mentionedUserId");

CREATE TABLE "RequestWatcher" (
  "requestId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RequestWatcher_pkey" PRIMARY KEY ("requestId", "userId"),
  CONSTRAINT "RequestWatcher_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RequestWatcher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "RequestWatcher_userId_idx" ON "RequestWatcher"("userId");

-- Mention wins over watch within one source event, including replay/retry.
-- Existing requester/approval/assignment/SLA notification keys remain unchanged.
CREATE UNIQUE INDEX "Notification_internal_recipient_event_key" ON "Notification"("recipientId", "eventId")
  WHERE "type" IN ('INTERNAL_NOTE_MENTION', 'REQUEST_WATCH_ACTIVITY');

GRANT SELECT, INSERT ON "RequestInternalNoteMention" TO mobiflow_app;
REVOKE UPDATE, DELETE, TRUNCATE ON "RequestInternalNoteMention" FROM mobiflow_app;
GRANT SELECT, INSERT, DELETE ON "RequestWatcher" TO mobiflow_app;
REVOKE UPDATE, TRUNCATE ON "RequestWatcher" FROM mobiflow_app;
