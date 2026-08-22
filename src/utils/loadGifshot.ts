// gifshot é CommonJS e não tem types. Dependendo de como o bundler decide dividir os chunks
// (varia conforme quantos pontos do código fazem `import('gifshot')`), o objeto real da lib
// às vezes não cai em `.default` — cai direto no namespace do módulo ou num export nomeado
// sintético. Resolve de forma defensiva em vez de assumir `.default`.
export async function loadGifshot(): Promise<any> {
  const mod: any = await import('gifshot');
  if (typeof mod?.default?.createGIF === 'function') return mod.default;
  if (typeof mod?.createGIF === 'function') return mod;
  const nested = Object.values(mod).find((v: any) => v && typeof v.createGIF === 'function');
  if (nested) return nested;
  throw new Error('Não foi possível carregar a biblioteca gifshot.');
}
