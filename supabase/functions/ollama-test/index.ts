/// <reference types="https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts" />
const session = new Supabase.ai.Session("llama3");

Deno.serve(async (req: Request) => {
  const params = new URL(req.url).searchParams;
  const prompt = params.get("prompt") ?? "";

  // Get the output as a stream
  const output =
    (await session.run(prompt, { stream: true })) as AsyncGenerator<
      { response: string | null },
      never,
      void
    >;

  const headers = new Headers({
    "Content-Type": "text/event-stream",
    Connection: "keep-alive",
  });

  // Create a stream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        for await (const chunk of output) {
          controller.enqueue(encoder.encode(chunk.response ?? ""));
        }
      } catch (err) {
        console.error("Stream error:", err);
      } finally {
        controller.close();
      }
    },
  });

  // Return the stream to the user
  return new Response(stream, {
    headers,
  });
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. supabase functions serve --env-file supabase/functions/.env
  3. Make an HTTP request:

  curl --get "http://localhost:54321/functions/v1/ollama-test" \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --data-urlencode "prompt=write a short rap song about Supabase, the Postgres Developer platform, as sung by Nicki Minaj"

*/
