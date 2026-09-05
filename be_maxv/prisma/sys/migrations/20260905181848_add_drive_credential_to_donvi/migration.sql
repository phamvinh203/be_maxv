-- AlterTable
ALTER TABLE "don_vi" ADD COLUMN     "driveEmail" TEXT,
ADD COLUMN     "driveRefreshTokenCipher" TEXT,
ADD COLUMN     "driveRefreshTokenIv" TEXT,
ADD COLUMN     "driveRefreshTokenTag" TEXT,
ADD COLUMN     "driveRootFolderId" TEXT;
