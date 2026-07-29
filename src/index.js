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

    // ambil param dari frontend lu
    const { searchParams } = new URL(request.url);
    const targetUrl = searchParams.get("url"); // ini isi link tiktoknya
    const hdParam = searchParams.get("hd") || "1";

    if (!targetUrl) {
      return new Response(JSON.stringify({ code: -1, msg: "p, isi param ?url= tiktoknya dulu bre 😭" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    try {
      // pasang form data buat dikirim ke tikwm pusat
      const formData = new URLSearchParams();
      formData.append("url", targetUrl);
      formData.append("hd", hdParam);

      // nembak ke tikwm pake redirect manual biar ga mental ke link tiktok bawaan
      const response = await fetch("https://www.tikwm.com/api/", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        },
        body: formData.toString(),
        redirect: "manual" // KUNCINYA DI SINI COK, BIAR GA DI-REDIRECT OLEH WORKER!
      });

      // kalau tikwm malah ngasih status redirect (301/302), kita potong langsung
      if (response.status === 301 || response.status === 302) {
        return new Response(JSON.stringify({ code: -1, msg: "api tikwm nyoba redirect kita, diblokir worker!", url: response.headers.get("location") }), {
          status: 502,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }

      const resText = await response.text();
      
      // aman, balikin data berupa string json mentah ke frontend lu
      return new Response(resText, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });

    } catch (err) {
      return new Response(JSON.stringify({ code: -1, msg: "relay crash cok", error: err.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
  }
};
