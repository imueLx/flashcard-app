import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const rootDir = process.cwd();
const sourceDir = path.join(rootDir, "src", "app", "data", "images");
const outputDir = path.join(rootDir, "public", "images", "flashcards");

const imageByQuestionId = {
  1: "boy-walking-to-school.jpg",
  2: "girls-playing.jpg",
  3: "girl-drinks-milk.jpg",
  4: "they-play-basketball.jpg",
  5: "mother-cooks-food.jpg",
  6: "dogs-barking.jpg",
  7: "boy-doing-homework.jpg",
  8: "happy-kid.jpg",
  9: "kind-kid.jpg",
  10: "cat-sleep-sofa.jpg",
  11: "student-open-books.jpg",
  12: "teacher-teaching-lessons.jpg",
  13: "wake-morning-early.jpg",
  14: "rainy-season.jpg",
  15: "birds-fying.jpg",
  16: "girl-walking-school.jpg",
  17: "boys-play-outside.jpg",
  18: "kids-excited.jpg",
  19: "ana-mia-friends.jpg",
  20: "boy-eat-breakfast.jpg",
  21: "dog-barking.jpg",
  22: "kids-ready-test.jpg",
  23: "girl-dont-know-answer.jpg",
  24: "kids-running-fast.jpg",
  25: "father-drives.jpg",
  26: "church.jpg",
  27: "flowers.jpg",
  28: "sisters-like-music.jpg",
  29: "knocking-on-door.jpg",
  30: "teacher-explains-lesson.jpg",
  31: "stdents-bring-notebooks.jpg",
  32: "girls-ready-to-dance.jpg",
  33: "boy-girl-not-late.jpg",
  34: "class-follow-rules.jpg",
  35: "basket-fruits-table.jpg",
  36: "two-person-library.jpg",
  37: "kid-helping-kid.jpg",
  38: "teacher-pupilis-in-classroom.jpg",
  39: "takes-bag.jpg",
  40: "shoes-under-bed.jpeg",
};

async function optimizeImage(inputPath, outputPath) {
  await sharp(inputPath)
    .rotate()
    .resize(960, 540, {
      fit: "contain",
      background: "#fff0f5",
      withoutEnlargement: true,
    })
    .webp({ quality: 72, effort: 5 })
    .toFile(outputPath);
}

async function main() {
  await fs.mkdir(outputDir, { recursive: true });

  const report = [];

  for (const [idRaw, fileName] of Object.entries(imageByQuestionId)) {
    const id = Number(idRaw);
    const inputPath = path.join(sourceDir, fileName);
    const outputPath = path.join(outputDir, `${id}.webp`);

    try {
      const inputStat = await fs.stat(inputPath);
      await optimizeImage(inputPath, outputPath);
      const outputStat = await fs.stat(outputPath);

      const savedBytes = inputStat.size - outputStat.size;
      const savedPercent =
        inputStat.size > 0
          ? ((savedBytes / inputStat.size) * 100).toFixed(1)
          : "0.0";

      report.push({
        id,
        fileName,
        beforeKb: (inputStat.size / 1024).toFixed(1),
        afterKb: (outputStat.size / 1024).toFixed(1),
        savedPercent,
      });
    } catch (error) {
      console.error(`Failed question ${id} (${fileName}):`, error.message);
      process.exitCode = 1;
    }
  }

  report.sort((a, b) => a.id - b.id);

  console.log("\nOptimized flashcard images:\n");
  for (const row of report) {
    console.log(
      `#${row.id.toString().padStart(2, "0")} ${row.fileName}  ${row.beforeKb}KB -> ${row.afterKb}KB  (${row.savedPercent}% saved)`,
    );
  }

  console.log(`\nOutput directory: ${outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
