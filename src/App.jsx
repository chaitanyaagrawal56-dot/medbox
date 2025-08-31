import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Pill, Search, AlertTriangle, CalendarClock, Package,
  Trash2, Edit2, Sparkles, Star, FolderPlus, Settings, LogIn
} from "lucide-react";

/** ──────────────────────────────────────────────────────────────
 *  Google Drive (shared JSON file) — UPDATE THESE
 *  ──────────────────────────────────────────────────────────── */
const GOOGLE = {
  CLIENT_ID: "258361846848-0a6vcgnq0dc622879248uul13a42cabk.apps.googleusercontent.com", // from OAuth 2.0 Client ID
  API_KEY: "AIzaSyC_kLCW_zdAvde7h7OOrWdSYtSJoW0vp-w",                                // from API Keys
  SCOPES: "https://www.googleapis.com/auth/drive.file",
  DISCOVERY_DOCS: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
};

// The ONE shared Drive file ID for everyone (Editor access needed)
const FILE_ID = "1AvZ7xFESc1nDJFz8tJPrSjJyxNP2ZYTc"; // e.g. "1a2B3cDeFGHIjkLMnoPQ"

/** Local storage key (fast local boot; Drive is source of truth) */
const LS_KEY = "medbox-data-v3";

export default function App() {
  const [signedIn, setSignedIn] = useState(false);
  const [status, setStatus] = useState("");
  const [meds, setMeds] = useState(() => JSON.parse(localStorage.getItem(LS_KEY) || "[]"));
  const [categories, setCategories] = useState(() => [
    { id: "allergy", name: "Allergy", color: "#06b6d4" },
    { id: "pain", name: "Pain Relief", color: "#f97316" },
    { id: "cold", name: "Cold & Flu", color: "#22c55e" },
    { id: "firstaid", name: "First Aid", color: "#ef4444" },
  ]);

  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState(null);          // MedDialog data (null = closed)
  const [catDialog, setCatDialog] = useState(false);
  const [manageCats, setManageCats] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState("#0ea5e9");

  /** Persist locally for fast boot */
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(meds));
  }, [meds]);

  /** Load Google libraries (gapi client + GIS) */
  useEffect(() => {
    if (!GOOGLE.CLIENT_ID.includes("__PUT_")) {
      const s1 = document.createElement("script");
      s1.src = "https://apis.google.com/js/api.js"; s1.async = true;
      const s2 = document.createElement("script");
      s2.src = "https://accounts.google.com/gsi/client"; s2.async = true;
      document.head.appendChild(s1); document.head.appendChild(s2);
      s1.onload = () => {
        // @ts-ignore
        window.gapi.load("client", async () => {
          // @ts-ignore
          await window.gapi.client.init({ apiKey: GOOGLE.API_KEY, discoveryDocs: GOOGLE.DISCOVERY_DOCS });
        });
      };
      return () => { try { document.head.removeChild(s1); document.head.removeChild(s2); } catch {} };
    }
  }, []);

  /** Sign in (GIS) → pull shared JSON once */
  const signIn = async () => {
    if (!FILE_ID || FILE_ID.startsWith("__PUT_")) {
      alert("Please set FILE_ID in App.jsx to your shared Drive file ID.");
      return;
    }
    // @ts-ignore
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE.CLIENT_ID,
      scope: GOOGLE.SCOPES,
      callback: (resp) => {
        if (resp && resp.access_token) {
          setSignedIn(true);
          pullFromDrive().then((d) => {
            if (d) {
              setMeds(Array.isArray(d.meds) ? d.meds : []);
              setCategories(Array.isArray(d.categories) ? d.categories : categories);
            }
          });
        } else {
          setStatus("Sign-in failed");
        }
      },
    });
    tokenClient.requestAccessToken({ prompt: "consent" });
  };

  /** Pull JSON from the single shared Drive file */
  const pullFromDrive = async () => {
    try {
      // @ts-ignore
      const gapi = window.gapi;
      const resp = await gapi.client.drive.files.get({
        fileId: FILE_ID,
        alt: "media",
      });
      return resp.body ? JSON.parse(resp.body) : { meds: [], categories: [] };
    } catch (e) {
      console.error("Pull failed:", e);
      setStatus("Pull failed");
      return { meds: [], categories: [] };
    }
  };

  /** Push JSON back to the same shared file */
  const pushToDrive = async (data) => {
    try {
      // @ts-ignore
      const gapi = window.gapi;
      await gapi.client.request({
        path: `/upload/drive/v3/files/${FILE_ID}`,
        method: "PATCH",
        params: { uploadType: "media" },
        body: JSON.stringify(data),
      });
      setStatus("Synced");
    } catch (e) {
      console.error("Push failed:", e);
      setStatus("Push failed");
    }
  };

  /** On any change, push to Drive (if signed in) */
  useEffect(() => {
    if (!signedIn) return;
    if (!FILE_ID || FILE_ID.startsWith("__PUT_")) return;
    const t = setTimeout(() => {
      pushToDrive({ meds, categories });
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [meds, categories, signedIn]);

  /** Filters */
  const filtered = useMemo(() => {
    let list = meds;
    if (tab === "low") list = list.filter((m) => m.low != null && m.qty <= (m.low || 0));
    else if (tab === "expiring")
      list = list.filter(
        (m) => m.expiry && (new Date(m.expiry).getTime() - Date.now()) / 86400000 <= 30
      );
    else if (tab.startsWith("cat:")) {
      const cid = tab.split(":")[1];
      list = list.filter((m) => m.categoryId === cid);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((m) =>
        [m.name, m.brand, m.notes, m.strength].filter(Boolean).join(" ").toLowerCase().includes(q)
      );
    }
    return list;
  }, [meds, query, tab]);

  /** CRUD helpers */
  const addMed = (m) => setMeds((prev) => [{ ...m, id: Date.now() }, ...prev]);
  const updateMed = (id, patch) =>
    setMeds((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const deleteMed = (id) => setMeds((prev) => prev.filter((x) => x.id !== id));

  /** Categories CRUD */
  const addCategory = () => {
    if (newCatName.trim()) {
      setCategories((prev) => [
        ...prev,
        { id: Date.now().toString(), name: newCatName.trim(), color: newCatColor },
      ]);
      setNewCatName("");
      setCatDialog(false);
    }
  };
  const renameCategory = (id, name, color) =>
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, name, color } : c)));
  const deleteCategory = (id) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
    setMeds((prev) => prev.map((m) => (m.categoryId === id ? { ...m, categoryId: undefined } : m)));
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Pill className="text-sky-400" /> MedBox
          <span className="text-xs font-normal text-slate-400">— Shared Google Drive JSON</span>
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => setCatDialog(true)}
            className="px-3 py-1 border border-slate-600 rounded flex items-center gap-1"
          >
            <FolderPlus size={16} /> New Category
          </button>
          <button
            onClick={() => setManageCats(true)}
            className="px-3 py-1 border border-slate-600 rounded flex items-center gap-1"
          >
            <Settings size={16} /> Manage
          </button>
          {!signedIn ? (
            <button
              onClick={signIn}
              className="bg-emerald-500 text-black px-3 py-1 rounded flex items-center gap-1"
            >
              <LogIn size={16} /> Sign in
            </button>
          ) : (
            <span className="text-xs text-slate-400">{status}</span>
          )}
        </div>
      </div>

      {/* Search + Add */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, brand, strength, notes…"
            className="pl-9 pr-3 py-2 rounded bg-slate-800 border border-slate-700 w-full"
          />
        </div>
        <button
          onClick={() => setForm({})}
          className="bg-sky-500 text-black px-3 py-2 rounded flex items-center gap-1"
        >
          <Plus size={16} /> Add
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setTab("all")}
          className={`px-3 py-1 rounded ${tab === "all" ? "bg-sky-600" : "bg-slate-700"}`}
        >
          All
        </button>
        <button
          onClick={() => setTab("expiring")}
          className={`px-3 py-1 rounded ${
            tab === "expiring" ? "bg-sky-600" : "bg-slate-700"
          }`}
        >
          <AlertTriangle size={14} /> Expiring
        </button>
        <button
          onClick={() => setTab("low")}
          className={`px-3 py-1 rounded ${tab === "low" ? "bg-sky-600" : "bg-slate-700"}`}
        >
          <Package size={14} /> Low
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setTab("cat:" + c.id)}
            className={`px-3 py-1 rounded ${
              tab === "cat:" + c.id ? "bg-sky-600" : "bg-slate-700"
            }`}
            style={{ borderColor: c.color }}
            title={c.name}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Grid of cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        <AnimatePresence>
          {filtered.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-3 rounded-xl border border-slate-700 bg-slate-800"
            >
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold flex items-center gap-1">
                  <Star size={14} className="text-sky-400" /> {m.name}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setForm(m)}
                    className="text-slate-400 hover:text-sky-400"
                    title="Edit"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => deleteMed(m.id)}
                    className="text-red-400 hover:text-red-500"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="text-xs text-slate-400 flex gap-2 flex-wrap">
                {m.brand && <span>{m.brand}</span>}
                {m.strength && <span>{m.strength}</span>}
                {m.expiry && <ExpiryBadge expiry={m.expiry} />}
              </div>

              <div className="flex justify-between items-center mt-2">
                <div className="flex items-center gap-1">
                  <Package size={14} /> {m.qty || 0}
                  {m.low != null && (m.qty || 0) <= m.low && (
                    <span className="text-amber-400 ml-1">(low)</span>
                  )}
                </div>
                <button
                  onClick={() =>
                    updateMed(m.id, { qty: Math.max(0, (m.qty || 0) - 1) })
                  }
                  className="px-2 py-0.5 border border-slate-600 rounded text-xs"
                >
                  -1
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Dialogs */}
      {form && (
        <MedDialog
          form={form}
          setForm={setForm}
          onSave={(m) => (form.id ? updateMed(form.id, m) : addMed(m))}
          categories={categories}
        />
      )}

      {catDialog && (
        <NewCategoryDialog
          onClose={() => setCatDialog(false)}
          onSave={addCategory}
          name={newCatName}
          setName={setNewCatName}
          color={newCatColor}
          setColor={setNewCatColor}
        />
      )}

      {manageCats && (
        <ManageCategoriesDialog
          onClose={() => setManageCats(false)}
          categories={categories}
          onRename={renameCategory}
          onDelete={deleteCategory}
        />
      )}
      {signedIn ? null : (
        <p className="mt-4 text-xs text-slate-400">
          Tip: After you sign in, edits auto-sync to the shared Drive file.
        </p>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
   Helpers & Dialog Components
   ──────────────────────────────────────────────────────────── */

function ExpiryBadge({ expiry }) {
  if (!expiry) return <span className="px-2 py-0.5 border rounded text-xs">No Expiry</span>;
  const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000);
  let cls = "bg-emerald-500/20 text-emerald-300";
  if (days < 0) cls = "bg-red-500/20 text-red-300";
  else if (days <= 30) cls = "bg-amber-500/20 text-amber-300";
  return (
    <span className={`px-2 py-0.5 rounded text-xs ${cls}`}>
      <CalendarClock size={12} /> {days < 0 ? `Expired ${Math.abs(days)}d` : `${days}d left`}
    </span>
  );
}

function MedDialog({ form, setForm, onSave, categories }) {
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  if (!form) return null;

  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50">
      <div className="bg-slate-900 p-4 rounded-xl w-[28rem] border border-slate-700">
        <h2 className="font-semibold mb-2 flex items-center gap-1">
          <Sparkles className="text-sky-400" /> {form.id ? "Edit" : "Add"} Medicine
        </h2>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <LabeledInput
            className="col-span-2"
            label="Name"
            value={form.name || ""}
            onChange={(e) => update("name", e.target.value)}
            placeholder="Dolo 650"
          />
          <LabeledInput label="Brand" value={form.brand || ""} onChange={(e) => update("brand", e.target.value)} />
          <LabeledInput label="Strength" value={form.strength || ""} onChange={(e) => update("strength", e.target.value)} />
          <div>
            <div className="mb-1">Form</div>
            <select
              value={form.form || "tablet"}
              onChange={(e) => update("form", e.target.value)}
              className="w-full h-8 rounded bg-slate-800 border border-slate-700 px-2"
            >
              <option value="tablet">Tablet</option>
              <option value="capsule">Capsule</option>
              <option value="syrup">Syrup</option>
              <option value="ointment">Ointment</option>
              <option value="other">Other</option>
            </select>
          </div>
          <LabeledInput
            type="number"
            label="Quantity"
            value={form.qty ?? 0}
            onChange={(e) => update("qty", Number(e.target.value))}
          />
          <LabeledInput
            type="number"
            label="Low stock alert"
            value={form.low ?? 0}
            onChange={(e) => update("low", Number(e.target.value))}
          />
          <LabeledInput
            type="date"
            label="Expiry"
            value={form.expiry || ""}
            onChange={(e) => update("expiry", e.target.value)}
          />
          <div>
            <div className="mb-1">Category</div>
            <select
              value={form.categoryId || ""}
              onChange={(e) => update("categoryId", e.target.value || undefined)}
              className="w-full h-8 rounded bg-slate-800 border border-slate-700 px-2"
            >
              <option value="">— None —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <div className="mb-1">Notes</div>
            <textarea
              value={form.notes || ""}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Use at night / After food"
              className="w-full rounded bg-slate-800 border border-slate-700 px-2 py-1 h-20"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-3">
          <button onClick={() => setForm(null)} className="px-3 py-1 border border-slate-600 rounded">
            Cancel
          </button>
          <button onClick={() => { onSave(form); setForm(null); }} className="px-3 py-1 bg-sky-500 text-black rounded">
            {form.id ? "Save" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

function NewCategoryDialog({ onClose, onSave, name, setName, color, setColor }) {
  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50">
      <div className="bg-slate-900 p-4 rounded-xl w-80 border border-slate-700">
        <h2 className="font-semibold mb-3 flex items-center gap-1">
          <FolderPlus className="text-sky-400" /> New Category
        </h2>
        <div className="space-y-2">
          <LabeledInput label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="flex items-center justify-between">
            <span className="text-sm">Color</span>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-8 w-16 rounded bg-slate-800 border border-slate-700"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-3">
          <button onClick={onClose} className="px-3 py-1 border border-slate-600 rounded">
            Cancel
          </button>
          <button
            onClick={() => {
              if (name.trim()) onSave();
            }}
            className="px-3 py-1 bg-sky-500 text-black rounded"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

function ManageCategoriesDialog({ onClose, categories, onRename, onDelete }) {
  const [local, setLocal] = useState({});
  const update = (id, field, value) =>
    setLocal((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: value } }));

  return (
    <div className="fixed inset-0 bg-black/50 grid place-items-center z-50">
      <div className="bg-slate-900 p-4 rounded-xl w-[28rem] border border-slate-700 max-h-[80vh] overflow-y-auto">
        <h2 className="font-semibold mb-3 flex items-center gap-1">
          <Settings className="text-sky-400" /> Manage Categories
        </h2>
        <div className="space-y-2">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 border border-slate-700 rounded p-2">
              <input
                value={local[c.id]?.name ?? c.name}
                onChange={(e) => update(c.id, "name", e.target.value)}
                className="flex-1 bg-slate-800 border border-slate-600 rounded px-2 h-8"
              />
              <input
                type="color"
                value={local[c.id]?.color ?? c.color}
                onChange={(e) => update(c.id, "color", e.target.value)}
                className="h-8 w-12 rounded"
              />
              <button
                onClick={() =>
                  onRename(c.id, local[c.id]?.name ?? c.name, local[c.id]?.color ?? c.color)
                }
                className="px-2 py-1 bg-sky-600 text-xs rounded"
              >
                Save
              </button>
              <button onClick={() => onDelete(c.id)} className="px-2 py-1 bg-red-600 text-xs rounded">
                Delete
              </button>
            </div>
          ))}
        </div>
        <div className="flex justify-end mt-3">
          <button onClick={onClose} className="px-3 py-1 bg-sky-500 text-black rounded">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/** Small labeled input used in dialogs */
function LabeledInput({ label, className = "", ...props }) {
  return (
    <div className={`text-sm space-y-1 ${className}`}>
      <div>{label}</div>
      <input
        {...props}
        className="w-full h-8 rounded bg-slate-800 border border-slate-700 px-2"
      />
    </div>
  );
}
