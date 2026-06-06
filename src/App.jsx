import { useState, useRef, useEffect } from "react";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://tqskxwsxufzppmkdfjwo.supabase.co";
const SUPABASE_KEY = "sb_publishable_3f5yERfWcqmwPadO7_T0tQ_RMk91xjP";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const FIELDS = [
  { key: "name", label: "Product Name", type: "text", placeholder: "e.g. Wireless Headphones Pro" },
  { key: "sku", label: "SKU", type: "text", placeholder: "e.g. WHP-001-BLK" },
  { key: "category", label: "Category", type: "text", placeholder: "e.g. Electronics" },
  { key: "price", label: "Price ($)", type: "number", placeholder: "0.00" },
  { key: "quantity", label: "Quantity", type: "number", placeholder: "0" },
  { key: "supplier", label: "Supplier", type: "text", placeholder: "e.g. TechSupply Co." },
  { key: "description", label: "Description", type: "textarea", placeholder: "Brief product description..." },
];

const EMPTY_FORM = Object.fromEntries(FIELDS.map((f) => [f.key, ""]));

function StatusBadge({ status }) {
  const map = {
    valid: { color: "#16a34a", bg: "#f0fdf4", label: "Valid" },
    warning: { color: "#d97706", bg: "#fffbeb", label: "Warning" },
    error: { color: "#dc2626", bg: "#fef2f2", label: "Issues Found" },
  };
  const s = map[status] || map.valid;
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, letterSpacing: "0.05em",
      color: s.color, background: s.bg,
      padding: "2px 8px", borderRadius: 20, textTransform: "uppercase"
    }}>{s.label}</span>
  );
}

