export default {
  async fetch(request, env, ctx) {
    // 1. wajib pasang cors header buat frontend lu (biar browser ga ngambek)
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // respon langsung kalo ada preflight request dari browser
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // 2. ambil param url tiktok dari query string
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get("url");
    const hdParam = searchParams.get("hd") || "1";

    if (!targetUrl) {
      return new Response(JSON.stringify({ code: -1, msg: "p, masukin url-nya dulu cok! 😭" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // 3. langsung tembak ke tikwm pusat (server-to-server, bebas cors!)
    try {
      const response = await fetch("https://www.tikwm.com/api/", {
        method: "POST", // pake POST biar lebih kebal anti-block
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        },
        body: new URLSearchParams({
          "url": targetUrl,
          "hd": hdParam
        })
      });

      if (!response.ok) {
        return new Response(JSON.stringify({ code: -1, msg: "server tikwm lagi rontok bre" }), {
          status: response.status,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      // ambil data asli dari tikwm
      const resJson = await response.json();

      // 4. balikin datanya ke frontend lu barengan ama corsHeaders
      return new Response(JSON.stringify(resJson, null, 2), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders // di sini kuncinya biar frontend lu bisa baca datanya tanpa error!
        }
      });

    } catch (err) {
      return new Response(JSON.stringify({ code: -1, msg: "worker crash/timeout cok", error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
  }
};
