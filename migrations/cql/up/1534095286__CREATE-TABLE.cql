CREATE TABLE service_users.users (id UUID PRIMARY KEY, username text, password text, created_at timestamp, updated_at timestamp);
---
CREATE INDEX username_idx ON service_users.users ( username );
