// import { useState } from 'react'
// import reactLogo from './assets/react.svg'
// import viteLogo from '/vite.svg'
// import './App.css'

// function App() {
//   return (
//     <div className="min-h-screen flex items-center justify-center bg-gray-50">
//       <h1 className="text-4xl font-bold text-blue-600 underline">
//         Hi!
//       </h1>
//     </div>
//   );
// }

// export default App;
import React, { useEffect, useMemo, useRef, useState } from "react";

// Single-file, localStorage-backed Flashcards app with SM-2 scheduling
// Tailwind ready (UI uses utility classes). No external deps.
// Keyboard shortcuts in review: 1=Again, 2=Hard, 3=Good, 4=Easy, Space=Flip

function nowISO() {
  return new Date().toISOString();
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

// SM-2 scheduler
function schedule(card, grade) {
  // grade: 0..5 (we'll map 1..4 -> 1..4, convert below)
  const q = clamp(grade, 0, 5);
  let { ef, reps, interval } = card;

  // Update ease factor
  ef = ef + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  ef = Math.max(1.3, ef);

  if (q < 3) {
    reps = 0;
    interval = 1; // next day retry
  } else {
    reps = reps + 1;
    if (reps === 1) interval = 1;
    else if (reps === 2) interval = 6;
    else interval = Math.round(interval * ef);
  }

  const due = addDays(new Date(), interval);
  return { ...card, ef, reps, interval, due };
}

const DEFAULT_DECK = [
  { id: "c1", front: "SQL: Find rows where column IS NULL", back: "SELECT * FROM t WHERE col IS NULL;", tag: "SQL", ef: 2.5, reps: 0, interval: 0, due: nowISO() },
  { id: "c2", front: "Logistic regression: sigmoid formula", back: "σ(z) = 1 / (1 + e^{−z})", tag: "ML", ef: 2.5, reps: 0, interval: 0, due: nowISO() },
  { id: "c3", front: "Bias–variance trade-off", back: "Increasing model complexity ↓ bias, ↑ variance; seek minimal expected generalization error.", tag: "ML", ef: 2.5, reps: 0, interval: 0, due: nowISO() },
];

const STORAGE_KEY = "srsDeckV1";

function useLocalStorageDeck() {
  const [deck, setDeck] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return DEFAULT_DECK;
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(deck)); } catch {}
  }, [deck]);

  return [deck, setDeck];
}

