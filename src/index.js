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
      // PROVIDER 1: LOFFY / TIKLY BACKUP FAST API
      const res1 = await fetch(`https://api.v1.lol/tiktok?url=${encodeURIComponent(targetUrl)}`, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
      });

      const contentType1 = res1.headers.get("content-type") || "";
      
      // amanin biar ga crash parsing HTML error page
      if (res1.ok && contentType1.includes("application/json")) {
        const data1 = await res1.json();
        if (data1 && (data1.play || data1.video)) {
          return new Response(JSON.stringify({
            code: 0,
            msg: "success",
            data: {
              title: data1.title || "video tiktok",
              cover: data1.cover || "",
              play: data1.play || data1.video,
              music: data1.music || data1.play || data1.video,
              author: { unique_id: data1.author?.unique_id || "user" },
              duration: 0
            }
          }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }
      }

      // PROVIDER 2 (FALLBACK): SCRAPE DIRECT TIKWM VIA DYNAMIC HEADERS
      const formData = new URLSearchParams();
      formData.append("url", targetUrl);
      formData.append("hd", "1");

      const res2 = await fetch("https://www.tikwm.com/api/", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
          "Referer": "https://www.tikwm.com/"
        },
        body: formData.toString()
      });

      const contentType2 = res2.headers.get("content-type") || "";
      if (res2.ok && contentType2.includes("application/json")) {
        const data2 = await res2.json();
        if (data2 && data2.code === 0) {
          return new Response(JSON.stringify(data2), {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }
      }

      // KALAU SEMUA SERVER API LUAR MATI
      return new Response(JSON.stringify({ code: -1, msg: "semua api server lagi tepar bre, coba beberapa saat lagi 😭" }), {
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
