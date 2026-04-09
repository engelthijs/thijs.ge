import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PASSWORD = Deno.env.get("PRIVATE_PASSWORD") || "Rijnlaan131";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const password = formData.get("password") as string;
    const files = formData.getAll("files") as File[];

    if (password !== PASSWORD) {
      return new Response(JSON.stringify({ error: "Wrong password" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!files || files.length === 0) {
      return new Response(JSON.stringify({ error: "No files provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const results: { name: string; success: boolean; error?: string }[] = [];

    for (const file of files) {
      // Sanitize filename: keep extension, add timestamp to prevent collisions
      const ext = file.name.split(".").pop() || "bin";
      const baseName = file.name
        .replace(/\.[^.]+$/, "")
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .substring(0, 50);
      const timestamp = Date.now();
      const path = `${baseName}_${timestamp}.${ext}`;

      const { error } = await supabase.storage
        .from("private")
        .upload(path, file, {
          contentType: file.type,
          upsert: false,
        });

      if (error) {
        results.push({ name: file.name, success: false, error: error.message });
      } else {
        results.push({ name: file.name, success: true });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
