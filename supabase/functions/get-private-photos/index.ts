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
    const { password } = await req.json();

    if (password !== PASSWORD) {
      return new Response(JSON.stringify({ error: "Wrong password" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Recursively list all files in the bucket
    async function listAll(path: string): Promise<{ name: string; path: string; type: string }[]> {
      const { data, error } = await supabase.storage
        .from("private")
        .list(path, { limit: 1000 });

      if (error) throw error;

      const results: { name: string; path: string; type: string }[] = [];
      for (const item of data || []) {
        const fullPath = path ? `${path}/${item.name}` : item.name;
        if (!item.id) {
          // It's a folder
          const nested = await listAll(fullPath);
          results.push(...nested);
        } else if (/\.(jpg|jpeg|png|gif|webp)$/i.test(item.name)) {
          results.push({ name: item.name, path: fullPath, type: "image" });
        } else if (/\.(mp4|mov|webm|avi|mkv)$/i.test(item.name)) {
          results.push({ name: item.name, path: fullPath, type: "video" });
        }
      }
      return results;
    }

    const allFiles = await listAll("");

    const signedUrls = await Promise.all(
      allFiles.map(async (file) => {
        const { data } = await supabase.storage
          .from("private")
          .createSignedUrl(file.path, 3600);
        return { name: file.name, path: file.path, url: data?.signedUrl, type: file.type };
      })
    );

    return new Response(JSON.stringify({ photos: signedUrls }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
