-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "cNumber" BIGINT NOT NULL,
    "cpf" TEXT NOT NULL,
    "password" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
