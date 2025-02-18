-- CreateTable
CREATE TABLE "History" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "topic" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "correctanswer" TEXT NOT NULL,
    "useranswer" TEXT NOT NULL,

    CONSTRAINT "History_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserLevel" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "level" TEXT NOT NULL,
    "topic" TEXT NOT NULL,

    CONSTRAINT "UserLevel_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "History" ADD CONSTRAINT "History_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserLevel" ADD CONSTRAINT "UserLevel_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
