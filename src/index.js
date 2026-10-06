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
      // PAKE API ALTERNATIF (DELTAV / TIKWM BACKUP) YANG GA KENA LIMIT SHARED IP
      const apiUrl = `https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(targetUrl)}`;
      
      const response = await fetch(apiUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
      });

      const data = await response.json();

      // MAPPING RESPON BIKIN FORMAT TIKWM BIAR SKRIP BJS LU GAUSAH DIUBAH-UBAH!
      if (data && data.video) {
        const formattedResponse = {
          code: 0,
          msg: "success",
          data: {
            title: data.title || "video tiktok",
            cover: data.cover || data.video.cover,
            play: data.video.noWatermark || data.video.watermark,
            music: data.music?.play_url || data.video.noWatermark,
            author: {
              unique_id: data.author?.unique_id || data.author?.name || "user"
            },
            duration: 0
          }
        };

        return new Response(JSON.stringify(formattedResponse), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } else {
        return new Response(JSON.stringify({ code: -1, msg: "gagal ngambil data dari server cadangan" }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

    } catch (err) {
      return new Response(JSON.stringify({ code: -1, msg: "error relay", error: err.message }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
  }
};
      
