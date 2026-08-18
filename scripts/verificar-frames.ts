import dotenv from "dotenv";
dotenv.config();
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function main() {
  const scratchRoot = process.argv[2];
  if (!scratchRoot) throw new Error("Uso: tsx verificar-frames.ts <pasta_scratch_com_batch-N>");

  const batchDirs = fs.readdirSync(scratchRoot).filter(d => d.startsWith("batch-"));
  const ids: string[] = [];
  for (const batchDir of batchDirs) {
    const batchPath = path.join(scratchRoot, batchDir);
    const idDirs = fs.readdirSync(batchPath).filter(d => {
      const full = path.join(batchPath, d);
      return fs.statSync(full).isDirectory();
    });
    ids.push(...idDirs.map(d => JSON.stringify({ id: d, dir: path.join(batchPath, d) })));
  }

  const entries = ids.map(s => JSON.parse(s));
  console.log(`Encontrados ${entries.length} ids processados em disco.`);

  const { data: gifRows, error } = await supabase
    .from("conteudos_links")
    .select("id")
    .eq("tipo_midia", "gif");
  if (error) throw error;
  const gifIds = new Set((gifRows ?? []).map((r: any) => r.id));

  const verifyRoot = path.join(scratchRoot, "verify");
  fs.mkdirSync(verifyRoot, { recursive: true });

  const suspects: any[] = [];
  const ok: string[] = [];
  const skippedEstatica: string[] = [];

  for (const { id, dir } of entries) {
    if (!gifIds.has(id)) {
      skippedEstatica.push(id);
      continue;
    }

    const oldFrameFiles = fs.readdirSync(dir).filter(f => f.startsWith("frame_") && f.endsWith(".png")).sort();
    if (oldFrameFiles.length === 0) continue;

    const outDir = path.join(verifyRoot, id);
    try {
      execSync(`npx tsx scripts/extrair-frames.ts "${outDir}" ${id}`, {
        cwd: "C:/Users/Notebook/spectrum",
        env: { ...process.env, PATH: `C:/Program Files/nodejs;${process.env.PATH}` },
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (e: any) {
      suspects.push({ id, reason: "erro ao reextrair", detail: e.message?.slice(0, 300) });
      continue;
    }

    const newFrameFiles = fs.readdirSync(outDir).filter(f => f.startsWith("frame_") && f.endsWith(".png")).sort();

    let mismatch = false;
    const details: any[] = [];
    const maxLen = Math.max(oldFrameFiles.length, newFrameFiles.length);
    for (let i = 0; i < maxLen; i++) {
      const oldFile = oldFrameFiles[i] ? path.join(dir, oldFrameFiles[i]) : null;
      const newFile = newFrameFiles[i] ? path.join(outDir, newFrameFiles[i]) : null;
      if (!oldFile || !newFile) { mismatch = true; details.push({ i, old: oldFile, new: newFile, note: "contagem de frames diferente" }); continue; }
      const oldMeta = await sharp(oldFile).metadata();
      const newMeta = await sharp(newFile).metadata();
      if (oldMeta.height !== newMeta.height || oldMeta.width !== newMeta.width) {
        mismatch = true;
        details.push({ i, oldDim: `${oldMeta.width}x${oldMeta.height}`, newDim: `${newMeta.width}x${newMeta.height}` });
      }
    }

    if (mismatch) {
      suspects.push({ id, oldCount: oldFrameFiles.length, newCount: newFrameFiles.length, details });
    } else {
      ok.push(id);
    }
  }

  console.log(`\n=== RESULTADO ===`);
  console.log(`OK (frames idênticos): ${ok.length}`);
  console.log(`Estáticas (puladas, bug não se aplica): ${skippedEstatica.length}`);
  console.log(`SUSPEITOS (frames divergentes, precisam reanálise): ${suspects.length}`);
  console.log(JSON.stringify(suspects, null, 2));
}

main().catch(err => {
  console.error("Erro:", err);
  process.exit(1);
});
