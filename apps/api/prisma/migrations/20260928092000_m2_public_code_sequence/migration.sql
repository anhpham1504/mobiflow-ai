-- Atomic allocator for the future M3 public-code service. M2 exposes no request creation route.
CREATE SEQUENCE "request_public_code_seq" AS BIGINT START WITH 1 INCREMENT BY 1 NO CYCLE;
GRANT USAGE, SELECT ON SEQUENCE "request_public_code_seq" TO mobiflow_app;
