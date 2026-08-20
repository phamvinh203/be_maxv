-- AlterTable
ALTER TABLE "don_vi" ADD COLUMN     "dvcPasswordCipher" TEXT,
ADD COLUMN     "dvcPasswordIv" TEXT,
ADD COLUMN     "dvcPasswordTag" TEXT,
ADD COLUMN     "dvcUsername" TEXT;