function AIFeedbackPanel({ feedback, loading }) {
  if (!feedback && !loading) return null;
  return (
    <div style={{
      border: "1px solid #e5e7eb", borderRadius: 10, padding: "16px 20px",
      background: "#fafafa", marginTop: 12, fontSize: 14, lineHeight: 1.7,
      color: "#374151", minHeight: 60, position: "relative"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#9ca3af", textTransform: "uppercase" }}>AI Review</span>
        {feedback?.status && <StatusBadge status={feedback.status} />}
      </div>
      {loading ? (
        <div style={{ display: "flex", gap: 4, alignItems: "center", color: "#9ca3af" }}>
          {[0,1,2].map(i => (
            <span key={i} style={{
              width: 6, height: 6, borderRadius: "50%", background: "#d1d5db",
              animation: "pulse 1.2s ease-in-out infinite",
              animationDelay: `${i * 0.2}s`, display: "inline-block"
            }} />
          ))}
          <span style={{ marginLeft: 6, fontSize: 13 }}>Analyzing entry…</span>
        </div>
      ) : (
        <p style={{ margin: 0 }}>{feedback?.message}</p>
      )}
      {feedback?.suggestions?.length > 0 && (
        <ul style={{ margin: "10px 0 0", paddingLeft: 18, color: "#6b7280", fontSize: 13 }}>
          {feedback.suggestions.map((s, i) => <li key={i}>{s}</li>)}
        </ul>
      )}
    </div>
  );
}

function ProductRow({ product, index, onDelete }) {
  return (
    <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
      <td style={{ padding: "10px 12px", color: "#9ca3af", fontSize: 12, fontVariantNumeric: "tabular-nums" }}>{String(index + 1).padStart(3, "0")}</td>
      <td style={{ padding: "10px 12px", fontWeight: 500, color: "#111827" }}>{product.name}</td>
      <td style={{ padding: "10px 12px", color: "#6b7280", fontFamily: "monospace", fontSize: 13 }}>{product.sku}</td>
      <td style={{ padding: "10px 12px", color: "#6b7280" }}>{product.category}</td>
      <td style={{ padding: "10px 12px", color: "#111827", fontVariantNumeric: "tabular-nums" }}>${Number(product.price).toFixed(2)}</td>
      <td style={{ padding: "10px 12px", color: "#111827", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{product.quantity}</td>
      <td style={{ padding: "10px 12px", textAlign: "center" }}>
        <button onClick={() => onDelete(product.id)} style={{
          background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 16, padding: "0 4px"
        }} title="Delete">✕</button>
      </td>
    </tr>
  );
}

export default function InventoryDashboard() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [products, setProducts] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);
  const [dbLoading, setDbLoading] = useState(true);
  const debounceRef = useRef(null);

  // Load products from Supabase on start
  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setDbLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setProducts(data || []);
    else showToast("Could not load products from database.", "error");
    setDbLoading(false);
  };

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const callAI = async (currentForm) => {
    const filled = Object.entries(currentForm).filter(([, v]) => v.toString().trim()).map(([k, v]) => `${k}: ${v}`).join("\n");
    if (!filled) { setFeedback(null); return; }
    setAiLoading(true);
    setFeedback(null);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 300,
          messages: [{
            role: "user",
            content: `You are an inventory data validator. Analyze this product entry and respond ONLY with a JSON object (no markdown, no backticks):

${filled}

Return: {"status": "valid"|"warning"|"error", "message": "one sentence summary", "suggestions": ["tip1", "tip2"]}

Rules:
- "valid" if data looks complete and reasonable
- "warning" if minor issues (e.g. missing optional fields, unusual price)
- "error" if critical issues (e.g. missing name, invalid SKU format, negative price/quantity)
- suggestions array: 0-3 short actionable tips. Empty array if all good. Be concise.`
          }]
        })
      });
      const data = await res.json();
      const text = data.content?.find(b => b.type === "text")?.text || "{}";
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      setFeedback(parsed);
    } catch {
      setFeedback({ status: "warning", message: "AI validator unavailable. You can still save the entry.", suggestions: [] });
    }
    setAiLoading(false);
  };

  const handleChange = (key, val) => {
    const updated = { ...form, [key]: val };
    setForm(updated);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => callAI(updated), 900);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) { showToast("Product name is required.", "error"); return; }
    setSubmitting(true);
    const { data, error } = await supabase.from("products").insert([{
      name: form.name,
      sku: form.sku,
      category: form.category,
      price: Number(form.price) || 0,
      quantity: Number(form.quantity) || 0,
      supplier: form.supplier,
      description: form.description,
    }]).select();
    if (error) {
      showToast("Failed to save product. Check your database connection.", "error");
    } else {
      setProducts(prev => [data[0], ...prev]);
      setForm(EMPTY_FORM);
      setFeedback(null);
      showToast("Product saved to database! ✓");
    }
    setSubmitting(false);
  };

  const handleDelete = async (id) => {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (!error) {
      setProducts(prev => prev.filter(p => p.id !== id));
      showToast("Product deleted.");
    } else {
      showToast("Could not delete product.", "error");
    }
  };

  const totalValue = products.reduce((s, p) => s + (Number(p.price) * Number(p.quantity)), 0);

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        input, textarea { outline: none; }
        input:focus, textarea:focus { border-color: #111827 !important; }
        button:hover { opacity: 0.85; }
        @keyframes pulse { 0%,100% { opacity: 0.3 } 50% { opacity: 1 } }
        @keyframes slideIn { from { opacity:0; transform:translateY(-8px) } to { opacity:1; transform:translateY(0) } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }
        tr:hover td { background: #f9fafb; }
      `}</style>

      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 1000,
          background: toast.type === "error" ? "#fef2f2" : "#f0fdf4",
          color: toast.type === "error" ? "#dc2626" : "#16a34a",
          border: `1px solid ${toast.type === "error" ? "#fecaca" : "#bbf7d0"}`,
          padding: "10px 18px", borderRadius: 8, fontSize: 14, fontWeight: 500,
          animation: "slideIn 0.2s ease"
        }}>{toast.msg}</div>
      )}

      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "0 32px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, background: "#111827", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
            </div>
            <span style={{ fontWeight: 600, fontSize: 15, color: "#111827", letterSpacing: "-0.01em" }}>Inventory Manager</span>
            <span style={{ fontSize: 11, background: "#f0fdf4", color: "#16a34a", border: "1px solid #bbf7d0", padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>● Supabase Connected</span>
          </div>
          <div style={{ display: "flex", gap: 24 }}>
            {[
              { label: "Total SKUs", value: products.length },
              { label: "Total Units", value: products.reduce((s, p) => s + Number(p.quantity), 0).toLocaleString() },
              { label: "Portfolio Value", value: `$${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` }
            ].map(stat => (
              <div key={stat.label} style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, color: "#9ca3af", letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 500 }}>{stat.label}</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#111827", fontFamily: "'DM Mono', monospace" }}>{stat.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 32px", display: "grid", gridTemplateColumns: "380px 1fr", gap: 28, alignItems: "start" }}>

        {/* Form Panel */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "28px 24px", animation: "fadeUp 0.3s ease" }}>
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#111827", letterSpacing: "-0.01em" }}>Add Product</h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#9ca3af" }}>Saved permanently to your database</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {FIELDS.map(field => (
              <div key={field.key}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#374151", marginBottom: 6, letterSpacing: "0.02em" }}>
                  {field.label}
                  {["name", "price", "quantity"].includes(field.key) && (
                    <span style={{ color: "#dc2626", marginLeft: 3 }}>*</span>
                  )}
                </label>
                {field.type === "textarea" ? (
                  <textarea
                    value={form[field.key]}
                    onChange={e => handleChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    rows={3}
                    style={{
                      width: "100%", padding: "8px 12px", border: "1px solid #e5e7eb",
                      borderRadius: 7, fontSize: 14, color: "#111827", background: "#fff",
                      fontFamily: "'DM Sans', sans-serif", resize: "vertical", transition: "border-color 0.15s"
                    }}
                  />
                ) : (
                  <input
                    type={field.type}
                    value={form[field.key]}
                    onChange={e => handleChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    step={field.type === "number" ? "any" : undefined}
                    style={{
                      width: "100%", padding: "8px 12px", border: "1px solid #e5e7eb",
                      borderRadius: 7, fontSize: 14, color: "#111827", background: "#fff",
                      fontFamily: field.key === "sku" ? "'DM Mono', monospace" : "'DM Sans', sans-serif",
                      transition: "border-color 0.15s"
                    }}
                  />
                )}
              </div>
            ))}
          </div>

          <AIFeedbackPanel feedback={feedback} loading={aiLoading} />

          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              width: "100%", marginTop: 20, padding: "11px 0",
              background: submitting ? "#6b7280" : "#111827",
              color: "#fff", border: "none", borderRadius: 8,
              fontSize: 14, fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer",
              fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.01em", transition: "background 0.15s"
            }}
          >
            {submitting ? "Saving to database…" : "Add to Inventory"}
          </button>
        </div>

        {/* Table Panel */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", animation: "fadeUp 0.35s ease" }}>
          <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#111827", letterSpacing: "-0.01em" }}>Products</h2>
            <span style={{ fontSize: 12, color: "#9ca3af", fontFamily: "'DM Mono', monospace" }}>{products.length} items</span>
          </div>

          {dbLoading ? (
            <div style={{ padding: "64px 24px", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
              Loading from database…
            </div>
          ) : products.length === 0 ? (
            <div style={{ padding: "64px 24px", textAlign: "center" }}>
              <div style={{ width: 40, height: 40, background: "#f3f4f6", borderRadius: 10, margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5"><path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/><path d="M16 3H8L6 7h12l-2-4z"/></svg>
              </div>
              <p style={{ margin: 0, color: "#9ca3af", fontSize: 14 }}>No products yet. Add your first item.</p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ background: "#fafafa", borderBottom: "1px solid #f3f4f6" }}>
                    {["#", "Name", "SKU", "Category", "Price", "Qty", ""].map((h, i) => (
                      <th key={i} style={{
                        padding: "10px 12px", textAlign: h === "Qty" ? "right" : "left",
                        fontSize: 11, fontWeight: 600, letterSpacing: "0.05em",
                        color: "#9ca3af", textTransform: "uppercase"
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {products.map((p, i) => <ProductRow key={p.id} product={p} index={i} onDelete={handleDelete} />)}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
