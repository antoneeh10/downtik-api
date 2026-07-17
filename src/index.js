export default {
  async fetch(request, env, ctx) {
    // 1. handle cors biar frontend lu ga rewel pas fetch data
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
      "Access-Control-Max-Age": "86400",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "GET" && request.method !== "POST") {
      return new Response(JSON.stringify({ code: -1, msg: "pake GET atau POST aja coy!" }), {
        status: 405,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // 2. ambil parameter query 'url' dan 'hd'
    const { searchParams } = new URL(request.url);
    let targetUrl = searchParams.get("url");
    const hdParam = searchParams.get("hd") || "1"; 

    if (!targetUrl) {
      return new Response(JSON.stringify({ 
        code: -1, 
        msg: "parameter 'url' kosong bre, masukin dulu link tiktoknya!" 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // 3. bersihin url dari encoding berlapis
    try {
      while (targetUrl.includes('%')) {
        targetUrl = decodeURIComponent(targetUrl);
      }
    } catch (e) {}
    targetUrl = targetUrl.trim();

    // 4. langsung tembak ke api tikwm pusat pake backend worker
    const tikwmApiUrl = "https://www.tikwm.com/api/";

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // timeout 8 detik

      // tikwm biasanya lebih stabil ditembak pake POST form-url-encoded
      const response = await fetch(tikwmApiUrl, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        body: new URLSearchParams({
          "url": targetUrl,
          "hd": hdParam
        })
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`server tikwm nolak, status: ${response.status}`);
      }

      const resJson = await response.json();

      // kalau api tikwm berhasil dapet datanya (code === 0)
      if (resJson.code === 0) {
        resJson.worker_meta = {
          status: "success",
          engine: "downtik core worker v3.0 tanpa cuddly 🗿"
        };

        return new Response(JSON.stringify(resJson, null, 2), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
            "Cache-Control": "no-store"
          }
        });
      } else {
        // ini kalau api tikwm ngerespon tapi link tiktok lu bermasalah/gagal di-parse ama mereka
        return new Response(JSON.stringify(resJson, null, 2), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

    } catch (err) {
      // handler kalau request ke tikwm timeout atau tumbang
      return new Response(JSON.stringify({
        code: -1,
        msg: "gagal nembak ke server pusat tikwm, coba lagi nanti bre 😭",
        error_log: err.message
      }), {
        status: 502,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
  }
};
