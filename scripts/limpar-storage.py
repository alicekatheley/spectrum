"""Apaga do bucket campaign-images os arquivos listados em limpeza-storage-2026-10-04.txt
(frames de pautas descartadas ou já apagadas de pautas_geradas). GIFs enviados à Insider
(insider-gifs/) e qualquer arquivo referenciado em pauta_envios_insider / teste_ab_* /
conteudos_links ficaram de fora da lista.

Precisa da service_role key (Supabase → Project Settings → API) e do serviço desbloqueado —
com o projeto restrito por cota a Storage API responde 402.

    SUPABASE_SERVICE_KEY=... python3 scripts/limpar-storage.py           # só mostra
    SUPABASE_SERVICE_KEY=... python3 scripts/limpar-storage.py --apagar  # apaga
"""
import json, os, sys, urllib.request
from pathlib import Path

URL = 'https://krxuwejvkdkrjrppcwsw.supabase.co/storage/v1/object/campaign-images'
lista = [l.strip() for l in (Path(__file__).parent / 'limpeza-storage-2026-10-04.txt').read_text().splitlines() if l.strip()]
print(f'{len(lista)} arquivos na lista')
if '--apagar' not in sys.argv:
    sys.exit('Rodando sem --apagar: nada foi removido.')
key = os.environ['SUPABASE_SERVICE_KEY']
apagados = 0
for i in range(0, len(lista), 100):
    lote = lista[i:i + 100]
    req = urllib.request.Request(URL, method='DELETE', data=json.dumps({'prefixes': lote}).encode(),
        headers={'apikey': key, 'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as r:
        apagados += len(json.load(r))
print(f'{apagados} arquivos apagados')
