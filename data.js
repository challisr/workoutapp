import { getStore } from "@netlify/blobs";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const DEFAULT_DAYS = [
  { id: "mon", name: "Monday", focus: "Strength (Lower Body)", exercises: [
    ex("Bulgarian split squats", "3 x 8 each leg", "Mimics the plant-leg position; control the descent."),
    ex("Hip thrusts", "3 x 10", "Primary glute power builder for hip extension."),
    ex("Romanian deadlifts", "3 x 8", "Coordinate with team's lift; don't double up on heavy loading."),
    ex("Copenhagen plank", "3 x 20-30 sec/side", "Adductor/groin strength — key injury prevention."),
    ex("Pallof press", "3 x 10 each side", "Anti-rotation core; stabilizes trunk during the kick."),
  ]},
  { id: "tue", name: "Tuesday", focus: "Posterior Chain + Core", exercises: [
    ex("Single-leg glute bridge", "3 x 12 each leg", "Isolates glute on plant leg."),
    ex("Banded hip flexor march", "3 x 15 each leg", "Builds leg speed/snap for the swing leg."),
    ex("Side plank with hip dip", "3 x 10 each side", "Lateral core/oblique control — relevant to the lean."),
    ex("Band or cable woodchoppers", "3 x 12 each side", "Hip-to-core power transfer."),
  ]},
  { id: "wed", name: "Wednesday", focus: "Balance + Lean Correction", exercises: [
    ex("Single-leg balance reach", "3 x 8 each direction", "Builds comfort leaning over the plant leg."),
    ex("Single-leg RDL to balance hold", "3 x 8 each leg, hold 3 sec", "Trains hip hinge + balance together."),
    ex("Bosu/pillow single-leg stands", "3 x 30 sec each leg", "Forces stabilizers to fire; supports the lean."),
    ex("Lateral band walks", "3 x 10 steps each direction", "Strengthens glute medius; controls side-to-side lean."),
    ex("90/90 hip mobility flow", "2 x 5 each side", "Hip internal/external rotation mobility."),
    ex("Pogo hops", "3 x 15", "Light, low-impact plyo."),
  ]},
  { id: "thu", name: "Thursday", focus: "GAME DAY", exercises: [
    ex("Dynamic warm-up + leg swings", "Pre-game only", "No new lifting or heavy work today."),
    ex("Banded hip flexor activation", "2 x 10", "Wake up the swing leg."),
    ex("Build-up kicks", "During warm-ups", "Increasing intensity only."),
  ]},
  { id: "fri", name: "Friday", focus: "Balance / Lean Focus (no lifting)", exercises: [
    ex("Single-leg RDL to balance hold", "3 x 8 each leg", "No competing heavy lift today — go deeper on this."),
    ex("Lateral band walks", "3 x 12 steps each direction", "Extra focus day since legs aren't pre-fatigued."),
    ex("Side plank with hip dip", "3 x 10 each side", "Lateral core control."),
    ex("Foam roll + stretch", "10 min", "Hip flexors, groin, hamstrings, calves."),
  ]},
  { id: "sat", name: "Saturday", focus: "Power / Plyometrics", exercises: [
    ex("Box jumps", "4 x 5", "Focus on soft, balanced landings."),
    ex("Single-leg bounds", "3 x 6 each leg", "Explosive hip extension."),
    ex("Med ball rotational throws", "3 x 8 each side", "Full-body power transfer."),
    ex("Resisted knee drive", "3 x 10 each leg", "Leg speed with resistance."),
    ex("Technical kicking reps", "As scheduled", "Cue: lean chest/shoulder toward the ball as you plant."),
  ]},
  { id: "sun", name: "Sunday", focus: "Rest", exercises: [
    ex("Rest or light walk", "—", "No lifting, no plyo, no kicking."),
  ]},
];

function ex(name, sets, notes) {
  return {
    id: cryptoId(),
    name, sets, notes,
    status: "approved",
    proposed: null,
  };
}

function cryptoId() {
  return Math.random().toString(36).slice(2, 10);
}

function defaultState(token) {
  const now = new Date().toISOString();
  return {
    meta: { token, athleteName: "Athlete", createdAt: now, lastUpdated: now },
    days: DEFAULT_DAYS,
    logs: {},
    kickLog: [],
  };
}

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const url = new URL(req.url);
  const token = (url.searchParams.get("token") || "").trim();
  if (!token || !/^[a-zA-Z0-9_-]{4,64}$/.test(token)) {
    return new Response(JSON.stringify({ error: "Invalid or missing family code" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const store = getStore("kicker-app-data");
  const key = `state-${token}`;

  if (req.method === "GET") {
    let state = await store.get(key, { type: "json" });
    if (!state) {
      state = defaultState(token);
      await store.setJSON(key, state);
    }
    return new Response(JSON.stringify(state), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  if (req.method === "POST") {
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Bad JSON" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    body.meta = body.meta || {};
    body.meta.token = token;
    body.meta.lastUpdated = new Date().toISOString();
    await store.setJSON(key, body);
    return new Response(JSON.stringify({ ok: true, lastUpdated: body.meta.lastUpdated }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  return new Response("Method not allowed", { status: 405, headers: CORS });
};

export const config = { path: "/api/data" };
