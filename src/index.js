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
      // PAKE GET DIRECT KE TIKWM BIAR NGGAK KENA REDIRECT 302 / BLOCK!
      const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(targetUrl)}&hd=1`;
      
      const response = await fetch(apiUrl, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36",
          "Accept": "application/json, text/plain, */*"
        }
      });

      const resText = await response.text();
      
      return new Response(resText, {
        status: 200, // SELALU BALIKIN STATUS 200 BIAR BJS GAK STUCK / MOGOK!
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });

    } catch (err) {
      return new Response(JSON.stringify({ code: -1, msg: "relay worker error", error: err.message }), {
        status: 200, // PASTIIN BALIK 200 BIAR BJS MANGGIL CALLBACK SUCCESS NANTI DIBACA BJS ERRORNYA
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
  }
};
