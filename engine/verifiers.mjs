import { typeBlock, parseOptions } from './util.mjs';
const num = s => { const m = String(s ?? '').replace(/,/g, '').match(/-?\d+(\.\d+)?/); return m ? +m[0] : NaN; };
const lastNum = s => { const m = String(s).match(/-?\d+(\.\d+)?/g); return m ? +m[m.length - 1] : NaN; };
const ratio = s => { const m = String(s).match(/(\d+)\s*:\s*(\d+)/); return m ? +m[1] / +m[2] : NaN; };
const root2 = s => { const m = String(s).match(/^\s*(\d+)\s*(\d)\s*m/); return m ? +m[1] * Math.sqrt(+m[2]) : NaN; };
const words = s => ({ twice: 2, thrice: 3 })[String(s).match(/twice|thrice/)?.[0]] ?? NaN;
const h = 6.626e-34, me = 9.109e-31, e = 1.602e-19, c = 3e8;

export const VERIFIERS = {
  '68dea616d0cda73d07e93ae6': { what: 'flux through cube: face-centre q/2 (half enters) + corner 2q (1/8)', expected: ((0.5 * 0.5) + (2 / 8)) / 0.5 },
  '68e8734442c06737d6e56da4': { what: 'F-100µ=10 ; 2F-100µ=100', expected: (100 - 2 * 10) / 100 },
  '60f744b3f1b9bc7cc7b4a949': { what: 'V=√(VR²+(VL−VC)²)', expected: Math.hypot(40, 60 - 30) },
  '68e870ef42c06737d6e565c4': { what: 'P=ρv²/3', expected: 9e-2 * 400 ** 2 / 3 },
  '60f742f6660d187cc13a8078': { what: 'Z with L=95.5 mH (value taken from stored solution; stem omits it)', expected: Math.hypot(40, 2 * Math.PI * 50 * 0.0955) , tol: 0.02 },
  '696a866665252c04fc1f81c2': { what: 'ΔV=PV/B with edge 10 cm (stem omits it), in mm³', expected: 7e6 / 1.4e11 * 1e-3 * 1e9 },
  '68dea7c2387eea3d0d95f9bb': { what: 'YDSE shift (D/d)[t1(µ1-1)-t2(µ2-1)] in cm', expected: (1 / 5e-3) * (2e-3 * .5 - 1.5e-3 * .4) * 100 },
  '68dea577d0cda73d07e9391c': { what: 'V(R/2)−V(2R) for uniform sphere, V(R)=16', expected: 16 * (11 / 8 - 1 / 2) },
  '68dea619d0cda73d07e93aee': { what: 'relative angle 2π: (π/4−π/8)t²=2π', expected: Math.sqrt(2 * Math.PI / (Math.PI / 8)) },
  '68dea715387eea3d0d95f790': { what: '6a² =311.299 → 4 s.f. → 311.3; ×10', expected: Math.round(+(6 * 7.203 ** 2).toPrecision(4) * 10) },
  '6956d7bb23cb221e570d6013': { what: 'H=R ⇒ tanθ=4', expected: 4, keyed: lastNum },
  '6956d7e988d7701e5617bd3e': { what: 'v=Aω cos(ωt), ω=π/8, t=2 ⇒ A', expected: Math.PI / ((Math.PI / 8) * Math.cos(Math.PI / 4)), keyed: root2, tol: 0.01 },
  '636283dbe3770c24f866e6d6': { what: 'σ ∝ Q/R², Q=64q, R=4r', expected: 64 / 16, keyed: ratio },
  '6263d75bdd44e265ef926d97': { what: '800 g = 2 cm × a² × 1 g/cm³', expected: Math.sqrt(800 / 2) },
  '612151a6a34397610a9a2e58': { what: 'K=h²/(2mλ²), λ=0.3 nm, in eV', expected: h * h / (2 * me * 0.3e-9 ** 2) / e, tol: 0.02 },
  '68f21caf941cda588bc04365': { what: 'τ = t/ln(N0/N)=3/ln8', expected: 3 / Math.log(8), tol: 0.01 },
  '63765a28f1d8416ae0408d89': { what: '7/8 decayed = 3 half-lives × 60', expected: 180 },
  '5fc60508028950133eac8963': { what: 'static friction = mg (30 N max available ≥ 20 N)', expected: 20 },
  '68c801bc1b1dbc16dc93bf2b': { what: 'K=(eV/c)²/2m, V=24800', expected: (e * 24800 / c) ** 2 / (2 * me) / e, tol: 0.03 },
  '63c7cce12981ed154ee92c94': { what: 'i_d = kε0 A/d · dV/dt in µA', expected: 10 * 8.854e-12 * 1 / 1e-3 * 25 * 1e6, tol: 0.02 },
  '68c9ae5afb6b2f16e2d43b1c': { what: 'eV0 = 12400/4000 − 2.0', expected: 12400 / 4000 - 2.0 },
  '60ca4feb6420652745f55522': { what: '1.1×0.9 = 0.99', expected: 99 },
  '6062ec84518e9535e120c422': { what: 'γ=3α=3·0.19/(100·100) in 1e-5', expected: 3 * 0.19 / (100 * 100) * 1e5 },
  '68f21df0941cda588bc0470b': { what: 'p ∝ √KE', expected: 2, keyed: words },
  '68dea87d387eea3d0d95fbe3': { what: 'αV²+V−V0=0, α=1, V0=30', expected: (-1 + Math.sqrt(1 + 120)) / 2 },
  '622f08d7b70e4b50e4500a1b': { what: 'vCM = 10·14/14', expected: 10 * 14 / 14 },
  '68dea657387eea3d0d95f54a': { what: 'm=4, u=12.5 ⇒ v=50, f=10 cm, each lens 5 D', expected: 100 / (1 / (1 / 50 + 1 / 12.5)) / 2 },
  '68dea6e6387eea3d0d95f6f8': { what: 'displacement method image ratio', expected: ((150 + Math.sqrt(150 * (150 - 96))) / (150 - Math.sqrt(150 * (150 - 96)))) ** 2 },
  '6956d79788d7701e5617bc29': { what: 'φ=90° ⇒ P=0', expected: 0 },
};

export function keyedValue(q, v) {
  const b = typeBlock(q), f = v.keyed ?? num;
  if (q.questionType === 'integerQuestion') return num(b.answer);
  if (q.questionType === 'scq') return f(parseOptions(b.question)[b.answer]);
  const first = Array.isArray(b.answer) ? b.answer.join(',').match(/[A-D]/)?.[0] : null;
  return first ? f(parseOptions(b.question)[first]) : NaN;
}
export function expectedLetter(q, v) {
  const f = v.keyed ?? num, o = parseOptions(typeBlock(q).question), tol = v.tol ?? 1e-6;
  return Object.keys(o).filter(k => Math.abs(f(o[k]) - v.expected) <= tol * Math.max(1, Math.abs(v.expected))).join('') || null;
}

export function verify(q) {
  const v = VERIFIERS[q._id];
  if (!v) return null;
  const keyed = keyedValue(q, v), tol = v.tol ?? 1e-6;
  const match = Math.abs(keyed - v.expected) <= tol * Math.max(1, Math.abs(v.expected));
  return { what: v.what, expected: +v.expected.toFixed(4), keyed: Number.isNaN(keyed) ? null : +keyed.toFixed(4), keyMatches: match, expectedOption: q.questionType === 'integerQuestion' ? null : expectedLetter(q, v) };
}