function Stat({ label, value }) {
  return (
    <div className="px-3 py-2 rounded-2xl bg-gray-100 shadow-sm text-sm">
      <div className="text-gray-500">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

function CardEditor({ deck, setDeck }) {
  const [draft, setDraft] = useState({ front: "", back: "", tag: "" });

  function addCard() {
    if (!draft.front.trim() || !draft.back.trim()) return;
    const id = "c" + Math.random().toString(36).slice(2);
    const base = { ef: 2.5, reps: 0, interval: 0, due: nowISO() };
    setDeck([{ id, ...draft, ...base }, ...deck]);
    setDraft({ front: "", back: "", tag: "" });
  }

  function remove(id) {
    setDeck(deck.filter(c => c.id !== id));
  }

  function update(id, field, val) {
    setDeck(deck.map(c => (c.id === id ? { ...c, [field]: val } : c)));
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(deck, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "deck.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  const importRef = useRef();
  function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (Array.isArray(data)) setDeck(data);
        else alert("Invalid JSON: expected an array of cards");
      } catch (err) {
        alert("Failed to parse JSON");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input className="border rounded-2xl p-3" placeholder="Front (question/prompt)" value={draft.front} onChange={e => setDraft({ ...draft, front: e.target.value })} />
        <input className="border rounded-2xl p-3" placeholder="Back (answer)" value={draft.back} onChange={e => setDraft({ ...draft, back: e.target.value })} />
        <input className="border rounded-2xl p-3" placeholder="Tag (optional)" value={draft.tag} onChange={e => setDraft({ ...draft, tag: e.target.value })} />
      </div>
      <div className="flex gap-2">
        <button onClick={addCard} className="px-4 py-2 rounded-2xl bg-black text-white shadow">Add</button>
        <button onClick={exportJSON} className="px-4 py-2 rounded-2xl bg-gray-800 text-white shadow">Export JSON</button>
        <label className="px-4 py-2 rounded-2xl bg-gray-200 shadow cursor-pointer">
          Import JSON
          <input type="file" accept="application/json" className="hidden" ref={importRef} onChange={handleImport} />
        </label>
      </div>

      <div className="border rounded-2xl divide-y">
        {deck.map(c => (
          <div key={c.id} className="p-3 flex flex-col md:flex-row gap-2 items-start md:items-center">
            <input className="border rounded-xl p-2 flex-1" value={c.front} onChange={e => update(c.id, "front", e.target.value)} />
            <input className="border rounded-xl p-2 flex-1" value={c.back} onChange={e => update(c.id, "back", e.target.value)} />
            <input className="border rounded-xl p-2 w-40" value={c.tag || ""} onChange={e => update(c.id, "tag", e.target.value)} />
            <div className="text-xs text-gray-500">due {new Date(c.due).toLocaleDateString()}</div>
            <button onClick={() => remove(c.id)} className="px-3 py-1 rounded-xl bg-red-100 text-red-700">Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Review({ deck, setDeck }) {
  const [showBack, setShowBack] = useState(false);

  const dueCards = useMemo(() => deck
    .filter(c => new Date(c.due) <= new Date())
    .sort((a, b) => new Date(a.due) - new Date(b.due)), [deck]);

  const current = dueCards[0];

  useEffect(() => { setShowBack(false); }, [current?.id]);

  function grade(g) {
    if (!current) return;
    const mapped = { 1: 1, 2: 3, 3: 4, 4: 5 }[g]; // map to 1..5 scale
    const updated = schedule(current, mapped);
    setDeck(deck.map(c => (c.id === current.id ? updated : c)));
    setShowBack(false);
  }

  useEffect(() => {
    function onKey(e) {
      if (e.code === "Space") { e.preventDefault(); setShowBack(s => !s); }
      if (e.key === "1") grade(1);
      if (e.key === "2") grade(2);
      if (e.key === "3") grade(3);
      if (e.key === "4") grade(4);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deck, current]);

  if (!current) {
    return (
      <div className="text-center p-10 rounded-2xl bg-green-50 border">
        <div className="text-xl font-semibold">No cards due.</div>
        <div className="text-sm text-gray-600">Add more cards or come back later.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Stat label="Due now" value={dueCards.length} />
        <Stat label="Total" value={deck.length} />
        <Stat label="Tag" value={current.tag || "—"} />
      </div>

      <div className="p-8 rounded-3xl bg-white border shadow-lg">
        <div className="text-sm text-gray-500 mb-2">Press Space to flip. 1=Again, 2=Hard, 3=Good, 4=Easy</div>
        <div className="text-2xl font-semibold min-h-[5rem] whitespace-pre-wrap">{showBack ? current.back : current.front}</div>
        <div className="mt-6 flex gap-2">
          {!showBack ? (
            <button onClick={() => setShowBack(true)} className="px-4 py-2 rounded-2xl bg-black text-white">Show Answer</button>
          ) : (
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => grade(1)} className="px-3 py-2 rounded-2xl bg-red-100 text-red-700">Again (1)</button>
              <button onClick={() => grade(2)} className="px-3 py-2 rounded-2xl bg-yellow-100 text-yellow-800">Hard (2)</button>
              <button onClick={() => grade(3)} className="px-3 py-2 rounded-2xl bg-blue-100 text-blue-800">Good (3)</button>
              <button onClick={() => grade(4)} className="px-3 py-2 rounded-2xl bg-green-100 text-green-800">Easy (4)</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FlashcardsApp() {
  const [deck, setDeck] = useLocalStorageDeck();
  const [tab, setTab] = useState("review");
  const dueCount = useMemo(() => deck.filter(c => new Date(c.due) <= new Date()).length, [deck]);

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl md:text-3xl font-bold">Flashcards SRS · SM-2</h1>
          <nav className="flex gap-2">
            <button onClick={() => setTab("review")} className={`px-4 py-2 rounded-2xl border ${tab === "review" ? "bg-black text-white" : "bg-white"}`}>Review ({dueCount})</button>
            <button onClick={() => setTab("edit")} className={`px-4 py-2 rounded-2xl border ${tab === "edit" ? "bg-black text-white" : "bg-white"}`}>Edit Deck</button>
          </nav>
        </header>

        {tab === "review" ? (
          <Review deck={deck} setDeck={setDeck} />
        ) : (
          <CardEditor deck={deck} setDeck={setDeck} />
        )}

        <footer className="pt-6 text-xs text-gray-500">
          Local-only. Data lives in your browser (localStorage). Export JSON to back up.
        </footer>
      </div>
    </div>
  );
}
