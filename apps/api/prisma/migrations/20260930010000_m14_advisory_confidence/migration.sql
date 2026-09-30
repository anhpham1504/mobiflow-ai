-- V1 confidence values remain intact. V2 has no model confidence field.
ALTER TABLE "AiRecommendation" ALTER COLUMN "confidence" DROP NOT NULL;
