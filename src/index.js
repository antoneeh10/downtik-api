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
      // PAKE API ALTERNATIF TIKTOK DOWNLOADER YANG MASIH GACOR
      const apiUrl = `https://api.v2.lol/tiktok?url=${encodeURIComponent(targetUrl)}`;
      
      const response = await fetch(apiUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "application/json"
        }
      });

      const resData = await response.json();

      // IF API V2 LOL BERHASIL
      if (resData && (resData.video || resData.play || resData.data)) {
        const item = resData.data || resData;

        const formattedResponse = {
          code: 0,
          msg: "success",
          data: {
            title: item.title || item.desc || "video tiktok",
            cover: item.cover || item.origin_cover || item.dynamic_cover || "",
            play: item.play || item.video || item.wmplay || "",
            music: item.music || item.music_info?.play || item.play || "",
            author: {
              unique_id: item.author?.unique_id || item.author?.nickname || "user"
            },
            duration: item.duration || 0
          }
        };

        return new Response(JSON.stringify(formattedResponse), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      // FALLBACK 2: KALAU PROVIDER ATAS ERROR, PAKE API BACKUP KEDUA AUTOMATIS 🗿
      const backupUrl = `https://dlPanda.com/api/tiktok?url=${encodeURIComponent(targetUrl)}`;
      const backupRes = await fetch(backupUrl);
      const backupData = await backupRes.json();

      if (backupData && backupData.video) {
        return new Response(JSON.stringify({
          code: 0,
          msg: "success",
          data: {
            title: backupData.title || "video tiktok",
            cover: backupData.cover || "",
            play: backupData.video,
            music: backupData.audio || backupData.video,
            author: { unique_id: backupData.author || "user" },
            duration: 0
          }
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      // KALAU DUA-DUANYA GAGAL
      return new Response(JSON.stringify({ code: -1, msg: "semua server downloader lagi sibuk/down bre 😭" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });

    } catch (err) {
      return new Response(JSON.stringify({ code: -1, msg: "relay worker error", error: err.message }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
  }
};
