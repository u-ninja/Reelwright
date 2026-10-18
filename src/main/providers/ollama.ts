// shortcut: model fixed per machine, model picker arrives with the other providers in milestone 6.
const MODEL = process.env['OLLAMA_MODEL'] ?? 'gemma4:12b-it-qat'

export async function ollama(system: string, user: string, schema: object): Promise<string> {
  const res = await fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    signal: AbortSignal.timeout(300_000),
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      think: false,
      format: schema,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    })
  }).catch((e) => {
    throw new Error(
      `Can't reach Ollama at localhost:11434 (is it running? brew services start ollama): ${e}`
    )
  })
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`)
  return (await res.json()).message.content
}
