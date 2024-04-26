/// <reference types="https://esm.sh/v135/@supabase/functions-js@2.3.1/src/edge-runtime.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.7";
import { corsHeaders } from "../_shared/cors.ts";

const session = new Supabase.ai.Session("llama3");

Deno.serve(async (req: Request) => {
  // This is needed if you're planning to invoke your function from a browser.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  // Initialise a Supabase client with user context.
  const authHeader = req.headers.get("Authorization")!;
  console.log({ authHeader });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  );
  // Get user
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!user) throw new Error("no user");
  const userId = user.id;
  console.log({ userId });

  // Decode JSON.
  const json = await req.json();
  console.log(json);
  const { messages, previewToken } = json;
  const prompt =
    `You're a friendly support assistant. Given the following message history between a user and you, the assistant, answer the user's most recent question taking into consideration all the context provided in the messages.
    
    Messages:
    ${JSON.stringify(messages)}
    `.trim();

  // Get the output as a stream
  const output =
    (await session.run(prompt, { stream: true })) as AsyncGenerator<
      { response: string | null },
      never,
      void
    >;

  // Create a stream
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let completion = "";

      try {
        for await (const chunk of output) {
          completion += chunk.response ?? "";
          controller.enqueue(encoder.encode(chunk.response ?? ""));
        }
      } catch (err) {
        console.error("Stream error:", err);
      } finally {
        // Write chat to db
        await onCompletion(completion);
        controller.close();
      }
    },
  });

  async function onCompletion(completion: string) {
    const title = json.messages[0].content.substring(0, 100);
    const id = json.id;
    const createdAt = Date.now();
    const path = `/chat/${id}`;
    const payload = {
      id,
      title,
      userId,
      createdAt,
      path,
      messages: [
        ...messages,
        {
          content: completion,
          role: "assistant",
        },
      ],
    };
    // Insert chat into database.
    await supabase.from("chats").upsert({ id, payload }).throwOnError();
  }

  // Return the stream to the user
  const headers = new Headers({
    ...corsHeaders,
    "Content-Type": "text/event-stream",
    Connection: "keep-alive",
  });
  return new Response(stream, {
    headers,
  });
});
