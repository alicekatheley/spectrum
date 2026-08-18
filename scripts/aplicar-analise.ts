import dotenv from "dotenv";
dotenv.config();
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function main() {
  const [id, tipoMidia, analiseJsonPath, flag] = process.argv.slice(2);
  if (!id || !tipoMidia || !analiseJsonPath) {
    throw new Error("Uso: tsx aplicar-analise.ts <id> <gif|estatica> <caminho_json_analise> [--force]");
  }
  const force = flag === "--force";

  const analise = JSON.parse(fs.readFileSync(analiseJsonPath, "utf-8"));

  const { data: sourceRow, error: sourceError } = await supabase
    .from("conteudos_links")
    .select("insider_original_url")
    .eq("id", id)
    .single();
  if (sourceError) throw sourceError;

  // Propaga pra todas as linhas que compartilham o mesmo asset (mesmo GIF/PNG reenviado
  // pra públicos/cohorts diferentes) — evita reanalisar a mesma imagem várias vezes.
  // --force ignora o filtro de "ainda não analisado" — usado pra corrigir análises geradas
  // a partir de frames corrompidos (bug de extração já corrigido em extrair-frames.ts).
  let updateQuery = supabase
    .from("conteudos_links")
    .update({
      mecanica_texto: analise.mecanicaTexto,
      composicao_texto: analise.composicaoTexto,
      frames: analise.frames,
      tipo_midia: tipoMidia,
      analisado_em: new Date().toISOString(),
    })
    .eq("insider_original_url", sourceRow.insider_original_url);
  if (!force) updateQuery = updateQuery.is("mecanica_texto", null);
  const { data: updated, error } = await updateQuery.select("id");

  if (error) throw error;
  console.log(`Salvo em conteudos_links (asset de id=${id}, ${updated?.length ?? 0} linha(s) atualizada(s), status_analise permanece "pendente" pra revisão).`);
}

main().catch(err => {
  console.error("Erro:", err);
  process.exit(1);
});
