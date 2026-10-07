# Spectrum — Agentes de CRM (Calendário, Segmentação, Teste A/B)

## 1. Nome do Projeto
**Spectrum — Agentes de Calendário, Segmentação e Teste A/B de CRM**

## 2. O que faz
Substitui três decisões de CRM hoje tomadas manualmente pelo time: o quê enviar, quando e para quem, e qual criativo converte melhor. O agente de calendário monta a grade de disparo ótima por marca a partir do histórico real (BigQuery); o agente de segmentação recomenda frequência e horário por grupo de valor de cliente (hoje só Barbours); o agente de teste A/B gera e envia comparações de GIF na Insider e aprende com o resultado. Serve aos times de CRM das marcas do Grupo Beauté (Ápice, Barbours, Kokeshi, Lescent, Rituária). Resultado esperado: mais receita com o mesmo volume de disparo, decisões guiadas por dado em vez de achismo.

## 3. Execução
- **Calendário**: sob demanda pela UI (`GET /api/calendario/contexto`, `POST /api/calendario/explicar`) + recálculo automático diário no BigQuery via scheduled queries (`ETL diário` 11:30 UTC, `ETL semanal` segunda 12:30 UTC, `alerta de saúde` 12:00 UTC).
- **Teste A/B (Modo C)**: gerado automaticamente por cron. Local: `node-cron` in-process (`server/index.ts`, 08:00 + catch-up no boot). Produção: `POST /tasks/agente-gif-tick`, chamado pelo agendador do GoDeploy (o worker não se agenda sozinho), 1 pauta por chamada, cota de 5/dia. Envio final para a Insider é manual (`POST /api/teste-ab-enviar-insider`), disparado pelo usuário na UI após aprovar a Variante B.
- **Segmentação**: recálculo diário de manhã sobre janela de ~2 meses (conforme especificação recebida — implementação ainda não está neste repositório).

## 4. Dependências
- **BigQuery** (`gogroup-crm.crm_modelo`) — modelo do calendário. Local via SDK Node + ADC; produção via REST + JWT RS256 assinado com WebCrypto (`GCP_SERVICE_ACCOUNT_JSON`).
- **AI proxy do Grupo** (`ai-proxy.gogroupbr.com/v1`, `AI_PROXY_KEY`/`GOGROUP_TOKEN`) — explicação do calendário e geração das propostas de teste A/B.
- **Supabase** — persistência (`pautas_geradas`, `teste_ab_propostas`, `teste_ab_envios`, `disparos_historicos`). Local via SDK, produção via REST na mão.
- **Insider** — envio da campanha experiment (`INSIDER_API_KEY_<MARCA>`, uma por marca).
- **PiApp** (`PIAPP_API_KEY`) — geração das imagens/frames do GIF.

## 5. Fluxo

**Calendário:** BigQuery deriva config → grade de horários → índices (walk-forward + GLM Poisson) → app lê `v_indices_atuais` → SE modo = receita máxima, concentra volume nos dias de maior retorno; SE modo = eficiência, corta volume e explicita o custo → aplica limites operacionais (teto de dias intensos, rodízio de família de oferta) → agente explica o plano em texto, sem inventar número.

**Teste A/B (Modo C):** cron dispara pipeline → gera conceito de GIF → SE aprovado pelo usuário, gera proposta de Variante B a partir do histórico e salva em `teste_ab_propostas`; SE reprovado, regenera imediatamente fora da cota → usuário aprova a comparação → `POST /api/teste-ab-enviar-insider` cria a campanha experiment como Draft na Insider com as duas variantes.

**Segmentação (spec):** mede receita por grupo (9 grupos, cruzando comprador/lead × valor) → compara com a média da marca → SE grupo está acima do que vale, reduz frequência gradualmente; SE está abaixo, aumenta gradualmente → converge em ~4 semanas sem choque de volume.

## 6. Configurar antes de usar
- Preencher `.env`: `AI_PROXY_KEY`, `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`, `BIGQUERY_PROJECT_ID` + `GOOGLE_APPLICATION_CREDENTIALS` (local), `PIAPP_API_KEY`.
- Em produção (GoDeploy): configurar `GCP_SERVICE_ACCOUNT_JSON`, `GOGROUP_TOKEN`, `INSIDER_API_KEY_<MARCA>` por marca, e o cron job apontando para `/tasks/agente-gif-tick`.
- No Supabase: popular o vault com a `service_role_key` e rodar `npm run sb:push` para aplicar as migrations e o schedule do sync de catálogo.
- Confirmar que as 5 marcas têm `marca_config` calibrada no BigQuery — sem isso a aba de calendário fica indisponível de propósito (sem fallback sintético).

## 7. Atenção
- **Dois servidores divergentes**: `server/index.ts` (Express, local) e `worker.ts` (Workers, produção) implementam a mesma API separadamente. Rota nova escrita só num dos dois já quebrou em produção sem erro visível — sempre testar contra o worker (`npx tsx scripts/verificar-worker-calendario.ts`), não só em `localhost:3000`.
- **Ordem das procedures de derivação do calendário é obrigatória**: inverter `sp_deriva_config` com as seguintes faz o dia rodar com o limiar de ontem, sem log nem erro.
- **`/api/parse-estilo-visual` diverge silenciosamente** entre servidores (Express chama IA de verdade, worker devolve paleta fixa) — não documentado, causa indeterminada.
- **Migração de IA pela metade**: seis call sites do Express ainda dependem de `GEMINI_API_KEY`/`@google/genai`, apesar de a variável não constar mais na documentação oficial; produção já está 100% no AI proxy.
- **Segmentação** ainda não tem implementação neste repositório e cobre só Barbours — as outras marcas exigem calibração própria antes de entrar em produção.
- Margem curta entre o ETL diário do calendário (~11:46 UTC) e o alerta de saúde (12:00 UTC): 13,7 minutos, registrado como pendência.
