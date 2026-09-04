-- Roles are stored in Oracle. The client never chooses or submits a role.
ALTER TABLE APP_USER ADD (
  ROLE VARCHAR2(20) DEFAULT 'CUSTOMER' NOT NULL
    CONSTRAINT CK_APP_USER_ROLE CHECK (ROLE IN ('CUSTOMER', 'ADMIN'))
);

CREATE TABLE TOKEN_REVOCATION (
  TOKEN_JTI VARCHAR2(64) CONSTRAINT PK_TOKEN_REVOCATION PRIMARY KEY,
  EXPIRES_AT TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IX_TOKEN_REVOCATION_EXPIRY ON TOKEN_REVOCATION (EXPIRES_AT);

-- Create one demonstrable administrator. Replace these placeholders before running.
-- Generate the bcrypt hash in Node, for example:
-- node -e "require('bcryptjs').hash('ChangeThisPassword!', 12).then(console.log)"
INSERT INTO APP_USER (USERNAME, EMAIL, PASSWORD_HASH, DATE_JOINED, ROLE)
VALUES ('cinehive_admin', 'admin@example.com', '$2b$12$.nNnUn7aRHocoESJ0MNkjOntEtJ69PYgsArkCRHrgZ9AG9zALutQK', SYSDATE, 'ADMIN');
