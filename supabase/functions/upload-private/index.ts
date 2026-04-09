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
    // Accepts JSON with password + list of filenames
    // Returns signed upload URLs for each file (browser uploads directly to Storage)
    const { password, files } = await req.json();

    if (password !== PASSWORD) {
      return new Response(JSON.stringify({ error: "Wrong password" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!files || !Array.isArray(files) || files.length === 0) {
      return new Response(JSON.stringify({ error: "No files provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const urls: { name: string; path: string; uploadUrl?: string; error?: string }[] = [];

    for (const file of files) {
      const ext = file.name.split(".").pop() || "bin";
      const baseName = file.name
        .replace(/\.[^.]+$/, "")
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .substring(0, 50);
      const timestamp = Date.now() + Math.floor(Math.random() * 1000);
      const path = `${baseName}_${timestamp}.${ext}`;

      const { data, error } = await supabase.storage
        .from("private")
        .createSignedUploadUrl(path);

      if (error) {
        urls.push({ name: file.name, path, error: error.message });
      } else {
        urls.push({ name: file.name, path, uploadUrl: data.signedUrl });
      }
    }

    return new Response(JSON.stringify({ urls }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
