export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get("url");

    if (!targetUrl) {
      return new Response(JSON.stringify({ code: -1, msg: "p, isi param ?url= tiktoknya dulu bre 😭" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    try {
      // SCRAPER TIKMATE (KHUSUS TIKTOK GLOBAL / INDO 100% ANTI DOUYIN)
      const formParams = new URLSearchParams();
      formParams.append("url", targetUrl);

      const res = await fetch("https://api.tikmate.app/api/lookup", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        },
        body: formParams.toString()
      });

      const data = await res.json();

      if (data && data.success && data.token) {
        // AMBIL URL VIDEO NO WATERMARK DARI TIKMATE
        const videoNoWm = `https://tikmate.app/download/${data.token}/${data.id}.mp4`;
        const hdVideo = `https://tikmate.app/download/${data.token}/${data.id}.mp4?hd=1`;

        return new Response(JSON.stringify({
          code: 0,
          msg: "success",
          data: {
            title: data.text || "video tiktok",
            cover: data.author_avatar || "",
            play: videoNoWm,
            hdplay: hdVideo,
            music: videoNoWm,
            author: { unique_id: data.author_id || data.author_name || "user" },
            duration: 0
          }
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      return new Response(JSON.stringify({ code: -1, msg: "gagal ngambil data tiktok, pastikan link valid bre 😭" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });

    } catch (err) {
      return new Response(JSON.stringify({ code: -1, msg: "worker parser error", error: err.message }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
  }
};
