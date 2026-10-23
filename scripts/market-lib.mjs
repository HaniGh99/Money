// أدوات تحديث بيانات السوق (تُستخدم في GitHub Actions)
export function parseJSON(t) {
  const s = t.indexOf("{"), e = t.lastIndexOf("}");
  if (s < 0 || e <= s) throw new Error("لا يوجد JSON في رد الذكاء الاصطناعي");
  return JSON.parse(t.slice(s, e + 1));
}

// ---------- التحقق من بيانات السوق (حماية من الهلوسة) ----------
const num = (v) => typeof v === "number" && isFinite(v) && v > 0;
export function validateMarket(n, prev) {
  const notes = [];
  const acc = {};
  const pair = (x, min, max, name, pv, key) => {
    if (x === undefined || x === null) return pv || null; // غير مُرسَل: يبقى السابق دون ملاحظة ولا يُجدَّد وقته
    if (x && num(x.b) && num(x.s) && x.b <= x.s && x.s / x.b < 1.1 && x.b >= min && x.b <= max) {
      if (pv && pv.b && Math.abs(x.b / pv.b - 1) > 0.12) { notes.push(name + ": تغيّر مشبوه (>12%) فأُبقي السعر السابق"); return pv; }
      acc[key] = true; return { b: x.b, s: x.s };
    }
    notes.push(name + ": قيمة غير صالحة فأُبقي السعر السابق"); return pv || null;
  };
  const out = {};
  out.usd = pair(n.usd, 50, 400, "الدولار", prev && prev.usd, "usd");
  out.g21 = pair(n.g21, 5000, 60000, "الذهب 21", prev && prev.g21, "g21");
  out.ounce = num(n.ounce) && n.ounce > 500 && n.ounce < 20000 ? n.ounce : (prev && prev.ounce) || null;
  out.off = n.official && num(n.official.b) && num(n.official.s) && n.official.b <= n.official.s && n.official.b >= 50 && n.official.b <= 400 ? { b: n.official.b, s: n.official.s } : null;
  const L = ["warn", "tip", "info"];
  out.advice = (Array.isArray(n.advice) ? n.advice : []).slice(0, 12).map((a) => ({
    c: String(a.c || "").slice(0, 24), l: L.includes(a.l) ? a.l : "info", t: String(a.t || "").slice(0, 420), s: String(a.s || "").slice(0, 60),
    x: /^\d{4}-\d{2}-\d{2}/.test(a.x || "") ? String(a.x).slice(0, 10) + "T00:00:00+03:00" : undefined,
  })).filter((a) => a.t.length > 10);
  out.summary = String(n.summary || "").slice(0, 500);
  out.sources = (Array.isArray(n.sources) ? n.sources : []).slice(0, 12).map((s) => String(s).slice(0, 50));
  out.notes = notes; out.updated = !!(acc.usd || acc.g21);
  return out;
}

export const MARKET_PROMPT = () => `أنت محلل أسواق لتطبيق إدارة مالية شخصية لمقيم في سوريا. التاريخ اليوم ${new Date().toISOString().slice(0, 10)}.
المهمة: ابحث على الويب واقرأ أولًا موقع sp-today.com (الليرة اليوم: صفحات العملات والذهب والأخبار)، ثم تحقّق من أحدث الأخبار الاقتصادية والسياسية المؤثرة على الليرة السورية من مصادر موثوقة (سانا، عنب بلدي، رويترز، الجزيرة، المصرف المركزي السوري، وزارة الخارجية والخزانة الأمريكية، صندوق النقد والبنك الدولي).
الأسعار بالليرة السورية الجديدة (بعد حذف صفرين): الدولار مقابل الليرة (شراء/مبيع في السوق الموازي كما في الليرة اليوم)، وغرام الذهب عيار 21 (شراء/مبيع)، وأونصة الذهب عالميًا بالدولار، وسعر المصرف المركزي الرسمي للدولار إن وُجد.
قواعد صارمة: لا تخمّن أي رقم، وإن لم تجده فضع null. لا تقتبس نصوصًا طويلة بل أعد الصياغة بكلماتك. لا تقدّم نصيحة استثمارية شخصية ولا تعد بأرباح.
أعد JSON واحدًا فقط دون أي نص آخر بهذا الشكل:
{"usd":{"b":0,"s":0},"g21":{"b":0,"s":0},"ounce":0,"official":{"b":0,"s":0},"summary":"خلاصة من 2 إلى 3 جمل","advice":[{"c":"فئة قصيرة","l":"warn أو tip أو info","t":"تحذير أو معلومة أو نصيحة عامة بحد أقصى 300 حرف","s":"اسم المصدر","x":"YYYY-MM-DD تاريخ انتهاء صلاحية البند"}],"sources":["أسماء المصادر"]}
ضمّن من 6 إلى 10 بنود تغطي: التنظيم والتراخيص (الصرافة)، الأخبار السياسية والأمنية المؤثرة، العقوبات، الموازنة والسياسة النقدية، الوقود والمعيشة، الذهب عالميًا، وخطوة عملية عامة للمتحوّط. اجعل x بعد 3 إلى 14 يومًا من اليوم بحسب سرعة تقادم الخبر.`;

